import torch
import torch.nn as nn

class TemporalForecastingEngine(nn.Module):
    """
    Forecasting Engine for MedTwin.
    Uses a Temporal Regression approach (LSTM-based) to project disease progression and risk scores 
    based on historical logs.
    """
    def __init__(self, input_dim=5, hidden_dim=32, num_layers=1, forecast_horizon=5):
        """
        Args:
            input_dim (int): Number of historical features (e.g., previous risk scores, severity).
            hidden_dim (int): Hidden dimension for the LSTM.
            num_layers (int): Number of LSTM layers.
            forecast_horizon (int): How many future time steps to predict.
        """
        super(TemporalForecastingEngine, self).__init__()
        self.forecast_horizon = forecast_horizon
        
        self.lstm = nn.LSTM(input_size=input_dim, hidden_size=hidden_dim, 
                            num_layers=num_layers, batch_first=True)
        
        # Output layer maps the final hidden state to future predicted values
        self.regressor = nn.Sequential(
            nn.Linear(hidden_dim, 16),
            nn.ReLU(),
            nn.Linear(16, forecast_horizon)
        )

    def forward(self, history_sequence):
        """
        Args:
            history_sequence (Tensor): Shape [batch_size, seq_len, input_dim]
        Returns:
            future_risk_trend (Tensor): Shape [batch_size, forecast_horizon]
        """
        # Pass sequence through LSTM
        lstm_out, (h_n, c_n) = self.lstm(history_sequence)
        
        # Use the last hidden state for prediction
        # h_n shape is [num_layers, batch_size, hidden_dim]
        last_hidden = h_n[-1, :, :] # [batch_size, hidden_dim]
        
        future_predictions = self.regressor(last_hidden)
        
        # Apply sigmoid if predicting normalized risk scores [0, 1]
        future_predictions = torch.sigmoid(future_predictions)
        
        return future_predictions

if __name__ == "__main__":
    forecaster = TemporalForecastingEngine(input_dim=3, forecast_horizon=10)
    
    # Dummy historical data: Batch 1, Sequence length 7 days, 3 features
    dummy_history = torch.rand(1, 7, 3)
    
    prediction = forecaster(dummy_history)
    print("Forecasted risk for next 10 time steps:", prediction.detach().numpy())
