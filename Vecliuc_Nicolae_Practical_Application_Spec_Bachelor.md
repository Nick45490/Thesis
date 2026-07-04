# Street Scout — Practical Application Specification

**Author:** Vecliuc Nicolae-Vlăduț  
**Repository:** [https://github.com/Nick45490/Thesis]

---

## Project Description

Street Scout is a microservice-based web application for AI-powered car recognition, collection, and gamification. Users photograph cars in the real world; a pipeline built on YOLO (vehicle detection), CLIP (visual embedding), and logistic regression identifies the make, model, and generation from a catalogue of 813 vehicle generations across 54 manufacturers. Identified cars are added to a personal collection displayed as trading cards, and users compete through asynchronous drag races resolved using Hollander's quarter-mile ET formula with real engine data.

### Services

| Service | Port | Technology |
|---|---|---|
| API Gateway | 8080 | Node.js / http-proxy-middleware |
| auth-service | 3001 | Node.js / Express / PostgreSQL |
| catalogue-service | 3002 | Node.js / Express (in-memory) |
| collection-service | 3003 | Node.js / Express / PostgreSQL |
| gamification-service | 3004 | Node.js / Express / PostgreSQL |
| ai-service | 8000 | Python / FastAPI / YOLO / CLIP / FAISS |
| frontend | 5173 | React 18 / Vite |

---

## Prerequisites

- **Node.js** v18 or later
- **Python** 3.10 or later
- **PostgreSQL** 14 or later (database name: `thesis`)
- **Git**

---

## Large Model Files (Google Drive)

The following files exceed Git's size limits and are hosted on Google Drive. Download them before starting the AI service.

| File | Destination | Link |
|---|---|---|
| `reference_images.zip` (3.3 GB) | Extract to `ai-service/model/reference_images/` | [https://drive.google.com/drive/folders/1IRskjWEsWlUsSQ97ez3m1y9lkhjECYy3?usp=drive_link] |
| `reference_embeddings.pt` (98.5 MB) | Place in `ai-service/model/` | [https://drive.google.com/file/d/113GbOr-4FYQPYesx-I081HBBCbMzffSQ/view?usp=drive_link] |

> `reference_images/` contains the reference photos used to build the FAISS index.  
> `reference_embeddings.pt` is the pre-computed FAISS index — the app uses this directly without needing to rebuild.

---

## Installation

### 1. Clone the repository

```bash
git clone [https://github.com/Nick45490/Thesis]
cd Thesis
```

### 2. Download model files from Google Drive

Download the two files from the links above and place them:

```
ai-service/model/reference_images/   ← extracted from reference_images.zip
ai-service/model/reference_embeddings.pt
```

### 3. Install Node.js dependencies

Run in separate terminals or sequentially:

```powershell
cd gateway           ; npm install ; cd ..
cd auth-service      ; npm install ; cd ..
cd catalogue-service ; npm install ; cd ..
cd collection-service; npm install ; cd ..
cd gamification-service ; npm install ; cd ..
cd frontend          ; npm install ; cd ..
```

### 4. Install Python dependencies

```powershell
cd ai-service
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
cd ..
```

### 5. Set up PostgreSQL

Create a database named `thesis` and a user with access:

```sql
CREATE DATABASE thesis;
```

Each service creates its own tables automatically on first start — no migration runner needed.

### 6. Configure environment variables

Copy the example env files and fill in your values:

```powershell
copy .env.example .env
copy gateway\.env.example gateway\.env
copy frontend\.env.example frontend\.env
```

Edit `gateway/.env` and set:

```
JWT_SECRET=your-secret-here
```

Edit `.env` (root) and set:

```
JWT_SECRET=your-secret-here
POSTGRES_PASSWORD=your-postgres-password
```

Each service also reads its database connection from environment variables — see each service's `.env.example` for details.

---

## Build Steps

### Frontend (production build)

```powershell
cd frontend
npm run build
```

The built files are output to `frontend/dist/`. For development, use `npm run dev` instead (see Launch section below).

### AI service

No build step required. The YOLO model (`yolov8n.pt`) is downloaded automatically by the `ultralytics` package on first run.

The classifier (`ai-service/model/classifier.pkl`) is included in the repository. To retrain it from scratch:

```powershell
cd ai-service
.\venv\Scripts\activate
python train_classifier.py
```

---

## Launch

Start each service in its own terminal window:

```powershell
# Terminal 1 — Gateway
cd gateway
npm start

# Terminal 2 — Auth service
cd auth-service
npm start

# Terminal 3 — Catalogue service
cd catalogue-service
npm start

# Terminal 4 — Collection service
cd collection-service
npm start

# Terminal 5 — Gamification service
cd gamification-service
npm start

# Terminal 6 — AI service
cd ai-service
.\venv\Scripts\activate
uvicorn src.main:app --reload --port 8000

# Terminal 7 — Frontend
cd frontend
npm run dev
```

Once all services are running, open **http://localhost:5173** in your browser.

### Verify everything is up

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\smoke-test.ps1
```

---

## Endpoints

| URL | Description |
|---|---|
| http://localhost:5173 | Frontend (React SPA) |
| http://localhost:8080/health | API Gateway health check |
| http://localhost:3001 | auth-service (direct) |
| http://localhost:3002 | catalogue-service (direct) |
| http://localhost:3003 | collection-service (direct) |
| http://localhost:3004 | gamification-service (direct) |
| http://localhost:8000/docs | AI service — FastAPI Swagger UI |
