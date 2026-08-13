from __future__ import annotations

import unittest

from pydantic import ValidationError

from inference.fusion_engine import build_result
from inference.service import InferenceRequest


class InferenceContractTests(unittest.TestCase):
    def test_result_contains_governed_research_contract(self) -> None:
        result = build_result(
            {
                "anatomy": "lungs",
                "threshold": 0.66,
                "horizon": 7,
                "volume_summary": {
                    "format": "nifti",
                    "dimensions": [64, 64, 32],
                    "spacing": [1.0, 1.0, 1.5],
                    "normalized_contrast": 0.52,
                    "voxel_count": 131072,
                },
            }
        )
        self.assertEqual(len(result["models"]), 5)
        self.assertEqual(len(result["forecast"]), 8)
        self.assertTrue(result["audit"]["volume_context_used"])
        self.assertEqual(result["audit"]["identity_fields_processed"], 0)
        self.assertEqual(result["models"][0]["approval"], "research-only")
        self.assertEqual(result["validation"]["metric_scope"], "synthetic validation cohort")

    def test_service_schema_rejects_identity_fields(self) -> None:
        with self.assertRaises(ValidationError):
            InferenceRequest.model_validate({"anatomy": "heart", "patient_name": "blocked"})


if __name__ == "__main__":
    unittest.main()
