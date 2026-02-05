from typing import List
from fastapi import APIRouter, HTTPException, Depends
from app.core.supabase import supabase_admin
from app.schemas.organization import OrganizationCreate, OrganizationOut, OrganizationUpdate
from app.core.security import get_current_user, check_permission
from app.models.core import UserProfile, Organization
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.api.deps import get_db
import uuid

router = APIRouter()

@router.get("/", response_model=List[OrganizationOut])
async def list_organizations(
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("tenants", "view_tab", module="config")),
    trashed: bool = False
):
    """Listado de organizaciones vía SQL Directo"""
    stmt = select(Organization)
    
    if current_user.role != "Super Admin":
        # Regular users can never see trashed orgs (security)
        stmt = stmt.where(Organization.id == current_user.tenant_id)
        # Force active only
        stmt = stmt.where(Organization.is_deleted == False)
    else:
        # Super Admin logic
        if trashed:
            stmt = stmt.where(Organization.is_deleted == True)
        else:
            stmt = stmt.where(Organization.is_deleted == False)
        
    result = await db.execute(stmt.order_by(Organization.created_at.desc()))
    return result.scalars().all()

@router.post("/", response_model=OrganizationOut)
async def create_organization(
    org_in: OrganizationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("tenants", "view_tab", module="config"))
):
    """Crea una organización vía SQL Directo"""
    if not org_in.slug:
        org_in.slug = org_in.name.lower().replace(" ", "-")
    
    db_org = Organization(
        id=uuid.uuid4(),
        name=org_in.name,
        slug=org_in.slug
    )
    
    # 1. ADD ORGANIZATION (Pending Commit)
    db.add(db_org)
    # FLUSH: Ensure the ID is registered in the session transaction context 
    # so that FK relationships in the subsequent seed are valid internal to the transaction.
    await db.flush()
    
    # 2. SEED PERMISSIONS (SQLAlchemy - Same Transaction)
    try:
        from app.core.permissions_seed import initialize_organization_permissions
        # Pass DB session. Seed will INSERT permissions via ORM.
        await initialize_organization_permissions(db_org.id, db)
        
        # 3. COMMIT EVERYTHING (Org + Perms)
        await db.commit()
        await db.refresh(db_org) 
        
    except Exception as e:
        # Rollback everything (Org + Partial Permissions if any)
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create organization. Transaction rolled back. Error: {str(e)}")

    return db_org

@router.get("/me", response_model=OrganizationOut)
async def get_my_organization(
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user)
):
    """Retorna la organización del usuario actual vía SQL"""
    if not current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Usuario sin organización asignada")
        
    result = await db.execute(select(Organization).where(Organization.id == current_user.tenant_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organización no encontrada")
    return org

@router.patch("/{org_id}", response_model=OrganizationOut)
async def update_organization(
    org_id: uuid.UUID,
    org_in: OrganizationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("tenants", "view_tab", module="config"))
):
    """Actualiza organización vía SQL"""
    try:
        stmt = select(Organization).where(Organization.id == org_id)
        if current_user.role != "Super Admin":
            if org_id != current_user.tenant_id:
                raise HTTPException(status_code=403, detail="Permiso denegado")
            stmt = stmt.where(Organization.id == current_user.tenant_id)

        result = await db.execute(stmt)
        db_org = result.scalar_one_or_none()
        if not db_org:
            raise HTTPException(status_code=404, detail="Organización no encontrada")

        update_data = org_in.model_dump(exclude_unset=True)
        if 'name' in update_data and not update_data.get('slug'):
            update_data['slug'] = update_data['name'].lower().replace(" ", "-")

        for key, value in update_data.items():
            setattr(db_org, key, value)
            
        await db.commit()
        await db.refresh(db_org)
        return db_org
    except HTTPException: raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{org_id}", response_model=OrganizationOut)
async def update_organization_put(
    org_id: uuid.UUID,
    org_in: OrganizationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("tenants", "view_tab", module="config"))
):
    """Alias PUT para actualización de organizaciones"""
    return await update_organization(org_id, org_in, db, current_user)

@router.delete("/{org_id}")
async def delete_organization(
    org_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("tenants", "view_tab", module="config"))
):
    """Elimina organización vía SQL Directo"""
    try:
        # Validar si tiene usuarios
        user_check = await db.execute(select(UserProfile.id).where(UserProfile.tenant_id == org_id).limit(1))
        if user_check.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Cannot delete organization with assigned users")
            
        # SOFT DELETE IMPLEMENTATION
        # Instead of physical delete, we mark as deleted
        stmt = select(Organization).where(Organization.id == org_id)
        result = await db.execute(stmt)
        org = result.scalar_one_or_none()
        
        if not org:
             raise HTTPException(status_code=404, detail="Organization not found")
             
        org.is_deleted = True
        
        await db.commit()
        return {"status": "success", "message": "Organization soft-deleted"}
    except HTTPException: raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
