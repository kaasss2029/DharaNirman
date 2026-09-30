from __future__ import annotations

from typing import Dict, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Building, BuildingFloor, CaseFile, CaseStatus, VolumetricProperty, WorkflowCase

SLIVER_HEIGHT_M = 0.3
MAX_STOREY_HEIGHT_M = 8.0
AIR_RIGHTS_BUFFER_M = 0.5


def _property_for_case(db: Session, case: WorkflowCase) -> Optional[VolumetricProperty]:
    by_ulpin = db.scalar(select(VolumetricProperty).where(VolumetricProperty.property_ulpin == case.property_ulpin))
    if by_ulpin:
        return by_ulpin
    return db.scalar(select(VolumetricProperty).where(VolumetricProperty.unit_id == case.property_ulpin))


def _geometry_srid(db: Session, geometry) -> Optional[int]:
    if geometry is None:
        return None
    try:
        from geoalchemy2.functions import ST_SRID

        return db.scalar(select(ST_SRID(geometry)))
    except Exception:
        return None


def _geometry_closed(db: Session, geometry) -> Optional[bool]:
    if geometry is None:
        return None
    try:
        from geoalchemy2.functions import ST_IsClosed

        return bool(db.scalar(select(ST_IsClosed(geometry))))
    except Exception:
        return None


def _geometries_intersect_3d(db: Session, left, right) -> bool:
    if left is None or right is None:
        return False
    try:
        from geoalchemy2.functions import ST_3DIntersects

        return bool(db.scalar(select(ST_3DIntersects(left, right))))
    except Exception:
        return False


def evaluate_case_validation(db: Session, case: WorkflowCase) -> Dict[str, bool]:
    property_record = _property_for_case(db, case)
    files = list(db.scalars(select(CaseFile).where(CaseFile.case_id == case.id)))
    building = None
    if property_record and property_record.building_id:
        building = db.get(Building, property_record.building_id)

    geometry = case.geometry if case.geometry is not None else (property_record.geometry if property_record else None)
    srid = _geometry_srid(db, geometry)
    closed = _geometry_closed(db, geometry)

    volume = property_record.volume if property_record else None
    area = property_record.area if property_record else None
    z_min = property_record.z_min if property_record else None
    z_max = property_record.z_max if property_record else None
    height = (z_max - z_min) if z_min is not None and z_max is not None else None

    crs_ok = srid == 7755 if srid is not None else property_record is not None
    closed_ok = closed if closed is not None else len(files) > 0
    volume_ok = bool(
        property_record
        and volume is not None
        and volume > 0
        and area is not None
        and area > 0
        and height is not None
        and height > 0
    )

    overlapping_units = False
    if property_record:
        siblings = list(
            db.scalars(
                select(VolumetricProperty).where(
                    VolumetricProperty.id != property_record.id,
                    VolumetricProperty.base_parcel == property_record.base_parcel,
                )
            )
        )
        for sibling in siblings:
            if _geometries_intersect_3d(db, property_record.geometry, sibling.geometry):
                overlapping_units = True
                break
            if sibling.unit_id == property_record.unit_id:
                overlapping_units = True
                break
            if (
                sibling.floor == property_record.floor
                and sibling.area == property_record.area
                and sibling.z_min == property_record.z_min
                and sibling.z_max == property_record.z_max
                and sibling.title == property_record.title
            ):
                overlapping_units = True
                break

    issued_duplicate = db.scalar(
        select(WorkflowCase.id).where(
            WorkflowCase.id != case.id,
            WorkflowCase.property_ulpin == case.property_ulpin,
            WorkflowCase.status == CaseStatus.certificate_issued,
        )
    )
    no_overlap = property_record is not None and not overlapping_units and issued_duplicate is None

    sliver_or_gap = height is None or height < SLIVER_HEIGHT_M
    if property_record and height is not None and property_record.floor.startswith("F") and height > MAX_STOREY_HEIGHT_M:
        sliver_or_gap = True
    if building and property_record and property_record.floor.startswith("F"):
        known_floors = set(db.scalars(select(BuildingFloor.floor_code).where(BuildingFloor.building_id == building.id)))
        if known_floors and property_record.floor not in known_floors:
            sliver_or_gap = True

    air_rights_ok = False
    if property_record and z_max is not None:
        if building:
            air_rights_ok = z_max <= (building.height_m + AIR_RIGHTS_BUFFER_M)
            if property_record.floor.startswith("B") and building.basement_levels <= 0:
                air_rights_ok = False
        else:
            air_rights_ok = z_max <= 150.0

    return {
        "crs_epsg_7755": bool(crs_ok),
        "closed_geometry": bool(closed_ok),
        "volume_positive": bool(volume_ok),
        "no_3d_overlap": bool(no_overlap),
        "no_gaps_or_slivers": not sliver_or_gap,
        "air_rights_clear": bool(air_rights_ok),
    }
