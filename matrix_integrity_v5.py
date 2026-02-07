
import asyncio
import uuid
import logging
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy import select
from app.core.database import SessionLocal
from app.models.core import Organization, RolePermission
from generate_permission_artifact import MATRIX

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def fill_matrix_gaps():
    """
    Surgical Matrix Seeder (V5).
    Resilient batching to avoid DB timeouts.
    """
    async with SessionLocal() as db:
        orgs_res = await db.execute(select(Organization))
        orgs = orgs_res.scalars().all()
        logger.info(f"🔍 Auditing {len(orgs)} organizations.")

        ALL_ROLES = [
            "super_admin", "administrador", "gerente", "supervisor_senior", 
            "supervisor", "representante", "dpto_estadistica", 
            "seguimiento", "auditor_calidad", "digitacion", "cliente"
        ]

        inserted_total = 0
        
        for org in orgs:
            logger.info(f"🚀 Processing Org: {org.name}")
            
            perms_to_insert = []
            
            for module, resources in MATRIX.items():
                # Module Access
                for role in ALL_ROLES:
                    is_allowed = role in resources.get("access", [])
                    perms_to_insert.append({
                        "id": uuid.uuid4(),
                        "tenant_id": org.id,
                        "role": role,
                        "module": module,
                        "resource": module,
                        "action": "access",
                        "name": f"Acceso Módulo {module.capitalize()}",
                        "is_allowed": is_allowed
                    })
                
                # Resource Actions
                for resource, actions in resources.items():
                    if resource == "access": continue
                    if isinstance(actions, dict):
                        for action, allowed_roles in actions.items():
                            for role in ALL_ROLES:
                                is_allowed = role in allowed_roles
                                friendly = f"{action.upper()} {resource.replace('_', ' ').capitalize()}"
                                if action == "view_tab": friendly = f"Pestaña {resource.replace('_', ' ').capitalize()}"
                                
                                perms_to_insert.append({
                                    "id": uuid.uuid4(),
                                    "tenant_id": org.id,
                                    "role": role,
                                    "module": module,
                                    "resource": resource,
                                    "action": action,
                                    "name": friendly,
                                    "is_allowed": is_allowed
                                })

            # Small Batch UPSERT
            BATCH_SIZE = 50
            org_inserted = 0
            for i in range(0, len(perms_to_insert), BATCH_SIZE):
                batch = perms_to_insert[i:i + BATCH_SIZE]
                stmt = insert(RolePermission).values(batch)
                stmt = stmt.on_conflict_do_nothing(constraint='_role_resource_action_tenant_uc')
                res = await db.execute(stmt)
                org_inserted += res.rowcount
                await db.commit() # Commit each batch for safety
            
            inserted_total += org_inserted
            logger.info(f"   ✅ Done with {org.name}. Total new rows: {org_inserted}")

        logger.info(f"🎉 FINAL SUCCESS: Matrix is now 100% complete. Total new rows: {inserted_total}")

if __name__ == "__main__":
    asyncio.run(fill_matrix_gaps())
