from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, ConfigDict, Field, model_validator

from .models import CaseStatus, UserRole


class LoginRequest(BaseModel):
    identifier: str
    role: UserRole
    password: str = Field(min_length=1, max_length=128)


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    identifier: str = Field(min_length=3, max_length=255)
    role: UserRole = UserRole.citizen
    unit_id: Optional[str] = "U1204"
    state: Optional[str] = Field(default=None, min_length=2, max_length=100)
    city: Optional[str] = Field(default=None, min_length=2, max_length=100)
    password: str = Field(min_length=8, max_length=128)
    confirm_password: str = Field(min_length=8, max_length=128)

    @model_validator(mode="after")
    def verify_passwords_match(self) -> "RegisterRequest":
        if self.password != self.confirm_password:
            raise ValueError("Create Password and Confirm Password must match")
        return self


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
    unit_id: Optional[str] = "U1204"
    state: Optional[str] = None
    city: Optional[str] = None


class RegulationProfileResponse(BaseModel):
    state: str
    city: str
    jurisdiction: str
    policy_status: str
    height_rule_summary: str
    basement_rule_summary: str
    source_note: str
    illustrative_scenario: Dict[str, Union[int, float]]


class PropertyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    building_id: Optional[int]
    unit_id: str
    property_ulpin: str
    title: str
    base_parcel: str
    zone: str
    floor: str
    z_min: float
    z_max: float
    area: float
    volume: float
    status: str
    owner_name: Optional[str]


class BuildingFloorResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    floor_code: str
    floor_number: int
    elevation_min: float
    elevation_max: float
    unit_count: int


class BuildingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    building_code: str
    name: str
    base_parcel: str
    building_use: str
    above_ground_floors: int
    basement_levels: int
    height_m: float
    footprint_area: float
    built_up_area: float
    volume: float
    status: str
    floors: List[BuildingFloorResponse] = []


class TitleApplicationCreate(BaseModel):
    requested_unit_id: Optional[str] = Field(default=None, min_length=2, max_length=40)
    requested_ulpin: Optional[str] = Field(default=None, min_length=3, max_length=120)
    notes: Optional[str] = Field(default=None, max_length=2000)


class TitleApplicationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    citizen_id: int
    property_id: Optional[int]
    requested_unit_id: Optional[str]
    requested_ulpin: Optional[str]
    notes: Optional[str]
    status: str
    created_at: datetime


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
    checks: Dict[str, bool]
    overall_valid: bool


TokenResponse.model_rebuild()
