from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Optional
from uuid import uuid4

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.orm import Session

from .auth import create_access_token, current_user, hash_password, require_roles, verify_password
from .config import get_settings
from .db import get_db, initialize_database
from .models import Building, BuildingFloor, CaseEvent, CaseFile, CaseStatus, PropertyOwnership, TitleApplication, User, UserRole, VolumetricProperty, WorkflowCase
from .schemas import AssignmentRequest, BuildingFloorResponse, BuildingResponse, CaseCreate, CaseResponse, LoginRequest, PropertyResponse, RegisterRequest, RegulationProfileResponse, ReviewRequest, TitleApplicationCreate, TitleApplicationResponse, TokenResponse, UserResponse, ValidationResponse
from .validation import evaluate_case_validation

app = FastAPI(title="DharaNirman Workflow API", description="3D volumetric land administration workflow service.", version="0.1.0")
settings = get_settings()
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origin_list, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

REGULATION_PROFILES = {
    ("jharkhand", "ranchi"): {
        "jurisdiction": "Ranchi planning / municipal authority",
        "height_rule_summary": "Check the applicable master plan, road width, FAR/FSI, setbacks, fire category and airport constraints.",
        "basement_rule_summary": "Basement count is approval-dependent; verify soil, groundwater, access, ventilation and fire-safety provisions.",
        "source_note": "Illustrative regulatory profile; confirm against the current Jharkhand and local building bye-laws before approval.",
    },
    ("delhi", "delhi"): {
        "jurisdiction": "DDA / MCD / NDMC jurisdiction as applicable",
        "height_rule_summary": "Height and floor count depend on the applicable Master Plan, UBBL, plot category, road width, FAR/FSI and fire approval.",
        "basement_rule_summary": "Basements require compliance with local parking, access, ventilation, fire and structural provisions.",
        "source_note": "Illustrative regulatory profile; confirm with the responsible Delhi planning authority.",
    },
    ("maharashtra", "mumbai"): {
        "jurisdiction": "Municipal / development authority jurisdiction as applicable",
        "height_rule_summary": "Height is controlled by the applicable DCPR, zoning, road width, FAR/FSI, aviation limits and fire requirements.",
        "basement_rule_summary": "Basement and high-rise provisions are triggered by the approved use, height, site and fire strategy.",
        "source_note": "Illustrative regulatory profile; confirm against the current local DCPR and sanctioned plan.",
    },
}

DEFAULT_REGULATION_PROFILE = {
    "jurisdiction": "State and local planning authority",
    "height_rule_summary": "No single India-wide maximum; calculate from the applicable local plan, road width, FAR/FSI, setbacks, aviation and fire rules.",
    "basement_rule_summary": "No single India-wide basement limit; obtain local approval supported by geotechnical, structural and fire-safety checks.",
    "source_note": "Model-code guidance only. This output is not a legal approval or a substitute for the current local regulations.",
}


@app.on_event("startup")
def startup() -> None:
    initialize_database()
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    seed_properties()
    seed_building_data()
    seed_default_users()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "dharanirman-api"}


def seed_default_users() -> None:
    db = next(get_db())
    try:
        officer = db.scalar(select(User).where(User.identifier == "officer@nic.gov.in"))
        if not officer:
            db.add(User(
                name="R. K. Iyer (DoLR)",
                identifier="officer@nic.gov.in",
                role=UserRole.officer,
                password_hash=hash_password("demo-access")
            ))
        elif not officer.password_hash:
            officer.password_hash = hash_password("demo-access")

        surveyor = db.scalar(select(User).where(User.identifier == "surveyor@survey.gov.in"))
        if not surveyor:
            db.add(User(
                name="Neha Kulkarni",
                identifier="surveyor@survey.gov.in",
                role=UserRole.surveyor,
                password_hash=hash_password("demo-access")
            ))
        elif not surveyor.password_hash:
            surveyor.password_hash = hash_password("demo-access")

        db.commit()
    finally:
        db.close()


def seed_properties() -> None:
    db = next(get_db())
    try:
        if db.scalar(select(VolumetricProperty.id).limit(1)):
            return
        records = [
            ("U0602", "IN-2187-4930-1049-A-F06-U0602-M2", "Apartment Unit #602", "F06", 18.0, 21.2, 120.0, 360.0),
            ("U1204", "IN-2187-4930-1049-A-F12-U1204-K8", "Apartment Unit #1204", "F12", 36.5, 39.8, 128.0, 384.2),
            ("U1201", "IN-2187-4930-1049-A-F12-U1201-J4", "Apartment Unit #1201 (Corner Suite)", "F12", 36.5, 39.8, 137.5, 412.5),
            ("U0401", "IN-2187-4930-1049-A-F04-U0401-R6", "Apartment Unit #401", "F04", 10.8, 14.4, 118.0, 354.0),
            ("U0101", "IN-2187-4930-1049-A-F01-U0101-T3", "Apartment Unit #101 (Garden View)", "F01", 0.8, 4.4, 125.0, 375.0),
            ("SURFACE", "IN-2187-4930-1049-A-S00-SURFACE-P1", "Surface Ground Parcel S00 (Master Title)", "S00", 0.0, 0.5, 1600.0, 800.0),
            ("BASEMENT1", "IN-2187-4930-1049-A-B01-BASEMENT-04", "Basement Parking Bay B1-04", "B01", -6.0, -3.0, 45.0, 135.0),
        ]
        for unit_id, ulpin, title, floor, z_min, z_max, area, volume in records:
            db.add(VolumetricProperty(
                unit_id=unit_id, property_ulpin=ulpin, title=title,
                base_parcel="2187-4930-1049", zone="A", floor=floor,
                z_min=z_min, z_max=z_max, area=area, volume=volume,
                status="available"
            ))
        db.commit()
    finally:
        db.close()


