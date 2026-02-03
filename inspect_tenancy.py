import asyncio
import os
import sys
from sqlalchemy import select
from dotenv import load_dotenv

sys.path.append(os.getcwd() + "/backend")
load_dotenv("backend/.env")

from app.core.database import SessionLocal
from app.models.core import UserProfile, Organization

async def inspect_tenancy():
    async with SessionLocal() as db:
        print("=== INSPECTING TENANCY ===")
        
        # 1. Get Tenants
        orgs = await db.execute(select(Organization).where(Organization.name.in_(['DEMO COMPANY', 'JPRS DIGITAL CONNECT'])))
        org_map = {o.name: str(o.id) for o in orgs.scalars().all()}
        
        print("\nORGANIZATIONS:")
        for name, oid in org_map.items():
            print(f"  {name}: {oid}")
            
        demo_id = org_map.get('DEMO COMPANY')
        
        # 2. Get Users and their Tenant IDs
        print("\nUSERS (Stephany Vargas):")
        stmt = select(UserProfile).where(UserProfile.first_name.ilike('%Stephany%'))
        users = (await db.execute(stmt)).scalars().all()
        
        for u in users:
            print(f"  Name: {u.first_name} {u.last_name}")
            print(f"  Role: {u.role}")
            print(f"  User Tenant ID: {u.tenant_id}")
            print(f"  Matches Demo? {str(u.tenant_id) == demo_id}")
            print("-" * 30)

        # 3. Check Juan C Penalo (Current User)
        print("\nCURRENT USER ADMIN:")
        juan = (await db.execute(select(UserProfile).where(UserProfile.email.ilike('%jcpenalo%')))).scalars().first()
        if juan:
            print(f"  Name: {juan.first_name}")
            print(f"  Tenant ID: {juan.tenant_id}")
            print(f"  Matches Demo? {str(juan.tenant_id) == demo_id}")

if __name__ == "__main__":
    asyncio.run(inspect_tenancy())
