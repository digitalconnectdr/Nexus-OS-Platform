import asyncio
import os
import sys
from sqlalchemy import select
from dotenv import load_dotenv

sys.path.append(os.getcwd() + "/backend")
load_dotenv("backend/.env")

from app.core.database import SessionLocal
from app.models.core import UserProfile

async def audit_juan_and_stephany():
    async with SessionLocal() as db:
        print("=== AUDIT START ===")
        
        # 1. Start with Juan C
        print("\nAll Profiles for 'jcpenalo':")
        # Search by email loosely
        stmt = select(UserProfile).where(UserProfile.email.ilike('%jcpenalo%'))
        juans = (await db.execute(stmt)).scalars().all()
        for j in juans:
            print(f"  ID: {j.id} | Ten: {j.tenant_id} | Role: {j.role} | Email: {j.email}")

        # 2. Check Stephany in Demo Company (9ab699...) specifically
        demo_id = "9ab69930-b675-4054-af33-0fb080182006"
        print(f"\nStephany in Demo Tenant ({demo_id}):")
        stmt = select(UserProfile).where(
            UserProfile.tenant_id == demo_id,
            UserProfile.first_name.ilike('%Stephany%')
        )
        s_demo = (await db.execute(stmt)).scalars().all()
        for s in s_demo:
             print(f"  ID: {s.id} | Role: '{s.role}' | is_active: {s.is_active}")
             
        # 3. Check Stephany in JPRS Tenant (fe0192...)
        jprs_id = "fe0192a0-6e11-4f5e-b6ca-6505d7c1e85e"
        print(f"\nStephany in JPRS Tenant ({jprs_id}):")
        stmt = select(UserProfile).where(
            UserProfile.tenant_id == jprs_id,
            UserProfile.first_name.ilike('%Stephany%')
        )
        s_jprs = (await db.execute(stmt)).scalars().all()
        for s in s_jprs:
             print(f"  ID: {s.id} | Role: '{s.role}' | is_active: {s.is_active}")

if __name__ == "__main__":
    asyncio.run(audit_juan_and_stephany())
