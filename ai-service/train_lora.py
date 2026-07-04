"""
LoRA fine-tuning of CLIP vision encoder for car-generation recognition.

Loss:   Supervised Contrastive (SupCon) — no classification head needed.
        Each batch contains P classes x K images; the model learns to pull
        same-generation embeddings together and push different ones apart.
        This directly improves the FAISS nearest-neighbour search.

Usage:
    pip install peft

    python train_lora.py                  # defaults
    python train_lora.py --epochs 50 --rank 16 --p 16 --k 4
    python train_lora.py --eval-only      # score existing LoRA weights
"""

from __future__ import annotations

import argparse
import json
import random
from collections import defaultdict
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from PIL import Image, ImageEnhance
from peft import LoraConfig, PeftModel, get_peft_model
from torch.utils.data import DataLoader, Dataset, Sampler
from transformers import CLIPModel, CLIPProcessor

# ── paths ─────────────────────────────────────────────────────────────────────

BASE_DIR       = Path(__file__).parent
LABELS_PATH    = BASE_DIR / "model" / "class_labels.json"
REF_MAP_PATH   = BASE_DIR / "model" / "reference_images.json"
LORA_SAVE_DIR  = BASE_DIR / "model" / "clip_lora"
CLIP_MODEL_ID  = "openai/clip-vit-large-patch14"

# ── hyper-parameters (overridable via CLI) ────────────────────────────────────

LORA_RANK    = 16
LORA_ALPHA   = 32
LORA_DROPOUT = 0.05
P_CLASSES    = 8      # classes per batch (16 OOMs on T4 with ViT-L/14)
K_SAMPLES    = 4      # augmented samples per class per batch
EPOCHS       = 40
LR           = 2e-4
TEMPERATURE  = 0.07
VAL_SPLIT    = 0.10

# ── augmentation ──────────────────────────────────────────────────────────────

def _augment(img: Image.Image) -> list[Image.Image]:
    w, h = img.size
    return [
        img,
        img.transpose(Image.FLIP_LEFT_RIGHT),
        ImageEnhance.Brightness(img).enhance(random.uniform(0.75, 1.35)),
        ImageEnhance.Contrast(img).enhance(random.uniform(0.80, 1.30)),
        ImageEnhance.Color(img).enhance(random.uniform(0.80, 1.20)),
        img.rotate(random.uniform(-10, 10), expand=False, fillcolor=(128, 128, 128)),
        img.crop((int(w * 0.05), int(h * 0.05), int(w * 0.95), int(h * 0.95))).resize((w, h), Image.LANCZOS),
        img.crop((0, 0, int(w * 0.88), h)).resize((w, h), Image.LANCZOS),
        img.crop((int(w * 0.12), 0, w, h)).resize((w, h), Image.LANCZOS),
    ]

# ── dataset ───────────────────────────────────────────────────────────────────

class GenerationDataset(Dataset):
    def __init__(self, samples: list[tuple[Path, int]], processor: CLIPProcessor, augment: bool = True):
        self.samples   = samples
        self.processor = processor
        self.augment   = augment

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int) -> tuple[torch.Tensor, int]:
        path, label = self.samples[idx]
        img = Image.open(path).convert("RGB")
        if self.augment:
            img = random.choice(_augment(img))
        enc = self.processor(images=img, return_tensors="pt")
        return enc["pixel_values"].squeeze(0), label

# ── P-K sampler ───────────────────────────────────────────────────────────────

class PKSampler(Sampler):
    """
    Yields batches of exactly P * K indices: P randomly chosen classes,
    K instances drawn (with replacement when a class has fewer than K images).
    """
    def __init__(self, labels: list[int], p: int, k: int):
        self.p = p
        self.k = k
        self.class_to_idx: dict[int, list[int]] = defaultdict(list)
        for i, lbl in enumerate(labels):
            self.class_to_idx[lbl].append(i)
        self.classes = list(self.class_to_idx.keys())

    def __iter__(self):
        classes = self.classes.copy()
        random.shuffle(classes)
        for start in range(0, len(classes) - self.p + 1, self.p):
            batch = []
            for cls in classes[start:start + self.p]:
                idxs = self.class_to_idx[cls]
                batch.extend(random.choices(idxs, k=self.k))
            yield batch

    def __len__(self) -> int:
        return len(self.classes) // self.p

# ── Supervised Contrastive loss ───────────────────────────────────────────────

class SupConLoss(nn.Module):
    """
    Khosla et al., 2020 — "Supervised Contrastive Learning"
    https://arxiv.org/abs/2004.11362
    """
    def __init__(self, temperature: float = 0.07):
        super().__init__()
        self.temperature = temperature

    def forward(self, features: torch.Tensor, labels: torch.Tensor) -> torch.Tensor:
        # features: (N, D), already L2-normalised
        N      = features.size(0)
        device = features.device

        sim    = torch.matmul(features, features.T) / self.temperature   # (N, N)
        eye    = torch.eye(N, device=device)

        # Positive mask: same label, excluding diagonal
        pos_mask = (labels.unsqueeze(0) == labels.unsqueeze(1)).float()
        pos_mask = pos_mask - eye

        # Log-softmax (mask out self before computing denominator)
        sim_masked = sim - eye * 1e9
        log_denom  = torch.logsumexp(sim_masked, dim=1, keepdim=True)   # (N, 1)
        log_prob   = sim - log_denom                                     # (N, N)

        n_pos = pos_mask.sum(dim=1).clamp(min=1)
        loss  = -(pos_mask * log_prob).sum(dim=1) / n_pos

        return loss.mean()

