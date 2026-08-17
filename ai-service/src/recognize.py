from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List

from .model_loader import CarClassifier
from .preprocess import validate_and_get_metadata


@dataclass(frozen=True)
class RecognitionResult:
    label: str
    confidence: float
    generation_id: int
    manufacturer_name: str
    model_name: str
    generation_code: str
    width: int
    height: int
    image_format: str
    candidates: List[dict] = field(default_factory=list)
    no_vehicle_detected: bool = False

    def as_dict(self) -> Dict[str, object]:
        best = self.candidates[0] if self.candidates else {}
        return {
            "label": self.label,
            "confidence": self.confidence,
            "generationId": self.generation_id,
            "manufacturerName": self.manufacturer_name,
            "modelName": self.model_name,
            "generationCode": self.generation_code,
            "generationSource": best.get("generationSource", "catalogue"),
            "candidates": self.candidates,
            "noVehicleDetected": self.no_vehicle_detected,
            "image": {
                "width": self.width,
                "height": self.height,
                "format": self.image_format,
            },
        }


def run_recognition(image_bytes: bytes, classifier: CarClassifier) -> RecognitionResult | None:
    width, height, image_format = validate_and_get_metadata(image_bytes)
    label, confidence, meta, candidates, no_vehicle_detected = classifier.predict(image_bytes)
    if not label or not meta:
        return None
    return RecognitionResult(
        label=label,
        confidence=round(confidence, 4),
        generation_id=meta["generationId"],
        manufacturer_name=meta["manufacturerName"],
        model_name=meta["modelName"],
        generation_code=meta["generationCode"],
        width=width,
        height=height,
        image_format=image_format,
        candidates=candidates,
        no_vehicle_detected=no_vehicle_detected,
    )
