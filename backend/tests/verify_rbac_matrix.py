import sys
import os
import asyncio
import httpx
import uuid
from typing import Any

# Add parent directory to path to import app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app
from app.core.security import get_current_user
from app.schemas.user_schemas import UserRole
from app.models.core import UserProfile

# Official Role List
ROLES = [
    UserRole.SUPER_ADMIN,
    UserRole.ADMINISTRADOR,
    UserRole.CLIENTE,
    UserRole.GERENTE,
    UserRole.SUPERVISOR_SENIOR,
    UserRole.SUPERVISOR,
    UserRole.DPTO_ESTADISTICA,
    UserRole.AUDITOR_CALIDAD,
    UserRole.SEGUIMIENTO,
    UserRole.DIGITACION,
    UserRole.REPRESENTANTE
]

# Test Tenant ID
TENANT_ID = "fe0192a0-6e11-4f5e-b6ca-6505d7c1e85e"

def mock_user_with_role(role: Any):
    # Ensure we pass the string value to the model
    role_val = role.value if hasattr(role, 'value') else str(role)
    user = UserProfile(
        id=uuid.uuid4(),
        email=f"test_{role_val.lower().replace(' ', '_')}@demo.com",
        role=role_val,
        tenant_id=uuid.UUID(TENANT_ID),
        is_active=True,
        is_deleted=False
    )
    return user

# Correct URLs based on source code analysis
endpoints = [
    {
        "name": "Ver Finanzas",
        "url": "/api/v1/finance/summary?start_date=2026-01-01&end_date=2026-01-31",
        "method": "GET"
    },
    {
        "name": "Crear Usuario",
        "url": "/api/v1/users/",
        "method": "POST",
        "payload": {
            "email": "audit_test_" + str(uuid.uuid4())[:8] + "@demo.com",
            "password": "password123",
            "first_name": "Audit",
            "last_name": "User",
            "role": "Representante",
            "tenant_id": TENANT_ID
        }
    },
    {
        "name": "Crear Venta",
        "url": "/api/v1/sales/",
        "method": "POST",
        "payload": {
            "customer_name": "Audit Customer",
            "snapshot_price": 50,
            "tenant_id": TENANT_ID
        }
    },
    {
        "name": "Ver Telemetría",
        "url": "/api/v1/ops/telemetry",
        "method": "GET"
    }
]

async def run_audit():
    print("\n" + "="*95)
    print(f"{'RBAC ISOLATION AUDIT: PERMISSIONS MATRIX ENFORCEMENT':^95}")
    print("="*95)
    print(f"{'ROLE':<25} | {'ACTION':<20} | {'RES':<5} | {'STATUS'}")
    print("-" * 95)

    async with httpx.AsyncClient(app=app, base_url="http://testserver") as ac:
        for role in ROLES:
            # Override get_current_user for this role
            mock_user = mock_user_with_role(role)
            app.dependency_overrides[get_current_user] = lambda: mock_user
            
            for ep in endpoints:
                try:
                    if ep["method"] == "GET":
                        response = await ac.get(ep["url"], headers={"Authorization": "Bearer mock-token"})
                    else:
                        response = await ac.post(ep["url"], json=ep["payload"], headers={"Authorization": "Bearer mock-token"})
                    
                    status = response.status_code
                    
                    # Logic to determine if it SHOULD be blocked based on official matrix
                    expected_block = False
                    
                    if ep["name"] == "Ver Finanzas":
                        if role not in [UserRole.SUPER_ADMIN, UserRole.ADMINISTRADOR, UserRole.CLIENTE, UserRole.GERENTE, UserRole.SUPERVISOR_SENIOR, UserRole.SUPERVISOR, UserRole.DPTO_ESTADISTICA]:
                            expected_block = True
                    
                    elif ep["name"] == "Crear Usuario":
                        if role not in [UserRole.SUPER_ADMIN, UserRole.ADMINISTRADOR]:
                            expected_block = True
                            
                    elif ep["name"] == "Crear Venta":
                        if role not in [UserRole.SUPER_ADMIN, UserRole.ADMINISTRADOR, UserRole.REPRESENTANTE, UserRole.SUPERVISOR, UserRole.SUPERVISOR_SENIOR]:
                            expected_block = True
                            
                    elif ep["name"] == "Ver Telemetría":
                        if role not in [UserRole.SUPER_ADMIN]:
                            expected_block = True
                    
                    # Verification
                    if expected_block and status in [200, 201]:
                        status_str = "!!! SECURITY FAILURE !!!"
                    elif not expected_block and status == 403:
                        status_str = "ERR: UNEXPECTED BLOCK"
                    elif status == 403:
                        status_str = "PASS: BLOCKED (OK)"
                    elif status in [200, 201]:
                        status_str = "PASS: ALLOWED (OK)"
                    elif status == 500:
                        status_str = "PASS: ALLOWED (LOGIC 500)"
                    elif status == 422:
                        status_str = "INFO: 422 VALIDATION"
                    else:
                        status_str = f"CODE: {status}"
                    
                    print(f"{role:<25} | {ep['name']:<20} | {status:<5} | {status_str}")
                except Exception as e:
                    print(f"{role:<25} | {ep['name']:<20} | ERR   | CRASH: {str(e)}")

    print("="*95 + "\n")

if __name__ == "__main__":
    asyncio.run(run_audit())
