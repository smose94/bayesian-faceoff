#Read in packages
import pandas as pd
import datetime as dt
import numpy as np
import arviz as az
from model_data import results
from predictions import home_goals, away_goals, schedule_left
from datetime import datetime

teams = pd.read_csv("formatting/teams.csv")
#schedule_left = pd.read_csv("data/schedule_left.csv")
#data_archived = np.load('data/arrays.npz')
#home_goals = data_archived["home_goals"]
#away_goals = data_archived["away_goals"]
results_current = results[results['Date'] > "2023-10-01"]


#Next we need to sort out poi
def simResults(schedule, homeGoals, awayGoals, teams):



    home_dict = dict.fromkeys(teams['team'])
    away_dict = dict.fromkeys(teams['team'])
    
    for team in teams['team']:
        home_dict[team] = []
        away_dict[team] = []

    for i in range(len(schedule)):
        home_team = schedule.iloc[i]['Home']
        away_team = schedule.iloc[i]['Visitor']
        
        homePoints = np.zeros(homeGoals.shape[1])
        awayPoints = np.zeros(awayGoals.shape[1])

        for j in range(homeGoals.shape[1]):

            if homeGoals[i][j] > awayGoals[i][j]:
                homePoints[j] = 2
            elif homeGoals[i][j] < awayGoals[i][j]:
                awayPoints[j] = 2
            else:  # This implies a draw
                homePoints[j] = 1
                awayPoints[j] = 1
                # Now, determine SO or OT
                if np.random.uniform(low=0, high=1) < 0.344:  # Chance of going to shootout
                    note = 'SO'
                    if np.random.uniform(low=0, high=1) < 0.5:
                        homePoints[j] = 2  # Home wins in shootout
                        awayPoints[j] = 1
                    else:
                        homePoints[j] = 1
                        awayPoints[j] = 2  # Away wins in shootout
                else:
                    note = 'OT'
                    if np.random.uniform(low=0, high=1) < 0.5:
                        homePoints[j] = 2  # Home wins in overtime
                        awayPoints[j] = 1
                    else:
                        homePoints[j] = 1
                        awayPoints[j] = 2  # Away wins in overtime



        home_dict[home_team].append(homePoints)
        away_dict[away_team].append(awayPoints)

    return home_dict, away_dict

home_dict, away_dict = simResults(schedule_left, home_goals, away_goals, teams)

for key in home_dict:
    home_dict[key] = np.array(home_dict[key]).sum(axis=0)
    away_dict[key] = np.array(away_dict[key]).sum(axis=0)


# Now, combine the results into a single dictionary
total_points = {}
for key in home_dict:
    # This will add the points from home and away matches
    # It assumes all keys in home_dict are also in away_dict
    total_points[key] = home_dict[key] + away_dict[key]

import numpy as np

def calcPoints(df, team_name):
    # Filter data once per team (more efficient than twice if data is large)
    is_home = df['Home'] == team_name
    is_away = df['Visitor'] == team_name

    # Home team points calculation
    home_wins = np.where((is_home) & (df['G.1'] > df['G']), 2, 0)
    home_otl = np.where((is_home) & (df['G.1'] < df['G']) & (df['Shootout'].notna()), 1, 0)

    # Away team points calculation
    away_wins = np.where((is_away) & (df['G'] > df['G.1']), 2, 0)
    away_otl = np.where((is_away) & (df['G'] < df['G.1']) & (df['Shootout'].notna()), 1, 0)

    # Summing all points
    total_points = np.sum(home_wins) + np.sum(home_otl) + np.sum(away_wins) + np.sum(away_otl)
    return total_points

# Calculate and update points for each team
for team in teams["team"]:
    current_season_points = calcPoints(results_current, team)
    if team in total_points:
        total_points[team] += current_season_points
    else:
        total_points[team] = current_season_points
    total_points[team] = "[" + ",".join(map(str, total_points[team])) + "]"



#Conversion for storage
df_points = pd.DataFrame(list(total_points.items()), columns=['team', 'points'])

# Add a date column with today's date
df_points['date'] = datetime.today().strftime('%Y-%m-%d')


df_points.to_csv("data/point_projections.csv", index=False)