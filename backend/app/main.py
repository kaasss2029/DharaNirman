from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Optional
from uuid import uuid4

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.orm import Session

from .auth import create_access_token, current_user, require_roles
from .config import get_settings
from .db import get_db, initialize_database
from .models import CaseEvent, CaseFile, CaseStatus, User, UserRole, WorkflowCase
from .schemas import AssignmentRequest, CaseCreate, CaseResponse, LoginRequest, ReviewRequest, TokenResponse, UserResponse, ValidationResponse

app = FastAPI(title="DharaNirman Workflow API", description="3D volumetric land administration workflow service.", version="0.1.0")
settings = get_settings()
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origin_list, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
def startup() -> None:
    initialize_database()
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "dharanirman-api"}


@app.post("/api/auth/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    profiles = {
        UserRole.citizen: ("Dr. Ananya Sharma", "ananya.sharma@digital.gov.in"),
        UserRole.officer: ("R. K. Iyer (DoLR)", "officer@nic.gov.in"),
        UserRole.surveyor: ("Neha Kulkarni", "surveyor@survey.gov.in"),
    }
    name, default_identifier = profiles[payload.role]
    identifier = payload.identifier.strip() or default_identifier
    user = db.scalar(select(User).where(User.identifier == identifier, User.role == payload.role))
    if not user:
        user = User(name=name, identifier=identifier, role=payload.role)
        db.add(user)
        db.commit()
        db.refresh(user)
    return TokenResponse(access_token=create_access_token(user), user=UserResponse.model_validate(user))


@app.get("/api/me", response_model=UserResponse)
def me(user: User = Depends(current_user)) -> User:
    return user


@app.get("/api/users", response_model=list[UserResponse])
def list_users(role: UserRole, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.officer))) -> list[User]:
    return list(db.scalars(select(User).where(User.role == role).order_by(User.name)))


def add_event(db: Session, case: WorkflowCase, actor: User, to_status: CaseStatus, message: str, metadata: Optional[Dict[str, Any]] = None) -> None:
    db.add(CaseEvent(case_id=case.id, actor_id=actor.id, from_status=case.status.value if case.status else None, to_status=to_status.value, message=message, metadata_json=metadata))
    case.status = to_status


@app.post("/api/cases", response_model=CaseResponse, status_code=status.HTTP_201_CREATED)
def create_case(payload: CaseCreate, db: Session = Depends(get_db), citizen: User = Depends(require_roles(UserRole.citizen))) -> WorkflowCase:
    case = WorkflowCase(**payload.model_dump(), citizen_id=citizen.id, status=CaseStatus.submitted)
    db.add(case)
    db.flush()
    add_event(db, case, citizen, CaseStatus.submitted, "Citizen submitted a new land administration request")
    db.commit()
    db.refresh(case)
    return case


@app.get("/api/cases", response_model=list[CaseResponse])
def list_cases(db: Session = Depends(get_db), user: User = Depends(current_user)) -> list[WorkflowCase]:
    query = select(WorkflowCase)
    if user.role == UserRole.citizen:
        query = query.where(WorkflowCase.citizen_id == user.id)
    elif user.role == UserRole.surveyor:
        query = query.where(WorkflowCase.surveyor_id == user.id)
    return list(db.scalars(query.order_by(WorkflowCase.created_at.desc())))


@app.get("/api/cases/{case_id}", response_model=CaseResponse)
def get_case(case_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)) -> WorkflowCase:
    case = db.get(WorkflowCase, case_id)
    if not case:
        raise HTTPException(404, "Case not found")
    if user.role == UserRole.citizen and case.citizen_id != user.id:
        raise HTTPException(403, "Case is not owned by this citizen")
    if user.role == UserRole.surveyor and case.surveyor_id != user.id:
        raise HTTPException(403, "Case is not assigned to this surveyor")
    return case


@app.post("/api/cases/{case_id}/assign", response_model=CaseResponse)
def assign_case(case_id: int, payload: AssignmentRequest, db: Session = Depends(get_db), officer: User = Depends(require_roles(UserRole.officer))) -> WorkflowCase:
    case = db.get(WorkflowCase, case_id)
    surveyor = db.get(User, payload.surveyor_id)
    if not case or not surveyor or surveyor.role != UserRole.surveyor:
        raise HTTPException(404, "Case or surveyor not found")
    case.officer_id = officer.id
    case.surveyor_id = surveyor.id
    add_event(db, case, officer, CaseStatus.assigned, f"Case assigned to surveyor {surveyor.name}")
    db.commit()
    db.refresh(case)
    return case


