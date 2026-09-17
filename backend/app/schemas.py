from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, ConfigDict, Field

from .models import CaseStatus, UserRole


class LoginRequest(BaseModel):
    identifier: str
    role: UserRole


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    identifier: str
    role: UserRole


class CaseCreate(BaseModel):
    title: str = Field(min_length=3, max_length=240)
    request_type: str = Field(pattern="^(demarcation|mutation|subdivision|new_title|encroachment)$")
    property_ulpin: str = Field(min_length=3, max_length=120)
    notes: Optional[str] = None


class CaseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    request_type: str
    notes: Optional[str]
    status: CaseStatus
    citizen_id: int
    officer_id: Optional[int]
    surveyor_id: Optional[int]
    property_ulpin: str
    validation: Optional[Dict[str, Any]]
    issued_ulpin: Optional[str]
    created_at: datetime
    updated_at: datetime


class AssignmentRequest(BaseModel):
    surveyor_id: int


class ReviewRequest(BaseModel):
    message: str = Field(min_length=3, max_length=1000)


class ValidationResponse(BaseModel):
    status: CaseStatus
    checks: dict[str, bool]
    overall_valid: bool


TokenResponse.model_rebuild()
