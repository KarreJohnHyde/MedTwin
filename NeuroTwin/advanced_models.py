"""Small, functional research architectures for NeuroTwin experiments.

They are untrained building blocks, not clinical models.  Training, evaluation
(including ROC-AUC), and checkpoint governance must happen outside the API.
"""

try:
    import torch
    import torch.nn as nn
    TORCH_AVAILABLE = True
except ImportError:  # keep the module importable in minimal deployments
    torch = None
    nn = None
    TORCH_AVAILABLE = False


if TORCH_AVAILABLE:
    class BrainTumorViT(nn.Module):
        """Compact patch-transformer classifier for 2-D MRI experiments."""
        def __init__(self, num_classes=4, image_size=224, patch_size=16, emb_dim=192, depth=4, heads=4):
            super().__init__()
            if image_size % patch_size:
                raise ValueError("image_size must be divisible by patch_size")
            self.image_size = image_size
            self.patch_embed = nn.Conv2d(1, emb_dim, kernel_size=patch_size, stride=patch_size)
            patches = (image_size // patch_size) ** 2
            self.cls_token = nn.Parameter(torch.zeros(1, 1, emb_dim))
            self.position = nn.Parameter(torch.zeros(1, patches + 1, emb_dim))
            layer = nn.TransformerEncoderLayer(emb_dim, heads, dim_feedforward=emb_dim * 4, batch_first=True)
            self.encoder = nn.TransformerEncoder(layer, num_layers=depth)
            self.head = nn.Sequential(nn.LayerNorm(emb_dim), nn.Linear(emb_dim, num_classes))

        def forward(self, x):
            if x.ndim != 4 or x.shape[1] != 1 or x.shape[-2:] != (self.image_size, self.image_size):
                raise ValueError(f"Expected [batch, 1, {self.image_size}, {self.image_size}] MRI input")
            x = self.patch_embed(x).flatten(2).transpose(1, 2)
            cls = self.cls_token.expand(x.size(0), -1, -1)
            return self.head(self.encoder(torch.cat((cls, x), dim=1) + self.position)[:, 0])


    class BrainMRIGenerator(nn.Module):
        """DCGAN-style generator producing normalized single-channel 64x64 MRIs."""
        def __init__(self, latent_dim=100):
            super().__init__()
            self.latent_dim = latent_dim
            self.network = nn.Sequential(
                nn.ConvTranspose2d(latent_dim, 256, 4, 1, 0, bias=False), nn.BatchNorm2d(256), nn.ReLU(True),
                nn.ConvTranspose2d(256, 128, 4, 2, 1, bias=False), nn.BatchNorm2d(128), nn.ReLU(True),
                nn.ConvTranspose2d(128, 64, 4, 2, 1, bias=False), nn.BatchNorm2d(64), nn.ReLU(True),
                nn.ConvTranspose2d(64, 32, 4, 2, 1, bias=False), nn.BatchNorm2d(32), nn.ReLU(True),
                nn.ConvTranspose2d(32, 1, 4, 2, 1, bias=False), nn.Tanh(),
            )

        def forward(self, z):
            if z.ndim == 2:
                z = z[:, :, None, None]
            if z.ndim != 4 or z.shape[1] != self.latent_dim or z.shape[2:] != (1, 1):
                raise ValueError(f"Expected [batch, {self.latent_dim}] or [batch, {self.latent_dim}, 1, 1] latent input")
            return self.network(z)


    class BrainStrokeCNN(nn.Module):
        """Baseline CNN producing two stroke-classification logits."""
        def __init__(self, num_classes=2):
            super().__init__()
            self.features = nn.Sequential(
                nn.Conv2d(1, 32, 3, padding=1), nn.ReLU(inplace=True), nn.MaxPool2d(2),
                nn.Conv2d(32, 64, 3, padding=1), nn.ReLU(inplace=True), nn.MaxPool2d(2),
                nn.Conv2d(64, 128, 3, padding=1), nn.ReLU(inplace=True), nn.AdaptiveAvgPool2d(1),
            )
            self.classifier = nn.Linear(128, num_classes)

        def forward(self, x):
            if x.ndim != 4 or x.shape[1] != 1:
                raise ValueError("Expected [batch, 1, height, width] MRI input")
            return self.classifier(self.features(x).flatten(1))
else:
    class _TorchRequired:
        def __init__(self, *args, **kwargs):
            raise RuntimeError("PyTorch is required for NeuroTwin advanced models")

    BrainTumorViT = BrainMRIGenerator = BrainStrokeCNN = _TorchRequired
