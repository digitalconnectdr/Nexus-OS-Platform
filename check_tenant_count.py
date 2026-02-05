
import asyncio
import logging
from sqlalchemy import text, select
from app.core.database import SessionLocal as async_session_factory
from app.models.core import RolePermission

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

TARGET_TENANT = "fe0192a0-6e11-4f5e-b6ca-6505d7c1e85e"

async def check_tenant():
    async with async_session_factory() as db:
        print(f"Checking permissions for tenant: {TARGET_TENANT}")
        

        # Count all
        result_all = await db.execute(text("SELECT count(*) FROM role_permissions"))
        total = result_all.scalar()
        print(f"TOTAL PERMISSIONS: {total}")

        # List Distinct Tenants
        result_tenants = await db.execute(text("SELECT DISTINCT tenant_id FROM role_permissions"))
        tenants = result_tenants.scalars().all()
        print(f"TENANTS WITH PERMISSIONS: {[str(t) for t in tenants]}")
        
        # Check specific again with UUID cast
        result = await db.execute(text(f"SELECT count(*) FROM role_permissions WHERE tenant_id = '{TARGET_TENANT}'::uuid"))
        count = result.scalar()
        
        print(f"COUNT_RESULT (Specific): {count}")


if __name__ == "__main__":
    asyncio.run(check_tenant())
