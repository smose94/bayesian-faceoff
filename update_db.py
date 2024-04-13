import subprocess
import pandas as pd
from supabase import create_client, Client
import os
import toml

def load_config():
    # Check if environment variables are available
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_KEY')
    
    if supabase_url and supabase_key:
        # Return as dictionary if running in environments with environment variables (like GitHub Actions)
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
    supabase.table('countries')

    # Query to find the maximum id value
    result = supabase.table("team_strengths").select("id").order("id",desc=True).limit(1).execute()

    # Extract the max id value
    max_id = result.data[0]['id'] if result.data else 0
    # Add a new 'id' column starting from max_id + 1
    # Calculate the new 'id' column values
    new_ids = range(max_id + 1, max_id + 1 + len(df))

    # Insert the 'id' column as the leftmost column
    df.insert(loc=0, column='id', value=new_ids)

    response = supabase.table(table_name).insert(df.to_dict(orient='records')).execute()

def main():
    # Run your scripts
    run_script('build_data.py')
    run_script('model_data.py')

    # Load the output data (this is just an example, adjust according to your actual data source)
    df = pd.read_csv('data/team_ratings.csv')

    # Assuming your DataFrame 'df' is already formatted to match the 'team_strengths' table schema
    #print(df)
    upload_to_supabase(df, 'team_strengths')

if __name__ == "__main__":
    main()
