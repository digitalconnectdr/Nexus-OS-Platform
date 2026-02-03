import sys
import os
import uuid
import json
from fastapi.testclient import TestClient
from fastapi import Depends
from dotenv import load_dotenv

# Add backend to sys.path
backend_path = os.path.join(os.getcwd(), "backend")
sys.path.append(backend_path)

# Load env vars from backend/.env
load_dotenv(os.path.join(backend_path, ".env"))

from app.main import app
from app.core import security
from app.api import deps
from app.models.core import UserProfile
from app.schemas.core import UserRole
from unittest.mock import MagicMock, AsyncMock

# Use TestClient
client = TestClient(app)

# --- MOCK USER ---
MOCK_REPRESENTANTE = UserProfile(
    id=uuid.uuid4(),
    email="agent@demo.com",
    role=UserRole.REPRESENTANTE,
    tenant_id=uuid.uuid4(),
    first_name="Agent",
    last_name="Test",
    is_active=True
)

# --- DEPENDENCY OVERRIDES ---
async def override_get_current_user():
    return MOCK_REPRESENTANTE

async def override_get_db():
    # Return a mock session that doesn't explode
    mock_session = AsyncMock()
    # Simulate DB being okay for initial connection test
    # This also mocks the return of db.execute(...) in check_permission
    # We want it to return None so it triggers the 403
    mock_session.execute.return_value = MagicMock()
    mock_session.execute.return_value.scalar_one_or_none.return_value = None
    yield mock_session

# We don't override check_permission itself because it's a factory.
# Instead, we will look for gaps by seeing which endpoints respond with 200 
# despite our low-level role.

app.dependency_overrides[security.get_current_user] = override_get_current_user
app.dependency_overrides[deps.get_db] = override_get_db

def get_route_permissions(route):
    """Inspects a route to find check_permission dependencies."""
    perms = []
    if not hasattr(route, "dependant"):
        return perms
        
    # Check all dependencies recursively
    stack = [route.dependant]
    visited = set()
    
    while stack:
        curr = stack.pop()
        if curr in visited:
            continue
        visited.add(curr)
        
        # In check_permission(res, act), the 'call' is the 'dependency' inner function.
        # We can't easily match it to the factory call unless we track the factory.
        # But we can look at the dependency function name if it was named 'dependency'.
        # This is unreliable. 
        
        # Better: Since we have the code, we know we use check_permission.
        # Actually, let's just use functional testing since it's more robust.
        # If an endpoint responds 200 for a Representante but should be restricted, it's a breach.
        
        for sub in curr.dependencies:
            stack.append(sub)
            
    return perms

