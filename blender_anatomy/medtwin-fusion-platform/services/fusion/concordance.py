"""
Core fusion logic — deliberately kept separate from main.py so it can be
unit tested without spinning up FastAPI. This is the module most worth
reviewing carefully: it owns the "never inflate confidence on missing
data" rule from the master prompt's Definition of Done.

NOTE (Phase 0/1 debt): label mapping is duplicated from
services/pulmonary/label_mapping.py here. Before adding organ 2, extract
both into a shared package (e.g. a small internal pip package or a
git submodule) rather than copy-pasting a third time — see README.md.
"""
from schemas import DomainResult, Finding

SEVERITY_SCORE = {"none": 0, "low": 25, "moderate": 50, "high": 75, "critical": 100}

# Duplicated from services/pulmonary/label_mapping.py — see module docstring.
LABEL_MAP = {
    "pneumonia": {
        "finding": "pneumonia",
        "system": "pulmonary",
        "severity_band": "moderate",
        "evidence": "opacity pattern consistent with pneumonia",
    },
    "normal": {
        "finding": "no_acute_finding",
        "system": "pulmonary",
        "severity_band": "none",
        "evidence": "no opacity detected",
    },
}


def map_domain_result_to_finding(result: DomainResult) -> Finding | None:
    if result.status != "ok" or result.label is None:
        return None
    entry = LABEL_MAP.get(result.label)
    if entry is None:
        return Finding(
            finding="unmapped_label",
            system="other",
            severity_band="none",
            confidence=0.0,
            source_models=[result.model_id],
            evidence=f"model returned unmapped label '{result.label}'",
        )
    return Finding(
        **entry,
        confidence=result.confidence or 0.0,
        source_models=[result.model_id],
    )


def compute_concordance(results: list[DomainResult]) -> str:
    ok_results = [r for r in results if r.status == "ok"]
    missing = [r for r in results if r.status != "ok"]

    if missing and not ok_results:
        return "DISCORDANT"  # nothing usable at all
    if missing:
        return "PARTIAL"  # some modalities missing/invalid — incomplete, not wrong

    # All present — check for disagreement among positive/negative findings
    # on the same body system. Phase 0 has only one domain so this branch
    # is a no-op until organ 2+ is wired; kept explicit rather than omitted
    # so the rule exists before it's needed.
    systems_seen: dict[str, set[str]] = {}
    for r in ok_results:
        entry = LABEL_MAP.get(r.label or "")
        if entry is None:
            continue
        systems_seen.setdefault(entry["system"], set()).add(entry["severity_band"])

    for bands in systems_seen.values():
        if "none" in bands and len(bands) > 1:
            return "DISCORDANT"

    return "CONCORDANT"


def compute_fusion_confidence(results: list[DomainResult]) -> float:
    ok_results = [r for r in results if r.status == "ok" and r.confidence is not None]
    if not results:
        return 0.0
    if not ok_results:
        return 0.0

    mean_confidence = sum(r.confidence for r in ok_results) / len(ok_results)
    completeness = len(ok_results) / len(results)  # THE discount for missing modalities
    return round(mean_confidence * completeness, 4)


def compute_risk_index(findings: list[Finding]) -> int:
    if not findings:
        return 0
    return max(SEVERITY_SCORE.get(f.severity_band, 0) for f in findings)


def compute_forecast(findings: list[Finding]) -> list[dict]:
    """Deliberately rule-based, not a learned time-series model, per
    spec section 6 — explainable until real longitudinal data exists."""
    if not findings:
        band, confidence = "none", 1.0
    else:
        worst = max(findings, key=lambda f: SEVERITY_SCORE.get(f.severity_band, 0))
        band, confidence = worst.severity_band, worst.confidence

    bands_order = ["none", "low", "moderate", "high", "critical"]
    idx = bands_order.index(band) if band in bands_order else 0
    escalated = bands_order[min(idx + 1, len(bands_order) - 1)]

    return [
        {"day": 0, "severity_band": band, "confidence": round(confidence, 2)},
        {"day": 7, "severity_band": band, "confidence": round(confidence * 0.8, 2)},
        {"day": 14, "severity_band": escalated, "confidence": round(confidence * 0.65, 2)},
    ]
