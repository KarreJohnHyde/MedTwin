import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
import matplotlib.pyplot as plt

def generate_mock_tabular_data(n_patients=1000):
    """
    Generates synthetic historical tabular data for clustering.
    Includes Lipids, Troponin, Ejection Fraction, and BP.
    """
    np.random.seed(42)
    
    data = {
        'PatientID': [f'P{str(i).zfill(4)}' for i in range(n_patients)],
        'LDL': np.random.normal(120, 30, n_patients),
        'HDL': np.random.normal(50, 15, n_patients),
        'Triglycerides': np.random.normal(150, 50, n_patients),
        'Troponin_I': np.random.exponential(0.01, n_patients),
        'Systolic_BP': np.random.normal(130, 20, n_patients),
        'Diastolic_BP': np.random.normal(80, 10, n_patients),
        'Ejection_Fraction': np.random.normal(60, 10, n_patients)
    }
    
    # Clip values to realistic ranges
    data['Ejection_Fraction'] = np.clip(data['Ejection_Fraction'], 15, 80)
    data['LDL'] = np.clip(data['LDL'], 30, 300)
    data['Troponin_I'] = np.clip(data['Troponin_I'], 0.0, 1.5)
    
    return pd.DataFrame(data)

def perform_risk_clustering(df, n_clusters=4):
    """
    Applies K-Means clustering to stratify patients into risk groups.
    """
    print("Preparing data for clustering...")
    features = ['LDL', 'HDL', 'Triglycerides', 'Troponin_I', 'Systolic_BP', 'Diastolic_BP', 'Ejection_Fraction']
    X = df[features]
    
    # Scale the features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    print(f"Applying K-Means with {n_clusters} clusters...")
    kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    clusters = kmeans.fit_predict(X_scaled)
    
    df['Risk_Cluster'] = clusters
    
    # Optional: Analyze clusters
    cluster_means = df.groupby('Risk_Cluster')[features].mean()
    print("\nCluster Means:")
    print(cluster_means)
    
    return df, kmeans, scaler

if __name__ == "__main__":
    print("Initiating Phase 2, Task 2.1: Patient Risk Clustering")
    
    # 1. Generate Mock Data
    df = generate_mock_tabular_data()
    
    # 2. Perform Clustering
    stratified_df, model, scaler = perform_risk_clustering(df, n_clusters=3)
    
    # 3. Save output
    stratified_df.to_csv("stratified_patients.csv", index=False)
    print("\nSaved clustered patient data to 'stratified_patients.csv'")
