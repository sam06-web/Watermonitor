# AquaSense — Water Monitoring & Satellite Intelligence System

Real-time sensor monitoring combined with genuine satellite remote sensing. The app ingests water-quality sensor telemetry over MQTT, computes a screening water-quality index, and independently validates conditions with real Sentinel-2 (STAC), NASA SWOT, and Open-Meteo hydrology data — no synthetic satellite readings.

## Architecture

```
React 19 SPA (mobile-first)          Node/Express 5 API (:5050)          Flask API (:5001)
├─ MQTT over WebSocket (HiveMQ) ──┐  ├─ /api/satellite/*                 ├─ /predict          (sklearn classifier)
├─ EcoDashboard                    │  ├─ /api/water-quality/*            ├─ /satellite/process (Sentinel-2 + rasterio)
├─ SatelliteMonitoring (lazy)      │  ├─ /api/health                     └─ /swot/process      (NASA CMR shapefiles)
├─ PipeMap (Leaflet)               │  └─ SQLite (better-sqlite3)
├─ FlowMonitor / Settings          │      └─ rivers + satellite_observations
└─ FloatingChat (Gemini)           └──  server/db/satellite.db
```

- **Frontend** — React 19 + Vite. The satellite view (and MapLibre GL) is lazy-loaded into a separate chunk.
- **Backend** — Express 5 with better-sqlite3. Real observations are stored with a `"source":"real"` marker; any synthetic rows are purged on startup.
- **ML service** — Flask. Reads Sentinel-2 L2A scenes from Planetary Computer / Earth Search STAC, computes NDWI/NDVI/NDMI, water area, and a turbidity proxy, renders PNG composites, and parses real SWOT reach attributes.

## Prerequisites

- Node.js 18+ and npm
- Python 3.10+ with pip
- (Recommended) Free API credentials in `.env`:
  - `NASA_EARTHDATA_TOKEN` — SWOT river measurements (width, water level). Get from https://urs.earthdata.nasa.gov.
  - `OPENROUTER_API_KEY` or `GEMINI_API_KEY` — optional AI text enrichment.

## Setup & Run

```bash
# 1. Install JS deps
npm install

# 2. Python ML service
python3 -m venv .venv
. .venv/bin/activate
pip install -r ml/requirements.txt
# optional: place a sklearn model at ml/water_quality_model.joblib
# otherwise /predict returns 503 but satellite processing still works

# 3. Configure environment
cp .env.example .env   # then fill in keys

# 4. Run everything (ML + server + client)
npm run dev:hybrid
```

Individual pieces:

```bash
npm run dev          # Express server + Vite client
npm run client       # Vite only
npm run server       # Express only
npm run ml           # Flask ML service only
```

Open http://localhost:5173 (Vite).

## API Overview

| Endpoint | Description |
|---|---|
| `GET /api/health` | System health check |
| `GET /api/satellite/latest?river=` | Newest real observation + river geometry |
| `GET /api/satellite/history?river=&period=` | History (`7d` / `30d` / `6m` / `1y`) |
| `GET /api/satellite/statistics?river=` | Aggregates & trends |
| `POST /api/satellite/refresh?river=` | Force a fresh satellite pass |
| `POST /api/satellite/backfill?river=` | Ingest historical real scenes (`{ start, end }`) |
| `GET /api/satellite/image?river=&type=&date=` | PNG or SVG placeholder render |
| `GET /api/satellite/search?river=` | Global river/lake search (OSM Nominatim) |
| `POST /api/satellite/scan` | Process a real Sentinel-2 scene over a user-drawn area (`{ bbox, lat, lng, name }`) |
| `POST /api/water-quality/predict` | ML prediction `{ ph, tds, turbidity }` |

## Configuration

All credentials are read from `.env` (see `.env.example`). No keys are hardcoded.

- `PORT` — Express port (default 5050)
- `WATER_QUALITY_MODEL_URL` — Flask service URL (default `http://127.0.0.1:5001`)
- `MONGODB_URI` / `MONGODB_DB_NAME` — MongoDB Atlas connection (falls back to SQLite when unset)
- `NASA_EARTHDATA_TOKEN` / `NASA_EARTHDATA_KEY` — SWOT downloads
- `OPENROUTER_API_KEY` / `GEMINI_API_KEY` — AI summary enrichment
- MQTT broker/topic are configurable in the app's Settings view.

## Android Build (Capacitor)

```bash
npm run build
npx cap sync android
npx cap open android
```

## Lint & Build

```bash
npm run lint
npm run build
```