def run_audit():
    print("\n" + "="*60)
    print("      RBAC SECURITY AUDIT - COMPREHENSIVE SCAN")
    print("="*60)
    
    vulnerabilities = []
    
    # Format: (Method, URL, Payload, Expected Permission, Component)
    test_cases = [
        # --- SALES ---
        ("GET", "/api/v1/sales/", None, "sales:read", "Sales"),
        ("POST", "/api/v1/sales/", {"customer_name": "Audit"}, "sales:create", "Sales"),
        ("DELETE", f"/api/v1/sales/{uuid.uuid4()}", None, "sales:delete", "Sales"),
        ("PUT", f"/api/v1/sales/{uuid.uuid4()}", {"status": "Audit"}, "sales:update", "Sales"),
        ("GET", "/api/v1/sales/export", None, "sales:export", "Sales"),
        
        # --- FINANCE ---
        ("GET", "/api/v1/finance/payroll?start_date=2024-01-01&end_date=2024-01-31", None, "finance:read_own", "Finance"),
        ("GET", "/api/v1/finance/summary?start_date=2024-01-01&end_date=2024-01-31", None, "finance:read_global", "Finance"),
        ("GET", "/api/v1/finance/campaign-revenue?start_date=2024-01-01&end_date=2024-01-31", None, "finance:read_global", "Finance"),
        ("GET", "/api/v1/finance/trends?start_date=2024-01-01&end_date=2024-01-31", None, "finance:read_global", "Finance"),
        
        # --- USER MANAGEMENT ---
        ("GET", "/api/v1/users/", None, "users:read", "Users"),
        ("POST", "/api/v1/users/", {"email": "hack@demo.com", "tenant_id": str(uuid.uuid4())}, "users:write", "Users"),
        ("PUT", f"/api/v1/users/{uuid.uuid4()}/role", {"role": "Super Admin"}, "users:change_role", "Users"),
        
        # --- PRODUCTS ---
        ("GET", "/api/v1/products/", None, "products:read", "Products"),
        ("POST", "/api/v1/products/", {"name": "Audit"}, "products:write", "Products"),
        
        # --- ANALYTICS & DASHBOARD ---
        ("GET", "/api/v1/analytics/dashboard?start_date=2024-01-01&end_date=2024-01-31", None, "operational:read", "Analytics"),
        ("GET", "/api/v1/analytics/efficiency?month=2024-01", None, "operational:read", "Analytics"),
        ("GET", "/api/v1/analytics/scorecard-agents?month=2024-01", None, "operational:read", "Analytics"),
        ("GET", "/api/v1/analytics/export-efficiency?start_date=2024-01-01&end_date=2024-01-31", None, "operational:export", "Analytics"),

        # --- ORGANIZATIONS & CAMPAIGNS ---
        ("GET", "/api/v1/organizations/", None, "organizations:read", "Organizations"),
        ("POST", "/api/v1/organizations/", {"name": "Hacker Org"}, "organizations:write", "Organizations"),
        ("GET", "/api/v1/campaigns/", None, "campaigns:read", "Campaigns"),
        ("POST", "/api/v1/campaigns/", {"name": "Shadow Campaign"}, "campaigns:write", "Campaigns"),

        # --- OPERATIONAL & GOALS ---
        ("GET", "/api/v1/operational/efficiency", None, "operational:read", "Operational"),
        ("GET", "/api/v1/goals/", None, "goals:read", "Goals"),
        ("POST", "/api/v1/goals/", {"target_amount": 1000}, "goals:write", "Goals"),

        # --- PERMISSIONS & POLICIES ---
        ("GET", "/api/v1/permissions/", None, "permissions:read", "Permissions"),
        ("POST", "/api/v1/permissions/toggle", {"target_role": "Representante", "resource": "sales", "action": "delete", "value": True}, "permissions:write", "Permissions"),
        ("GET", "/api/v1/policies/", None, "policies:read", "Policies"),
    ]
    
    for method, url, payload, permission, component in test_cases:
        print(f"[{component}] {method:6} {url[:50]:50} ... ", end="")
        try:
            if method == "GET":
                response = client.get(url)
            elif method == "POST":
                response = client.post(url, json=payload)
            elif method == "PUT":
                response = client.put(url, json=payload)
            elif method == "DELETE":
                response = client.delete(url)
            
            # If it returns 200, 201, 204 or even 422 (validation error), 
            # it means it bypassed the 403 permission check.
            if response.status_code in [200, 201, 204, 422, 500]:
                if response.status_code == 422:
                    print(f"❌ VULNERABLE (Bypassed auth, hit 422 Validation)")
                elif response.status_code == 500:
                    print(f"❌ VULNERABLE (Bypassed auth, hit 500 Crash)")
                else:
                    print(f"❌ BREACH! ({response.status_code})")
                    
                vulnerabilities.append({
                    "component": component,
                    "method": method,
                    "url": url,
                    "permission": permission,
                    "status": "VULNERABLE"
                })
            elif response.status_code == 403:
                print("✅ PROTECTED")
            else:
                print(f"❓ OTHER ({response.status_code})")
                
        except Exception as e:
            print(f"💥 ERROR: {str(e)}")

    print("\n" + "="*60)
    print(f"AUDIT SUMMARY: {len(vulnerabilities)} vulnerabilities detected.")
    print("="*60)
    
    if vulnerabilities:
        with open("security_audit_report.json", "w", encoding="utf-8") as f:
            json.dump(vulnerabilities, f, indent=2, ensure_ascii=False)
        print("Detailed report saved to security_audit_report.json")
    
    return vulnerabilities

if __name__ == "__main__":
    run_audit()
