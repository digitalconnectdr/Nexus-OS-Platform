from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Response
from fastapi.encoders import jsonable_encoder
import logging
from app.core.supabase import supabase_admin

logger = logging.getLogger(__name__)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, distinct, or_, func
from sqlalchemy.orm import joinedload
from typing import List, Optional
import csv
import io
from app.api.deps import get_db
from app.core.security import get_current_user, check_permission
from app.models.core import Product, Campaign, UserProfile
from app.models.sales_goal import SalesGoal
from app.schemas.core import ProductOut, ProductCreate, ProductUpdate, ProductSkillOption, PaginatedResponse
from app.api.pagination import CommonQueryParams, apply_pagination_logic
from uuid import UUID

router = APIRouter()

@router.get("/skills-manifest", response_model=List[ProductSkillOption])
async def get_skills_manifest(
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("products", "read", module="config_products"))
):
    """Genera el manifiesto de habilidades vía SQL Directo"""
    try:
        # Fetch products and campaigns
        stmt = (
            select(Product.family_name, Campaign.name.label("campaign_name"))
            .join(Campaign, Product.campaign_id == Campaign.id)
            .where(
                Product.tenant_id == current_user.tenant_id,
                Product.is_active == True
            )
            .distinct()
        )
        
        result = await db.execute(stmt)
        rows = result.all()
        
        unique_skills = []
        seen = set()
        
        for row in rows:
            family = row.family_name
            if not family: continue
            
            camp_name = row.campaign_name.upper()
            family = family.strip().upper()
            label = f"{camp_name} > {family}"
            
            if label not in seen:
                unique_skills.append({"label": label, "value": label})
                seen.add(label)
        
        unique_skills.sort(key=lambda x: x["label"])
        return unique_skills
    except Exception as e:
        logger.error(f"Error fetching skills manifest via SQL: {e}")
        return []

@router.get("/", response_model=PaginatedResponse[ProductOut])
async def list_products(
    db: AsyncSession = Depends(get_db),
    params: CommonQueryParams = Depends(),
    include_inactive: bool = False,
    campaign_id: Optional[UUID] = Query(None),
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("products", "read", module="config_products"))
):
    query = select(Product).options(joinedload(Product.campaign)).where(Product.tenant_id == current_user.tenant_id)
    if not include_inactive:
        query = query.where(Product.is_active == True)
    
    if campaign_id:
        query = query.where(Product.campaign_id == campaign_id)
    
    return await apply_pagination_logic(
        db=db,
        model=Product,
        params=params,
        base_query=query,
        search_fields=["name", "family_name", "current_pp", "plan_name"]
    )

@router.post("/", response_model=ProductOut)
async def create_product(
    product_in: ProductCreate,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("products", "create", module="config_products"))
):
    """Alta de producto vía SQL Directo"""
    try:
        product_data = product_in.model_dump()
        if product_data.get("family_name"):
            product_data["family_name"] = product_data["family_name"].upper()
        
        # Inyectar Tenant ID
        product_data["tenant_id"] = current_user.tenant_id
        
        db_product = Product(**product_data)
        db.add(db_product)
        await db.commit()
        await db.refresh(db_product)
        
        return db_product
    except Exception as e:
        await db.rollback()
        logger.error(f"Error creating product via SQL: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error interno al crear el producto: {str(e)}")

@router.put("/{product_id}", response_model=ProductOut)
async def update_product(
    product_id: UUID,
    product_in: ProductUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("products", "update", module="config_products"))
):
    """Actualización de producto vía SQL Directo"""
    try:
        stmt = select(Product).where(Product.id == product_id, Product.tenant_id == current_user.tenant_id)
        result = await db.execute(stmt)
        db_product = result.scalar_one_or_none()
        
        if not db_product:
            raise HTTPException(status_code=404, detail="Producto no encontrado")

        update_data = product_in.model_dump(exclude_unset=True)
        if "family_name" in update_data and update_data["family_name"]:
            update_data["family_name"] = update_data["family_name"].upper()

        for field, value in update_data.items():
            setattr(db_product, field, value)

        await db.commit()
        await db.refresh(db_product)
        return db_product
    except HTTPException: raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error updating product via SQL: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error al actualizar producto: {str(e)}")

@router.delete("/{product_id}")
async def delete_product(
    product_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("products", "delete", module="config_products"))
):
    """Soft delete vía SQL"""
    try:
        stmt = select(Product).where(Product.id == product_id, Product.tenant_id == current_user.tenant_id)
        result = await db.execute(stmt)
        db_product = result.scalar_one_or_none()
        
        if not db_product:
            raise HTTPException(status_code=404, detail="Producto no encontrado")

        db_product.is_active = False
        await db.commit()
        return {"status": "success", "message": "Producto desactivado correctamente"}
    except HTTPException: raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error deleting product via SQL: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error al desactivar el producto: {str(e)}")

