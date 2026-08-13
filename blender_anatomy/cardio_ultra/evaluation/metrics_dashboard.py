import numpy as np

try:
    from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, mean_absolute_error, mean_squared_error, confusion_matrix
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False
    print("Warning: scikit-learn not installed. Running in mock mode.")

def evaluate_classification_metrics(y_true, y_pred, y_prob=None):
    """
    Evaluates Tabular and NLP Classification models.
    """
    if not SKLEARN_AVAILABLE:
        return {"Mock_AUC": 0.85, "Mock_F1": 0.80}
        
    metrics = {
        "Accuracy": accuracy_score(y_true, y_pred),
        "Precision": precision_score(y_true, y_pred),
        "Recall/Sensitivity": recall_score(y_true, y_pred),
        "F1-Score": f1_score(y_true, y_pred)
    }
    
    if y_prob is not None:
        metrics["AUC-ROC"] = roc_auc_score(y_true, y_prob)
        
    metrics["Confusion_Matrix"] = confusion_matrix(y_true, y_pred).tolist()
    
    return metrics

def evaluate_regression_metrics(y_true, y_pred):
    """
    Evaluates Forecasting and Time-Series models.
    """
    if not SKLEARN_AVAILABLE:
        return {"Mock_RMSE": 0.12, "Mock_MAE": 0.08}
        
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    mae = mean_absolute_error(y_true, y_pred)
    
    return {
        "RMSE": rmse,
        "MAE": mae
    }

if __name__ == "__main__":
    print("Initiating Phase 4, Task 4.1: Metrics Dashboard Calculation")
    
    # Mock data for classification
    y_true_cls = [0, 1, 1, 0, 1, 0, 1, 1, 0, 0]
    y_pred_cls = [0, 1, 0, 0, 1, 0, 1, 1, 1, 0]
    y_prob_cls = [0.1, 0.9, 0.4, 0.2, 0.85, 0.3, 0.95, 0.7, 0.6, 0.1]
    
    print("\nClassification Metrics:")
    cls_metrics = evaluate_classification_metrics(y_true_cls, y_pred_cls, y_prob_cls)
    for k, v in cls_metrics.items():
        print(f"  {k}: {v}")
        
    # Mock data for regression
    y_true_reg = [1.2, 1.4, 1.3, 1.5, 1.8]
    y_pred_reg = [1.1, 1.5, 1.35, 1.45, 1.7]
    
    print("\nRegression Metrics:")
    reg_metrics = evaluate_regression_metrics(y_true_reg, y_pred_reg)
    for k, v in reg_metrics.items():
        print(f"  {k}: {v}")
