"""Train XGBoost heart risk model from heart.csv.

Usage:
    python train_xgb.py
"""
import os
import sys

# Resolve paths relative to this script's directory
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

os.environ.setdefault(
    "MEDTWIN_HEART_DATA_PATH",
    os.path.join(SCRIPT_DIR, "heart.csv"),
)
sys.path.insert(0, SCRIPT_DIR)

from cardio_ultra.data_prep.load_heart_data import load_heart_dataset
from cardio_ultra.models.train_heart_model import train_xgboost_heart_model, save_heart_model

def main():
    print("Loading dataset...")
    df = load_heart_dataset()
    print("Training model...")
    model, metrics = train_xgboost_heart_model(df)

    out_path = os.path.join(SCRIPT_DIR, "MedTwin", "artifacts", "xgb_heart_model.pkl")
    print(f"Saving model to {out_path}...")
    save_heart_model(model, metrics, out_path)
    print("Done!")

if __name__ == "__main__":
    main()
