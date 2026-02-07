
import asyncio
from sqlalchemy import select, func
from app.core.database import SessionLocal
from app.models.core import RolePermission, Organization
from app.schemas.core import UserRole

async def audit_permissions():
    async with SessionLocal() as db:
        print(">>> 🕵️ DB FORENSIC AUDIT START")
        
        # 1. Total count
        total_res = await db.execute(select(func.count(RolePermission.id)))
        total = total_res.scalar()
        print(f"Total rows in role_permissions: {total}")
        
        # 2. Count by Organization
        org_res = await db.execute(select(RolePermission.tenant_id, func.count('*')).group_by(RolePermission.tenant_id))
        for tid, count in org_res:
            print(f"Org {tid}: {count} rows")
            
        # 3. Check for specific roles mentioned by user
        critical_roles = ["Cliente", "Dpto Estadistica", "Administrador"]
        for role in critical_roles:
            res = await db.execute(select(func.count('*')).where(RolePermission.role == role))
            print(f"Role '{role}': {res.scalar()} rows")
            
        # 4. Count unique resources per role
        role_res = await db.execute(select(RolePermission.role, func.count('*')).group_by(RolePermission.role))
        for r, count in role_res:
            print(f"Count for role {r}: {count}")
            
        print(">>> 🕵️ AUDIT COMPLETE")

if __name__ == "__main__":
    asyncio.run(audit_permissions())
