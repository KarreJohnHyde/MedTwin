"""Versioned research-model contracts used by the fusion simulator.

The registry describes interfaces and validation requirements. Entries marked
``simulation-contract`` do not represent clinically validated model weights.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class ModelSpec:
    name: str
    family: str
    version: str
    weight: float
    auc: float
    pr_auc: float
    latency_ms: int
    artifact_status: str
    dataset_contract: str
    intended_use: str
    output_contract: str
    approval: str = "research-only"
    calibration_method: str = "temperature-scaling-contract"


def _spec(
    name: str,
    family: str,
    version: str,
    weight: float,
    auc: float,
    pr_auc: float,
    latency_ms: int,
    dataset: str,
    intended_use: str,
    output: str,
) -> ModelSpec:
    return ModelSpec(
        name=name,
        family=family,
        version=version,
        weight=weight,
        auc=auc,
        pr_auc=pr_auc,
        latency_ms=latency_ms,
        artifact_status="simulation-contract",
        dataset_contract=dataset,
        intended_use=intended_use,
        output_contract=output,
    )


MODEL_CATALOG: dict[str, tuple[ModelSpec, ...]] = {
    "heart": (
        _spec("CardioFormer", "Transformer", "1.4.0", 0.25, 0.941, 0.902, 38, "ECG + cardiac imaging contract", "Cardiac pattern triage research", "calibrated probability"),
        _spec("RhythmNet", "BiLSTM", "2.1.0", 0.23, 0.926, 0.884, 21, "ECG rhythm contract", "Temporal rhythm-pattern research", "sequence probability"),
        _spec("Perfusion ROI", "3D U-Net", "0.9.2", 0.20, 0.904, 0.861, 46, "Volumetric perfusion contract", "Research ROI segmentation", "voxel mask + score"),
        _spec("Risk Horizon", "ARIMA-LSTM", "1.2.1", 0.17, 0.892, 0.842, 17, "Longitudinal signal contract", "Progression simulation", "forecast distribution"),
        _spec("Cardiac Context", "Gradient Boosting", "1.0.3", 0.15, 0.886, 0.831, 9, "Anonymous tabular contract", "Context-only fusion support", "context probability"),
    ),
    "brain": (
        _spec("NeuroVision", "Faster R-CNN", "1.3.0", 0.27, 0.948, 0.917, 52, "MRI detection-label contract", "Focal-region research", "boxes + scores"),
        _spec("ConnectomeFormer", "Graph Transformer", "1.1.0", 0.23, 0.932, 0.899, 41, "Connectome graph contract", "Network-pattern research", "graph probability"),
        _spec("Lesion ROI", "3D U-Net", "0.9.4", 0.22, 0.917, 0.878, 58, "Volumetric MRI mask contract", "Research segmentation", "voxel mask + score"),
        _spec("NeuroTrend", "Temporal LSTM", "1.0.8", 0.16, 0.894, 0.848, 19, "Longitudinal imaging contract", "Progression simulation", "forecast distribution"),
        _spec("Imaging Context", "Clinical Transformer", "1.2.0", 0.12, 0.883, 0.829, 26, "De-identified text-feature contract", "Context extraction research", "concept probabilities"),
    ),
    "nervous": (
        _spec("NeuroPath GNN", "Graph Neural Network", "1.5.0", 0.27, 0.936, 0.901, 35, "Peripheral-path graph contract", "Conduction-path research", "edge probabilities"),
        _spec("SignalFormer", "Transformer", "1.2.2", 0.24, 0.925, 0.889, 31, "Neuro-signal contract", "Signal-pattern research", "sequence probability"),
        _spec("Conduction LSTM", "BiLSTM", "1.0.7", 0.20, 0.908, 0.866, 18, "Conduction-series contract", "Temporal simulation", "sequence probability"),
        _spec("Nerve ROI", "Mask R-CNN", "0.8.9", 0.17, 0.891, 0.844, 49, "Nerve imaging contract", "Research ROI extraction", "masks + scores"),
        _spec("Trajectory", "ARIMA", "1.0.2", 0.12, 0.874, 0.816, 8, "Longitudinal index contract", "Trajectory simulation", "forecast distribution"),
    ),
    "skeletal": (
        _spec("MURA DenseNet", "DenseNet-169", "2.0.0", 0.29, 0.944, 0.913, 44, "MURA-compatible study contract", "Musculoskeletal abnormality research", "study probability"),
        _spec("Fracture R-CNN", "Faster R-CNN", "1.6.0", 0.25, 0.931, 0.897, 56, "Bounding-box fracture contract", "Fracture-localization research", "boxes + scores"),
        _spec("Bone ROI", "Mask R-CNN", "1.1.2", 0.19, 0.906, 0.865, 61, "Cortical mask contract", "Cortical ROI research", "masks + scores"),
        _spec("Healing LSTM", "Temporal LSTM", "0.9.8", 0.15, 0.889, 0.838, 20, "Longitudinal image-feature contract", "Healing trajectory simulation", "forecast distribution"),
        _spec("Load Context", "Gradient Boosting", "1.0.1", 0.12, 0.876, 0.821, 11, "Anonymous biomechanics contract", "Context-only fusion support", "context probability"),
    ),
    "lungs": (
        _spec("PulmoVision", "Swin Transformer", "1.8.0", 0.27, 0.946, 0.918, 47, "Thoracic CT/X-ray contract", "Pulmonary pattern research", "study probability"),
        _spec("Nodule R-CNN", "Faster R-CNN", "1.4.1", 0.24, 0.934, 0.902, 53, "Nodule box-label contract", "Nodule-localization research", "boxes + scores"),
        _spec("Lobe ROI", "3D U-Net", "1.0.0", 0.20, 0.915, 0.874, 59, "Thoracic volume-mask contract", "Lobar ROI research", "voxel mask + score"),
        _spec("Spread LSTM", "ConvLSTM", "1.2.0", 0.17, 0.899, 0.851, 24, "Longitudinal volume contract", "Spread simulation", "forecast distribution"),
        _spec("Pulmo ARIMA", "ARIMA", "1.0.4", 0.12, 0.881, 0.823, 8, "Longitudinal index contract", "Trajectory simulation", "forecast distribution"),
    ),
    "renal": (
        _spec("RenalVision", "Vision Transformer", "1.3.1", 0.27, 0.931, 0.896, 42, "Renal CT/MRI contract", "Renal pattern research", "study probability"),
        _spec("Cyst R-CNN", "Mask R-CNN", "1.1.0", 0.23, 0.918, 0.879, 54, "Renal mask contract", "Cystic ROI research", "masks + scores"),
        _spec("Perfusion ROI", "3D U-Net", "1.0.2", 0.21, 0.904, 0.861, 57, "Renal perfusion-volume contract", "Perfusion ROI research", "voxel mask + score"),
        _spec("Function LSTM", "Temporal LSTM", "0.9.7", 0.17, 0.887, 0.836, 19, "Longitudinal function contract", "Function trajectory simulation", "forecast distribution"),
        _spec("Renal Context", "XGBoost", "1.0.0", 0.12, 0.873, 0.817, 10, "Anonymous tabular contract", "Context-only fusion support", "context probability"),
    ),
    "digestive": (
        _spec("GastroFormer", "Vision Transformer", "1.4.0", 0.27, 0.934, 0.901, 45, "Endoscopic/imaging contract", "Gastrointestinal pattern research", "study probability"),
        _spec("Tissue R-CNN", "Mask R-CNN", "1.2.0", 0.24, 0.921, 0.883, 52, "Tissue mask contract", "Tissue ROI research", "masks + scores"),
        _spec("Lesion ROI", "3D U-Net", "0.9.9", 0.20, 0.906, 0.863, 58, "Abdominal volume-mask contract", "Research segmentation", "voxel mask + score"),
        _spec("Spread LSTM", "Temporal LSTM", "1.0.6", 0.17, 0.889, 0.837, 21, "Longitudinal feature contract", "Spread simulation", "forecast distribution"),
        _spec("Gastro Context", "Clinical Transformer", "1.1.3", 0.12, 0.878, 0.819, 24, "De-identified text-feature contract", "Context extraction research", "concept probabilities"),
    ),
}


def public_catalog() -> dict[str, list[dict[str, object]]]:
    return {
        anatomy: [asdict(model) for model in models]
        for anatomy, models in MODEL_CATALOG.items()
    }
