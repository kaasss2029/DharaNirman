# DharaNirman Backend API

DharaNirman is an interactive 3D cadastral and volumetric land administration platform. 3D ULPIN is the identifier standard used by the platform.

This is the first database-backed workflow foundation for the Citizen → Officer → Surveyor → Officer approval process.

## Run with Docker

From the project root:

```bash
docker compose up -d db
cd backend
cp .env.example .env
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Open the API documentation at http://127.0.0.1:8000/docs.

The API currently provides demo role login, case creation, case assignment, survey file upload, validation, survey submission, officer return/approval, issued ULPINs, and case timelines. Authentication is intentionally demo-only until a production identity provider is connected.
