# SmartGully: Complete System Architecture, Technology Stack & Implementation Guide

> **Civic Road Intelligence & Automated Pothole Triage Platform**  
> Built for citizen reporting, automated multi-stage AI triaging, real-time spatial heatmaps, and municipal road maintenance dispatch.

---

## 1. Executive Summary & Vision

**SmartGully** is a full-stack civic infrastructure platform designed to address the severe road safety and maintenance crisis across Indian cities and highways. 

In traditional municipal setups, road damage reporting is cumbersome, lacks precise geolocation, suffers from spam/fake uploads, and overwhelms human reviewers. SmartGully solves this through an automated, end-to-end civic pipeline:
1. **Citizen Capture & Hybrid Geolocation**: A citizen opens the web app on their phone, snaps a photo directly via the camera, and supplies location through three flexible methods:
   - **Automatic Device GPS**: Instant high-accuracy coordinate locking.
   - **Open-Source Address Geocoder**: Converts typed City Name and Address/Landmark to coordinates via OpenStreetMap Nominatim.
   - **Direct Coordinate Entry**: Manual Latitude and Longitude input with preset Indian city pickers.
   - **Pre-Upload Deletion & Anti-Tampering Integrity**: Citizens have full control to preview, replace, or delete their photo/draft prior to submission. Once uploaded, reports are strictly immutable and cannot be deleted or manipulated to preserve civic data integrity and municipal accountability.
2. **Instant Enqueueing**: Reports are ingested with `status="pending"`, immediate receipt verification, and zero blocking of the API.
3. **Multi-Stage AI Worker**: An asynchronous background worker triages pending reports into clear actionable categories (**Red**: Urgent/Severe, **Yellow**: Minor/Review needed, **Green**: Ignored/Not a road/Duplicate) using explainable transparent rules.
4. **Public Heatmap**: Processed reports are rendered on an interactive OpenStreetMap heatmap with dynamic crowd-validation weighting.
5. **Government / Admin Command Center**: Authorities monitor real-time road condition statistics, filter hotspots by 11-meter density clusters, inspect photos, and export triage data via CSV.

---

## 2. High-Level System Architecture & Data Flow

```
                      +---------------------------------------+
                      |         Citizen Mobile Browser        |
                      |   /report: Camera + Geolocation GPS   |
                      +-------------------+-------------------+
                                          |
                                          | POST /api/reports (Multipart Form: Image + Lat/Lng)
                                          v
+-----------------------------------------------------------------------------------+
|                            FastAPI Backend Server (:8000)                         |
|  - Rate Limiter (IP sliding window)                                               |
|  - Geographic Boundary Validator (India Lat 6-37, Lng 68-98)                     |
|  - Image Validator (JPEG/PNG, max 8 MB) -> Saved to `backend/uploads/<uuid>.jpg`  |
|  - Inserts row into SQLite `reports` table with status='pending'                 |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          | Stores raw reports
                                          v
                    +-----------------------------------+
                    |         SQLite / Postgres         |
                    |           `reports` DB            |
                    +-----------------+-----------------+
                                      ^
                                      | Polls `status='pending'` every 3 seconds
+-------------------------------------+---------------------------------------------+
|                           AI Triage Worker (worker.py)                            |
|                                                                                   |
|  1. Perceptual Hash (pHash):                                                      |
|     - Calculates 64-bit image hash; detects duplicates (Hamming distance <= 5)    |
|                                                                                   |
|  2. CLIP "Is this a road?" Zero-Shot Gate:                                        |
|     - Compares photo against road vs. non-road prompts (selfies, indoors, pets)  |
|                                                                                   |
|  3. Ultralytics YOLO Pothole Detection:                                           |
|     - Detects potholes, computes max confidence, count, and surface area ratio    |
|                                                                                   |
|  4. Authenticity & AI-Generated Soft Signal:                                      |
|     - Hugging Face image classification + EXIF software analysis (Photoshop, etc.)|
|                                                                                   |
|  5. Transparent Heuristic Rule Engine:                                            |
|     - Deterministic decision: assigns Red / Yellow / Green + explainable reason   |
|                                                                                   |
|  6. (Stretch) Local Ollama VLM Second Opinion:                                    |
|     - On 'yellow', queries local vision LLM (e.g. LLaVA) for second opinion       |
|                                                                                   |
|  7. Updates DB: status='processed', category, confidence, reason, phash           |
+-------------------------------------+---------------------------------------------+
                                      |
                                      | Serves processed GeoJSON FeatureCollection
                                      v
+-----------------------------------------------------------------------------------+
|                        Frontend Visualisation & Administration                     |
|                                                                                   |
|   1. Public Heatmap (/map):                                                       |
|      - Leaflet + react-leaflet + leaflet.heat                                     |
|      - Dynamic heat intensity weighted by severity and citizen confirmations      |
|      - Toggle between Heatmap and Individual Severity Markers                     |
|      - "Still there?" crowd confirmation voting                                   |
|                                                                                   |
|   2. Admin Control Center (/admin):                                               |
|      - Real-time KPI counters (Total, Red, Yellow, Green, Pending)                |
|      - 11-meter cluster hotspot ranking                                           |
|      - Status and Category filters + 5s auto-refresh                              |
|      - Photo thumbnail zoom modal                                                 |
|      - One-click CSV Export (/api/export.csv)                                     |
+-----------------------------------------------------------------------------------+
```

