
import asyncio
from sqlalchemy import select
from app.core.database import SessionLocal
from app.models.core import Organization
from app.schemas.organization import OrganizationOut
import pydantic

async def audit_all_orgs():
    async with SessionLocal() as db:
        print("\n--- [AGGRESSIVE ORG AUDIT] ---")
        res = await db.execute(select(Organization))
        orgs = res.scalars().all()
        print(f"Total organizations to test: {len(orgs)}")
        
        for org in orgs:
            try:
                # Attempt full validation
                OrganizationOut.model_validate(org)
                print(f"✅ Org OK: {org.name} (ID: {org.id})")
            except pydantic.ValidationError as e:
                print(f"❌ VALIDATION ERROR in Org: {org.id}")
                print(f"   Name: {org.name}")
                print(f"   Errors: {e.json(indent=2)}")
            except Exception as e:
                print(f"❌ UNEXPECTED ERROR in Org: {org.id}: {type(e).__name__}: {str(e)}")

if __name__ == "__main__":
    asyncio.run(audit_all_orgs())
