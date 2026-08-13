import numpy as np

# A basic mock script representing a Generative Adversarial Network (GAN)
# In production, this would be implemented in PyTorch using layers like nn.Conv1d, nn.LSTM
# to synthesize realistic ECG signals (e.g., MedGAN).

class MockECGGAN:
    def __init__(self, sequence_length=120):
        self.sequence_length = sequence_length
        self.is_trained = False
        
    def train(self, real_ecg_data, epochs=5):
        print(f"Training GAN on {len(real_ecg_data)} real ECG samples for {epochs} epochs...")
        # Simulating training process
        for epoch in range(epochs):
            print(f"Epoch {epoch+1}/{epochs}: Discriminator Loss: {np.random.uniform(0.3, 0.7):.4f}, Generator Loss: {np.random.uniform(0.8, 1.5):.4f}")
        self.is_trained = True
        print("GAN Training Complete.")

    def generate_synthetic_anomaly(self, num_samples=1, anomaly_type="ST_Elevation"):
        """
        Generates synthetic anomalous ECG signals to balance the dataset.
        """
        if not self.is_trained:
            print("Warning: Model is untrained. Generating pure noise.")
            
        print(f"Synthesizing {num_samples} samples of {anomaly_type}...")
        
        synthetic_samples = []
        for _ in range(num_samples):
            # Base normal rhythm (mock sine wave)
            t = np.linspace(0, 10, self.sequence_length)
            base_ecg = np.sin(2 * np.pi * 1.2 * t) 
            
            # Inject anomaly
            if anomaly_type == "ST_Elevation":
                # Elevate a specific segment to simulate STEMI
                base_ecg[60:80] += 0.8
                
            # Add noise
            noisy_ecg = base_ecg + np.random.normal(0, 0.1, self.sequence_length)
            synthetic_samples.append(noisy_ecg)
            
        return np.array(synthetic_samples)

if __name__ == "__main__":
    print("Initiating Phase 2, Task 2.3: Synthetic Data Generation")
    
    # 1. Initialize GAN
    gan = MockECGGAN(sequence_length=120)
    
    # 2. Mock some real data
    mock_real_data = np.random.normal(0, 1, (100, 120))
    
    # 3. Train
    gan.train(mock_real_data, epochs=3)
    
    # 4. Generate balanced dataset
    synthetic_stemi = gan.generate_synthetic_anomaly(num_samples=5, anomaly_type="ST_Elevation")
    
    print(f"Generated shape: {synthetic_stemi.shape}")
    print("Synthetic sample generated. In production, these will be saved as .npy files and fed to the LSTM.")