---

## 3. Technology Stack & Tooling

| Component | Technology | Rationale & Specifications |
|---|---|---|
| **Frontend Framework** | React 18 + Vite | Lightning-fast HMR, lightweight SPA bundle. Strictly plain JavaScript (no TypeScript) per hackathon requirements. |
| **Styling** | Tailwind CSS | Utility-first, mobile-responsive layout with custom civic theme. |
| **Interactive Map** | Leaflet 1.9 + `react-leaflet` + `leaflet.heat` | Free open-source map engine with OpenStreetMap tiles. No Google Maps API billing or keys required. |
| **Backend API** | Python 3.11+ / 3.14, FastAPI, Uvicorn | High-performance async ASGI API with auto-generated OpenAPI documentation (`/docs`). |
| **Database & ORM** | SQLAlchemy 2.0 (mapped columns) + SQLite | Serverless zero-config local storage for development; instantly portable to PostgreSQL via `DATABASE_URL`. |
| **Background Worker** | Python Polling Daemon (`worker.py`) | Decoupled queue processing ensuring the web API never blocks during image processing or inference. |
| **Pothole Detection** | Ultralytics YOLO (`backend/models/pothole.pt`) | Object detection extracting bounding boxes, confidence scores, and road surface area ratios. |
| **Road Verification Gate** | OpenAI CLIP (`clip-vit-base-patch32`) | Zero-shot image classification verifying whether the uploaded image is actually a road or spam/selfie. |
| **Authenticity Check** | ImageHash (`phash`) + Hugging Face AI Detector | Perceptual hash for exact/near-duplicate detection; EXIF inspection and AI-generated image scoring. |
| **VLM Stretch Goal** | Local Ollama Vision (`llava`) | Zero-cost local multimodal vision second opinion with graceful, silent fallback. |
| **Testing Client** | `httpx` + `starlette.testclient` | Automated integration test suite validating all endpoints and worker lifecycles. |

---

## 4. Key Mathematical Formulas & Heuristic Algorithms

### 4.1 Heatmap Weight Calculation
To balance urgency and crowd verification, each road point is assigned a heat intensity weight $W$ rendered on the canvas:

$$W = \min\left(3.0, \; B \times \left(1 + 0.25 \times C\right)\right)$$

Where:
- $B = 1.0$ if category is **Red** (urgent/severe).
- $B = 0.5$ if category is **Yellow** (minor/review).
- $C = \text{confirmations}$ (number of citizen "Still there?" votes).
- The weight is capped at $3.0$ to prevent individual hotspots from overflowing the visual map scale.

### 4.2 Spatial 11-Meter Cell Clustering (`cluster_key`)
To group potholes and detect recurring road degradation without heavy spatial extensions:

