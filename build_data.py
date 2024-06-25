import pandas as pd
import numpy as np

#Read in teams data for later use
teams = pd.read_csv("formatting/teams.csv")

# Initialize an empty DataFrame to store all data
data_hr = pd.DataFrame()

for year in range(2022, 2025):  # Loop from 2022 to 2024 inclusive
    url = f'https://www.hockey-reference.com/leagues/NHL_{year}_games.html'
    data_year = pd.read_html(url)
    
    # Assuming the table you're interested in is the first one
    df_year = data_year[0]
    
    # Renaming 'Unnamed: 5' to 'Shootout'
    df_year = df_year.rename(columns={'Unnamed: 6': 'Shootout'})
    
    # Adding a column for the season year
    df_year['Season'] = year
    
    # Concatenating the yearly data to the main DataFrame
    data_hr = pd.concat([data_hr, df_year], ignore_index=True)

#Convert 'Date column to datetime'
data_hr['Date'] = pd.to_datetime(data_hr['Date'])

# Creating 'home_score' and 'away_score' columns
data_hr['home_score'] = data_hr['G.1']
data_hr['away_score'] = data_hr['G']

# Adjusting scores based on 'Shootout'
# Loop through each row to check for shootout condition and adjust scores
for index, row in data_hr.iterrows():
    if pd.notnull(row['Shootout']):  # Check if 'Shootout' is not NaN
        # Find the max score to determine the winner in shootout cases
        max_score = max(row['home_score'], row['away_score'])
        
        # If it's a shootout, the winning score should be reduced by 1
        # since one goal is added to the winning team's score in a shootout win
        if row['home_score'] == max_score:
            data_hr.at[index, 'home_score'] = row['home_score'] - 1
        else:
            data_hr.at[index, 'away_score'] = row['away_score'] - 1

#Create new columns home_ix, away_ix which provides corresponding team index for each match
data_hr = (
    data_hr.merge(teams[['team','team_index']], left_on="Home", right_on="team")
    .rename(columns={"team_index": "home_ix"})
    .drop(["team"], axis=1)
    .merge(teams[['team','team_index']], left_on="Visitor", right_on="team")
    .rename(columns={"team_index": "away_ix"})
    .drop(["team"], axis=1)
)




