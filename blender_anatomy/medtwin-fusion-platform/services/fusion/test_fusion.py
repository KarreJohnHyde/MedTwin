from schemas import DomainResult
from concordance import (
    compute_concordance,
    compute_fusion_confidence,
    map_domain_result_to_finding,
)

OK_RESULT = DomainResult(
    model_id="pulmonary.pneumonia_detection", status="ok", label="pneumonia", confidence=0.82
)
INVALID_RESULT = DomainResult(model_id="pulmonary.pneumonia_detection", status="invalid_input")
NORMAL_RESULT = DomainResult(
    model_id="pulmonary.pneumonia_detection", status="ok", label="normal", confidence=0.91
)


def test_concordance_all_ok():
    assert compute_concordance([OK_RESULT]) == "CONCORDANT"


def test_concordance_partial_on_missing_modality():
    assert compute_concordance([INVALID_RESULT]) == "DISCORDANT"  # only result, and it's missing
    assert compute_concordance([OK_RESULT, INVALID_RESULT]) == "PARTIAL"


def test_fusion_confidence_never_inflated_by_missing_modality():
    full_confidence = compute_fusion_confidence([OK_RESULT])
    partial_confidence = compute_fusion_confidence([OK_RESULT, INVALID_RESULT])
    # This is the regression test for the master prompt's core rule:
    # missing data must lower confidence, never leave it unchanged or raise it.
    assert partial_confidence < full_confidence


def test_fusion_confidence_zero_when_nothing_usable():
    assert compute_fusion_confidence([INVALID_RESULT]) == 0.0


def test_mapping_produces_source_models_for_traceability():
    finding = map_domain_result_to_finding(OK_RESULT)
    assert finding is not None
    assert finding.source_models == ["pulmonary.pneumonia_detection"]


def test_invalid_result_produces_no_finding():
    assert map_domain_result_to_finding(INVALID_RESULT) is None
