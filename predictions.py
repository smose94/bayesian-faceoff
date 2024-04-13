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
from model_data import baseline_mcmc, model, mcmc
teams = pd.read_csv("formatting/teams.csv")

#Set dt_time to today's date
dt_time = dt.datetime.today().strftime('%Y-%m-%d')

#As this runs at 12:01 GMT, we need to include any games that have the current date as well as
#they will be played that evening.
schedule_left = data_hr[data_hr['home_goal'].isna()]

#Define function to use posterior predictions and generate, for each game remaining, 2000 runs of home and away goals
def sim_schedule_left(schedule_left,mcmc, model):
    #Get current points for each teams in array
    
    try:
        #Get predictive samples from mcmc 
        post_samples = mcmc.get_samples()

        #Get the remaining schedule team codes
        games_left = schedule_left[['home_ix','away_ix']].copy()
        #No factor of decay for future games
        games_left['days_since'] = 0
        x_pred = games_left.values

        #Set numpyro predictive to create predictive samples
        predictive = Predictive(model, posterior_samples=post_samples, return_sites=['home_goals','away_goals'])
        samples_predictive = predictive(random.PRNGKey(0), x_pred, None, None)

        #print("extracting goals")
        #Extract the predicted goals for each game. This will return 2000 samples for each team in each game. 
        home_goals = jnp.array(samples_predictive["home_goals"]).T
        away_goals = jnp.array(samples_predictive["away_goals"]).T

    except:
        home_goals, away_goals = [],[]
    return home_goals, away_goals

#Get samples of home_goals and away_goals for each game left
home_goals, away_goals = sim_schedule_left(schedule_left, mcmc, model)

