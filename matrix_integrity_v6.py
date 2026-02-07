
import asyncio
import uuid
import logging
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy import select, func
from app.core.database import SessionLocal
from app.models.core import Organization, RolePermission
from generate_permission_artifact import MATRIX

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def repair_matrix_v6():
    """
    Surgical Matrix V6: Lowercase role standardization + Batch Upsert.
    """
    async with SessionLocal() as db:
        orgs_res = await db.execute(select(Organization))
        orgs = orgs_res.scalars().all()
        
        # Standard roles (normalized to lower for DB)
        ALL_ROLES = [
            "super_admin", "administrador", "gerente", "supervisor_senior", 
            "supervisor", "representante", "dpto_estadistica", 
            "seguimiento", "auditor_calidad", "digitacion", "cliente"
        ]

        inserted_total = 0
        
        for org in orgs:
            logger.info(f"🧬 Processing {org.name}...")
            batch_data = []
            
            for module, content in MATRIX.items():
                # Module Access
                for role in ALL_ROLES:
                    is_allowed = role in content.get("access", [])
                    batch_data.append({
                        "id": uuid.uuid4(),
                        "tenant_id": org.id,
                        "role": role,
                        "module": module.lower(),
                        "resource": module.lower(),
                        "action": "access",
                        "name": f"Acceso Módulo {module.capitalize()}",
                        "is_allowed": is_allowed
                    })
                
                # Resources
                for resource, actions in content.items():
                    if resource == "access": continue
                    if isinstance(actions, dict):
                        for action, allowed_roles in actions.items():
                            for role in ALL_ROLES:
                                is_allowed = role in allowed_roles
                                batch_data.append({
                                    "id": uuid.uuid4(),
                                    "tenant_id": org.id,
                                    "role": role,
                                    "module": module.lower(),
                                    "resource": resource.lower(),
                                    "action": action.lower(),
                                    "name": f"{action.upper()} {resource.replace('_', ' ').capitalize()}",
                                    "is_allowed": is_allowed
                                })

            # Perform surgical upsert
            BATCH_SIZE = 100
            for i in range(0, len(batch_data), BATCH_SIZE):
                chunk = batch_data[i:i+BATCH_SIZE]
                stmt = insert(RolePermission).values(chunk)
                # On conflict update NOTHING to preserve current user settings, 
                # but ensures the row exists with standardized role casing.
                stmt = stmt.on_conflict_do_nothing(index_elements=['role', 'resource', 'action', 'tenant_id'])
                res = await db.execute(stmt)
                inserted_total += res.rowcount
            
            await db.commit()
            
        print(f"✅ V6 REPAIR COMPLETE. Rows Adjusted: {inserted_total}")

if __name__ == "__main__":
    asyncio.run(repair_matrix_v6())
