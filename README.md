# Street Scout

AI-powered car recognition, collection, and gamification web app. Photograph a car — the app identifies the make, model, and generation and adds it to your personal collection. Compete with friends through drag races using real engine data.

---

## Features

- **Car recognition** — YOLO detects and crops the vehicle, CLIP embeds it, logistic regression classifies it across 813 generations from 54 manufacturers
- **Trading card collection** — every scanned car becomes a rarity-tiered card with engine stats (horsepower, torque, weight)
- **Drag racing** — asynchronous race challenges resolved with Hollander's quarter-mile ET formula and real engine data
- **Achievements** — two independent systems tracking collection milestones and racing performance
- **Friends & leaderboard** — invite-code friend system, friend profile browsing, global points leaderboard
- **Privacy** — licence plates and faces are blurred before any scan photo is stored (GDPR compliance)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, React Router v6 |
| API Gateway | Node.js, http-proxy-middleware |
| Auth / Collection / Gamification | Node.js, Express, PostgreSQL |
| Catalogue | Node.js, Express (in-memory JSON) |
| AI service | Python, FastAPI, YOLOv8, CLIP ViT-L/14, FAISS, scikit-learn |

---

## Architecture

```
Browser → Frontend (:5173) → Gateway (:8080) → microservices
```

Six services behind a single API gateway. The gateway handles JWT verification, rate limiting, and path-based proxying. Services communicate only through the gateway — never directly with each other.

| Service | Port |
|---|---|
| Gateway | 8080 |
| auth-service | 3001 |
| catalogue-service | 3002 |
| collection-service | 3003 |
| gamification-service | 3004 |
| ai-service | 8000 |
| Frontend | 5173 |

---

## Prerequisites

- Node.js v18+
- Python 3.10+
- PostgreSQL 14+ (database name: `thesis`)

---

## Setup

### 1. Clone

```bash
git clone https://github.com/Nick45490/Thesis.git
cd Thesis
```

### 2. Download model files

Two large files are hosted on Google Drive — download and place them before starting the AI service:

| File | Destination |
|---|---|
| [reference\_images](https://drive.google.com/drive/folders/1IRskjWEsWlUsSQ97ez3m1y9lkhjECYy3?usp=drive_link) (3.3 GB) | `ai-service/model/reference_images/` |
| [reference\_embeddings.pt](https://drive.google.com/file/d/113GbOr-4FYQPYesx-I081HBBCbMzffSQ/view?usp=drive_link) (98.5 MB) | `ai-service/model/` |

### 3. Install dependencies

```powershell
npm install --prefix gateway
npm install --prefix auth-service
npm install --prefix catalogue-service
npm install --prefix collection-service
npm install --prefix gamification-service
npm install --prefix frontend
```

```powershell
python -m venv ai-service\venv
ai-service\venv\Scripts\activate
pip install -r ai-service\requirements.txt
```

### 4. Configure environment

```powershell
copy .env.example .env
copy gateway\.env.example gateway\.env
copy frontend\.env.example frontend\.env
```

Set `JWT_SECRET` in both `.env` and `gateway/.env`.

### 5. Database

Create a PostgreSQL database named `thesis`. Each service creates its own tables on first start — no migrations needed.

---

## Running

Start each service in its own terminal:

```powershell
# Gateway
cd gateway && npm start

# Auth
cd auth-service && npm start

# Catalogue
cd catalogue-service && npm start

# Collection
cd collection-service && npm start

# Gamification
cd gamification-service && npm start

# AI service
cd ai-service && venv\Scripts\activate && uvicorn src.main:app --reload --port 8000

# Frontend
cd frontend && npm run dev
```

Open **http://localhost:5173**

---

## AI Recognition Pipeline

1. **YOLO** (YOLOv8n) — detects and crops the largest vehicle bounding box
2. **CLIP** (ViT-L/14) — embeds the crop into a 512-dim vector
3. **Logistic regression** — classifies against 813 vehicle generations (78.9% top-1 validation accuracy)
4. **FAISS** — nearest-neighbour fallback when the classifier confidence is below threshold
5. **Censor** — blurs licence plates and faces before storing the image
