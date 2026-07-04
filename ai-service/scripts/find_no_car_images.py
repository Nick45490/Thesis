"""
Scans all reference images with YOLO and reports files where no vehicle is detected.
Run from the ai-service directory:
    python scripts/find_no_car_images.py
"""

from pathlib import Path
from ultralytics import YOLO
from PIL import Image

REF_DIR     = Path(__file__).resolve().parents[1] / "model" / "reference_images"
YOLO_MODEL  = "yolov8n.pt"
CAR_CLASSES = {2, 5, 7}   # COCO: car, bus, truck

def main():
    print(f"Loading YOLO ({YOLO_MODEL})...")
    yolo = YOLO(YOLO_MODEL)

    images = sorted(REF_DIR.glob("*.jpg")) + sorted(REF_DIR.glob("*.jpeg")) + sorted(REF_DIR.glob("*.png"))
    total  = len(images)
    print(f"Scanning {total} images in {REF_DIR}...\n")

    no_car = []
    for i, path in enumerate(images, 1):
        if i % 500 == 0 or i == total:
            print(f"  {i}/{total}...")
        try:
            img     = Image.open(path).convert("RGB")
            results = yolo(img, verbose=False)
            boxes   = [b for b in results[0].boxes if int(b.cls[0]) in CAR_CLASSES]
            if not boxes:
                no_car.append(path.name)
        except Exception as exc:
            print(f"  ERROR reading {path.name}: {exc}")

    print(f"\n=== Done ===")
    print(f"Total images:      {total}")
    print(f"No vehicle found:  {len(no_car)}")

    if no_car:
        out = Path(__file__).parent / "no_car_images.txt"
        out.write_text("\n".join(no_car), encoding="utf-8")
        print(f"\nList saved to: {out}")
        print("\nFirst 20:")
        for name in no_car[:20]:
            print(f"  {name}")

if __name__ == "__main__":
    main()