from __future__ import annotations

import json
import re
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, Response, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from .censor import censor_to_base64
from .model_loader import CarClassifier, BASE_DIR, LABELS_PATH, REF_IMAGES_PATH
from .preprocess import decode_base64_image
from .recognize import run_recognition


# Matches collection-service's express.json({ limit: "10mb" }) convention —
# nothing previously capped how large a payload could reach YOLO/CLIP here.
MAX_IMAGE_BYTES = 10 * 1024 * 1024
# Base64 inflates size by ~4/3 — cap the string itself well above what a
# genuine <=10MB image encodes to, so oversized payloads are rejected by
# Pydantic before decode_base64_image ever allocates the raw bytes.
MAX_BASE64_CHARS = int(MAX_IMAGE_BYTES * 4 / 3) + 1024


class RecognizeBase64Request(BaseModel):
    imageBase64: str = Field(max_length=MAX_BASE64_CHARS)


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
    def health(response: Response) -> dict:
        # A missing/empty reference index means every /recognize call would
        # fail regardless of the process being "up" — surface that here
        # instead of always reporting ok.
        ready = classifier._index is not None and classifier._index.ntotal > 0
        if not ready:
            response.status_code = 503
            return {"service": "ai-service", "status": "degraded", "error": "no reference embeddings loaded"}
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
        # Read in chunks and abort as soon as the limit is crossed, instead of
        # buffering an arbitrarily large body into memory before checking its
        # size — a client could otherwise stream gigabytes past this endpoint
        # regardless of MAX_IMAGE_BYTES.
        chunks: list[bytes] = []
        total = 0
        chunk_size = 1024 * 1024
        while True:
            chunk = await file.read(chunk_size)
            if not chunk:
                break
            total += len(chunk)
            if total > MAX_IMAGE_BYTES:
                raise HTTPException(status_code=413, detail="Image exceeds the 10MB upload limit")
            chunks.append(chunk)
        image_bytes = b"".join(chunks)
        if not image_bytes:
            raise HTTPException(status_code=400, detail="Uploaded file is empty")
        # _recognize_and_censor runs real YOLO+CLIP inference synchronously —
        # calling it directly here would block the single asyncio event loop
        # for the full duration, serializing every concurrent scan behind
        # whichever one got there first. run_in_threadpool moves it onto a
        # worker thread so concurrent requests actually run concurrently.
        return await run_in_threadpool(_recognize_and_censor, image_bytes, classifier)

    @router.post("/predict")
    async def recognize_from_base64(payload: RecognizeBase64Request) -> dict:
        try:
            image_bytes = decode_base64_image(payload.imageBase64)
        except Exception as error:
            raise HTTPException(status_code=400, detail=f"Invalid image: {error}") from error

        if len(image_bytes) > MAX_IMAGE_BYTES:
            raise HTTPException(status_code=413, detail="Image exceeds the 10MB upload limit")

        return await run_in_threadpool(_recognize_and_censor, image_bytes, classifier)

    return router


def _recognize_and_censor(image_bytes: bytes, classifier: CarClassifier) -> dict:
    # Kept as two separate try/except blocks (not one shared one) — a
    # censoring crash is a fundamentally different situation from a bad
    # image and must not be reported to the user as "Invalid image", which
    # would wrongly suggest the photo itself was the problem.
    try:
        result = run_recognition(image_bytes, classifier)
    except Exception as error:
        raise HTTPException(status_code=400, detail=f"Invalid image: {error}") from error

    try:
        censored_b64 = censor_to_base64(image_bytes)
    except Exception as error:
        # censor_image_bytes() deliberately re-raises on a mid-detection
        # crash rather than shipping an unblurred plate/face (see censor.py)
        # — that's correct fail-closed behavior, but the user still deserves
        # an honest reason the scan didn't go through, not a generic error.
        raise HTTPException(
            status_code=503,
            detail="Couldn't safely process this photo — please try again.",
        ) from error

    return {"prediction": result.as_dict() if result else None, "censoredPhoto": censored_b64}