@router.get("/families", response_model=List[str])
async def list_product_families(
    campaign_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("products", "read", module="config_products"))
):
    """Returns a DISTINCT list of family names for a campaign."""
    query = (
        select(distinct(func.coalesce(Product.family_name, "GENERAL")))
        .where(
            Product.campaign_id == campaign_id, 
            Product.is_active == True,
            Product.tenant_id == current_user.tenant_id
        )
    )
    result = await db.execute(query)
    # Convert to list of strings and clean
    return [str(row[0]).strip().upper() for row in result.all() if row[0]]

@router.get("/names", response_model=List[str])
async def list_product_names(
    campaign_id: UUID = Query(...),
    family_name: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("products", "read", module="config_products"))
):
    """Returns a DISTINCT list of product names for a campaign and family."""
    query = (
        select(distinct(Product.name))
        .where(
            Product.campaign_id == campaign_id,
            Product.is_active == True,
            Product.tenant_id == current_user.tenant_id
        )
    )
    # Normalizing family input for comparison
    if family_name:
        query = query.where(
            func.upper(func.trim(func.coalesce(Product.family_name, "GENERAL"))) == family_name.strip().upper()
        )
        
    result = await db.execute(query)
    return [str(n).strip() for n in result.scalars().all()]

@router.get("/plans", response_model=List[ProductOut])
async def list_product_plans(
    db: AsyncSession = Depends(get_db),
    campaign_id: Optional[UUID] = Query(None),
    family_name: Optional[str] = Query(None),
    product_name: Optional[str] = Query(None),
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("products", "read", module="config_products"))
):
    """Returns the list of specific items (plans) for a campaign, family and product."""
    query = (
        select(Product)
        .options(joinedload(Product.campaign))
        .where(
            Product.is_active == True,
            Product.tenant_id == current_user.tenant_id
        )
    )
    
    # Robust handling for FastAPI Query objects vs direct calls
    eff_camp_id = campaign_id if isinstance(campaign_id, UUID) else None
    eff_family = family_name if isinstance(family_name, str) else None
    eff_product = product_name if isinstance(product_name, str) else None

    if eff_camp_id:
        query = query.where(Product.campaign_id == eff_camp_id)
    if eff_family:
        query = query.where(
            func.upper(func.trim(func.coalesce(Product.family_name, "GENERAL"))) == eff_family.strip().upper()
        )
    if eff_product:
        query = query.where(Product.name == eff_product)
        
    result = await db.execute(query.order_by(Product.plan_name))
    return result.scalars().all()

@router.get("/template")
async def list_product_template():
    """Returns a CSV template with a sample row."""
    output = io.StringIO()
    # Use utf-8-sig for Excel compatibility
    writer = csv.writer(output)
    
    headers = ["Campaña", "Familia", "Producto", "Concepto Factura", "Plan", "Referencia PP", "Precio", "Incentivo"]
    sample_row = ["Claro Video", "Claro Video", "Claro Video", "Comision Alambrico", "Claro Video Individual - Fijo", "CVCB12", "386", "58"]
    
    writer.writerow(headers)
    writer.writerow(sample_row)
    
    content = output.getvalue()
    content_bytes = content.encode("utf-8-sig")
    
    return Response(
        content=content_bytes,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=plantilla_productos.csv"}
    )

@router.post("/import")
async def import_products(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("products", "create", module="config_products"))
):
    """Procesa un archivo CSV para crear o actualizar productos vía SQL."""
    content = await file.read()
    try:
        text_content = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text_content = content.decode("latin-1")
        
    reader = csv.DictReader(io.StringIO(text_content))
    
    results = {
        "total_processed": 0,
        "success_count": 0,
        "error_count": 0,
        "errors": []
    }
    
    # Pre-cargar campañas de la organización
    campaign_stmt = select(Campaign.id, Campaign.name).where(Campaign.tenant_id == current_user.tenant_id)
    campaign_res = await db.execute(campaign_stmt)
    campaigns = {c.name.upper(): c.id for c in campaign_res.all()}
    
    header_map = {f.strip().lower(): f for f in (reader.fieldnames or [])}

    def get_val(row, clean_name, default=""):
        real_key = header_map.get(clean_name.lower())
        return row.get(real_key, "").strip() if real_key else default

    for i, row in enumerate(reader, start=2):
        results["total_processed"] += 1
        try:
            camp_name = get_val(row, "Campaña")
            family = get_val(row, "Familia")
            if family: family = family.upper()
            name = get_val(row, "Producto")
            concept = get_val(row, "Concepto Factura")
            plan = get_val(row, "Plan")
            pp = get_val(row, "Referencia PP")
            
            price_raw = get_val(row, "Precio", None)
            if not price_raw: raise ValueError("Columna 'Precio' vacía o faltante")
            
            import math
            try:
                price = float(price_raw)
                if not math.isfinite(price): raise ValueError("Precio no finito")
            except ValueError: raise ValueError(f"Precio '{price_raw}' no es válido")
                
            incentive_raw = get_val(row, "Incentivo", "0") or "0"
            try:
                incentive = float(incentive_raw)
                if not math.isfinite(incentive): raise ValueError("Incentivo no finito")
            except ValueError: raise ValueError(f"Incentivo '{incentive_raw}' no es válido")
            
            if not camp_name: raise ValueError("Campaña obligatoria")
            if not name: raise ValueError("Nombre de producto obligatorio")
            if not pp: raise ValueError("Referencia PP obligatoria")
                
            camp_id = campaigns.get(camp_name.upper())
            if not camp_id: raise ValueError(f"Campaña '{camp_name}' no encontrada")
            
            # Buscar producto existente
            existing_stmt = select(Product).where(
                Product.current_pp == pp,
                Product.campaign_id == camp_id,
                Product.tenant_id == current_user.tenant_id
            )
            existing_res = await db.execute(existing_stmt)
            db_product = existing_res.scalar_one_or_none()
            
            payload = {
                "tenant_id": current_user.tenant_id,
                "campaign_id": camp_id,
                "family_name": family,
                "name": name,
                "current_concept": concept,
                "plan_name": plan,
                "current_pp": pp,
                "current_price": price,
                "incentive": incentive,
                "is_active": True
            }
            
            if db_product:
                for key, value in payload.items():
                    setattr(db_product, key, value)
            else:
                db_product = Product(**payload)
                db.add(db_product)
            
            results["success_count"] += 1
            
        except Exception as e:
            results["error_count"] += 1
            results["errors"].append({"row": i, "message": str(e)})
            
    try:
        await db.commit()
    except Exception as commit_err:
        await db.rollback()
        results["error_count"] = results["total_processed"]
        results["errors"].append({"row": "GLOBAL", "message": f"Error al guardar cambios: {str(commit_err)}"})
        
    return results