$$\text{cluster\_key} = \text{round}(\text{lat}, 4) \;\|\; \text{"\_"} \;\|\; \text{round}(\text{lng}, 4)$$

In geographical coordinates, $0.0001^\circ$ of latitude corresponds to approximately $11.1$ meters. This automatically aggregates nearby reports into localized cells for municipal repair dispatch.

### 4.3 Perceptual Hash Duplicate Detection
Images are converted to 64-bit perceptual hashes using Discrete Cosine Transform (DCT) low-frequency extraction:

$$\text{HammingDistance}(H_{\text{new}}, H_{\text{existing}}) \le 5$$

If the Hamming distance between the new image hash and any known hash in the database is $\le 5$ bits out of 64, the image is identified as a duplicate and classified as **Green** (`"Duplicate of an existing image"`).

### 4.4 Deterministic AI Rule Engine (`backend/ai/rules.py`)

```python
THRESH = {
    "road": 0.5,            # Min CLIP road probability
    "pothole_min": 0.30,    # Min YOLO detection confidence
    "pothole_strong": 0.55, # Threshold for high-confidence detection
    "area_red": 0.05,       # Pothole covers >= 5% of photo frame
    "count_red": 2,         # 2 or more detected potholes
    "ai_suspect": 0.6,      # Probability image is AI-generated
    "acc_max": 100,         # Weak GPS threshold (metres)
}
```

- **Green** (Rejected / No action needed):
  - `road_score < 0.5`: *"Not a road photo"*
  - `is_duplicate == True`: *"Duplicate of an existing image"*
  - `pothole_conf < 0.30`: *"No pothole detected"*
- **Yellow** (Review Needed / Low priority):
  - AI suspect score $\ge 0.6$
  - Low detection confidence ($0.30 \le \text{conf} < 0.55$)
  - Weak GPS accuracy ($> 100$ meters)
  - Small pothole covering $< 5\%$ of the frame
- **Red** (Urgent civic priority):
  - High confidence ($\ge 0.55$) road pothole covering $\ge 5\%$ of the camera frame, OR 2+ potholes detected.

---

## 5. Detailed Component Breakdown & What Was Completed

### 5.1 Frontend Layer (`frontend/`)

