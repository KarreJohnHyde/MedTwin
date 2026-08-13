import logging
import math
import os
from typing import List

logger = logging.getLogger("medtwin.models.ecg")

try:
    import torch
    import torch.nn as nn
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    logger.warning("PyTorch not available. Running LSTM in mock mode.")

if TORCH_AVAILABLE:
    class CardioLSTM(nn.Module):
        def __init__(self, input_size=1, hidden_size=64, num_layers=2, num_classes=1):
            super(CardioLSTM, self).__init__()
            self.hidden_size = hidden_size
            self.num_layers = num_layers
            self.lstm = nn.LSTM(input_size, hidden_size, num_layers, batch_first=True)
            self.fc = nn.Linear(hidden_size, num_classes)
            self.sigmoid = nn.Sigmoid()

        def forward(self, x):
            h0 = torch.zeros(self.num_layers, x.size(0), self.hidden_size).to(x.device)
            c0 = torch.zeros(self.num_layers, x.size(0), self.hidden_size).to(x.device)
            out, _ = self.lstm(x, (h0, c0))
            out = self.fc(out[:, -1, :])
            return self.sigmoid(out)

# Lazy initialization
_lstm_model = None
_device = None
_model_load_attempted = False

def get_lstm_model():
    """Load a calibrated checkpoint when one is explicitly configured.

    Returning a randomly initialized neural network as an inference model makes
    its probability meaningless, so the model remains unavailable until a
    trained checkpoint is supplied through ``MEDTWIN_ECG_MODEL_PATH``.
    """
    global _lstm_model, _device, _model_load_attempted
    if not _model_load_attempted and TORCH_AVAILABLE:
        _model_load_attempted = True
        try:
            if torch.cuda.is_available():
                _device = torch.device("cuda")
            elif hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
                _device = torch.device("mps")
            else:
                _device = torch.device("cpu")
            checkpoint = os.getenv("MEDTWIN_ECG_MODEL_PATH")
            if not checkpoint:
                logger.info("No ECG checkpoint configured; using heuristic-only ECG analysis")
                return None, _device
            if not os.path.isfile(checkpoint):
                logger.warning("Configured ECG checkpoint does not exist: %s", checkpoint)
                return None, _device
            _lstm_model = CardioLSTM(input_size=1, hidden_size=64, num_layers=2, num_classes=1).to(_device)
            state = torch.load(checkpoint, map_location=_device, weights_only=True)
            _lstm_model.load_state_dict(state.get("state_dict", state))
            _lstm_model.eval()
            logger.info("Loaded calibrated ECG LSTM checkpoint from %s", checkpoint)
        except Exception as e:
            _lstm_model = None
            logger.warning(f"Failed to load PyTorch CardioLSTM: {e}")
    return _lstm_model, _device

def predict_arrhythmia(samples: List[float], sampling_rate=360) -> dict:
    """Uses PyTorch LSTM to forecast imminent arrhythmia risk from the ECG window."""
    model, device = get_lstm_model()
    
    # Process samples defensively; malformed sensor values should not tear down
    # a realtime ingestion task.
    try:
        numeric = [float(value) for value in samples][-720:]
    except (TypeError, ValueError):
        return {"label": "Invalid ECG window", "heart_rate": 0, "trace": [], "risk_prob": 0.0, "model_status": "unavailable"}
    if not all(math.isfinite(value) for value in numeric):
        return {"label": "Invalid ECG window", "heart_rate": 0, "trace": [], "risk_prob": 0.0, "model_status": "unavailable"}
    if len(numeric) < 8:
        return {"label": "Insufficient ECG window", "heart_rate": 0, "trace": numeric, "risk_prob": 0.0, "model_status": "unavailable"}
        
    lo, hi = min(numeric), max(numeric)
    span = hi - lo or 1.0
    normalized = [((value - lo) / span) * 2 - 1 for value in numeric]
    
    # Calculate crude heart rate for the response
    threshold = sorted(normalized)[int(len(normalized) * .92)]
    peaks = [i for i in range(1, len(normalized)-1) if normalized[i] > threshold and normalized[i] >= normalized[i-1] and normalized[i] >= normalized[i+1]]
    refractory = max(1, int(sampling_rate * .25))
    retained = []
    for peak in peaks:
        if not retained or peak - retained[-1] >= refractory:
            retained.append(peak)
    duration = len(normalized) / sampling_rate
    heart_rate = round((len(retained) / duration) * 60) if duration else 0
    
    risk_prob = 0.0
    label = "Normal rhythm (heuristic)"
    model_status = "calibrated" if model else "heuristic_only"
    
    if model:
        try:
            # Pad or truncate to a fixed sequence length, e.g., 720
            seq_len = 720
            if len(normalized) < seq_len:
                padded = normalized + [0.0] * (seq_len - len(normalized))
            else:
                padded = normalized[-seq_len:]
                
            input_tensor = torch.tensor(padded, dtype=torch.float32).unsqueeze(0).unsqueeze(-1).to(device)
            
            with torch.no_grad():
                output = model(input_tensor)
                risk_prob = output.item()
                
            if risk_prob > 0.7:
                label = f"Arrhythmia High Risk ({risk_prob*100:.1f}%)"
            elif risk_prob > 0.4:
                label = f"Arrhythmia Moderate Risk ({risk_prob*100:.1f}%)"
            
        except Exception as e:
            logger.error(f"PyTorch LSTM inference error: {e}")
            model_status = "inference_failed"
            
    # Fallback / Irregularity check if model didn't fire
    if risk_prob == 0.0:
        intervals = [b-a for a, b in zip(retained, retained[1:])]
        irregular = len(intervals) > 2 and max(intervals) - min(intervals) > sampling_rate * .14
        if irregular:
            label = "Irregular rhythm pattern (heuristic)"
            
    return {
        "label": label,
        "heart_rate": heart_rate,
        "trace": normalized[-72:],
        "risk_prob": risk_prob,
        "model_status": model_status,
    }
