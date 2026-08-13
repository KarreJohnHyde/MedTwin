import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, Dataset
from torch.amp import autocast, GradScaler
from unet3d import UNet3D
import numpy as np

class DiceLoss(nn.Module):
    def __init__(self, eps=1e-5):
        super(DiceLoss, self).__init__()
        self.eps = eps

    def forward(self, logits, targets):
        # logits shape: (N, C, D, H, W)
        # Apply softmax to get probabilities
        probs = torch.softmax(logits, dim=1)
        
        # We only care about the positive class (disease) which is index 1
        p_i = probs[:, 1, ...]
        g_i = targets.float()
        
        intersection = torch.sum(p_i * g_i)
        union = torch.sum(p_i) + torch.sum(g_i)
        
        dice_score = (2. * intersection + self.eps) / (union + self.eps)
        return 1. - dice_score

class StubVolumetricDataset(Dataset):
    """
    A stub dataset that generates random 3D volumes and binary masks.
    Simulates data augmentation like random rotations and deformations implicitly
    by generating randomized samples.
    """
    def __init__(self, size=10, volume_shape=(16, 16, 16)):
        self.size = size
        self.volume_shape = volume_shape
        
    def __len__(self):
        return self.size
        
    def __getitem__(self, idx):
        # Input volume (1 channel)
        volume = torch.randn(1, *self.volume_shape)
        # Ground truth mask (binary, 0 or 1)
        mask = torch.randint(0, 2, self.volume_shape).long()
        return volume, mask

def train():
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Training on device: {device}")
    
    # Model
    model = UNet3D(in_channels=1, out_channels=2).to(device)
    
    # Optimizer
    optimizer = optim.Adam(model.parameters(), lr=1e-4)
    
    # Losses
    ce_loss = nn.CrossEntropyLoss()
    dice_loss = DiceLoss()
    
    # Scaler for AMP
    scaler = GradScaler()
    
    # DataLoader
    dataset = StubVolumetricDataset(size=5, volume_shape=(32, 32, 32))
    loader = DataLoader(dataset, batch_size=1, shuffle=True)
    
    num_epochs = 3
    for epoch in range(num_epochs):
        model.train()
        epoch_loss = 0.0
        
        for batch_idx, (volumes, masks) in enumerate(loader):
            volumes = volumes.to(device)
            masks = masks.to(device)
            
            optimizer.zero_grad()
            
            # AMP context manager
            with autocast('cuda' if torch.cuda.is_available() else 'cpu'):
                outputs = model(volumes)
                # Combine losses
                loss_ce = ce_loss(outputs, masks)
                loss_dice = dice_loss(outputs, masks)
                loss = loss_ce + loss_dice
                
            # Backward pass
            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()
            
            epoch_loss += loss.item()
            
        print(f"Epoch {epoch+1}/{num_epochs}, Loss: {epoch_loss/len(loader):.4f}")
        
    print("Training complete.")

if __name__ == "__main__":
    train()
