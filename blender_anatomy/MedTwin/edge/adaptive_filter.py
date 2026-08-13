import numpy as np

class NLMSFilter:
    """
    Normalized Least Mean Squares (NLMS) Adaptive Filter for real-time edge processing.
    Effectively removes baseline wander and motion artifacts from ECG signals.
    """
    def __init__(self, num_taps=32, mu=0.1, epsilon=1e-4):
        """
        Args:
            num_taps (int): Filter length (number of weights).
            mu (float): Step size for weight updates.
            epsilon (float): Small constant to avoid division by zero.
        """
        self.num_taps = num_taps
        self.mu = mu
        self.epsilon = epsilon
        
        # Initialize filter weights to zero
        self.weights = np.zeros(num_taps)
        
        # Buffer to hold past reference inputs
        self.ref_buffer = np.zeros(num_taps)

    def filter_step(self, primary_input, reference_input):
        """
        Processes a single sample.
        Args:
            primary_input (float): Noisy ECG signal sample (d(n))
            reference_input (float): Noise estimation reference (x(n))
        Returns:
            error (float): Cleaned ECG signal estimation (e(n))
        """
        # Shift reference buffer and insert new sample
        self.ref_buffer[1:] = self.ref_buffer[:-1]
        self.ref_buffer[0] = reference_input
        
        # Calculate filter output (estimated noise)
        y = np.dot(self.weights, self.ref_buffer)
        
        # Calculate error (clean signal)
        error = primary_input - y
        
        # Calculate normalization factor (norm of reference buffer)
        norm_factor = np.dot(self.ref_buffer, self.ref_buffer) + self.epsilon
        
        # Update filter weights
        self.weights = self.weights + (self.mu / norm_factor) * error * self.ref_buffer
        
        return error

    def filter_batch(self, primary_signal, reference_signal):
        """
        Processes an entire array of samples.
        """
        n = len(primary_signal)
        cleaned_signal = np.zeros(n)
        
        for i in range(n):
            cleaned_signal[i] = self.filter_step(primary_signal[i], reference_signal[i])
            
        return cleaned_signal

if __name__ == "__main__":
    # Test filter logic with dummy data
    t = np.linspace(0, 1, 360)
    clean_ecg = np.sin(2 * np.pi * 5 * t) # Mock 5Hz component
    noise = np.sin(2 * np.pi * 50 * t)    # Mock 50Hz powerline noise
    
    noisy_ecg = clean_ecg + noise
    
    # In a real scenario, reference_input might be derived from a secondary sensor or a synthetic 50Hz tone
    reference = noise 
    
    filter = NLMSFilter(num_taps=32, mu=0.5)
    output = filter.filter_batch(noisy_ecg, reference)
    
    print(f"NLMS initialized. Error variance before: {np.var(noisy_ecg - clean_ecg):.4f}, after: {np.var(output - clean_ecg):.4f}")