def seed_building_data() -> None:
    db = next(get_db())
    try:
        building = db.scalar(select(Building).where(Building.building_code == "BLDG-2187-4930-1049-A"))
        if not building:
            building = Building(
                building_code="BLDG-2187-4930-1049-A",
                name="Tower A",
                base_parcel="2187-4930-1049",
                building_use="residential",
                above_ground_floors=12,
                basement_levels=2,
                height_m=46.8,
                footprint_area=640.0,
                built_up_area=7680.0,
                volume=35840.0,
                status="verified",
            )
            db.add(building)
            db.flush()
            for floor_number in range(1, 13):
                db.add(BuildingFloor(
                    building_id=building.id,
                    floor_code=f"F{floor_number:02d}",
                    floor_number=floor_number,
                    elevation_min=0.8 + (floor_number - 1) * 3.6,
                    elevation_max=4.4 + (floor_number - 1) * 3.6,
                    unit_count=4,
                ))
        db.flush()
        db.query(VolumetricProperty).filter(
            VolumetricProperty.base_parcel == "2187-4930-1049",
            VolumetricProperty.building_id.is_(None),
        ).update({"building_id": building.id}, synchronize_session=False)
        db.commit()
    finally:
        db.close()


@app.post("/api/auth/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    identifier = payload.identifier.strip()
    if not identifier:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Identifier / Email is required")

    user = db.scalar(select(User).where(User.identifier == identifier, User.role == payload.role))
    if not user:
        if payload.role == UserRole.citizen:
            raise HTTPException(
                status.HTTP_401_UNAUTHORIZED,
                "Citizen account not found. Please register your account first on the 'Register New Citizen' tab."
            )
        else:
            raise HTTPException(
                status.HTTP_401_UNAUTHORIZED,
                "Account not found for this role. Please verify your official User ID."
            )

    if not user.password_hash or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect password. Please verify and try again.")

    return TokenResponse(access_token=create_access_token(user), user=UserResponse.model_validate(user))


@app.post("/api/auth/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> TokenResponse:
    identifier = payload.identifier.strip()
    if not identifier:
        raise HTTPException(400, "Identifier / Email is required")
    existing = db.scalar(select(User).where(User.identifier == identifier))
    if existing:
        raise HTTPException(409, "User identifier already registered")
    if payload.role != UserRole.citizen:
        raise HTTPException(403, "Only citizen self-registration is available")
    property_record = None
    if payload.unit_id:
        property_record = db.scalar(select(VolumetricProperty).where(VolumetricProperty.unit_id == payload.unit_id))
        if not property_record:
            property_record = VolumetricProperty(
                unit_id=payload.unit_id,
                property_ulpin=f"IN-2187-4930-1049-A-{payload.unit_id}",
                title=f"3D Cadastral Unit #{payload.unit_id}",
                base_parcel="2187-4930-1049",
                zone="A",
                floor="F01",
                z_min=0.8,
                z_max=4.4,
                area=120.0,
                volume=360.0,
                status="available",
            )
            db.add(property_record)
            db.flush()

    user = User(
        name=payload.name.strip(),
        identifier=identifier,
        role=payload.role,
        password_hash=hash_password(payload.password),
        unit_id=payload.unit_id or "U1204",
        state=payload.state.strip() if payload.state else None,
        city=payload.city.strip() if payload.city else None,
    )
    db.add(user)
    db.flush()
    if property_record:
        property_record.status = "claimed"
        property_record.owner_name = user.name
        db.add(PropertyOwnership(property_id=property_record.id, citizen_id=user.id))
    db.commit()
    db.refresh(user)
    return TokenResponse(access_token=create_access_token(user), user=UserResponse.model_validate(user))


@app.get("/api/regulations/profile", response_model=RegulationProfileResponse)
def regulation_profile(state: str, city: str, user: User = Depends(current_user)) -> RegulationProfileResponse:
    normalized_state = state.strip()
    normalized_city = city.strip()
    profile = REGULATION_PROFILES.get((normalized_state.lower(), normalized_city.lower()), DEFAULT_REGULATION_PROFILE)
    return RegulationProfileResponse(
        state=normalized_state,
        city=normalized_city,
        policy_status="planning context — verify with the competent authority",
        illustrative_scenario={
            "max_height_m": 12.0,
            "above_ground_floors": 4,
            "basement_levels": 1,
            "parking_levels": 1,
        },
        **profile,
    )


@app.get("/api/properties", response_model=list[PropertyResponse])
def list_properties(db: Session = Depends(get_db), user: User = Depends(current_user)) -> list[VolumetricProperty]:
    query = select(VolumetricProperty)
    if user.role == UserRole.citizen:
        query = query.join(PropertyOwnership, PropertyOwnership.property_id == VolumetricProperty.id).where(PropertyOwnership.citizen_id == user.id)
    return list(db.scalars(query.order_by(VolumetricProperty.unit_id)))


@app.get("/api/buildings/{building_id}", response_model=BuildingResponse)
def get_building(building_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)) -> BuildingResponse:
    building = db.get(Building, building_id)
    if not building:
        raise HTTPException(404, "Building not found")
    if user.role == UserRole.citizen:
        linked = db.scalar(select(PropertyOwnership.id).join(VolumetricProperty, PropertyOwnership.property_id == VolumetricProperty.id).where(
            PropertyOwnership.citizen_id == user.id,
            VolumetricProperty.building_id == building_id,
        ))
        if not linked:
            raise HTTPException(403, "Building is not linked to this citizen")
    floors = list(db.scalars(select(BuildingFloor).where(BuildingFloor.building_id == building_id).order_by(BuildingFloor.floor_number)))
    response = BuildingResponse.model_validate(building)
    return response.model_copy(update={"floors": [BuildingFloorResponse.model_validate(floor) for floor in floors]})


@app.get("/api/properties/{property_id}/building", response_model=BuildingResponse)
def get_property_building(property_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)) -> BuildingResponse:
    property_record = db.get(VolumetricProperty, property_id)
    if not property_record or not property_record.building_id:
        raise HTTPException(404, "Building not found for property")
    return get_building(property_record.building_id, db, user)