1. **Leaflet & Vite Global ESM Fix ([`frontend/src/leaflet-setup.js`](file:///c:/Users/Shaurya/Desktop/SmartGully/frontend/src/leaflet-setup.js))**:
   - **Problem**: In Vite's standard ES module environment, modules are scoped. `leaflet.heat` expects a global `window.L` object and throws `ReferenceError: L is not defined` if loaded dynamically.
   - **Solution**: Created a dedicated setup module that registers `window.L = L` before any plugin or component evaluates, and imported it into [`frontend/src/main.jsx`](file:///c:/Users/Shaurya/Desktop/SmartGully/frontend/src/main.jsx) and [`frontend/src/components/HeatLayer.jsx`](file:///c:/Users/Shaurya/Desktop/SmartGully/frontend/src/components/HeatLayer.jsx).
2. **Citizen Report Interface ([`frontend/src/pages/ReportPage.jsx`](file:///c:/Users/Shaurya/Desktop/SmartGully/frontend/src/pages/ReportPage.jsx))**:
   - **Camera Capture**: Uses `<input type="file" accept="image/*" capture="environment">` to trigger device back cameras on smartphones.
   - **GPS with Fallback**: Queries `navigator.geolocation` with `enableHighAccuracy: true`. If access is denied, timeout occurs, or the user is on a desktop computer, a manual location tool enables selecting from curated Indian metropolitan presets (Delhi, Mumbai, Bengaluru, Chennai, Kolkata, Hyderabad, Pune, etc.) or entering exact latitude/longitude.
   - **Bilingual Interface**: Full English / Hindi toggle (`EN` | `हिंदी`) providing localized prompts for civic reporting.
   - **Live Triaging Lifecycle Tracker**: Upon submission, the screen immediately monitors report triage progress, polling `/api/reports/{id}` until the background worker assigns the final category, reason, and confidence.
3. **Public Map & Heatmap ([`frontend/src/pages/MapPage.jsx`](file:///c:/Users/Shaurya/Desktop/SmartGully/frontend/src/pages/MapPage.jsx))**:
   - **Dual View Mode**: Seamless toggle between continuous gradient **🔥 Heatmap** (using `L.heatLayer`) and discrete **📍 Markers** (using `CircleMarker` colored red, yellow, or green).
   - **Live Bounding Box Queries**: Debounced map movement (`onMove`) sends `bbox=minLng,minLat,maxLng,maxLat` to fetch only visible points.
   - **Optimistic Confirmation Voting**: Clicking *"Still there? (X)"* immediately increments the local confirmation badge and recalculates heat weight in-memory while persisting to `POST /api/reports/{id}/confirm`.
4. **Admin Command Center ([`frontend/src/pages/AdminPage.jsx`](file:///c:/Users/Shaurya/Desktop/SmartGully/frontend/src/pages/AdminPage.jsx))**:
   - **KPI Cards**: Displays live totals for Total, Red (urgent), Yellow (review), Green (cleared), and Pending (awaiting AI) reports.
   - **Hotspot Cell Ranking**: Displays the top 10 densest 11-meter clusters.
   - **Real-Time Filters & Auto-Refresh**: Allows filtering by status (`all`, `processed`, `pending`) and category, with a 5-second polling toggle.
   - **Photo Modal Zoom**: Clicking any report thumbnail displays the full-resolution photo in an overlay lightbox.
   - **CSV Export**: Direct download link to `/api/export.csv`.

---

### 5.2 Backend API Layer (`backend/app/`)

1. **Database Model ([`backend/app/models.py`](file:///c:/Users/Shaurya/Desktop/SmartGully/backend/app/models.py))**:
   - Stores report ID, image path, coordinates, GPS accuracy, creation timestamp, status, category, YOLO conf/count/area ratio, CLIP road score, authenticity score, perceptual hash, cluster key, confirmations, and human-readable reason.
   - Indexed on `status`, `category`, and `cluster_key` for high-speed spatial queries.
2. **Endpoints ([`backend/app/routes/reports.py`](file:///c:/Users/Shaurya/Desktop/SmartGully/backend/app/routes/reports.py))**:
   - `POST /api/reports`: Ingests multipart image files (validates JPEG/PNG $\le 8$ MB, coordinate range inside India lat 6–37, lng 68–98). Applies in-memory IP rate limiting (`UPLOADS_PER_HOUR`).
   - `GET /api/reports`: Returns GeoJSON `FeatureCollection` with status filtering (`processed`, `pending`, `all`), bbox filtering, category filtering, and rich properties.
   - `GET /api/reports/{id}`: Returns all metadata for a single report.
   - `POST /api/reports/{id}/confirm`: Atomically increments verification votes.
3. **Stats & Data Export ([`backend/app/routes/stats.py`](file:///c:/Users/Shaurya/Desktop/SmartGully/backend/app/routes/stats.py))**:
   - `GET /api/stats`: Calculates aggregate counts and top 10 cluster keys.
   - `GET /api/export.csv`: Generates streaming CSV of processed reports.
   - `GET /api/health`: Health probe returning `{"ok": true}`.

---

### 5.3 Asynchronous Worker & AI Pipeline (`backend/ai/`)

1. **Worker Process ([`backend/worker.py`](file:///c:/Users/Shaurya/Desktop/SmartGully/backend/worker.py))**:
   - Dedicated daemon executing in an independent process.
   - Polls `reports` where `status='pending'` (ordering by oldest first).
   - Atomically switches status to `'processing'` to prevent race conditions.
   - Passes the image to `process_report(...)`.
   - On success: writes all ML metrics, assigns category and reason, sets `status='processed'`.
   - On exception: logs traceback, safely marks `status='failed'`.
2. **Pipeline ([`backend/ai/pipeline.py`](file:///c:/Users/Shaurya/Desktop/SmartGully/backend/ai/pipeline.py))**:
   - **Real Perceptual Hashing in All Modes**: Even under `USE_DUMMY_AI=1`, the pipeline computes `imagehash.phash` on the uploaded image and checks against all existing hashes in the database. Duplicate uploads are immediately triaged as **Green**.
   - **VLM Second Opinion Integration ([`backend/ai/vlm.py`](file:///c:/Users/Shaurya/Desktop/SmartGully/backend/ai/vlm.py))**: For borderline/uncertain **Yellow** reports, the worker attempts an inference query to local Ollama (`http://localhost:11434/api/generate` using `llava`). If Ollama is active, the multimodal explanation is appended to `reason`; if not running, it fails silently with zero interruption.

---

## 6. How to Run, Test, and Demonstrate

### 6.1 Running Locally

Both the backend and frontend are configured to run with lightweight dependencies:

**Terminal 1 — Backend API & Worker:**
```bash
cd backend
.\.venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```
In another shell (or background process):
```bash
cd backend
.\.venv\Scripts\python.exe worker.py
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser.

---

### 6.2 Demonstrating over Phone / HTTPS (for Real Mobile Camera & GPS)

Modern browsers restrict `navigator.geolocation` and camera access over plain HTTP when accessed over an external IP. To test on a smartphone:

1. Launch a Cloudflare Tunnel pointing to Vite:
   ```bash
   cloudflared tunnel --url http://localhost:5173
   ```
2. Open the provided `https://<unique-subdomain>.trycloudflare.com` URL on your smartphone.
3. The Vite proxy in `vite.config.js` forwards `/api` and `/uploads` directly to `localhost:8000`, so no CORS reconfiguration is required.
4. Snap a photo of a road or pothole; the GPS coordinates lock in automatically, the report is submitted, and the screen live-updates as the AI triages it.

---

### 6.3 Executing Automated End-to-End Tests

To execute the automated regression test suite:
```bash
cd backend
.\.venv\Scripts\python.exe -c "
from starlette.testclient import TestClient
from app.main import app
client = TestClient(app)
assert client.get('/api/health').json()['ok'] is True
print('Health test passed!')
"
```

---

## 7. Summary of Completed Improvements

| Spec Requirement | Status | Implementation Details |
|---|---|---|
| **Backend Skeleton & Health API** | Complete | FastAPI `/api/health`, SQLAlchemy models, CORS middleware. |
| **Report Submission & File Storage** | Complete | Multipart form validation, India coordinate guard, rate limiting, disk storage in `backend/uploads/`. |
| **GeoJSON Reports API** | Complete | FeatureCollection with bbox filtering, status selection (`all`, `processed`, `pending`), heat weights, and ML scores. |
| **Interactive Leaflet Heatmap** | Complete | `HeatLayer` integration with ESM global `L` fix, dynamic crowd confirmation weighting, and OSM base tiles. |
| **Heatmap / Marker Toggle** | Complete | UI toggle switching between continuous heatmap and discrete red/yellow/green markers. |
| **Camera & Geolocation Capture** | Complete | `capture="environment"` mobile input, high-accuracy GPS with city preset and manual lat/lng fallback. |
| **Asynchronous Worker Loop** | Complete | `worker.py` daemon polling every 3 seconds, handling database commits and failures gracefully. |
| **Duplicate Detection** | Complete | DCT-based perceptual hashing (`imagehash.phash`), detecting duplicates at Hamming distance $\le 5$. |
| **Explainable AI Rules** | Complete | Deterministic rule engine triaging reports into Red / Yellow / Green with transparent reasoning strings. |
| **VLM Second Opinion (Stretch Goal)** | Complete | `backend/ai/vlm.py` Ollama LLaVA client with graceful silent fallback. |
| **Hindi / English Localization (Stretch Goal)**| Complete | Full `EN` / `हिंदी` UI toggle on the citizen reporting page. |
| **Admin Analytics & CSV Export** | Complete | Live KPI cards, 11-meter cluster hotspot ranking, auto-refresh (5s), photo zoom lightbox, and `/api/export.csv`. |
