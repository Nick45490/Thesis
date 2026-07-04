# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: Street Scout

A microservice-based web app for car recognition, collection, and gamification. Users photograph cars, the AI identifies them, they build a personal collection, and compete via races/achievements/leaderboards with friends.

## Running the stack

**The user does NOT use Docker.** Each service is started directly in its own terminal window.

```powershell
# Start each service in a separate terminal:
cd auth-service        && npm start   # :3001
cd catalogue-service   && npm start   # :3002
cd collection-service  && npm start   # :3003
cd gamification-service && npm start  # :3004
cd frontend            && npm run dev # :5173
# ai-service: cd ai-service && uvicorn src.main:app --reload --port 8000
```

After changing backend files, stop the service terminal (Ctrl+C) and restart with `npm start`. DB schema changes (ALTER TABLE) run automatically via `initDb()` on startup.

Endpoints once running:
- Frontend: http://localhost:5173
- Gateway: http://localhost:8080/health
- Services also exposed directly on 3001–3004, 8000

## Smoke test (full end-to-end)

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\smoke-test.ps1
# With custom params:
powershell -ExecutionPolicy Bypass -File .\scripts\smoke-test.ps1 -BaseUrl http://localhost:8080 -Email test@example.com -Username tester -Password Passw0rd!
```

## Environment setup

Copy `.env.example` to `.env` in the root and set `JWT_SECRET`. Each service also has its own `.env.example`. Individual service `.env` files are used when running services outside Docker.

## Architecture

### Request flow

```
Browser → Frontend (Vite, :5173) → Gateway (:8080) → microservices
```

The gateway is the single entrypoint. It proxies by path prefix, strips the prefix before forwarding, and injects `x-user-id` / `x-user-email` headers on authenticated requests. Services read the user identity from those headers, never from JWT directly.

**Public routes** (no token): `/auth`, `/catalogue`
**Protected routes** (Bearer token required): `/collection`, `/gamification`, `/recognize`

Rate limits: 1000 req/15 min globally, 200 req/15 min on `/auth`.

### Services

| Service | Port | DB | Notes |
|---|---|---|---|
| gateway | 8080 | — | http-proxy-middleware, JWT verify, rate-limit |
| auth-service | 3001 | PostgreSQL | Users, friend requests, invite codes |
| catalogue-service | 3002 | in-memory | Car data loaded from `data.json` at startup |
| collection-service | 3003 | PostgreSQL | User car collection + engine data + progress + achievements |
| gamification-service | 3004 | PostgreSQL | Races, achievements, leaderboard, challenges |
| ai-service | 8000 | — | Python/FastAPI; YOLO + CLIP + FAISS |

### AI recognition pipeline (`ai-service/src/model_loader.py`)

1. **YOLO** (yolov8n) detects and crops the largest vehicle bounding box from the image.
2. **CLIP** (openai/clip-vit-base-patch32, optionally with a LoRA adapter from `model/clip_lora/`) embeds the cropped image into a 512-dim vector.
3. **FAISS** (IndexFlatIP) nearest-neighbour search against pre-computed reference embeddings (5 augmentations × N reference images).
4. Two-level aggregation: first ranks (make, model) pairs by average similarity score, then within the winner picks the generation with the most FAISS votes.
5. Embedding cache (`model/reference_embeddings.pt`) is rebuilt only when the source image count changes.

Reference images live in `ai-service/model/reference_images/`. Add new ones and restart the service to rebuild the FAISS index.

### Database schema (PostgreSQL)

Schema is created inline by each service's `initDb()` call on startup — no separate migration runner. `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` handles existing tables. Tables:

- **auth-service**: `users`, `friend_requests`, `friend_invite_codes`
- **collection-service**: `user_collections` — includes engine columns: `engine_name`, `engine_fuel_type`, `engine_horsepower`, `engine_torque_nm`, `engine_weight_kg`
- **gamification-service**: `race_challenges` — includes `challenger_horsepower`, `challenger_weight_kg`, `opponent_horsepower`, `opponent_weight_kg`

All three services share the single `thesis` database with separate tables.

### Frontend (`frontend/src/`)

React + Vite SPA. All API calls go through `api/http.js:apiFetch`, which reads the JWT from **`sessionStorage`** key `thesis_token` (sessionStorage isolates each browser tab — needed for multi-account testing). `VITE_API_BASE_URL` controls the gateway URL (defaults to `http://localhost:8080`).

Auth state lives in `context/AuthContext.jsx`; collection state in `context/CollectionContext.jsx`.

### Friends system

Invite-code based flow (all on the Friends page — **not** the Profile page):
1. Code owner clicks "Generate Code" on the Friends page → 6-char code, 15-min TTL, single-use, invalidates any prior unused code.
2. Code owner shares the code with a friend.
3. Friend enters the code on their Friends page → creates a pending friend request.
4. Code owner accepts the request on their Friends page.

Friends list is clickable — each friend links to `/friends/:id` (FriendProfile page) showing their username, stats, and full car collection.

The `DELETE /friends/:friendId` endpoint exists in the backend but has no UI surface.

### Engine data

Each car generation in `catalogue-service/seed/data.json` has an `engines[]` array with 3–4 real engines (name, fuelType, horsepower, torqueNm, weightKg). Populated via `scripts/populate-engines.js` using the Claude API (claude-haiku-4-5-20251001). 812/813 generations are populated; Subaru Forester SJ (2012) had a timeout and can be retried by re-running the script (it skips already-populated entries).

When a user scans a car (`Camera.jsx`), a random engine from the generation's `engines[]` is picked and stored in the collection item. This engine is displayed on the car card and used for race calculations.

### Gamification & Race algorithm

Race resolution uses Hollander's quarter-mile ET formula when engine data is available:

```
quarter_time = 6.269 × (weightKg × 2.20462 / horsepower) ^ (1/3)
```

- ±4% variance applied to both cars for realism.
- Half/full mile: high power-to-weight cars get a `topSpeedAdj` bonus (up to 6%) that partially overcomes the weight penalty at launch.
- Fallback: rarity-tier base times when hp/weight are missing.

Points formula (`gamification-service/src/engine/performanceEngine.js`):
- Base: `50 × RARITY_MULT[loserRarity] × DISTANCE_MULT[distance]`
- Threshold: `2 + WINNER_RARITY_STEPS[winnerRarity]` seconds
- Bonus: `floor(max(0, (marginSeconds - threshold) × 1000) / 20)`
- Loser always gets 0 points.

Achievement checking is in `achievementChecker.js`; collection-level achievements in `collection-service/src/controllers/collectionAchievements.controller.js`.

### Key API endpoints added

| Method | Path | Service | Description |
|---|---|---|---|
| GET | `/collection/user/:userId` | collection | Returns any user's collection + progress (used by FriendProfile) |
| GET | `/catalogue/generations/:id` | catalogue | Returns a single generation with its `engines[]` array |
| GET | `/auth/users/:id` | auth | Returns basic user info by ID |
