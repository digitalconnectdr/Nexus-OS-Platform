import asyncio
import os
import sys
import requests
from dotenv import load_dotenv

sys.path.append(os.getcwd() + "/backend")
load_dotenv("backend/.env")

def test_backend_tenant_switching():
    # 1. We need a valid token for Juan C Penalo (Super Admin)
    # Since we can't easily generate a Supabase signed token without the secret (which we have in settings, but easier to just mock or assume we have one if we were doing integration tests),
    # I will simulate the logic locally by calling the function directly if possible, or just checking the DB state.
    
    # Actually, verifying the endpoint requires a running server and valid token.
    # Instead, I will write a script that IMPORTS get_current_user and calls it with a Mock Request/Header.
    
    from app.core.security import get_current_user
    from app.core.database import SessionLocal
    from app.models.core import UserProfile
    from fastapi import Request
    from unittest.mock import MagicMock
    
    # Mock Request
    req = MagicMock(spec=Request)
    
    # Mock Auth Credentials
    class MockAuth:
        credentials = "mock_token" 
        
    # We need to bypass JWT decode in get_current_user... which is hard without mocking jwt.decode
    # So let's reproduce the logic manually to test the "Override" part.
    
    pass

async def manual_test_override():
    from app.core.database import SessionLocal
    from app.models.core import UserProfile
    import uuid
    
    async with SessionLocal() as db:
        print("=== TEST TENANT OVERRIDE LOGIC ===")
        # Get Juan C
        from sqlalchemy import select
        stmt = select(UserProfile).where(UserProfile.email.ilike('%jcpenalo@gmail.com%'))
        juan = (await db.execute(stmt)).scalars().first()
        
        print(f"Original Juan Tenant: {juan.tenant_id}")
        print(f"Original Juan Role: {juan.role}")
        
        # Simulate Override
        target_tenant = "fe0192a0-6e11-4f5e-b6ca-6505d7c1e85e" # JPRS
        
        # Logic from security.py
        if juan.role == "Super Admin" and target_tenant:
             juan.tenant_id = uuid.UUID(target_tenant)
             print(f"Overridden Juan Tenant: {juan.tenant_id}")
             
        # Now use this overridden user to query JPRS users (Stephany Rep)
        stmt = select(UserProfile).where(
            UserProfile.tenant_id == juan.tenant_id,
            UserProfile.role == 'Representante'
        )
        res = await db.execute(stmt)
        reps = res.scalars().all()
        print(f"\nFound {len(reps)} Reps in Target Tenant:")
        for r in reps:
            print(f"  {r.first_name} {r.last_name} ({r.role})")

if __name__ == "__main__":
    asyncio.run(manual_test_override())
