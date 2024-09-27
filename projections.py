import pandas as pd
import numpy as np
import datetime as dt
from datetime import datetime
from model_data import results
from predictions import home_goals, away_goals, schedule_left
import arviz as az

# Read in teams data
teams = pd.read_csv("formatting/teams.csv")

# Filter for current season results
results_current = results[results['Date'] > "2024-10-01"]

# Optimized simResults function using vectorized operations
def simResults(schedule, homeGoals, awayGoals, teams):
    # Initialize dictionaries for home and away points
    home_dict = {team: [] for team in teams['team']}
    away_dict = {team: [] for team in teams['team']}

    # Iterate over the schedule
    for i, row in schedule.iterrows():
        home_team = row['Home']
        away_team = row['Visitor']

        # Determine points based on goals using vectorized operations
        home_points = np.where(homeGoals[i] > awayGoals[i], 2, 
                       np.where(homeGoals[i] < awayGoals[i], 0, 1))
        away_points = np.where(homeGoals[i] < homeGoals[i], 2, 
                       np.where(homeGoals[i] > awayGoals[i], 0, 1))

        # Handle shootouts/overtimes in vectorized way
        draws = (homeGoals[i] == awayGoals[i])
        random_vals = np.random.uniform(low=0, high=1, size=homeGoals.shape[1])

        # Determine if it's a shootout or overtime
        shootout_mask = (draws & (random_vals < 0.344))
        overtime_mask = (draws & ~shootout_mask)

        shootout_winners = np.random.uniform(low=0, high=1, size=homeGoals.shape[1]) < 0.5
        home_points[shootout_mask] += shootout_winners * 1
        away_points[shootout_mask] += ~shootout_winners * 1

        overtime_winners = np.random.uniform(low=0, high=1, size=homeGoals.shape[1]) < 0.5
        home_points[overtime_mask] += overtime_winners * 1
        away_points[overtime_mask] += ~overtime_winners * 1

        # Append points for home and away teams
        home_dict[home_team].append(home_points)
        away_dict[away_team].append(away_points)

    return home_dict, away_dict

# Simulate results and calculate points
home_dict, away_dict = simResults(schedule_left, home_goals, away_goals, teams)

# Optimized summing of points using np.vstack
for key in home_dict:
    home_dict[key] = np.sum(np.vstack(home_dict[key]), axis=0)
    away_dict[key] = np.sum(np.vstack(away_dict[key]), axis=0)

# Combine home and away points into total_points
total_points = {key: home_dict[key] + away_dict[key] for key in home_dict}

# Optimized calcPoints function
def calcPoints(df, team_name):
    # Filter once for home and away matches
    is_home = df['Home'] == team_name
    is_away = df['Visitor'] == team_name

    # Use np.select for points calculation in a single step
    home_wins = np.select([is_home & (df['G.1'] > df['G'])], [2], default=0)
    home_otl = np.select([is_home & (df['G.1'] < df['G']) & df['Shootout'].notna()], [1], default=0)
    
    away_wins = np.select([is_away & (df['G'] > df['G.1'])], [2], default=0)
    away_otl = np.select([is_away & (df['G'] < df['G.1']) & df['Shootout'].notna()], [1], default=0)
    
    # Sum all points
    total_points = home_wins.sum() + home_otl.sum() + away_wins.sum() + away_otl.sum()
    return np.zeros(2000) + total_points

# Calculate and update points for each team
for team in teams["team"]:
    current_season_points = calcPoints(results_current, team)
    if team in total_points:
        total_points[team] += current_season_points
    else:
        total_points[team] = np.zeros(2000) + current_season_points

    # Convert to string format for storage
    total_points[team] = "[" + ",".join(map(str, total_points[team])) + "]"

# Conversion for storage
df_points = pd.DataFrame(list(total_points.items()), columns=['team', 'points'])

# Add a date column with today's date
df_points['date'] = datetime.today().strftime('%Y-%m-%d')

# Export the points to CSV
df_points.to_csv("data/point_projections_vector.csv", index=False)
