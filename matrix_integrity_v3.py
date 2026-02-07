
import asyncio
import uuid
import logging
from sqlalchemy import select, text
from app.core.database import SessionLocal
from app.models.core import Organization, RolePermission
from generate_permission_artifact import MATRIX

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def fill_matrix_gaps():
    """
    Robust Matrix Seeder (V3).
    Respects UniqueConstraint('role', 'resource', 'action', 'tenant_id').
    """
    async with SessionLocal() as db:
        # 1. Fetch All Organizations
        orgs_res = await db.execute(select(Organization))
        orgs = orgs_res.scalars().all()
        logger.info(f"🔍 Found {len(orgs)} organizations to audit.")

        ALL_ROLES = [
            "super_admin", "administrador", "gerente", "supervisor_senior", 
            "supervisor", "representante", "dpto_estadistica", 
            "seguimiento", "auditor_calidad", "digitacion", "cliente"
        ]

        added_count = 0
        
        for org in orgs:
            logger.info(f"🚀 Auditing Org: {org.name} ({org.id})")
            
            # Fetch existing perms for this org (role, resource, action)
            existing_res = await db.execute(select(RolePermission).where(RolePermission.tenant_id == org.id))
            # The constraint is (role, resource, action, tenant_id)
            existing_perms = {(p.role, p.resource, p.action) for p in existing_res.scalars().all()}
            
            permissions_to_add = []
            
            for module, resources in MATRIX.items():
                # Level 1: Module Access
                for role in ALL_ROLES:
                    is_allowed_default = False
                    if "access" in resources and role in resources["access"]:
                        is_allowed_default = True
                        
                    # For modules, resource is often the module name
                    key = (role, module, "access")
                    if key not in existing_perms:
                        permissions_to_add.append(RolePermission(
                            tenant_id=org.id,
                            role=role,
                            module=module,
                            resource=module,
                            action="access",
                            name=f"Acceso Módulo {module.capitalize()}",
                            is_allowed=is_allowed_default
                        ))
                        existing_perms.add(key)
                
                # Level 2: Resources and Actions
                for resource, actions in resources.items():
                    if resource == "access": continue
                    
                    if isinstance(actions, dict):
                        for action, allowed_roles in actions.items():
                            for role in ALL_ROLES:
                                is_allowed = role in allowed_roles
                                
                                key = (role, resource, action)
                                if key not in existing_perms:
                                    friendly_name = f"{action.upper()} {resource.replace('_', ' ').capitalize()}"
                                    if action == "view_tab": friendly_name = f"Ver Pestaña {resource.replace('_', ' ').capitalize()}"
                                    if action == "access": friendly_name = f"Acceso {resource.replace('_', ' ').capitalize()}"
                                    
                                    permissions_to_add.append(RolePermission(
                                        tenant_id=org.id,
                                        role=role,
                                        module=module,
                                        resource=resource,
                                        action=action,
                                        name=friendly_name,
                                        is_allowed=is_allowed
                                    ))
                                    existing_perms.add(key)
            
            if permissions_to_add:
                db.add_all(permissions_to_add)
                added_count += len(permissions_to_add)
                logger.info(f"   ✅ Prepared {len(permissions_to_add)} missing perms for {org.name}")
            else:
                logger.info(f"   ✨ All perms already exist for {org.name}")

        if added_count > 0:
            try:
                await db.commit()
                logger.info(f"🎉 SUCCESS: Added {added_count} missing permissions across {len(orgs)} organizations.")
            except Exception as e:
                await db.rollback()
                logger.error(f"❌ Error committing changes: {e}")
        else:
            logger.info("✅ Matrix is already complete. No changes made.")

if __name__ == "__main__":
    asyncio.run(fill_matrix_gaps())
