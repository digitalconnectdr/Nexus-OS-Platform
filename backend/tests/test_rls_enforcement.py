import sys
import os
import uuid
import logging
import asyncio
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch, AsyncMock
from sqlalchemy.ext.asyncio import AsyncSession
from dotenv import load_dotenv

# Add backend to sys.path
backend_path = os.path.join(os.getcwd(), "backend")
if backend_path not in sys.path:
    sys.path.append(backend_path)
load_dotenv(os.path.join(backend_path, ".env"))

from app.main import app
from app.api import deps
from app.core import security
from app.models.core import UserProfile
from app.schemas.core import UserRole

# Prevent logging noise during tests
logging.basicConfig(level=logging.ERROR)

client = TestClient(app)

# --- MOCK DATA ---
TENANT_ID = uuid.uuid4()
AGENT_ID = uuid.uuid4()

AGENT_USER = UserProfile(
    id=AGENT_ID,
    email="agent@demo.com",
    role=UserRole.REPRESENTANTE,
    tenant_id=TENANT_ID,
    first_name="Test",
    last_name="Agent",
    is_active=True
)

def run_rls_tests():
    print("\n" + "="*60)
    print("      RLS ENFORCEMENT VERIFICATION (SOLO LO MÍO)")
    print("="*60)

    # 1. Bypassing permission system via DB mocking
    # We override get_db to return a mock session that always "allows" the permission check
    mock_db = AsyncMock(spec=AsyncSession)
    
    # Permission check mock result
    mock_perm = MagicMock()
    mock_perm.is_allowed = True
    
    mock_res = MagicMock()
    mock_res.scalar_one_or_none.return_value = mock_perm
    mock_db.execute.return_value = mock_res
    
    async def get_mock_db():
        yield mock_db

    app.dependency_overrides[deps.get_db] = get_mock_db
    app.dependency_overrides[security.get_current_user] = lambda: AGENT_USER

    results = []

    # 2. Patching Supabase Admin in each endpoint module
    with patch("app.api.api_v1.endpoints.sales.supabase_admin") as mock_supa_sales, \
         patch("app.api.api_v1.endpoints.analytics.supabase_admin") as mock_supa_analytics, \
         patch("app.api.api_v1.endpoints.finance.supabase_admin") as mock_supa_finance:

        mock_query = MagicMock()
        mock_query.select.return_value = mock_query
        mock_query.eq.return_value = mock_query
        mock_query.in_.return_value = mock_query
        mock_query.or_.return_value = mock_query
        mock_query.range.return_value = mock_query
        mock_query.order.return_value = mock_query
        mock_query.match.return_value = mock_query
        mock_query.gte.return_value = mock_query
        mock_query.lte.return_value = mock_query
        # Mock execute to return empty data so we don't crash on processing
        mock_query.execute.return_value = MagicMock(data=[], count=0)

        # --- TEST 1: SALES LISTING ---
        print("- Testing Sales (GET /api/v1/sales/) ... ", end="")
        mock_supa_sales.table.return_value = mock_query
        mock_query.eq.reset_mock()

        response = client.get("/api/v1/sales/")
        if response.status_code != 200:
            print(f"❌ FAILED (Status {response.status_code})")
            results.append(False)
        else:
            calls = [tuple(c.args) for c in mock_query.eq.call_args_list]
            is_isolated = any(c == ('agent_id', str(AGENT_ID)) for c in calls)
            if is_isolated:
                print("✅ PASSED")
                results.append(True)
            else:
                print("❌ FAILED (No agent_id filter)")
                results.append(False)

            # --- TEST 2: SCORECARD AGENTS (Supabase Fallback) ---
            print("- Testing Scorecard (Supabase Fallback) ... ", end="")
            app.dependency_overrides[deps.get_db] = lambda: None # Force fallback
            
            mock_query.eq.reset_mock()
            mock_supa_analytics.table.return_value = mock_query
            
            response = client.get("/api/v1/analytics/scorecard/agents?month=2024-01")
            if response.status_code != 200:
                print(f"❌ FAILED (Status {response.status_code})")
                results.append(False)
            else:
                calls = [tuple(c.args) for c in mock_query.eq.call_args_list]
                is_isolated = any((c[0] == 'id' and c[1] == str(AGENT_ID)) for c in calls)
                if is_isolated:
                    print("✅ PASSED")
                    results.append(True)
                else:
                    print(f"❌ FAILED (Calls: {calls})")
                    results.append(False)

            # --- TEST 3: FINANCE SUMMARY ---
            print("- Testing Finance Summary ... ", end="")
            app.dependency_overrides[deps.get_db] = get_mock_db # Restore DB
            
            mock_query.eq.reset_mock()
            mock_supa_finance.table.return_value = mock_query
            
            response = client.get("/api/v1/finance/summary?start_date=2024-01-01&end_date=2024-01-31")
            if response.status_code != 200:
                print(f"❌ FAILED (Status {response.status_code})")
                results.append(False)
            else:
                calls = [tuple(c.args) for c in mock_query.eq.call_args_list]
                is_isolated = any(c == ('agent_id', str(AGENT_ID)) for c in calls)
                if is_isolated:
                    print("✅ PASSED")
                    results.append(True)
                else:
                    print(f"❌ FAILED (Calls: {calls})")
                    results.append(False)

            # --- TEST 4: EFFICIENCY (Supabase Fallback) ---
            print("- Testing Efficiency (Supabase Fallback) ... ", end="")
            app.dependency_overrides[deps.get_db] = lambda: None # Force fallback
            
            mock_query.eq.reset_mock()
            mock_supa_analytics.table.return_value = mock_query
            
            response = client.get("/api/v1/analytics/efficiency-v3?month=2024-01")
            if response.status_code != 200:
                print(f"❌ FAILED (Status {response.status_code})")
                results.append(False)
            else:
                calls = [tuple(c.args) for c in mock_query.eq.call_args_list]
                is_isolated = any((c[0] == 'id' and c[1] == str(AGENT_ID)) for c in calls)
                if is_isolated:
                    print("✅ PASSED")
                    results.append(True)
                else:
                    print(f"❌ FAILED (Calls: {calls})")
                    results.append(False)

    print("="*60)
    if all(results) and len(results) > 0:
        print("      SUCCESS: RLS IS FUNCTIONAL FOR ALL MODULES")
    else:
        print("      CRITICAL: VULNERABILITIES DETECTED OR TESTS FAILED")
    print("="*60 + "\n")

if __name__ == "__main__":
    run_rls_tests()
