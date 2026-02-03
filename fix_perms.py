import asyncio
import os
from dotenv import load_dotenv

# Load env from backend
load_dotenv('backend/.env')

# Re-run the setup script
import sys
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from sqlalchemy import delete
from app.models.core import RolePermission
from app.database import AsyncSessionLocal
import uuid

PERMISSION_SCENARIOS = {
    "Representante": {
        "sales": ["read_own"],
        "finance": ["read_own"]
    }
}

async def fix_permissions():
    print("🛠️ Fixing permissions for Representante...")
    async with AsyncSessionLocal() as db:
        await db.execute(delete(RolePermission).where(RolePermission.role == "Representante"))
        
        for role, resources in PERMISSION_SCENARIOS.items():
            for resource, actions in resources.items():
                for action in actions:
                    new_perm = RolePermission(
                        id=uuid.uuid4(),
                        role=role,
                        resource=resource,
                        action=action,
                        module="BUSINESS",
                        is_allowed=True
                    )
                    db.add(new_perm)
        await db.commit()
    print("✅ Done.")

if __name__ == "__main__":
    asyncio.run(fix_permissions())
