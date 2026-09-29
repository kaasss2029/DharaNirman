from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Dict, Optional

from sqlalchemy import DateTime, Enum as SqlEnum, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .config import get_settings
from .db import Base

is_sqlite = get_settings().database_url.startswith("sqlite")
if not is_sqlite:
    from geoalchemy2 import Geometry
    SpatialGeometry = Geometry("POLYHEDRALSURFACEZ", srid=7755, spatial_index=False)
else:
    SpatialGeometry = Text


class UserRole(str, Enum):
    citizen = "citizen"
    officer = "officer"
    surveyor = "surveyor"


class CaseStatus(str, Enum):
    submitted = "submitted"
    assigned = "assigned"
    survey_in_progress = "survey_in_progress"
    survey_submitted = "survey_submitted"
    validated = "validated"
    under_review = "under_review"
    returned = "returned"
    approved = "approved"
    certificate_issued = "certificate_issued"
    rejected = "rejected"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    identifier: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    role: Mapped[UserRole] = mapped_column(SqlEnum(UserRole, native_enum=False), index=True)
    password_hash: Mapped[Optional[str]] = mapped_column(String(255))
    unit_id: Mapped[Optional[str]] = mapped_column(String(40), default="U1204")
    state: Mapped[Optional[str]] = mapped_column(String(100))
    city: Mapped[Optional[str]] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Building(Base):
    __tablename__ = "buildings"

    id: Mapped[int] = mapped_column(primary_key=True)
    building_code: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(240))
    base_parcel: Mapped[str] = mapped_column(String(80), index=True)
    building_use: Mapped[str] = mapped_column(String(80))
    above_ground_floors: Mapped[int] = mapped_column(default=0)
    basement_levels: Mapped[int] = mapped_column(default=0)
    height_m: Mapped[float] = mapped_column(default=0)
    footprint_area: Mapped[float] = mapped_column(default=0)
    built_up_area: Mapped[float] = mapped_column(default=0)
    volume: Mapped[float] = mapped_column(default=0)
    status: Mapped[str] = mapped_column(String(60), default="verified")
    geometry: Mapped[Optional[Any]] = mapped_column(SpatialGeometry)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class BuildingFloor(Base):
    __tablename__ = "building_floors"

    id: Mapped[int] = mapped_column(primary_key=True)
    building_id: Mapped[int] = mapped_column(ForeignKey("buildings.id"), index=True)
    floor_code: Mapped[str] = mapped_column(String(20))
    floor_number: Mapped[int] = mapped_column()
    elevation_min: Mapped[float] = mapped_column()
    elevation_max: Mapped[float] = mapped_column()
    unit_count: Mapped[int] = mapped_column(default=0)


class VolumetricProperty(Base):
    __tablename__ = "volumetric_properties"

    id: Mapped[int] = mapped_column(primary_key=True)
    building_id: Mapped[Optional[int]] = mapped_column(ForeignKey("buildings.id"), index=True)
    unit_id: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    property_ulpin: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(240))
    base_parcel: Mapped[str] = mapped_column(String(80), index=True)
    zone: Mapped[str] = mapped_column(String(10))
    floor: Mapped[str] = mapped_column(String(40))
    z_min: Mapped[float] = mapped_column()
    z_max: Mapped[float] = mapped_column()
    area: Mapped[float] = mapped_column()
    volume: Mapped[float] = mapped_column()
    status: Mapped[str] = mapped_column(String(60), default="available")
    owner_name: Mapped[Optional[str]] = mapped_column(String(160))
    geometry: Mapped[Optional[Any]] = mapped_column(SpatialGeometry)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PropertyOwnership(Base):
    __tablename__ = "property_ownerships"

    id: Mapped[int] = mapped_column(primary_key=True)
    property_id: Mapped[int] = mapped_column(ForeignKey("volumetric_properties.id"), index=True)
    citizen_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    ownership_percent: Mapped[float] = mapped_column(default=100.0)
    status: Mapped[str] = mapped_column(String(40), default="verified")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class TitleApplication(Base):
    __tablename__ = "title_applications"

    id: Mapped[int] = mapped_column(primary_key=True)
    citizen_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    property_id: Mapped[Optional[int]] = mapped_column(ForeignKey("volumetric_properties.id"), index=True)
    requested_unit_id: Mapped[Optional[str]] = mapped_column(String(40))
    requested_ulpin: Mapped[Optional[str]] = mapped_column(String(120))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(40), default="submitted", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class WorkflowCase(Base):
    __tablename__ = "workflow_cases"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(240))
    request_type: Mapped[str] = mapped_column(String(80))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[CaseStatus] = mapped_column(SqlEnum(CaseStatus, native_enum=False), default=CaseStatus.submitted, index=True)
    citizen_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    officer_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))
    surveyor_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))
    property_ulpin: Mapped[str] = mapped_column(String(120), index=True)
    geometry: Mapped[Optional[Any]] = mapped_column(SpatialGeometry)
    validation: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON)
    issued_ulpin: Mapped[Optional[str]] = mapped_column(String(120), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    citizen: Mapped[Optional["User"]] = relationship("User", foreign_keys=[citizen_id], lazy="joined")

    @property
    def citizen_name(self) -> Optional[str]:
        return self.citizen.name if self.citizen else None


class CaseEvent(Base):
    __tablename__ = "case_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("workflow_cases.id"), index=True)
    actor_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    from_status: Mapped[Optional[str]] = mapped_column(String(40))
    to_status: Mapped[str] = mapped_column(String(40))
    message: Mapped[str] = mapped_column(Text)
    metadata_json: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CaseFile(Base):
    __tablename__ = "case_files"

    id: Mapped[int] = mapped_column(primary_key=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("workflow_cases.id"), index=True)
    uploaded_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    filename: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[Optional[str]] = mapped_column(String(120))
    storage_path: Mapped[str] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
