from __future__ import annotations

import base64
from io import BytesIO
from typing import Tuple

from PIL import Image


def decode_base64_image(data: str) -> bytes:
	payload = data.split(",", 1)[1] if "," in data else data
	return base64.b64decode(payload)


def validate_and_get_metadata(image_bytes: bytes) -> Tuple[int, int, str]:
	with Image.open(BytesIO(image_bytes)) as image:
		image.verify()

	with Image.open(BytesIO(image_bytes)) as image:
		width, height = image.size
		image_format = image.format or "unknown"

	return width, height, image_format
