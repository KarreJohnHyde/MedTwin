import numpy as np
import pytest

from eval.metrics_dashboard import run_metrics_dashboard


def test_metrics_reports_undefined_auc_for_single_class_split():
    result = run_metrics_dashboard([1, 1], [0.2, 0.8])
    assert result["AUC-ROC"] is None
    assert result["F1-Score"] >= 0


def test_metrics_rejects_invalid_probabilities():
    with pytest.raises(ValueError, match="between 0 and 1"):
        run_metrics_dashboard([0, 1], [0.1, np.nan])


def test_fusion_transformer_returns_logits_and_normalized_probabilities():
    torch = pytest.importorskip("torch")
    from cloud.models.fusion.fusion_engine import MultiHeadCrossModalTransformer

    model = MultiHeadCrossModalTransformer(
        emb_dim=128, num_heads=4, num_layers=2, num_classes=3
    )
    v, e, n = torch.zeros(2, 1024), torch.zeros(2, 128), torch.zeros(2, 768)
    logits = model(v, e, n)
    assert logits.shape == (2, 3)
    assert torch.allclose(model.predict_proba(v, e, n).sum(dim=1), torch.ones(2))


def test_neurotwin_advanced_models_have_working_forwards():
    torch = pytest.importorskip("torch")
    from NeuroTwin.advanced_models import BrainMRIGenerator, BrainStrokeCNN, BrainTumorViT

    vit = BrainTumorViT(image_size=32, patch_size=8, emb_dim=24, depth=1, heads=4)
    assert vit(torch.zeros(1, 1, 32, 32)).shape == (1, 4)
    assert BrainMRIGenerator()(torch.zeros(1, 100)).shape == (1, 1, 64, 64)
    assert BrainStrokeCNN()(torch.zeros(1, 1, 32, 32)).shape == (1, 2)
