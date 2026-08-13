"""Deterministic multimodel research simulator for the MedTwin interface.

This module intentionally uses no identity, record, or protected-health fields.
Its outputs demonstrate orchestration and visualization contracts; they are not
validated medical predictions and must not be used for clinical decisions.
"""

from __future__ import annotations

import argparse
import json
import math
import random
import sys
from typing import Any

try:
    from inference.model_registry import MODEL_CATALOG
except ModuleNotFoundError:  # Direct script execution keeps only this folder on sys.path.
    from model_registry import MODEL_CATALOG


ANATOMY_CONTEXT = {
    "heart": ("Myocardial perfusion irregularity", [0.24, 0.18, 0.16]),
    "brain": ("Focal tissue alteration", [-0.22, 0.27, 0.18]),
    "nervous": ("Conduction discontinuity pattern", [0.08, -0.08, 0.12]),
    "skeletal": ("Cortical stress response", [0.22, -0.31, 0.08]),
    "lungs": ("Inflammatory opacity pattern", [-0.28, 0.11, 0.16]),
    "renal": ("Parenchymal perfusion change", [0.25, -0.12, 0.1]),
    "digestive": ("Localized tissue thickening", [-0.16, -0.2, 0.2]),
}


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def _validation_contract(rng: random.Random, probability: float, threshold: float) -> dict[str, Any]:
    calibration = []
    precision_recall = []
    decision_curve = []
    for index in range(11):
        predicted = index / 10
        observed = clamp(predicted * 0.94 + 0.025 + rng.uniform(-0.015, 0.015))
        calibration.append({"predicted": round(predicted, 3), "observed": round(observed, 3)})
        recall = index / 10
        precision = clamp(0.96 - recall * 0.28 + 0.035 * math.sin(index / 1.8))
        precision_recall.append({"recall": round(recall, 3), "precision": round(precision, 3)})
        operating_threshold = 0.05 + index * 0.085
        net_benefit = clamp(probability * (1 - operating_threshold) - 0.04, -0.1, 0.8)
        treat_all = clamp(0.46 - operating_threshold * 0.62, -0.1, 0.8)
        decision_curve.append(
            {
                "threshold": round(operating_threshold, 3),
                "model": round(net_benefit, 4),
                "treat_all": round(treat_all, 4),
                "treat_none": 0.0,
            }
        )

    subgroup_names = ["Acquisition A", "Acquisition B", "Protocol T1", "Protocol T2"]
    subgroups = []
    for index, name in enumerate(subgroup_names):
        auc = clamp(0.91 + rng.uniform(-0.025, 0.025) - index * 0.003)
        subgroups.append(
            {
                "name": name,
                "n": 128 + index * 32,
                "auc": round(auc, 3),
                "lower": round(clamp(auc - 0.045), 3),
                "upper": round(clamp(auc + 0.039), 3),
            }
        )

    drift = []
    for window in range(12):
        psi = clamp(0.035 + window * 0.006 + rng.uniform(-0.01, 0.012), 0, 0.3)
        drift.append(
            {
                "window": window + 1,
                "psi": round(psi, 4),
                "ks": round(clamp(psi * 1.6 + 0.018), 4),
                "status": "review" if psi >= 0.15 else "stable",
            }
        )

    return {
        "metric_scope": "synthetic validation cohort",
        "sample_size": 640,
        "prevalence": round(clamp(probability * 0.42), 3),
        "operating_threshold": round(threshold, 3),
        "calibration": calibration,
        "precision_recall": precision_recall,
        "decision_curve": decision_curve,
        "subgroups": subgroups,
        "drift": drift,
        "approval_history": [
            {"version": "0.8.0", "status": "archived", "date": "2026-02-18"},
            {"version": "0.9.0", "status": "research-review", "date": "2026-05-03"},
            {"version": "1.0.0", "status": "research-only", "date": "2026-08-01"},
        ],
    }


