import torch
import torch.nn as nn

class UNet3D(nn.Module):
    def __init__(self, in_channels=1, out_channels=2): 
        super(UNet3D, self).__init__()
        
        # Contracting Path (Encoder)
        self.enc1 = self._conv_block(in_channels, 32)
        self.pool1 = nn.MaxPool3d(kernel_size=2, stride=2)
        
        # Bottleneck
        self.bottleneck = self._conv_block(32, 64)
        
        # Expanding Path (Decoder)
        self.upconv1 = nn.ConvTranspose3d(64, 32, kernel_size=2, stride=2)
        self.dec1 = self._conv_block(64, 32) # 64 input channels due to skip connection concatenation
        
        # Final Classification Layer
        self.out_conv = nn.Conv3d(32, out_channels, kernel_size=1)
        
    def _conv_block(self, in_c, out_c):
        return nn.Sequential(
            nn.Conv3d(in_c, out_c, kernel_size=3, padding=1),
            nn.BatchNorm3d(out_c),
            nn.ReLU(inplace=True),
            nn.Conv3d(out_c, out_c, kernel_size=3, padding=1),
            nn.BatchNorm3d(out_c),
            nn.ReLU(inplace=True)
        )

    def forward(self, x):
        # Downsample
        e1 = self.enc1(x)
        p1 = self.pool1(e1)
        
        # Bottleneck
        b = self.bottleneck(p1)
        
        # Upsample & Skip Connection
        d1 = self.upconv1(b)
        skip = torch.cat((d1, e1), dim=1) # Concatenate along channel dimension
        d1 = self.dec1(skip)
        
        return self.out_conv(d1)

if __name__ == "__main__":
    # Test the model forward pass with a dummy tensor
    model = UNet3D()
    x = torch.randn(1, 1, 32, 32, 32)  # Batch, Channels, Depth, Height, Width
    y = model(x)
    print(f"Input shape: {x.shape}")
    print(f"Output shape: {y.shape}")
