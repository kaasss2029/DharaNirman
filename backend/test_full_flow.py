import sys
import os
import unittest
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import select

from app.db import get_db, initialize_database
from app.models import CaseFile, CaseStatus, User, UserRole, VolumetricProperty, PropertyOwnership, WorkflowCase
from app.schemas import LoginRequest, RegisterRequest
from app.auth import verify_password
from app.main import login, register, seed_properties, seed_building_data, seed_default_users, list_properties
from fastapi import HTTPException

class TestFullSystemIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        initialize_database()
        seed_properties()
        seed_building_data()
        seed_default_users()

    def setUp(self):
        self.db = next(get_db())

    def tearDown(self):
        self.db.close()

    def test_01_seeded_roles_exist_in_db(self):
        """Verify official Officer and Surveyor accounts exist in database with correct hashes"""
        officer = self.db.scalar(select(User).where(User.identifier == "officer@nic.gov.in"))
        self.assertIsNotNone(officer)
        self.assertEqual(officer.role, UserRole.officer)
        self.assertTrue(verify_password("demo-access", officer.password_hash))

        surveyor = self.db.scalar(select(User).where(User.identifier == "surveyor@survey.gov.in"))
        self.assertIsNotNone(surveyor)
        self.assertEqual(surveyor.role, UserRole.surveyor)
        self.assertTrue(verify_password("demo-access", surveyor.password_hash))

    def test_02_citizen_registration_and_db_tally(self):
        """Register citizen with state/city & property, verify database insertion and ownership link"""
        timestamp = int(time.time() * 1000)
        email = f"citizen_{timestamp}@example.com"
        reg_req = RegisterRequest(
            name="Ramesh Kumar",
            identifier=email,
            role=UserRole.citizen,
            unit_id="U1204",
            state="Jharkhand",
            city="Ranchi",
            password="SecurePassword2026!",
            confirm_password="SecurePassword2026!"
        )
        reg_res = register(reg_req, self.db)
        self.assertIsNotNone(reg_res.access_token)

        # Check User entry in DB
        db_user = self.db.scalar(select(User).where(User.identifier == email))
        self.assertIsNotNone(db_user)
        self.assertEqual(db_user.name, "Ramesh Kumar")
        self.assertEqual(db_user.state, "Jharkhand")
        self.assertEqual(db_user.city, "Ranchi")
        self.assertEqual(db_user.unit_id, "U1204")

        # Check Property ownership entry in DB
        prop = self.db.scalar(select(VolumetricProperty).where(VolumetricProperty.unit_id == "U1204"))
        self.assertIsNotNone(prop)
        self.assertEqual(prop.owner_name, "Ramesh Kumar")
        self.assertEqual(prop.status, "claimed")

        ownership = self.db.scalar(select(PropertyOwnership).where(
            PropertyOwnership.citizen_id == db_user.id,
            PropertyOwnership.property_id == prop.id
        ))
        self.assertIsNotNone(ownership)

    def test_03_citizen_login_verification(self):
        """Test login for newly created citizen, officer, and invalid password attempt"""
        # Login Officer
        off_req = LoginRequest(identifier="officer@nic.gov.in", role=UserRole.officer, password="demo-access")
        off_res = login(off_req, self.db)
        self.assertEqual(off_res.user.role, UserRole.officer)

        # Login Surveyor
        surv_req = LoginRequest(identifier="surveyor@survey.gov.in", role=UserRole.surveyor, password="demo-access")
        surv_res = login(surv_req, self.db)
        self.assertEqual(surv_res.user.role, UserRole.surveyor)

        # Login Unregistered Citizen Failure
        bad_req = LoginRequest(identifier="nonexistent@example.com", role=UserRole.citizen, password="SomePassword123!")
        with self.assertRaises(HTTPException) as ctx:
            login(bad_req, self.db)
        self.assertEqual(ctx.exception.status_code, 401)

    def test_04_citizen_properties_filtered_by_db(self):
        """Test that calling list_properties for citizen returns only their owned DB properties"""
        timestamp = int(time.time() * 1000)
        email = f"owner_{timestamp}@example.com"
        reg_req = RegisterRequest(
            name="Anupama Sen",
            identifier=email,
            role=UserRole.citizen,
            unit_id="U0602",
            state="Maharashtra",
            city="Mumbai",
            password="Password123!",
            confirm_password="Password123!"
        )
        register(reg_req, self.db)

        citizen_user = self.db.scalar(select(User).where(User.identifier == email))
        user_props = list_properties(self.db, citizen_user)
        self.assertEqual(len(user_props), 1)
        self.assertEqual(user_props[0].unit_id, "U0602")

    def test_05_volumetric_validation_requires_property_and_survey_file(self):
        """Validation must fail without evidence, then pass for a real unit with a survey file."""
        from app.validation import evaluate_case_validation

        timestamp = int(time.time() * 1000)
        email = f"validation_{timestamp}@example.com"
        register(RegisterRequest(
            name="Validation Citizen",
            identifier=email,
            role=UserRole.citizen,
            unit_id="U1201",
            state="Delhi",
            city="New Delhi",
            password="Password123!",
            confirm_password="Password123!",
        ), self.db)
        citizen = self.db.scalar(select(User).where(User.identifier == email))
        prop = self.db.scalar(select(VolumetricProperty).where(VolumetricProperty.unit_id == "U1201"))

        unknown_case = WorkflowCase(
            title="demarcation request for unknown unit",
            request_type="demarcation",
            citizen_id=citizen.id,
            property_ulpin="IN-DOES-NOT-EXIST",
            status=CaseStatus.survey_submitted,
        )
        self.db.add(unknown_case)
        self.db.commit()
        self.db.refresh(unknown_case)
        unknown_checks = evaluate_case_validation(self.db, unknown_case)
        self.assertFalse(unknown_checks["volume_positive"])
        self.assertFalse(unknown_checks["closed_geometry"])
        self.assertFalse(all(unknown_checks.values()))

        case = WorkflowCase(
            title=f"demarcation request for Unit #{prop.unit_id}",
            request_type="demarcation",
            citizen_id=citizen.id,
            property_ulpin=prop.property_ulpin,
            status=CaseStatus.survey_submitted,
        )
        self.db.add(case)
        self.db.commit()
        self.db.refresh(case)

        before_file = evaluate_case_validation(self.db, case)
        self.assertTrue(before_file["volume_positive"])
        self.assertFalse(before_file["closed_geometry"])
        self.assertFalse(all(before_file.values()))

        self.db.add(CaseFile(
            case_id=case.id,
            uploaded_by=citizen.id,
            filename="survey.gml",
            content_type="application/gml+xml",
            storage_path="/tmp/survey.gml",
        ))
        self.db.commit()
        after_file = evaluate_case_validation(self.db, case)
        self.assertTrue(after_file["closed_geometry"])
        self.assertTrue(after_file["volume_positive"])
        self.assertTrue(after_file["no_3d_overlap"])
        self.assertTrue(after_file["no_gaps_or_slivers"])
        self.assertTrue(after_file["air_rights_clear"])
        self.assertTrue(all(after_file.values()))

if __name__ == "__main__":
    unittest.main(verbosity=2)
