"""Train a local, versioned XGBoost heart-risk research artifact.

Example:
  python scripts/train_heart_risk.py --data C:\\Users\\johnn\\Downloads\\heart.csv
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from cardio_ultra.models.train_heart_model import save_heart_model, train_xgboost_heart_model


def main() -> None:
    parser = argparse.ArgumentParser(description="Train a deduplicated heart-disease XGBoost baseline")
    parser.add_argument("--data", type=Path, required=True, help="CSV with the documented 13 features and binary target")
    parser.add_argument("--output", type=Path, default=Path("artifacts/heart_xgboost.joblib"))
    args = parser.parse_args()
    if not args.data.is_file():
        parser.error(f"Dataset not found: {args.data}")

    import pandas as pd

    model, metrics = train_xgboost_heart_model(pd.read_csv(args.data))
    output = save_heart_model(model, metrics, args.output)
    print(json.dumps({"artifact": str(output), "metrics": metrics}, indent=2))


if __name__ == "__main__":
    main()
