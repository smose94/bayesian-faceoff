import subprocess
import pandas as pd
import datetime
from supabase import create_client, Client
import os
import toml

def load_config():
    # Check if environment variables are available
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_KEY')
    
    if supabase_url and supabase_key:
        # Return as dictionary for GitHub Actions
        return {
            "supabase": {
                "url": supabase_url,
                "key": supabase_key
            }
        }
    else:
        with open("config.toml", "r") as file:
            config = toml.load(file)
        return config


config = load_config()
supabase_url = config["supabase"]["url"]
supabase_key = config["supabase"]["key"]

def run_script(script_path):
    """Function to run a Python script."""
    subprocess.run(['python', script_path], check=True)

def upload_to_supabase(df, table_name):
    """Upload DataFrame to Supabase table."""

    supabase: Client = create_client(supabase_url, supabase_key)

    # Query to find the maximum id value
    result = supabase.table(table_name).select("id").order("id",desc=True).limit(1).execute()

    # Extract the max id value
    max_id = result.data[0]['id'] if result.data else 0
    # Add a new 'id' column starting from max_id + 1
    # Calculate the new 'id' column values
    new_ids = range(max_id + 1, max_id + 1 + len(df))

    # Insert the 'id' column as the leftmost column
    df.insert(loc=0, column='id', value=new_ids)

    response = supabase.table(table_name).insert(df.to_dict(orient='records')).execute()

def create_team_stats_table(data_hr, teams_df):
    """
    Create a table that tracks each team's wins, losses, OT/SO results, and regulation wins on each date.
    Only tracks results from the latest season.
    
    Parameters:
    data_hr (DataFrame): DataFrame containing game results
    teams_df (DataFrame): DataFrame containing team information
    
    Returns:
    DataFrame: A DataFrame with team stats on each date
    """
    import pandas as pd
    import numpy as np
    
    # Filter for the latest season only
    latest_season = data_hr['Season'].max()
    data_hr = data_hr[data_hr['Season'] == latest_season].copy()
    
    # Sort data by date
    data_hr = data_hr.sort_values('Date')
    
    # Create a list to store team stats for each date
    team_stats_list = []
    
    # Initialize a dictionary to track cumulative stats for each team
    team_cumulative_stats = {}
    for idx, team_row in teams_df.iterrows():
        team_idx = team_row['team_index']
        team_cumulative_stats[team_idx] = {
            'wins': 0, 
            'regulation_wins': 0, 
            'losses': 0, 
            'ot': 0, 
            'team_name': team_row['team']
        }
    
    # Get unique dates
    unique_dates = data_hr['Date'].unique()
    
    # Process games date by date
    for date in unique_dates:
        # Get games for this date
        date_games = data_hr[data_hr['Date'] == date]
        
        # Process each game
        for _, game in date_games.iterrows():
            home_idx = game['home_ix']
            away_idx = game['away_ix']
            
            # Get the original score values
            home_score = game['G.1']  # Using the original G.1 column
            away_score = game['G']    # Using the original G column
            
            # Check if the game went to overtime/shootout
            # The 'Shootout' column contains 'OT' for overtime and 'SO' for shootout, blank for regulation
            is_ot_so = False
            if 'Shootout' in game.index and pd.notnull(game['Shootout']):
                is_ot_so = True
            
            # Handle potential ties in the data (which should be resolved if it's OT/SO)
            if home_score == away_score:
                # In the NHL, ties don't exist anymore, so this is likely a data issue
                # If it's marked as OT/SO, we need to determine a winner based on other data
                if is_ot_so:
                    # Look for other indications of who won in the shootout
                    # For now, skip these games as they need data correction
                    print(f"Warning: Equal score found in OT/SO game on {date}: {game['Home']} vs {game['Visitor']}. Skipping.")
                    continue
                else:
                    # This might be a game in progress or other data issue
                    print(f"Warning: Unexpected tie game found on {date}: {game['Home']} vs {game['Visitor']}. Skipping.")
                    continue
            
            # Update team stats based on game result
            if home_score > away_score:
                # Home team won
                team_cumulative_stats[home_idx]['wins'] += 1
                if not is_ot_so:
                    # It's a regulation win
                    team_cumulative_stats[home_idx]['regulation_wins'] += 1
                    team_cumulative_stats[away_idx]['losses'] += 1
                else:
                    # Away team gets an OT loss
                    team_cumulative_stats[away_idx]['ot'] += 1
            elif away_score > home_score:
                # Away team won
                team_cumulative_stats[away_idx]['wins'] += 1
                if not is_ot_so:
                    # It's a regulation win
                    team_cumulative_stats[away_idx]['regulation_wins'] += 1
                    team_cumulative_stats[home_idx]['losses'] += 1
                else:
                    # Home team gets an OT loss
                    team_cumulative_stats[home_idx]['ot'] += 1
        
        # After processing all games for this date, append cumulative stats to the list
        for team_idx, stats in team_cumulative_stats.items():
            team_stats_list.append({
                'date': date,
                'team_index': team_idx,
                'team_name': stats['team_name'],
                'wins': stats['wins'],
                'regulation_wins': stats['regulation_wins'],
                'losses': stats['losses'],
                'ot': stats['ot'],
                # Calculate points: 2 points for each win (regulation or OT/SO) + 1 point for each OT/SO loss
                'points': (stats['wins'] * 2) + stats['ot'],
                # Add season for reference
                'season': latest_season
            })
    
    # Convert the list to a DataFrame
    team_stats_df = pd.DataFrame(team_stats_list)
    
    return team_stats_df

def get_latest_standings(team_stats_df):
    """
    Get the latest standings with today's date.
    
    Parameters:
    team_stats_df (DataFrame): Full historical team stats
    
    Returns:
    DataFrame: Only the latest standings with today's date
    """
    # If team_stats_df is empty, return empty DataFrame
    if team_stats_df.empty:
        return team_stats_df
    
    # Get the latest date in the data
    latest_date = team_stats_df['date'].max()
    
    # Filter for just the latest standings
    latest_standings = team_stats_df[team_stats_df['date'] == latest_date].copy()
    
    # Update the date to today
    today = pd.Timestamp(datetime.date.today())
    latest_standings['date'] = today
    
    return latest_standings

def main():
    # Run your scripts
    run_script('build_data.py')
    #run_script('model_data.py')
    run_script('projections.py')

    # Load the teams data
    teams = pd.read_csv("formatting/teams.csv")
    
    # Import directly from build_data
    import build_data
    data_hr = build_data.data_hr
    
    # Create complete team stats table with historical data
    team_stats_df = create_team_stats_table(data_hr, teams)
    
    # Save full historical stats to CSV for reference
    team_stats_df.to_csv("data/team_stats_full.csv", index=False)
    
    # Get only the latest standings with today's date
    latest_standings = get_latest_standings(team_stats_df)
    
    # Save latest standings to a separate CSV for reference
    latest_standings.to_csv("data/team_stats_latest.csv", index=False)
    
    # Upload only the latest standings (32 records) to Supabase
    upload_to_supabase(latest_standings, 'team_standings')

    # Load the output data 
    df_ratings = pd.read_csv('data/team_ratings.csv')

    #Upload team strengths
    upload_to_supabase(df_ratings, 'team_strengths')

    #Now get df for point projections
    df_projections = pd.read_csv("data/point_projections.csv")
    #Now upload point projections
    upload_to_supabase(df_projections, 'team_points')

if __name__ == "__main__":
    main()