# ── LoRA setup ────────────────────────────────────────────────────────────────

def apply_lora(clip: CLIPModel, rank: int, alpha: int, dropout: float) -> CLIPModel:
    cfg = LoraConfig(
        r            = rank,
        lora_alpha   = alpha,
        lora_dropout = dropout,
        # PEFT matches by suffix — "q_proj" / "v_proj" hits every attention layer
        # in both the vision and text encoders (text encoder is unused at inference).
        target_modules = ["q_proj", "v_proj"],
        modules_to_save = ["visual_projection"],
        bias = "none",
    )
    return get_peft_model(clip, cfg)

# ── embedding helper ──────────────────────────────────────────────────────────

def embed_batch(model: CLIPModel, pixel_values: torch.Tensor) -> torch.Tensor:
    out  = model.vision_model(pixel_values=pixel_values)
    feat = model.visual_projection(out.pooler_output)
    return F.normalize(feat, dim=-1)

# ── evaluation ────────────────────────────────────────────────────────────────

@torch.no_grad()
def evaluate(model: CLIPModel, processor: CLIPProcessor,
             samples: list[tuple[Path, int]], device: torch.device) -> dict:
    model.eval()
    embs, lbls = [], []
    for path, label in samples:
        try:
            img = Image.open(path).convert("RGB")
            enc = processor(images=img, return_tensors="pt")
            pv  = enc["pixel_values"].to(device)
            e   = embed_batch(model, pv)
            embs.append(e.cpu())
            lbls.append(label)
        except Exception:
            pass

    if not embs:
        return {"top1": 0.0, "top5": 0.0}

    mat  = torch.cat(embs, dim=0)          # (N, 512)
    lbls = torch.tensor(lbls)
    sim  = mat @ mat.T
    sim.fill_diagonal_(-1e9)

    k       = min(5, sim.size(0) - 1)
    _, topk = sim.topk(k, dim=1)
    top1    = (lbls[topk[:, 0]] == lbls).float().mean().item()
    top5    = (lbls[topk] == lbls.unsqueeze(1)).any(dim=1).float().mean().item()

    return {"top1": top1, "top5": top5}

# ── data loading ──────────────────────────────────────────────────────────────

def load_samples() -> tuple[list[tuple[Path, int]], dict[int, str]]:
    with LABELS_PATH.open("r", encoding="utf-8") as f:
        labels_dict = json.load(f)
    with REF_MAP_PATH.open("r", encoding="utf-8") as f:
        ref_map = json.load(f)

    all_keys  = sorted(labels_dict.keys())
    key_to_idx = {k: i for i, k in enumerate(all_keys)}
    idx_to_key = {i: k for k, i in key_to_idx.items()}

    samples: list[tuple[Path, int]] = []
    for key, paths in ref_map.items():
        if key not in key_to_idx:
            continue
        label     = key_to_idx[key]
        path_list = paths if isinstance(paths, list) else [paths]
        for p in path_list:
            ph = Path(p)
            if ph.exists():
                samples.append((ph, label))

    return samples, idx_to_key

def split_samples(samples, val_ratio: float = VAL_SPLIT):
    by_class: dict[int, list] = defaultdict(list)
    for s in samples:
        by_class[s[1]].append(s)

    train, val = [], []
    for cls_samples in by_class.values():
        random.shuffle(cls_samples)
        cut = max(1, int(len(cls_samples) * (1 - val_ratio)))
        train.extend(cls_samples[:cut])
        val.extend(cls_samples[cut:])
    return train, val

# ── training loop ─────────────────────────────────────────────────────────────