@app.get("/api/properties/{property_id}", response_model=PropertyResponse)
def get_property(property_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)) -> VolumetricProperty:
    property_record = db.get(VolumetricProperty, property_id)
    if not property_record:
        raise HTTPException(404, "Property not found")
    if user.role == UserRole.citizen:
        owns = db.scalar(select(PropertyOwnership.id).where(PropertyOwnership.property_id == property_id, PropertyOwnership.citizen_id == user.id))
        if not owns:
            raise HTTPException(403, "Property is not linked to this citizen")
    return property_record


@app.get("/api/properties/by-ulpin/{property_ulpin}", response_model=PropertyResponse)
def get_property_by_ulpin(property_ulpin: str, db: Session = Depends(get_db), user: User = Depends(current_user)) -> VolumetricProperty:
    property_record = db.scalar(select(VolumetricProperty).where(VolumetricProperty.property_ulpin == property_ulpin))
    if not property_record:
        raise HTTPException(404, "ULPIN not found")
    return get_property(property_record.id, db, user)


@app.get("/api/title-applications", response_model=list[TitleApplicationResponse])
def list_title_applications(db: Session = Depends(get_db), citizen: User = Depends(require_roles(UserRole.citizen))) -> list[TitleApplication]:
    return list(db.scalars(select(TitleApplication).where(TitleApplication.citizen_id == citizen.id).order_by(TitleApplication.created_at.desc())))


@app.post("/api/title-applications", response_model=TitleApplicationResponse, status_code=status.HTTP_201_CREATED)
def create_title_application(payload: TitleApplicationCreate, db: Session = Depends(get_db), citizen: User = Depends(require_roles(UserRole.citizen))) -> TitleApplication:
    property_record = None
    if payload.requested_unit_id:
        property_record = db.scalar(select(VolumetricProperty).where(VolumetricProperty.unit_id == payload.requested_unit_id))
        if not property_record:
            raise HTTPException(404, "Requested 3D property unit not found")
        if property_record.status != "available":
            raise HTTPException(409, "Requested property is not available")
    application = TitleApplication(
        citizen_id=citizen.id,
        property_id=property_record.id if property_record else None,
        requested_unit_id=payload.requested_unit_id,
        requested_ulpin=payload.requested_ulpin,
        notes=payload.notes,
    )
    db.add(application)
    db.commit()
    db.refresh(application)
    return application


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
    checks = evaluate_case_validation(db, case)
    case.validation = checks
    overall_valid = all(checks.values())
    add_event(
        db,
        case,
        user,
        CaseStatus.validated if overall_valid else CaseStatus.returned,
        "Automated volumetric validation completed" if overall_valid else "Automated volumetric validation failed",
        checks,
    )
    db.commit()
    return ValidationResponse(status=case.status, checks=checks, overall_valid=overall_valid)


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
