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

The API currently provides role login, case creation, case assignment, survey file upload, volumetric validation, survey submission, officer return/approval, issued ULPINs, and case timelines. Sessions require a JWT from `/api/auth/login` or `/api/auth/register`; unsigned demo tokens are rejected.

Citizen registration also records the State/UT and City/District context used by the 3D workspace's planning profile. `GET /api/regulations/profile?state=<state>&city=<city>` returns a clearly labelled, illustrative planning context; it is not a building permit or a substitute for the current local development regulations.

Citizen passwords are stored as salted PBKDF2-SHA256 hashes. Existing prototype accounts can use `demo-access` through the one-click access button; new registrations require an 8-character minimum password and matching confirmation.
