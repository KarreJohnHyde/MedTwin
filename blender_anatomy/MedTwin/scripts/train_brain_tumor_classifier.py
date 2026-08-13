"""Train and evaluate the local brain-MRI binary classifier.

The dataset must contain `yes/` and `no/` subdirectories. Exact duplicate
images are grouped before splitting so copies cannot leak across splits.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import random
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, roc_auc_score
from sklearn.model_selection import train_test_split
from torch.utils.data import DataLoader, Dataset

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from cloud.models.vision.classifier import BrainTumorCNN

IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png"}


def seed_everything(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)


def collect_grouped_samples(data_dir: Path):
    groups = defaultdict(list)
    for label_name, label in (("no", 0), ("yes", 1)):
        folder = data_dir / label_name
        if not folder.is_dir():
            raise ValueError(f"Missing class directory: {folder}")
        for path in sorted(folder.iterdir()):
            if path.suffix.lower() not in IMAGE_SUFFIXES:
                continue
            try:
                with Image.open(path) as image:
                    image.verify()
            except Exception as exc:
                raise ValueError(f"Invalid image {path}: {exc}") from exc
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            groups[digest].append((path, label))
    if not groups:
        raise ValueError("No supported images found")
    for members in groups.values():
        if len({label for _, label in members}) != 1:
            raise ValueError("Identical images occur in both labels; dataset is contradictory")
    return groups


def split_groups(groups, seed: int):
    keys = list(groups)
    labels = [groups[key][0][1] for key in keys]
    train_keys, heldout_keys = train_test_split(keys, test_size=0.30, random_state=seed, stratify=labels)
    heldout_labels = [groups[key][0][1] for key in heldout_keys]
    val_keys, test_keys = train_test_split(heldout_keys, test_size=0.50, random_state=seed, stratify=heldout_labels)
    # A content hash defines one observation.  Keep one representative instead
    # of merely placing duplicates in the same split, avoiding duplicate-driven
    # weighting in both training and reported evaluation metrics.
    def expand(selected):
        return [groups[key][0] for key in selected]
    return expand(train_keys), expand(val_keys), expand(test_keys)


class MRIDataset(Dataset):
    def __init__(self, samples, image_size: int):
        self.samples, self.image_size = samples, image_size

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, index):
        path, label = self.samples[index]
        with Image.open(path) as image:
            image = image.convert("RGB").resize((self.image_size, self.image_size))
            tensor = torch.from_numpy(np.asarray(image, dtype=np.float32).copy())
        return tensor.permute(2, 0, 1).div(255.0), torch.tensor(label, dtype=torch.float32)


def scores(model, loader):
    probabilities, labels = [], []
    with torch.no_grad():
        for images, target in loader:
            probabilities.extend(torch.sigmoid(model(images)).tolist())
            labels.extend(target.int().tolist())
    predictions = [int(value >= 0.5) for value in probabilities]
    return {
        "roc_auc": float(roc_auc_score(labels, probabilities)),
        "f1": float(f1_score(labels, predictions, zero_division=0)),
        "accuracy": float(accuracy_score(labels, predictions)),
        "confusion_matrix": confusion_matrix(labels, predictions).tolist(),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path("artifacts/brain_tumor_cnn.pt"))
    parser.add_argument("--epochs", type=int, default=20)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--image-size", type=int, default=128)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    seed_everything(args.seed)
    groups = collect_grouped_samples(args.data)
    train_samples, val_samples, test_samples = split_groups(groups, args.seed)
    train_loader = DataLoader(MRIDataset(train_samples, args.image_size), batch_size=args.batch_size, shuffle=True)
    val_loader = DataLoader(MRIDataset(val_samples, args.image_size), batch_size=args.batch_size)
    test_loader = DataLoader(MRIDataset(test_samples, args.image_size), batch_size=args.batch_size)
    model = BrainTumorCNN()
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-3, weight_decay=1e-4)
    positives = sum(label for _, label in train_samples)
    loss_fn = torch.nn.BCEWithLogitsLoss(pos_weight=torch.tensor([(len(train_samples) - positives) / positives]))
    best_auc, best_state, stale_epochs = -1.0, None, 0
    for epoch in range(1, args.epochs + 1):
        model.train()
        for images, target in train_loader:
            optimizer.zero_grad()
            loss = loss_fn(model(images), target)
            loss.backward()
            optimizer.step()
        model.eval()
        validation = scores(model, val_loader)
        print(f"epoch={epoch} validation_auc={validation['roc_auc']:.4f} validation_f1={validation['f1']:.4f}")
        if validation["roc_auc"] > best_auc:
            best_auc, best_state, stale_epochs = validation["roc_auc"], {key: value.cpu() for key, value in model.state_dict().items()}, 0
        else:
            stale_epochs += 1
            if stale_epochs >= 5:
                break
    model.load_state_dict(best_state)
    model.eval()
    metrics = scores(model, test_loader)
    metrics.update({"validation_roc_auc": best_auc, "train_images": len(train_samples), "validation_images": len(val_samples), "test_images": len(test_samples), "unique_content_groups": len(groups)})
    args.output.parent.mkdir(parents=True, exist_ok=True)
    torch.save({"state_dict": model.state_dict(), "input_size": args.image_size, "threshold": 0.5, "metrics": metrics, "seed": args.seed}, args.output)
    print(json.dumps({"artifact": str(args.output), "metrics": metrics}, indent=2))


if __name__ == "__main__":
    main()