def train(args: argparse.Namespace) -> None:
    device  = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    use_amp = torch.cuda.is_available()
    print(f"Device: {device}  AMP: {use_amp}")

    random.seed(42)
    torch.manual_seed(42)

    samples, idx_to_key = load_samples()
    n_classes = len(set(l for _, l in samples))
    print(f"Loaded {len(samples)} images across {n_classes} generations")

    train_samples, val_samples = split_samples(samples, args.val_split)
    print(f"Train: {len(train_samples)}   Val: {len(val_samples)}")

    # Load CLIP + apply LoRA
    print(f"Loading {CLIP_MODEL_ID} …")
    processor = CLIPProcessor.from_pretrained(CLIP_MODEL_ID)
    clip      = CLIPModel.from_pretrained(CLIP_MODEL_ID)
    model     = apply_lora(clip, args.rank, args.rank * 2, LORA_DROPOUT)
    model.print_trainable_parameters()
    model.to(device)

    # Gradient checkpointing: recomputes activations during backward instead of
    # storing them — cuts activation VRAM from ~7 GB to ~700 MB for ViT-L/14.
    model.enable_input_require_grads()
    model.gradient_checkpointing_enable()

    torch.cuda.empty_cache()

    train_labels = [l for _, l in train_samples]
    dataset  = GenerationDataset(train_samples, processor, augment=True)
    sampler  = PKSampler(train_labels, p=args.p, k=args.k)
    loader   = DataLoader(dataset, batch_sampler=sampler, num_workers=0, pin_memory=False)

    criterion = SupConLoss(temperature=TEMPERATURE)
    optimizer = torch.optim.AdamW(
        [p for p in model.parameters() if p.requires_grad],
        lr=args.lr, weight_decay=1e-4,
    )
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs)
    scaler    = torch.cuda.amp.GradScaler(enabled=use_amp)

    best_top1 = 0.0
    LORA_SAVE_DIR.mkdir(parents=True, exist_ok=True)

    for epoch in range(1, args.epochs + 1):
        model.train()
        total_loss, steps = 0.0, 0

        for pixel_values, labels in loader:
            pixel_values = pixel_values.to(device)
            labels       = labels.to(device)

            with torch.cuda.amp.autocast(enabled=use_amp):
                features = embed_batch(model, pixel_values)
                loss     = criterion(features, labels)

            optimizer.zero_grad()
            scaler.scale(loss).backward()
            scaler.unscale_(optimizer)
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            scaler.step(optimizer)
            scaler.update()

            total_loss += loss.item()
            steps      += 1
            if steps % 10 == 0:
                print(f"  step {steps}  loss={loss.item():.4f}", flush=True)

        scheduler.step()
        avg_loss = total_loss / max(steps, 1)

        if epoch % 5 == 0 or epoch == 1 or epoch == args.epochs:
            metrics = evaluate(model, processor, val_samples, device)
            marker  = ""
            if metrics["top1"] > best_top1:
                best_top1 = metrics["top1"]
                model.save_pretrained(LORA_SAVE_DIR)
                marker = "  <- saved"
            print(f"Epoch {epoch:3d}  loss={avg_loss:.4f}  "
                  f"top-1={metrics['top1']:.3f}  top-5={metrics['top5']:.3f}{marker}")
        else:
            print(f"Epoch {epoch:3d}  loss={avg_loss:.4f}")

    print(f"\nDone.  Best val top-1: {best_top1:.3f}")
    print(f"LoRA adapter saved to: {LORA_SAVE_DIR}")
    print("Re-start the AI service to pick up the new weights (delete reference_embeddings.pt first).")

# ── eval-only mode ────────────────────────────────────────────────────────────

def eval_only() -> None:
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    samples, _ = load_samples()
    _, val_samples = split_samples(samples)

    processor = CLIPProcessor.from_pretrained(CLIP_MODEL_ID)
    clip      = CLIPModel.from_pretrained(CLIP_MODEL_ID)

    if LORA_SAVE_DIR.exists():
        print(f"Loading LoRA weights from {LORA_SAVE_DIR} …")
        model = PeftModel.from_pretrained(clip, str(LORA_SAVE_DIR))
    else:
        print("No LoRA weights found — evaluating base CLIP.")
        model = clip

    model.to(device)
    metrics = evaluate(model, processor, val_samples, device)
    print(f"Val top-1: {metrics['top1']:.3f}   top-5: {metrics['top5']:.3f}")

# ── entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="LoRA fine-tune CLIP for car generation recognition")
    parser.add_argument("--epochs",      type=int,   default=EPOCHS,      help="Training epochs")
    parser.add_argument("--rank",        type=int,   default=LORA_RANK,   help="LoRA rank")
    parser.add_argument("--p",           type=int,   default=P_CLASSES,   help="Classes per batch")
    parser.add_argument("--k",           type=int,   default=K_SAMPLES,   help="Samples per class per batch")
    parser.add_argument("--lr",          type=float, default=LR,          help="Learning rate")
    parser.add_argument("--val-split",   type=float, default=VAL_SPLIT,   help="Validation fraction")
    parser.add_argument("--eval-only",   action="store_true",             help="Score existing LoRA weights and exit")
    parser.add_argument("--labels-path", type=str,   default=None,        help="Override path to class_labels.json")
    parser.add_argument("--ref-map",     type=str,   default=None,        help="Override path to reference_images.json")
    parser.add_argument("--output-dir",  type=str,   default=None,        help="Override LoRA output directory")
    args = parser.parse_args()

    # Allow Colab / remote environments to override paths
    if args.labels_path:
        LABELS_PATH = Path(args.labels_path)
    if args.ref_map:
        REF_MAP_PATH = Path(args.ref_map)
    if args.output_dir:
        LORA_SAVE_DIR = Path(args.output_dir)

    if args.eval_only:
        eval_only()
    else:
        train(args)
