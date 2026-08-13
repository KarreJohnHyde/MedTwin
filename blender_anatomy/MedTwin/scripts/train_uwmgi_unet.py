import os
import torch
import torch.nn as nn
import torch.optim as optim
import time
import random
from pathlib import Path

# Adjust path to import UNet3D
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from api.unet3d import UNet3D

def generate_synthetic_patient_data(num_patients=5, slices_per_patient=8, height=32, width=32):
    """
    Generates synthetic tensors representing patient 3D MRI scans and masks.
    Shape: (N, C, D, H, W) -> (Patients, 1, Slices, Height, Width)
    """
    print(f"Generating synthetic 3D MRI data for {num_patients} patients...")
    X = torch.randn(num_patients, 1, slices_per_patient, height, width)
    
    # Generate some dummy masks (binary)
    y = torch.zeros(num_patients, 2, slices_per_patient, height, width)
    for p in range(num_patients):
        # class 0 (background)
        y[p, 0] = 1.0
        # class 1 (foreground) in some central region
        y[p, 1, slices_per_patient//4:3*slices_per_patient//4, height//4:3*height//4, width//4:3*width//4] = 1.0
        y[p, 0] = 1.0 - y[p, 1]
    
    return X, y

def dice_score(preds, targets, smooth=1e-6):
    preds = torch.sigmoid(preds)
    preds = (preds > 0.5).float()
    intersection = (preds * targets).sum(dim=(2, 3, 4))
    union = preds.sum(dim=(2, 3, 4)) + targets.sum(dim=(2, 3, 4))
    dice = (2. * intersection + smooth) / (union + smooth)
    return dice.mean().item()

def main():
    print("--- MedTwin Phase 5: UWMGI U-Net Training Run ---")
    
    # 1. Patient-level held-out split
    # We enforce a strict split on patient ID to avoid slice leakage
    num_patients = 5
    X, y = generate_synthetic_patient_data(num_patients)
    
    # Split: 80 train, 20 val (patient level)
    # Shuffle indices
    indices = list(range(num_patients))
    random.seed(42)
    random.shuffle(indices)
    
    train_idx = indices[:4]
    val_idx = indices[4:]
    
    X_train, y_train = X[train_idx], y[train_idx]
    X_val, y_val = X[val_idx], y[val_idx]
    
    print(f"Train patients: {len(train_idx)}, Val patients: {len(val_idx)}")
    
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    model = UNet3D(in_channels=1, out_channels=2).to(device)
    
    criterion = nn.BCEWithLogitsLoss()
    optimizer = optim.Adam(model.parameters(), lr=1e-3)
    
    epochs = 1
    batch_size = 4
    
    print("Starting training...")
    for epoch in range(epochs):
        model.train()
        train_loss = 0.0
        for i in range(0, len(X_train), batch_size):
            inputs = X_train[i:i+batch_size].to(device)
            targets = y_train[i:i+batch_size].to(device)
            
            optimizer.zero_grad()
            outputs = model(inputs)
            loss = criterion(outputs, targets)
            loss.backward()
            optimizer.step()
            
            train_loss += loss.item() * inputs.size(0)
            
        train_loss /= len(X_train)
        
        # Eval
        model.eval()
        val_loss = 0.0
        val_dice = 0.0
        with torch.no_grad():
            for i in range(0, len(X_val), batch_size):
                inputs = X_val[i:i+batch_size].to(device)
                targets = y_val[i:i+batch_size].to(device)
                outputs = model(inputs)
                loss = criterion(outputs, targets)
                val_loss += loss.item() * inputs.size(0)
                val_dice += dice_score(outputs, targets) * inputs.size(0)
                
        val_loss /= len(X_val)
        val_dice /= len(X_val)
        
        print(f"Epoch [{epoch+1}/{epochs}] - Train Loss: {train_loss:.4f} - Val Loss: {val_loss:.4f} - Val Dice: {val_dice:.4f}")
        
    
    # 2. Save versioned artifact
    out_dir = Path(__file__).resolve().parent.parent / "artifacts"
    out_dir.mkdir(exist_ok=True)
    out_path = out_dir / "uwmgi_unet.pt"
    
    torch.save(model.state_dict(), out_path)
    print(f"Saved model artifact to {out_path}")
    print("Please ensure this run is logged in MedTwin/docs/model_sources.md")

if __name__ == "__main__":
    main()
