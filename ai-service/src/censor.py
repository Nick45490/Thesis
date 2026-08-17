"""
Privacy censoring: blurs license plates and faces in user-submitted photos
before they are stored in the collection.

Both detection models are loaded lazily on first use and cached for the
lifetime of the process. If a model fails to download (offline, etc.) the
corresponding region type is simply skipped. A crash during actual detection
on a given image is a different case and is NOT swallowed — it propagates so
the scan is rejected rather than stored with an unblurred plate/face.
"""
from __future__ import annotations

import base64
import logging
from io import BytesIO

from PIL import Image, ImageFilter

logger = logging.getLogger(__name__)

_BLUR_RADIUS = 22    # strong enough to make plates/faces unreadable
_PADDING     = 0.08  # 8% padding added around each detected box

_plate_model = None
_face_model  = None


def _get_plate_model():
    global _plate_model
    if _plate_model is not None:
        return _plate_model
    try:
        from ultralytics import YOLO
        _plate_model = YOLO("keremberke/yolov8n-license-plate-detection")
        logger.info("Plate detection model ready.")
    except Exception as exc:
        logger.warning("Plate model unavailable (%s) — plates won't be blurred.", exc)
        _plate_model = False
    return _plate_model


def _get_face_model():
    global _face_model
    if _face_model is not None:
        return _face_model
    try:
        from ultralytics import YOLO
        _face_model = YOLO("arnabdhar/YOLOv8-Face-Detection")
        logger.info("Face detection model ready.")
    except Exception as exc:
        logger.warning("Face model unavailable (%s) — faces won't be blurred.", exc)
        _face_model = False
    return _face_model


def _detect(model, img: Image.Image) -> list[tuple[int, int, int, int]]:
    if not model:
        return []
    try:
        results = model(img, verbose=False)
        return [(int(b.xyxy[0][0]), int(b.xyxy[0][1]),
                 int(b.xyxy[0][2]), int(b.xyxy[0][3]))
                for b in results[0].boxes]
    except Exception:
        # Distinct from "model not loaded" above (which is an intentional skip) —
        # a crash mid-inference must not look like "no detections found", since
        # that would silently ship an unblurred plate/face. Let it propagate so
        # censor_image_bytes rejects the photo instead of treating this as clean.
        logger.exception("Detector inference failed on this image.")
        raise


def _apply_blur(img: Image.Image, boxes: list[tuple[int, int, int, int]]) -> Image.Image:
    w, h = img.size
    img = img.copy()
    for (x1, y1, x2, y2) in boxes:
        pad_x = max(4, int((x2 - x1) * _PADDING))
        pad_y = max(4, int((y2 - y1) * _PADDING))
        rx1, ry1 = max(0, x1 - pad_x), max(0, y1 - pad_y)
        rx2, ry2 = min(w, x2 + pad_x), min(h, y2 + pad_y)
        region  = img.crop((rx1, ry1, rx2, ry2))
        blurred = region.filter(ImageFilter.GaussianBlur(radius=_BLUR_RADIUS))
        img.paste(blurred, (rx1, ry1))
    return img


def censor_image_bytes(image_bytes: bytes) -> bytes:
    """
    Detect and blur license plates and faces. Returns JPEG bytes.

    Deliberately does NOT fall back to the original image on failure — a photo
    that can't be censored must not be stored uncensored. Callers (see routes.py)
    already turn an exception here into a 400, rejecting the scan instead.
    """
    img = Image.open(BytesIO(image_bytes)).convert("RGB")

    plate_boxes = _detect(_get_plate_model(), img)
    face_boxes  = _detect(_get_face_model(),  img)
    all_boxes   = plate_boxes + face_boxes

    if all_boxes:
        img = _apply_blur(img, all_boxes)
        logger.info("Censored %d plate(s), %d face(s).", len(plate_boxes), len(face_boxes))

    buf = BytesIO()
    img.save(buf, format="JPEG", quality=92)
    return buf.getvalue()


def censor_to_base64(image_bytes: bytes) -> str:
    """Censor and return as a base64 data URL."""
    return "data:image/jpeg;base64," + base64.b64encode(censor_image_bytes(image_bytes)).decode()