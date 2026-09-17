from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Dict, Optional

from geoalchemy2 import Geometry
from sqlalchemy import DateTime, Enum as SqlEnum, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


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
    geometry: Mapped[Optional[Any]] = mapped_column(Geometry("POLYHEDRALSURFACEZ", srid=7755))
    validation: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON)
    issued_ulpin: Mapped[Optional[str]] = mapped_column(String(120), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


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