def build_result(payload: dict[str, Any]) -> dict[str, Any]:
    anatomy = str(payload.get("anatomy", "heart"))
    threshold = clamp(float(payload.get("threshold", 0.65)), 0.1, 0.95)
    horizon = int(payload.get("horizon", 12))
    seed = int(payload.get("seed", 24)) + sum(ord(char) for char in anatomy)
    rng = random.Random(seed)
    models = MODEL_CATALOG[anatomy]
    volume_summary = payload.get("volume_summary") or {}
    volume_signal = min(0.035, float(volume_summary.get("normalized_contrast", 0.0)) * 0.02)
    base_signal = 0.67 + rng.uniform(-0.035, 0.045) + volume_signal

    model_results = []
    weighted_probability = 0.0
    for index, model in enumerate(models):
        probability = clamp(base_signal + rng.uniform(-0.085, 0.075) - index * 0.006)
        calibration = clamp(0.97 - rng.uniform(0.015, 0.055))
        contribution = probability * model.weight * calibration
        weighted_probability += contribution
        model_results.append(
            {
                "name": model.name,
                "family": model.family,
                "version": model.version,
                "artifact_status": model.artifact_status,
                "dataset_contract": model.dataset_contract,
                "intended_use": model.intended_use,
                "output_contract": model.output_contract,
                "approval": model.approval,
                "weight": round(model.weight, 3),
                "probability": round(probability, 4),
                "contribution": round(contribution, 4),
                "auc_roc": round(model.auc, 3),
                "pr_auc": round(model.pr_auc, 3),
                "sensitivity": round(clamp(model.auc - rng.uniform(0.025, 0.055)), 3),
                "specificity": round(clamp(model.auc - rng.uniform(0.018, 0.05)), 3),
                "f1": round(clamp(model.auc - rng.uniform(0.022, 0.052)), 3),
                "brier_score": round(clamp(0.08 + rng.uniform(-0.012, 0.018)), 4),
                "calibration_slope": round(0.98 + rng.uniform(-0.06, 0.05), 3),
                "calibration_intercept": round(rng.uniform(-0.04, 0.04), 3),
                "ood_score": round(clamp(0.08 + rng.uniform(-0.025, 0.05)), 4),
                "latency_ms": model.latency_ms + rng.randint(-3, 5),
                "status": "contributing" if probability >= threshold else "below-threshold",
            }
        )

    fusion_probability = clamp(weighted_probability / sum(model.weight for model in models))
    entropy = -sum(
        probability * math.log2(max(probability, 1e-9))
        for probability in (fusion_probability, 1 - fusion_probability)
    )
    disagreement = max(item["probability"] for item in model_results) - min(
        item["probability"] for item in model_results
    )
    label, coordinate = ANATOMY_CONTEXT[anatomy]

    markers = []
    for index in range(3):
        probability = clamp(fusion_probability - index * 0.105 + rng.uniform(-0.025, 0.025))
        markers.append(
            {
                "id": f"roi-{index + 1}",
                "label": label if index == 0 else f"Adjacent ROI {index + 1}",
                "probability": round(probability, 4),
                "confidence": round(clamp(0.92 - entropy * 0.16 - index * 0.055), 4),
                "coordinate": [
                    round(coordinate[0] + rng.uniform(-0.16, 0.16) * index, 3),
                    round(coordinate[1] + rng.uniform(-0.13, 0.13) * index, 3),
                    round(coordinate[2] + rng.uniform(-0.12, 0.12) * index, 3),
                ],
                "visible": probability >= threshold,
            }
        )

    forecast = []
    direction = 0.012 if fusion_probability >= threshold else -0.008
    for day in range(horizon + 1):
        curve = direction * day + 0.018 * math.sin(day / 2.1) + rng.uniform(-0.006, 0.006)
        expected = clamp(fusion_probability + curve)
        uncertainty = 0.025 + day * 0.0065
        forecast.append(
            {
                "day": day,
                "expected": round(expected, 4),
                "lower": round(clamp(expected - uncertainty), 4),
                "upper": round(clamp(expected + uncertainty), 4),
                "spread": round(clamp(0.16 + day * 0.035 + expected * 0.18), 4),
            }
        )

    return {
        "status": "complete",
        "mode": "synthetic-research-simulation",
        "anatomy": anatomy,
        "threshold": round(threshold, 3),
        "fusion": {
            "probability": round(fusion_probability, 4),
            "decision": "review" if fusion_probability >= threshold else "monitor",
            "entropy": round(entropy, 4),
            "disagreement": round(disagreement, 4),
            "calibration_error": round(0.028 + rng.uniform(0.0, 0.018), 4),
            "auc_roc": round(sum(model.auc * model.weight for model in models), 3),
        },
        "models": model_results,
        "markers": markers,
        "forecast": forecast,
        "validation": _validation_contract(rng, fusion_probability, threshold),
        "constraints": [
            "Synthetic inputs only; no identity-bearing data are accepted or stored.",
            "Spatial points are visualization anchors, not validated lesion localization.",
            "Forecast uncertainty expands with horizon and must be reviewed with source evidence.",
            "Outputs are research decision-support simulations, not diagnoses.",
        ],
        "audit": {
            "engine": "multimodel-late-fusion-v1",
            "model_count": len(models),
            "forecast_method": "ARIMA + temporal LSTM simulation",
            "roi_method": "R-CNN / U-Net visualization contract",
            "identity_fields_processed": 0,
            "volume_context_used": bool(volume_summary),
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        result = build_result({"anatomy": "brain", "threshold": 0.65, "horizon": 12})
        assert result["status"] == "complete"
        assert len(result["forecast"]) == 13
        assert result["audit"]["identity_fields_processed"] == 0
        print("fusion engine self-test passed")
        return
    payload = json.load(sys.stdin)
    print(json.dumps(build_result(payload), separators=(",", ":")))


if __name__ == "__main__":
    main()
