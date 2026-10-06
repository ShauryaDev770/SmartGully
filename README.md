# SmartGully

Public website for reporting potholes and broken roads in India. Citizens upload a photo plus GPS; an AI worker triages each report into red / yellow / green; a public heatmap shows processed reports.

## Run locally

Needs Python 3.11+, Node 18+, and two terminals. Dummy AI is on by default (`USE_DUMMY_AI=1`) so the worker does not need GPU weights.

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install fastapi "uvicorn[standard]" sqlalchemy python-multipart pillow imagehash pydantic
uvicorn app.main:app --reload --port 8000
```

In another terminal, from `backend` with the venv active:

```bash
python seed.py
python worker.py
```

Health check: `curl http://localhost:8000/api/health`

Upload check (replace the image path):

```bash
curl -F "image=@photo.jpg" -F "lat=28.61" -F "lng=77.21" http://localhost:8000/api/reports
```

For the real CLIP + YOLO pipeline, put weights at `backend/models/pothole.pt`, then:

```bash
pip install -r requirements.txt
```

Set `USE_DUMMY_AI=0` in `backend/.env` and restart the worker.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

### Phone demo (HTTPS for GPS)

```bash
cloudflared tunnel --url http://localhost:5173
```

Point `FRONTEND_ORIGIN` at the HTTPS URL if the API rejects CORS.

## Layout

See `Desktop/SMARTGULLY_ARCHITECTURE.md` for the full spec.

Commands to run:

Terminal 1 :
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install fastapi "uvicorn[standard]" sqlalchemy python-multipart pillow imagehash pydantic
uvicorn app.main:app --reload --port 8000

terminal 2:
cd backend
.venv\Scripts\activate
python seed.py
python worker.py

terminal 3:
cd frontend
npm install
npm run dev

