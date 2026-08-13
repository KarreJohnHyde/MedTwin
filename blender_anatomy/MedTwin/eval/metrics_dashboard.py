import numpy as np
import logging

try:
    from sklearn.metrics import roc_auc_score, f1_score, confusion_matrix, accuracy_score
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False
    
logger = logging.getLogger("medtwin.eval.metrics")

def run_metrics_dashboard(y_true, y_pred_probs, threshold=0.5):
    """
    Computes rigorous classification metrics to evaluate model performance 
    objectively before live deployment.
    """
    if not SKLEARN_AVAILABLE:
        raise RuntimeError("scikit-learn is required for model evaluation")

    y_true = np.asarray(y_true)
    y_pred_probs = np.asarray(y_pred_probs, dtype=float)
    if y_true.ndim != 1 or y_pred_probs.ndim != 1 or len(y_true) != len(y_pred_probs) or len(y_true) == 0:
        raise ValueError("y_true and y_pred_probs must be non-empty one-dimensional arrays of equal length")
    if not np.isfinite(y_pred_probs).all() or np.any((y_pred_probs < 0) | (y_pred_probs > 1)):
        raise ValueError("y_pred_probs must contain finite probabilities between 0 and 1")
    if not 0 < threshold < 1:
        raise ValueError("threshold must be between 0 and 1")

    y_pred_classes = (y_pred_probs >= threshold).astype(int)
    # ROC-AUC is undefined for a single-class validation split.  Report that
    # explicitly instead of crashing a dashboard or fabricating a score.
    auc_roc = roc_auc_score(y_true, y_pred_probs) if np.unique(y_true).size == 2 else None
    f1 = f1_score(y_true, y_pred_classes, zero_division=0)
    conf_matrix = confusion_matrix(y_true, y_pred_classes)
    acc = accuracy_score(y_true, y_pred_classes)
    
    print("========================================")
    print("CARDIO-ULTRA METRICS DASHBOARD")
    print("========================================")
    print(f"Validation AUC-ROC:  {auc_roc:.4f}" if auc_roc is not None else "Validation AUC-ROC:  undefined (single class)")
    print(f"Validation F1-Score: {f1:.4f}")
    print(f"Validation Accuracy: {acc:.4f}")
    print("Confusion Matrix:")
    print(conf_matrix)
    print("========================================")
    
    return {
        "AUC-ROC": auc_roc,
        "F1-Score": f1,
        "Accuracy": acc,
        "Confusion_Matrix": conf_matrix.tolist()
    }

if __name__ == "__main__":
    # Simulated true labels (e.g., 1 = Arrhythmia, 0 = Normal)
    sim_y_true = np.array([0, 1, 1, 0, 1, 0, 0, 1, 1, 0])
    # Simulated model probabilities
    sim_y_probs = np.array([0.1, 0.8, 0.6, 0.3, 0.9, 0.2, 0.4, 0.85, 0.7, 0.05])
    
    run_metrics_dashboard(sim_y_true, sim_y_probs)
