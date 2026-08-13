"""Train a Deep Convolutional Generative Adversarial Network (DCGAN) for Brain MRI Augmentation.

Uses synthetic dummy images to establish the training pipeline. The resulting 
generator artifact can be used to synthesize new brain MRI scans for data augmentation.
"""

import os
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset
from pathlib import Path

# DCGAN Parameters
LATENT_DIM = 100
IMG_CHANNELS = 1
FEATURES_GEN = 64
FEATURES_DISC = 64

class Generator(nn.Module):
    def __init__(self):
        super(Generator, self).__init__()
        self.net = nn.Sequential(
            # Input is the latent vector Z, going into a convolution
            nn.ConvTranspose2d(LATENT_DIM, FEATURES_GEN * 8, 4, 1, 0, bias=False),
            nn.BatchNorm2d(FEATURES_GEN * 8),
            nn.ReLU(True),
            # (FEATURES_GEN * 8) x 4 x 4
            nn.ConvTranspose2d(FEATURES_GEN * 8, FEATURES_GEN * 4, 4, 2, 1, bias=False),
            nn.BatchNorm2d(FEATURES_GEN * 4),
            nn.ReLU(True),
            # (FEATURES_GEN * 4) x 8 x 8
            nn.ConvTranspose2d(FEATURES_GEN * 4, FEATURES_GEN * 2, 4, 2, 1, bias=False),
            nn.BatchNorm2d(FEATURES_GEN * 2),
            nn.ReLU(True),
            # (FEATURES_GEN * 2) x 16 x 16
            nn.ConvTranspose2d(FEATURES_GEN * 2, FEATURES_GEN, 4, 2, 1, bias=False),
            nn.BatchNorm2d(FEATURES_GEN),
            nn.ReLU(True),
            # (FEATURES_GEN) x 32 x 32
            nn.ConvTranspose2d(FEATURES_GEN, IMG_CHANNELS, 4, 2, 1, bias=False),
            nn.Tanh()
            # Output: IMG_CHANNELS x 64 x 64
        )

    def forward(self, x):
        return self.net(x)


class Discriminator(nn.Module):
    def __init__(self):
        super(Discriminator, self).__init__()
        self.net = nn.Sequential(
            # Input: IMG_CHANNELS x 64 x 64
            nn.Conv2d(IMG_CHANNELS, FEATURES_DISC, 4, 2, 1, bias=False),
            nn.LeakyReLU(0.2, inplace=True),
            # FEATURES_DISC x 32 x 32
            nn.Conv2d(FEATURES_DISC, FEATURES_DISC * 2, 4, 2, 1, bias=False),
            nn.BatchNorm2d(FEATURES_DISC * 2),
            nn.LeakyReLU(0.2, inplace=True),
            # (FEATURES_DISC * 2) x 16 x 16
            nn.Conv2d(FEATURES_DISC * 2, FEATURES_DISC * 4, 4, 2, 1, bias=False),
            nn.BatchNorm2d(FEATURES_DISC * 4),
            nn.LeakyReLU(0.2, inplace=True),
            # (FEATURES_DISC * 4) x 8 x 8
            nn.Conv2d(FEATURES_DISC * 4, FEATURES_DISC * 8, 4, 2, 1, bias=False),
            nn.BatchNorm2d(FEATURES_DISC * 8),
            nn.LeakyReLU(0.2, inplace=True),
            # (FEATURES_DISC * 8) x 4 x 4
            nn.Conv2d(FEATURES_DISC * 8, 1, 4, 1, 0, bias=False),
            nn.Sigmoid()
        )

    def forward(self, x):
        return self.net(x).view(-1, 1).squeeze(1)


def init_weights(m):
    """Custom weights initialization for DCGAN."""
    classname = m.__class__.__name__
    if classname.find('Conv') != -1:
        nn.init.normal_(m.weight.data, 0.0, 0.02)
    elif classname.find('BatchNorm') != -1:
        nn.init.normal_(m.weight.data, 1.0, 0.02)
        nn.init.constant_(m.bias.data, 0)


def main():
    print("--- MedTwin: Training Brain MRI DCGAN (Synthetic Data) ---")
    
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Using device: {device}")
    
    # 1. Models Setup
    netG = Generator().to(device)
    netD = Discriminator().to(device)
    
    netG.apply(init_weights)
    netD.apply(init_weights)
    
    # 2. Synthetic Data
    # Generate random images to simulate brain MRIs (1 channel, 64x64)
    num_samples = 256
    batch_size = 64
    fake_mri_data = torch.randn(num_samples, IMG_CHANNELS, 64, 64)
    # Scale to [-1, 1] for Tanh compatibility
    fake_mri_data = torch.clamp(fake_mri_data, -1, 1) 
    
    dataset = TensorDataset(fake_mri_data)
    dataloader = DataLoader(dataset, batch_size=batch_size, shuffle=True)
    
    # 3. Optimizers & Loss
    criterion = nn.BCELoss()
    # DCGAN typically uses Adam with beta1=0.5
    optimizerD = optim.Adam(netD.parameters(), lr=0.0002, betas=(0.5, 0.999))
    optimizerG = optim.Adam(netG.parameters(), lr=0.0002, betas=(0.5, 0.999))
    
    # 4. Training Loop
    epochs = 2
    for epoch in range(epochs):
        for i, (data,) in enumerate(dataloader):
            real_data = data.to(device)
            b_size = real_data.size(0)
            
            # Labels
            real_label = torch.ones(b_size, device=device)
            fake_label = torch.zeros(b_size, device=device)
            
            # --- Train Discriminator ---
            netD.zero_grad()
            output_real = netD(real_data)
            loss_D_real = criterion(output_real, real_label)
            loss_D_real.backward()
            
            # Generate fake images
            noise = torch.randn(b_size, LATENT_DIM, 1, 1, device=device)
            fake_data = netG(noise)
            
            output_fake = netD(fake_data.detach())
            loss_D_fake = criterion(output_fake, fake_label)
            loss_D_fake.backward()
            
            optimizerD.step()
            loss_D = loss_D_real + loss_D_fake
            
            # --- Train Generator ---
            netG.zero_grad()
            output_fake_for_G = netD(fake_data)
            loss_G = criterion(output_fake_for_G, real_label) # G wants D to think fake is real
            loss_G.backward()
            optimizerG.step()
            
        print(f"Epoch [{epoch+1}/{epochs}] | Loss D: {loss_D.item():.4f} | Loss G: {loss_G.item():.4f}")

    # 5. Save Artifact (Generator only)
    out_dir = Path(__file__).resolve().parents[1] / "artifacts"
    out_dir.mkdir(exist_ok=True, parents=True)
    out_path = out_dir / "brain_dcgan_gen.pt"
    
    artifact = {
        "state_dict": netG.state_dict(),
        "latent_dim": LATENT_DIM,
        "model_type": "dcgan_generator",
    }
    
    torch.save(artifact, out_path)
    print(f"\nSaved DCGAN Generator artifact to: {out_path}")

if __name__ == "__main__":
    main()
