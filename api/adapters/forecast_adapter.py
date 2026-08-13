import numpy as np

class ForecastAdapter:
    """
    Adapter representing a Time-Series Forecasting model (like LSTM or ARIMA).
    This model predicts the localized spread radius and severity of a detected anomaly 
    over a future time horizon (days).
    """
    def __init__(self):
        self.is_loaded = True
        print("Time-Series Forecast Adapter (LSTM/ARIMA mock) loaded.")

    def predict(self, day: int) -> dict:
        """
        Simulate an LSTM predicting the disease spread radius for a given day in the future.
        """
        if not self.is_loaded:
            raise RuntimeError("Model is not loaded.")
            
        # Mock LSTM exponential spread progression
        # Day 0: base radius (e.g. 1.0 multiplier)
        # Day 14: maximum radius (e.g. 4.0 multiplier)
        
        # Non-linear spread simulation
        base_spread = 1.0
        growth_rate = 0.12 # 12% daily compounding growth
        
        predicted_spread_multiplier = base_spread * (1 + growth_rate) ** day
        
        # Severity increases with time
        base_severity = 0.3
        severity = min(base_severity + (day * 0.05), 1.0)
        
        return {
            "model_type": "time_series_lstm",
            "prediction_day": day,
            "spread_multiplier": predicted_spread_multiplier,
            "severity_index": severity,
            "confidence": max(0.95 - (day * 0.02), 0.50) # Confidence drops further into future
        }
