from __future__ import annotations

import logging

from dotenv import load_dotenv
from fastapi import FastAPI

from .model_loader import CarClassifier, load_labels_dict
from .routes import build_router

load_dotenv()
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="AI Recognition Service", version="2.0.0")

labels_dict = load_labels_dict()
classifier = CarClassifier(labels_dict)

app.include_router(build_router(classifier))
