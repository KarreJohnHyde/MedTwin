"""Train and evaluate a local PyTorch CNN for Pneumonia Detection in Lung Radiographs.

Uses synthetic data to establish the artifact pipeline without requiring the
full 1+ GB original Kaggle dataset locally. The resulting artifact can be 
loaded by the inference API.
"""

from __future__ import annotations

import os
import json
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset
from pathlib import Path

class PneumoniaCNN(nn.Module):
    """Simple CNN architecture for binary classification (Normal vs Pneumonia)."""
    def __init__(self):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(1, 16, kernel_size=3, padding=1),
            nn.BatchNorm2d(16),
            nn.ReLU(),
            nn.MaxPool2d(2),
            
            nn.Conv2d(16, 32, kernel_size=3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(),
            nn.MaxPool2d(2),
            
            nn.Conv2d(32, 64, kernel_size=3, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(),
            nn.AdaptiveAvgPool2d(1),
        )
        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Dropout(0.3),
            nn.Linear(64, 1)
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.classifier(self.features(x)).squeeze(1)


def generate_synthetic_data(num_samples: int = 100, img_size: int = 128):
    """Generate random tensors simulating grayscale lung X-rays (1 channel)."""
    X = torch.randn(num_samples, 1, img_size, img_size)
    y = torch.randint(0, 2, (num_samples,), dtype=torch.float32)
    return X, y


def main():
    print("--- MedTwin: Training Pneumonia CNN (Synthetic Data) ---")
    
    # Hyperparameters
    epochs = 2
    batch_size = 16
    img_size = 128
    
    # Generate Synthetic Dataset
    X_train, y_train = generate_synthetic_data(num_samples=80, img_size=img_size)
    X_val, y_val = generate_synthetic_data(num_samples=20, img_size=img_size)
    
    train_loader = DataLoader(TensorDataset(X_train, y_train), batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(TensorDataset(X_val, y_val), batch_size=batch_size, shuffle=False)
    
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    model = PneumoniaCNN().to(device)
    
    criterion = nn.BCEWithLogitsLoss()
    optimizer = optim.Adam(model.parameters(), lr=1e-3)
    
    print(f"Training on {device}...")
    for epoch in range(1, epochs + 1):
        model.train()
        total_loss = 0.0
        for inputs, targets in train_loader:
            inputs, targets = inputs.to(device), targets.to(device)
            optimizer.zero_grad()
            outputs = model(inputs)
            loss = criterion(outputs, targets)
            loss.backward()
            optimizer.step()
            total_loss += loss.item() * inputs.size(0)
            
        model.eval()
        correct = 0
        with torch.no_grad():
            for inputs, targets in val_loader:
                inputs, targets = inputs.to(device), targets.to(device)
                outputs = model(inputs)
                preds = (torch.sigmoid(outputs) >= 0.5).float()
                correct += (preds == targets).sum().item()
                
        val_acc = correct / len(val_loader.dataset)
        print(f"Epoch {epoch}/{epochs} | Train Loss: {total_loss/len(train_loader.dataset):.4f} | Val Acc: {val_acc:.4f}")

    # Artifact generation
    out_dir = Path(__file__).resolve().parents[1] / "artifacts"
    out_dir.mkdir(exist_ok=True)
    out_path = out_dir / "pneumonia_cnn.pt"
    
    artifact = {
        "state_dict": model.state_dict(),
        "input_size": img_size,
        "threshold": 0.5,
        "model_type": "pneumonia_cnn",
        "metrics": {"validation_accuracy": val_acc}
    }
    
    torch.save(artifact, out_path)
    print(json.dumps({"artifact": str(out_path), "metrics": artifact["metrics"]}, indent=2))

if __name__ == "__main__":
    main()
