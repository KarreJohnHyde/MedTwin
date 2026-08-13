import boto3
import json
import os
from botocore.exceptions import ClientError

def create_dynamodb_table(table_name="CardioUltraPatients", region_name="us-east-1", endpoint_url=None):
    """
    Creates a DynamoDB table for Cardio-Ultra patient data.
    Partition Key: PatientID (String)
    Sort Key: Timestamp (String)
    """
    # Use endpoint_url for local DynamoDB testing (e.g., LocalStack or DynamoDB Local)
    dynamodb = boto3.resource('dynamodb', region_name=region_name, endpoint_url=endpoint_url)

    try:
        table = dynamodb.create_table(
            TableName=table_name,
            KeySchema=[
                {
                    'AttributeName': 'PatientID',
                    'KeyType': 'HASH'  # Partition key
                },
                {
                    'AttributeName': 'Timestamp',
                    'KeyType': 'RANGE'  # Sort key
                }
            ],
            AttributeDefinitions=[
                {
                    'AttributeName': 'PatientID',
                    'AttributeType': 'S'
                },
                {
                    'AttributeName': 'Timestamp',
                    'AttributeType': 'S'
                }
            ],
            ProvisionedThroughput={
                'ReadCapacityUnits': 10,
                'WriteCapacityUnits': 10
            }
        )
        print(f"Creating table {table_name}...")
        table.wait_until_exists()
        print(f"Table {table_name} created successfully.")
        return table
    except ClientError as e:
        if e.response['Error']['Code'] == 'ResourceInUseException':
            print(f"Table {table_name} already exists.")
            return dynamodb.Table(table_name)
        else:
            print(f"Unexpected error: {e}")
            raise

def setup_local_mock_db(filepath="local_mock_db.json"):
    """
    Sets up a local JSON file to act as a mock database for initial testing 
    without AWS credentials.
    """
    if not os.path.exists(filepath):
        with open(filepath, 'w') as f:
            json.dump({"patients": {}}, f)
        print(f"Created local mock database at {filepath}")
    else:
        print(f"Mock database already exists at {filepath}")

if __name__ == "__main__":
    print("Initializing Cardio-Ultra Database Infrastructure...")
    
    # 1. Setup local mock DB for immediate local testing
    setup_local_mock_db(filepath="local_mock_db.json")
    
    # 2. Setup AWS DynamoDB (Requires AWS credentials to be configured)
    # Uncomment to run against AWS or LocalStack
    # create_dynamodb_table()
    
    print("Database setup complete.")
