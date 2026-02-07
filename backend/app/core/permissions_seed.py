import uuid
import logging
from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.core import RolePermission
from app.core.permissions_catalog import ROLES, MASTER_CATALOG, DEFAULT_MAPPING

logger = logging.getLogger(__name__)

async def initialize_organization_permissions(tenant_id: uuid.UUID, db: AsyncSession):
    """
    Seeds the RolePermission table for a new tenant using the MASTER_CATALOG.
    This ensures all 192+ (implied total) functionalities are created immediately.
    """
    try:
        logger.info(f"🧬 [CORE SEED] Initiating Permission Seeding for Tenant: {tenant_id}")

        new_perms_objects = []
        
        for role in ROLES:
            for mod, res, act, name in MASTER_CATALOG:
                # Get the default is_allowed for this role/mod/res/act triplet
                # Fallback to False if not in mapping (Safety)
                is_allowed = DEFAULT_MAPPING.get(role, {}).get((mod, res, act), False)
                
                new_perm = RolePermission(
                    id=uuid.uuid4(),
                    tenant_id=tenant_id,
                    role=role.lower(), # Keep lowercase consistency
                    module=mod,
                    resource=res,
                    action=act,
                    name=name,
                    is_allowed=is_allowed
                )
                new_perms_objects.append(new_perm)
            
        # 3. ADD BATCH TO SESSION
        db.add_all(new_perms_objects)
        
        success_msg = f"Seeding exitoso: {len(new_perms_objects)} permisos encolados para el nuevo tenant {tenant_id}"
        logger.info(success_msg)
        print(success_msg) 
        
        return True

    except Exception as e:
        logger.error(f"❌ CORE SEEDING ERROR: {e}", exc_info=True)
        raise e
