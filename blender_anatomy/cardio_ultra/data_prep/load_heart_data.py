"""
CardioUltra: Heart Disease Dataset Loader
Fetches the Kaggle dataset via kagglehub (johnsmith88/heart-disease-dataset).
"""

import logging
import os
from pathlib import Path

logger = logging.getLogger("cardio_ultra.data")

try:
    import kagglehub
    from kagglehub import KaggleDatasetAdapter
    import pandas as pd
except ImportError:
    kagglehub = None
    KaggleDatasetAdapter = None
    pd = None

def load_heart_dataset(file_path=None):
    """
    Downloads and loads the Heart Disease dataset into a Pandas DataFrame.
    """
    local_path = Path(file_path or os.getenv("MEDTWIN_HEART_DATA_PATH", ""))
    if str(local_path) and local_path.is_file():
        if pd is None:
            raise RuntimeError("pandas is required to load the local heart-disease dataset")
        logger.info("Loading local heart dataset from %s", local_path)
        return pd.read_csv(local_path)
    if kagglehub is None:
        raise RuntimeError("Set MEDTWIN_HEART_DATA_PATH or install kagglehub and pandas to load the heart-disease dataset")
    logger.info("Loading 'johnsmith88/heart-disease-dataset'")
    try:
        df = kagglehub.load_dataset(
            KaggleDatasetAdapter.PANDAS,
            "johnsmith88/heart-disease-dataset",
            file_path,
        )
        
        # Display the 14 features requested
        expected_features = [
            "age", "sex", "cp", "trestbps", "chol", "fbs", "restecg", 
            "thalach", "exang", "oldpeak", "slope", "ca", "thal", "target"
        ]
        
        missing = set(expected_features) - set(df.columns)
        if missing:
            raise ValueError(f"Downloaded dataset is missing expected columns: {sorted(missing)}")
        logger.info("Loaded heart dataset with %d rows", len(df))
        return df
    except Exception as e:
        raise RuntimeError(f"Unable to load heart-disease dataset: {e}") from e

if __name__ == "__main__":
    df = load_heart_dataset()