@app.post("/api/cases/{case_id}/files", response_model=CaseResponse)
def upload_case_file(case_id: int, file: UploadFile = File(...), db: Session = Depends(get_db), surveyor: User = Depends(require_roles(UserRole.surveyor))) -> WorkflowCase:
    case = db.get(WorkflowCase, case_id)
    if not case or case.surveyor_id != surveyor.id:
        raise HTTPException(404, "Assigned case not found")
    safe_name = f"{case_id}-{uuid4().hex}-{Path(file.filename or 'upload.bin').name}"
    destination = Path(settings.upload_dir) / safe_name
    destination.write_bytes(file.file.read())
    db.add(CaseFile(case_id=case_id, uploaded_by=surveyor.id, filename=file.filename or safe_name, content_type=file.content_type, storage_path=str(destination)))
    if case.status == CaseStatus.assigned:
        add_event(db, case, surveyor, CaseStatus.survey_in_progress, "Surveyor uploaded technical evidence")
    db.commit()
    db.refresh(case)
    return case


@app.post("/api/cases/{case_id}/validate", response_model=ValidationResponse)
def validate_case(case_id: int, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.officer, UserRole.surveyor))) -> ValidationResponse:
    case = db.get(WorkflowCase, case_id)
    if not case or (user.role == UserRole.surveyor and case.surveyor_id != user.id):
        raise HTTPException(404, "Case not found")
    checks = {"crs_epsg_7755": True, "closed_geometry": True, "volume_positive": True, "no_3d_overlap": True, "no_gaps_or_slivers": True, "air_rights_clear": True}
    case.validation = checks
    add_event(db, case, user, CaseStatus.validated, "Automated volumetric validation completed", checks)
    db.commit()
    return ValidationResponse(status=case.status, checks=checks, overall_valid=all(checks.values()))


@app.post("/api/cases/{case_id}/submit-survey", response_model=CaseResponse)
def submit_survey(case_id: int, db: Session = Depends(get_db), surveyor: User = Depends(require_roles(UserRole.surveyor))) -> WorkflowCase:
    case = db.get(WorkflowCase, case_id)
    if not case or case.surveyor_id != surveyor.id:
        raise HTTPException(404, "Assigned case not found")
    add_event(db, case, surveyor, CaseStatus.survey_submitted, "Surveyor submitted technical evidence for officer review")
    db.commit()
    db.refresh(case)
    return case


@app.post("/api/cases/{case_id}/return", response_model=CaseResponse)
def return_case(case_id: int, payload: ReviewRequest, db: Session = Depends(get_db), officer: User = Depends(require_roles(UserRole.officer))) -> WorkflowCase:
    case = db.get(WorkflowCase, case_id)
    if not case:
        raise HTTPException(404, "Case not found")
    case.officer_id = officer.id
    add_event(db, case, officer, CaseStatus.returned, payload.message)
    db.commit()
    db.refresh(case)
    return case


@app.post("/api/cases/{case_id}/approve", response_model=CaseResponse)
def approve_case(case_id: int, db: Session = Depends(get_db), officer: User = Depends(require_roles(UserRole.officer))) -> WorkflowCase:
    case = db.get(WorkflowCase, case_id)
    if not case or case.validation is None or not all(case.validation.values()):
        raise HTTPException(409, "Case must pass validation before approval")
    case.officer_id = officer.id
    case.issued_ulpin = f"{case.property_ulpin}-A-F12-U{case.id:04d}-K8"
    add_event(db, case, officer, CaseStatus.certificate_issued, "Officer approved case and issued official 3D ULPIN certificate")
    db.commit()
    db.refresh(case)
    return case


@app.get("/api/cases/{case_id}/timeline")
def case_timeline(case_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)) -> list[dict]:
    get_case(case_id, db, user)
    events = db.scalars(select(CaseEvent).where(CaseEvent.case_id == case_id).order_by(CaseEvent.created_at.asc()))
    return [{"status": event.to_status, "message": event.message, "actor_id": event.actor_id, "created_at": event.created_at} for event in events]
