#Read in packages
from build_data import data_hr
import pandas as pd
import datetime as dt
import numpyro
import numpyro.distributions as dist
import jax.numpy as jnp
from jax import random
from numpyro.infer import MCMC, NUTS, Predictive
import arviz as az



#Set dt_time to today's date
dt_time = dt.datetime.today().strftime('%Y-%m-%d')

# Filter rows where 'Date' is before dt_time using boolean indexing
results = data_hr[data_hr['Date'] < dt_time].copy()

#Create new column 'days_since' as we'll need it for decay_rate in the model
results['days_since'] = (results['Date'].max() - results['Date']).dt.days

#Get number of unique teams in data - should be 32
n_teams = data_hr['Home'].nunique()

#Set intial decay factor 0.005 is a good first guess
decay_factor = 0.005

#Define the bradley-terry model
def model(data_in,y_1=None,y_2=None):
    home = numpyro.sample("home", dist.Normal(1,0.1))
    intercept = numpyro.sample("intercerpt", dist.Normal(1,0.1))

    #Decay rate based on time since game - will be able to tweak factor for better performance
    decay_rate = jnp.exp(-decay_factor*data_in[:,2])


    #Attack Ratings
    tau_att = numpyro.sample("tau_att", dist.Gamma(0.1,0.1))
    atts_star = numpyro.sample("atts_star", dist.Normal(0, tau_att),sample_shape=(n_teams,))

    #Defense Ratings
    tau_def = numpyro.sample("tau_def", dist.Gamma(0.1,0.1))
    defs_star = numpyro.sample("defs_star", dist.Normal(0, tau_def),sample_shape=(n_teams,))

    #Apply zero-sum constraints
    atts = numpyro.deterministic("atts", atts_star - jnp.mean(atts_star))
    defs = numpyro.deterministic("defs", defs_star - jnp.mean(defs_star))

    #Calculate lambdas

    home_lambda = jnp.exp(intercept + home + atts[data_in[:,0]] + defs[data_in[:,1]])
    away_lambda = jnp.exp(intercept + atts[data_in[:,1]] + defs[data_in[:,0]])
    #Goal Expectation
    with numpyro.plate('n', len(data_in)),numpyro.handlers.scale(scale=decay_rate):
        home_goals = numpyro.sample("home_goals", dist.Poisson(home_lambda),obs=y_1)
        away_goals = numpyro.sample("away_goals", dist.Poisson(away_lambda),obs=y_2)

#Set up data for input into model
data_in = results[['home_ix','away_ix','days_since']].values
y_1 = results['home_score'].values
y_2 = results['away_score'].values


#Run model for the most updated fixtures e.g. current skill level
rng_key = random.PRNGKey(0)
rng_key, rng_key_ = random.split(rng_key)
num_samples =  2000
kernel = NUTS(model)
mcmc = MCMC(kernel, num_warmup=1000, num_samples=num_samples)
mcmc.run(rng_key,data_in = data_in, y_1=y_1,y_2=y_2)

#import team names for arviz
teams = pd.read_csv("formatting/teams.csv")
#Convert object to arviz for easier processing
baseline_mcmc = az.from_numpyro(mcmc, coords={"atts_star_dim_0": teams['team'], "defs_star_dim_0":teams['team']})

# Calculate mean attack and defense ratings from the posterior
att_mean = baseline_mcmc.posterior["atts_star"].values.reshape(-1, 32).mean(axis=0)
def_mean = baseline_mcmc.posterior["defs_star"].values.reshape(-1, 32).mean(axis=0)

team_ratings_df = pd.DataFrame({
    'Team': teams['team'],
    'Mean Attack Rating': att_mean,
    'Mean Defense Rating': def_mean,
    'Date': dt_time
})

team_ratings_df.to_csv("data/team_ratings.csv",index=False)