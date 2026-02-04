import uuid
import logging
from app.core.client import supabase  # Service Key Client
from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession


logger = logging.getLogger(__name__)

# HARDCODED MASTER TEMPLATE ID (JPRS DIGITAL CONNECT)
JPRS_TENANT_ID = "fe0192a0-6e11-4f5e-b6ca-6505d7c1e85e"

async def initialize_organization_permissions(tenant_id: uuid.UUID, db: AsyncSession):
    """
    Seeds the RolePermission table for a new tenant by CLONING dynamically
    from 'JPRS DIGITAL CONNECT' (Hardcoded ID) using SQLAlchemy (Same Transaction).
    """
    try:
        logger.info(f"🧬 [CORE SEED] Initiating Permission Cloning for Tenant: {tenant_id}")
        logger.info(f"   > Source Template ID (Hardcoded): {JPRS_TENANT_ID}")

        # 1. FETCH SOURCE PERMISSIONS (JPRS)
        # We use SQLAlchemy to ensure we read from the SAME database we are writing to.
        from sqlalchemy import select
        from app.models.core import RolePermission
        
        # Determine source UUID
        source_uuid = uuid.UUID(JPRS_TENANT_ID)
        
        stmt = select(RolePermission).where(RolePermission.tenant_id == source_uuid)
        result = await db.execute(stmt)
        source_perms = result.scalars().all()
        
        if not source_perms:
            msg = f"❌ CRITICAL: Template JPRS ({JPRS_TENANT_ID}) has 0 permissions or not found in THIS DB. Cannot clone."
            logger.error(msg)
            raise ValueError(msg)
            
        logger.info(f"   > Found {len(source_perms)} permissions in Template (SQLAlchemy).")

        # 2. PREPARE BATCH (ORM OBJECTS)
        # Using ORM objects ensures they are tracked by the Session and committed standardly.
        new_perms_objects = []
        for p in source_perms:
            new_perm = RolePermission(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                role=p.role,
                module=p.module,
                resource=p.resource,
                action=p.action,
                name=p.name,
                is_allowed=p.is_allowed
            )
            new_perms_objects.append(new_perm)
            
        # 3. ADD BATCH TO SESSION
        # add_all registers them in the unit-of-work. Commit/Flush will persist them.
        db.add_all(new_perms_objects)
        
        # NOTE: We do not flush here to let the parent transaction handle strict atomicity,
        # but add_all ensures they are queued.
        
        success_msg = f"Clonación exitosa: {len(new_perms_objects)} permisos encolados para {tenant_id}"
        logger.info(success_msg)
        print(success_msg) 
        
        return True

    except Exception as e:
        logger.error(f"❌ CORE SEEDING ERROR: {e}", exc_info=True)
        raise e
