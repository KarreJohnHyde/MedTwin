import torch
import torch.nn as nn
import torch.nn.functional as F

class Attention(nn.Module):
    """
    Bahdanau-style Additive Attention Mechanism.
    """
    def __init__(self, hidden_dim):
        super(Attention, self).__init__()
        self.W = nn.Linear(hidden_dim, hidden_dim)
        self.v = nn.Linear(hidden_dim, 1, bias=False)

    def forward(self, hidden_states):
        # hidden_states shape: [batch_size, seq_len, hidden_dim]
        score = self.v(torch.tanh(self.W(hidden_states))) # [batch_size, seq_len, 1]
        attention_weights = F.softmax(score, dim=1) # [batch_size, seq_len, 1]
        
        # Multiply weights with hidden states
        context_vector = attention_weights * hidden_states # [batch_size, seq_len, hidden_dim]
        context_vector = torch.sum(context_vector, dim=1) # [batch_size, hidden_dim]
        
        return context_vector, attention_weights.squeeze(-1)

class CNNLSTMAttention(nn.Module):
    """
    Hybrid CNN-LSTM network with Attention for real-time ECG arrhythmia classification.
    """
    def __init__(self, input_channels=1, num_classes=5, hidden_dim=64, num_layers=2):
        super(CNNLSTMAttention, self).__init__()
        
        # CNN Feature Extractor
        self.cnn = nn.Sequential(
            nn.Conv1d(in_channels=input_channels, out_channels=16, kernel_size=7, stride=1, padding=3),
            nn.BatchNorm1d(16),
            nn.ReLU(),
            nn.MaxPool1d(kernel_size=3, stride=2, padding=1),
            
            nn.Conv1d(in_channels=16, out_channels=32, kernel_size=5, stride=1, padding=2),
            nn.BatchNorm1d(32),
            nn.ReLU(),
            nn.MaxPool1d(kernel_size=3, stride=2, padding=1),
            
            nn.Conv1d(in_channels=32, out_channels=64, kernel_size=3, stride=1, padding=1),
            nn.BatchNorm1d(64),
            nn.ReLU(),
            nn.MaxPool1d(kernel_size=3, stride=2, padding=1)
        )
        
        # Bidirectional LSTM
        self.lstm = nn.LSTM(input_size=64, hidden_size=hidden_dim, 
                            num_layers=num_layers, batch_first=True, bidirectional=True)
        
        # Attention Mechanism (hidden_dim * 2 because bidirectional)
        self.attention = Attention(hidden_dim * 2)
        
        # Classifier Head
        self.classifier = nn.Sequential(
            nn.Linear(hidden_dim * 2, 64),
            nn.ReLU(),
            nn.Dropout(0.5),
            nn.Linear(64, num_classes)
        )

    def forward(self, x):
        """
        Args:
            x (Tensor): Input ECG temporal window of shape [batch_size, channels, sequence_length]
        """
        # Feature extraction
        features = self.cnn(x) # [batch_size, 64, seq_len']
        
        # Reshape for LSTM: [batch_size, seq_len', features]
        features = features.permute(0, 2, 1)
        
        # Recurrent processing
        lstm_out, (h_n, c_n) = self.lstm(features) # lstm_out: [batch_size, seq_len', hidden_dim * 2]
        
        # Attention mapping
        context_vector, attention_weights = self.attention(lstm_out)
        
        # Classification
        logits = self.classifier(context_vector)
        
        return logits, attention_weights

if __name__ == "__main__":
    # Test model initialization
    model = CNNLSTMAttention(input_channels=1, num_classes=5)
    
    # Dummy input: Batch Size 16, 1 Channel, 1000 time steps (e.g., 2.7s at 360Hz)
    dummy_input = torch.randn(16, 1, 1000)
    
    logits, attn_weights = model(dummy_input)
    print("Model Output Shape:", logits.shape)
    print("Attention Weights Shape:", attn_weights.shape)
    print("MedTwin ECG Model initialized successfully.")
