"""
MedTwin: ARIMA + LSTM Hybrid Forecasting Module
Provides statistical (ARIMA) and deep learning (LSTM) forecasting for 
clinical time-series data such as risk scores, cognitive decline metrics,
and physiological trends.
"""

import numpy as np
import logging

logger = logging.getLogger("medtwin.models.forecasting.arima_hybrid")

try:
    from statsmodels.tsa.arima.model import ARIMA
    STATSMODELS_AVAILABLE = True
except ImportError:
    STATSMODELS_AVAILABLE = False
    logger.warning("statsmodels not available — ARIMA forecasting disabled.")

try:
    import torch
    from cloud.models.fusion.forecasting import TemporalForecastingEngine
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False


class ARIMAForecaster:
    """
    Statistical ARIMA forecaster for low-frequency clinical metrics.
    Best for: monthly cognitive scores, weekly risk assessments, daily vitals trends.
    """
    def __init__(self, order=(2, 1, 1)):
        self.order = order
        self.model_fit = None

    def fit_and_forecast(self, time_series: list, steps: int = 5) -> list:
        """Fits ARIMA on the time series and forecasts `steps` into the future."""
        if not STATSMODELS_AVAILABLE:
            logger.warning("ARIMA unavailable — returning linear extrapolation.")
            return self._linear_fallback(time_series, steps)

        data = np.array(time_series, dtype=np.float64)
        if len(data) < 5:
            return self._linear_fallback(time_series, steps)

        try:
            model = ARIMA(data, order=self.order)
            self.model_fit = model.fit()
            forecast = self.model_fit.forecast(steps=steps)
            return np.clip(forecast, 0, 1).tolist()
        except Exception as e:
            logger.warning(f"ARIMA fit failed: {e} — falling back to linear.")
            return self._linear_fallback(time_series, steps)

    def _linear_fallback(self, series: list, steps: int) -> list:
        """Simple linear extrapolation when ARIMA can't fit."""
        if len(series) < 2:
            return [series[-1] if series else 0.5] * steps
        slope = (series[-1] - series[-2])
        return [max(0, min(1, series[-1] + slope * (i + 1))) for i in range(steps)]


class HybridForecaster:
    """
    Combines ARIMA (statistical) and LSTM (deep learning) forecasts 
    using a weighted ensemble for robust clinical prediction.
    """
    def __init__(self, arima_weight=1.0, lstm_weight=0.0, use_neural=False):
        self.arima = ARIMAForecaster()
        self.arima_weight = arima_weight
        self.lstm_weight = lstm_weight
        self.lstm_forecaster = None

        # A randomly initialized LSTM must never influence a live forecast.
        # Enable it only after a calibrated checkpoint loader is supplied.
        if use_neural and TORCH_AVAILABLE:
            try:
                self.lstm_forecaster = TemporalForecastingEngine(
                    input_dim=1, hidden_dim=32, num_layers=1, forecast_horizon=5
                )
                self.lstm_forecaster.eval()
            except Exception as e:
                logger.warning(f"LSTM forecaster init failed: {e}")

    def forecast(self, risk_history: list, steps: int = 5) -> dict:
        """
        Generates a hybrid forecast combining ARIMA and LSTM predictions.
        """
        result = {
            "arima_forecast": [],
            "lstm_forecast": [],
            "ensemble_forecast": [],
            "method": "unavailable",
        }

        # ARIMA
        arima_pred = self.arima.fit_and_forecast(risk_history, steps)
        result["arima_forecast"] = arima_pred

        # LSTM
        lstm_pred = None
        if self.lstm_forecaster and TORCH_AVAILABLE and len(risk_history) >= 3:
            try:
                tensor = torch.tensor(
                    [risk_history[-min(20, len(risk_history)):]],
                    dtype=torch.float32,
                ).unsqueeze(-1)  # [1, seq, 1]
                # Pad to match input_dim=1 (already correct for this config)
                with torch.no_grad():
                    pred = self.lstm_forecaster(tensor)
                lstm_pred = pred.squeeze().tolist()
                if isinstance(lstm_pred, float):
                    lstm_pred = [lstm_pred]
                result["lstm_forecast"] = lstm_pred
            except Exception as e:
                logger.warning(f"LSTM forecast error: {e}")

        # Ensemble
        if lstm_pred and len(lstm_pred) == len(arima_pred):
            ensemble = [
                self.arima_weight * a + self.lstm_weight * l
                for a, l in zip(arima_pred, lstm_pred)
            ]
            result["ensemble_forecast"] = ensemble
            result["method"] = "arima+lstm_ensemble"
        elif arima_pred:
            result["ensemble_forecast"] = arima_pred
            result["method"] = "arima_only"
        else:
            result["ensemble_forecast"] = [0.5] * steps
            result["method"] = "fallback"

        return result


if __name__ == "__main__":
    # Demo with synthetic risk history
    history = [0.12, 0.15, 0.18, 0.22, 0.19, 0.25, 0.30, 0.28, 0.35, 0.33]
    
    hybrid = HybridForecaster()
    result = hybrid.forecast(history, steps=5)
    
    print("=" * 50)
    print("HYBRID FORECASTING RESULTS")
    print("=" * 50)
    print(f"Method:    {result['method']}")
    print(f"ARIMA:     {[f'{v:.3f}' for v in result['arima_forecast']]}")
    print(f"LSTM:      {[f'{v:.3f}' for v in result['lstm_forecast']]}")
    print(f"Ensemble:  {[f'{v:.3f}' for v in result['ensemble_forecast']]}")
