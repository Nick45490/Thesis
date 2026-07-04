from __future__ import annotations

import json
import re
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

from .censor import censor_to_base64
from .model_loader import CarClassifier, BASE_DIR, LABELS_PATH, REF_IMAGES_PATH
from .preprocess import decode_base64_image
from .recognize import run_recognition


class RecognizeBase64Request(BaseModel):
    imageBase64: str


def _build_image_index() -> tuple[dict[int, str], dict[str, list[str]]]:
    """Build generationId→key and key→[paths] maps from model files."""
    gen_id_to_key: dict[int, str] = {}
    ref_map: dict[str, list[str]] = {}

    try:
        with LABELS_PATH.open("r", encoding="utf-8") as f:
            labels = json.load(f)
        for key, meta in labels.items():
            gid = meta.get("generationId")
            if gid is not None:
                gen_id_to_key[int(gid)] = key
    except Exception:
        pass

    try:
        with REF_IMAGES_PATH.open("r", encoding="utf-8") as f:
            raw = json.load(f)
        for key, paths in raw.items():
            ref_map[key] = paths if isinstance(paths, list) else [paths]
    except Exception:
        pass

    return gen_id_to_key, ref_map


def _load_no_car_set() -> set[str]:
    """Return filenames flagged as having no detectable vehicle."""
    p = BASE_DIR / "scripts" / "no_car_images.txt"
    if not p.exists():
        return set()
    return {line.strip() for line in p.read_text(encoding="utf-8").splitlines() if line.strip()}


def _load_preferred_display() -> dict[str, str]:
    """Return generation_key → preferred display image path, if the file exists."""
    p = BASE_DIR / "model" / "preferred_display_images.json"
    if not p.exists():
        return {}
    try:
        with p.open(encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def build_router(classifier: CarClassifier) -> APIRouter:
    router = APIRouter()

    _gen_id_to_key, _ref_map = _build_image_index()
    _no_car_names  = _load_no_car_set()
    _preferred_map = _load_preferred_display()

    @router.get("/health")
    def health() -> dict:
        return {"service": "ai-service", "status": "ok"}

    @router.get("/images/{generation_id}")
    def get_generation_image(generation_id: int) -> FileResponse:
        key = _gen_id_to_key.get(generation_id)
        if not key:
            raise HTTPException(status_code=404, detail="Generation not found")

        # Use CLIP-selected display image if available
        if key in _preferred_map:
            preferred = Path(_preferred_map[key])
            if preferred.exists() and preferred.name not in _no_car_names:
                suffix = preferred.suffix.lower()
                media  = "image/jpeg" if suffix in (".jpg", ".jpeg") else "image/png"
                return FileResponse(str(preferred), media_type=media)

        all_paths = [Path(p) for p in _ref_map.get(key, []) if Path(p).exists()]
        if not all_paths:
            raise HTTPException(status_code=404, detail="No image available for this generation")

        def _slot_index(p: Path) -> int:
            m = re.search(r"_(\d+)\.\w+$", p.name)
            return int(m.group(1)) if m else 999

        real_paths = [p for p in all_paths if p.name not in _no_car_names]
        candidates = real_paths if real_paths else all_paths
        chosen = sorted(candidates, key=_slot_index)[0]

        suffix = chosen.suffix.lower()
        media  = "image/jpeg" if suffix in (".jpg", ".jpeg") else "image/png"
        return FileResponse(str(chosen), media_type=media)

    @router.post("/")
    async def recognize_from_upload(file: UploadFile = File(...)) -> dict:
        image_bytes = await file.read()
        if not image_bytes:
            raise HTTPException(status_code=400, detail="Uploaded file is empty")
        try:
            result       = run_recognition(image_bytes, classifier)
            censored_b64 = censor_to_base64(image_bytes)
            return {"prediction": result.as_dict() if result else None, "censoredPhoto": censored_b64}
        except Exception as error:
            raise HTTPException(status_code=400, detail=f"Invalid image: {error}") from error

    @router.post("/predict")
    def recognize_from_base64(payload: RecognizeBase64Request) -> dict:
        try:
            image_bytes  = decode_base64_image(payload.imageBase64)
            result       = run_recognition(image_bytes, classifier)
            censored_b64 = censor_to_base64(image_bytes)
            return {"prediction": result.as_dict() if result else None, "censoredPhoto": censored_b64}
        except Exception as error:
            raise HTTPException(status_code=400, detail=f"Invalid image: {error}") from error

    return router
