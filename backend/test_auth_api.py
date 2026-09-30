import sys
import os
import unittest
from pydantic import ValidationError

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db import get_db, initialize_database
from app.models import User, UserRole, VolumetricProperty
from app.schemas import LoginRequest, RegisterRequest
from app.auth import verify_password, hash_password, create_access_token
from app.main import login, register, startup, seed_properties, seed_building_data
from fastapi import HTTPException

class TestAuthAndValidation(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        initialize_database()
        seed_properties()
        seed_building_data()

    def setUp(self):
        self.db = next(get_db())

    def tearDown(self):
        self.db.close()

    def test_01_password_hashing_and_verification(self):
        """Test PBKDF2 password hashing & verification logic"""
        raw_pwd = "MySecretPassword123!"
        hashed = hash_password(raw_pwd)
        self.assertTrue(hashed.startswith("pbkdf2_sha256$"))
        self.assertTrue(verify_password(raw_pwd, hashed))
        self.assertFalse(verify_password("WrongPassword", hashed))

    def test_02_create_confirm_password_match_schema(self):
        """Test RegisterRequest passes when create == confirm password"""
        req = RegisterRequest(
            name="Test User",
            identifier="test.user@gov.in",
            role=UserRole.citizen,
            unit_id="U0602",
            password="SecurePassword2026!",
            confirm_password="SecurePassword2026!"
        )
        self.assertEqual(req.password, req.confirm_password)

    def test_03_create_confirm_password_mismatch_schema(self):
        """Test RegisterRequest rejects when create != confirm password"""
        with self.assertRaises(ValidationError) as ctx:
            RegisterRequest(
                name="Mismatch User",
                identifier="mismatch@gov.in",
                role=UserRole.citizen,
                unit_id="U0602",
                password="SecurePassword2026!",
                confirm_password="DifferentPassword999!"
            )
        self.assertIn("Create Password and Confirm Password must match", str(ctx.exception))

    def test_04_short_password_rejection(self):
        """Test RegisterRequest rejects password shorter than 8 characters"""
        with self.assertRaises(ValidationError):
            RegisterRequest(
                name="Short User",
                identifier="short@gov.in",
                role=UserRole.citizen,
                password="123",
                confirm_password="123"
            )

    def test_05_default_login_flow(self):
        """Test default demo-access login succeeds and returns access_token"""
        login_req = LoginRequest(
            identifier="officer@nic.gov.in",
            role=UserRole.officer,
            password="demo-access"
        )
        res = login(login_req, self.db)
        self.assertIsNotNone(res.access_token)
        self.assertEqual(res.user.role, UserRole.officer)

    def test_06_login_invalid_password_failure(self):
        """Test login fails when wrong password is used"""
        login_req = LoginRequest(
            identifier="officer@nic.gov.in",
            role=UserRole.officer,
            password="InvalidPassword999"
        )
        with self.assertRaises(HTTPException) as ctx:
            login(login_req, self.db)
        self.assertEqual(ctx.exception.status_code, 401)
        self.assertEqual(ctx.exception.detail, "Incorrect password. Please verify and try again.")

    def test_07_citizen_registration_and_subsequent_login(self):
        """Test registering a user with matching passwords and logging in"""
        import time
        unique_id = f"citizen_{int(time.time() * 1000)}@gov.in"
        unit_code = f"T_{int(time.time() * 1000)}"

        # Add a fresh available test property
        test_prop = VolumetricProperty(
            unit_id=unit_code,
            property_ulpin=f"IN-TEST-{unit_code}",
            title="Test Dynamic Unit",
            base_parcel="2187-4930-1049",
            zone="A",
            floor="F01",
            z_min=0.8,
            z_max=4.4,
            area=100.0,
            volume=300.0,
            status="available"
        )
        self.db.add(test_prop)
        self.db.commit()

        reg_req = RegisterRequest(
            name="Vikram Malhotra",
            identifier=unique_id,
            role=UserRole.citizen,
            unit_id=unit_code,
            state="Jharkhand",
            city="Ranchi",
            password="UserPassword123!",
            confirm_password="UserPassword123!"
        )
        reg_res = register(reg_req, self.db)
        self.assertIsNotNone(reg_res.access_token)
        self.assertEqual(reg_res.user.name, "Vikram Malhotra")

        # Verify login with the new password
        login_req = LoginRequest(
            identifier=unique_id,
            role=UserRole.citizen,
            password="UserPassword123!"
        )
        login_res = login(login_req, self.db)
        self.assertIsNotNone(login_res.access_token)
        self.assertEqual(login_res.user.identifier, unique_id)

        # Verify login fails with incorrect password
        bad_login_req = LoginRequest(
            identifier=unique_id,
            role=UserRole.citizen,
            password="WrongUserPassword!"
        )
        with self.assertRaises(HTTPException) as ctx:
            login(bad_login_req, self.db)
        self.assertEqual(ctx.exception.status_code, 401)
        self.assertEqual(ctx.exception.detail, "Incorrect password. Please verify and try again.")

    def test_08_unregistered_citizen_login_blocked(self):
        """Test login fails when citizen is not registered first"""
        unreg_req = LoginRequest(
            identifier="nonexistent.citizen@example.com",
            role=UserRole.citizen,
            password="AnyPassword123!"
        )
        with self.assertRaises(HTTPException) as ctx:
            login(unreg_req, self.db)
        self.assertEqual(ctx.exception.status_code, 401)
        self.assertIn("Citizen account not found. Please register", ctx.exception.detail)

if __name__ == "__main__":
    unittest.main(verbosity=2)
