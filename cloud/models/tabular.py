import pandas as pd
import logging

try:
    from sklearn.cluster import KMeans
    from sklearn.preprocessing import StandardScaler
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False

logger = logging.getLogger("medtwin.models.tabular")

def train_risk_clustering(df: pd.DataFrame) -> KMeans:
    """Trains K-Means clustering to create baseline patient risk groups."""
    if not SKLEARN_AVAILABLE:
        logger.warning("Scikit-learn not available. Cannot train K-Means.")
        return None
        
    features = ['TotalCholesterol', 'SystolicBP', 'EjectionFraction']
    if not all(col in df.columns for col in features):
        raise ValueError(f"Missing required features: {features}")
        
    X = df[features].dropna()
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    # Grouping into 3 distinct risk clusters
    kmeans = KMeans(n_clusters=3, random_state=42)
    kmeans.fit(X_scaled)
    
    return kmeans

def assign_risk_cluster(total_cholesterol: float, systolic_bp: float, ejection_fraction: float) -> int:
    """Uses a pre-trained K-Means clustering model (heuristic logic for live inference) to assign a risk cluster."""
    try:
        # In a live app, this loads the saved KMeans model & Scaler.
        # Here we mock the behavior of inference based on standard boundaries to represent the logic.
        if ejection_fraction < 40 or systolic_bp > 160:
            return 2 # High Risk
        elif ejection_fraction < 50 or total_cholesterol > 200:
            return 1 # Medium Risk
        return 0 # Low Risk
    except Exception as e:
        logger.error(f"Clustering error: {e}")
        return -1