@router.get("/export")
async def export_products(
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("products", "export", module="config_products"))
):
    """Exports all active products as a CSV file."""
    # --- AUDITORÍA: Registrar descarga ---
    from app.core.client import supabase
    try:
        supabase.table("export_jobs").insert({
            "user_id": str(current_user.id),
            "user_email": current_user.email,
            "report_type": "Product Catalog",
            "status": "completed",
            "message": "Descarga de catálogo completada"
        }).execute()
    except Exception as audit_err:
        print(f"Audit Log Error: {audit_err}")

    query = select(Product).options(joinedload(Product.campaign)).where(
        Product.tenant_id == current_user.tenant_id,
        Product.is_active == True
    )
    result = await db.execute(query)
    products = result.scalars().all()
    
    output = io.StringIO()
    # Use utf-8-sig for Excel compatibility
    writer = csv.writer(output)
    
    headers = ["Campaña", "Familia", "Producto", "Concepto Factura", "Plan", "Referencia PP", "Precio", "Incentivo"]
    writer.writerow(headers)
    
    for p in products:
        writer.writerow([
            (p.campaign.name if p.campaign else "") or "",
            p.family_name or "",
            p.name or "",
            p.current_concept or "",
            p.plan_name or "",
            p.current_pp or "",
            str(p.current_price) if p.current_price is not None else "0.0",
            str(p.incentive) if p.incentive is not None else "0.0"
        ])
    
    content = output.getvalue()
    content_bytes = content.encode("utf-8-sig")
    
    return Response(
        content=content_bytes,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=catalogo_productos.csv"}
    )

@router.post("/batch-delete")
async def batch_delete_products(
    ids: List[UUID],
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("products", "delete", module="config_products"))
):
    """Baja masiva lógica vía SQL."""
    try:
        from sqlalchemy import update
        stmt = (
            update(Product)
            .where(Product.id.in_(ids), Product.tenant_id == current_user.tenant_id)
            .values(is_active=False)
            .returning(Product.id)
        )
        
        response = await db.execute(stmt)
        await db.commit()
        
        return {"status": "success", "deleted_count": len(response.all())}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete via SQL: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error en eliminación masiva: {str(e)}")

@router.get("/{product_id}", response_model=ProductOut)
async def get_product(
    product_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("products", "read", module="config_products"))
):
    result = await db.execute(
        select(Product)
        .options(joinedload(Product.campaign))
        .where(Product.id == product_id)
        .where(Product.tenant_id == current_user.tenant_id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(
            status_code=404, 
            detail="Producto no encontrado: El item solicitado no existe o no tiene permisos para visualizarlo."
        )
    return product

@router.get("/all-for-select")
async def list_all_active_products_lite(
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("products", "read", module="config_products"))
):
    """Returns a lite, unpaginated list of all active products for UI selectors."""
    query = (
        select(
            Product.id, 
            Product.name, 
            Product.family_name, 
            Campaign.name.label("campaign_name")
        )
        .join(Campaign, Product.campaign_id == Campaign.id)
        .where(
            Product.tenant_id == current_user.tenant_id,
            Product.is_active == True
        )
    )
    result = await db.execute(query)
    # Convert result to list of dicts for simple frontend consumption
    products = []
    for row in result.all():
        products.append({
            "id": str(row.id),
            "name": row.name,
            "family_name": row.family_name,
            "campaign_name": row.campaign_name
        })
    return products

