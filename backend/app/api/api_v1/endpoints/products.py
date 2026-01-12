from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, distinct, or_, func
from sqlalchemy.orm import joinedload
from typing import List, Optional
import csv
import io
from app.api.deps import get_db
from app.core.security import get_current_user
from app.models.core import Product, Campaign, UserProfile
from app.models.sales_goal import SalesGoal
from app.schemas.core import ProductOut, ProductCreate, ProductUpdate, ProductSkillOption, PaginatedResponse
from app.api.pagination import CommonQueryParams, apply_pagination_logic
from uuid import UUID

router = APIRouter()

@router.get("/skills-manifest", response_model=List[ProductSkillOption])
async def get_skills_manifest(
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user)
):
    """Returns a unique list of campaign > family labels for skills selection."""
    query = (
        select(
            func.coalesce(Campaign.name, "SIN CAMPAÑA").label("camp_name"),
            Product.family_name
        )
        .outerjoin(Campaign, Product.campaign_id == Campaign.id)
        .where(
            Product.tenant_id == current_user.tenant_id,
            Product.is_active == True,
            Product.family_name.isnot(None)
        )
        .distinct()
        .order_by("camp_name", Product.family_name)
    )
    result = await db.execute(query)
    
    unique_skills = []
    seen = set()
    
    for row in result.all():
        camp_name = str(row[0]).strip().upper()
        family = str(row[1]).strip().upper()
        label = f"{camp_name} > {family}"
        
        if label not in seen:
            unique_skills.append({"label": label, "value": label})
            seen.add(label)
    
    unique_skills.sort(key=lambda x: x["label"])
    return unique_skills

@router.get("/", response_model=PaginatedResponse[ProductOut])
async def list_products(
    db: AsyncSession = Depends(get_db),
    params: CommonQueryParams = Depends(),
    include_inactive: bool = False,
    campaign_id: Optional[UUID] = Query(None)
):
    query = select(Product).options(joinedload(Product.campaign))
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
    db: AsyncSession = Depends(get_db)
):
    product_data = product_in.model_dump()
    if product_data.get("family_name"):
        product_data["family_name"] = product_data["family_name"].upper()
        
    product = Product(**product_data)
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return product

@router.put("/{product_id}", response_model=ProductOut)
async def update_product(
    product_id: UUID,
    product_in: ProductUpdate,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    update_data = product_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if key == "family_name" and value:
            value = value.upper()
        setattr(product, key, value)
    
    await db.commit()
    await db.refresh(product)
    return product

@router.delete("/{product_id}")
async def delete_product(
    product_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Soft delete (Logical Deletion)
    product.is_active = False
    await db.commit()
    return {"status": "success", "message": "Product deactivated"}

@router.get("/families", response_model=List[str])
async def list_product_families(
    campaign_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """Returns a DISTINCT list of family names for a campaign."""
    query = (
        select(distinct(func.coalesce(Product.family_name, "GENERAL")))
        .where(
            Product.campaign_id == campaign_id, 
            Product.is_active == True
        )
    )
    result = await db.execute(query)
    # Convert to list of strings and clean
    return [str(row[0]).strip().upper() for row in result.all() if row[0]]

@router.get("/names", response_model=List[str])
async def list_product_names(
    campaign_id: UUID = Query(...),
    family_name: str = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """Returns a DISTINCT list of product names for a campaign and family."""
    query = (
        select(distinct(Product.name))
        .where(
            Product.campaign_id == campaign_id,
            Product.is_active == True
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
    product_name: Optional[str] = Query(None)
):
    """Returns the list of specific items (plans) for a campaign, family and product."""
    query = select(Product).options(joinedload(Product.campaign)).where(Product.is_active == True)
    
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
    current_user: UserProfile = Depends(get_current_user)
):
    """Processes a CSV file to create or update products."""
    content = await file.read()
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = content.decode("latin-1")
        
    reader = csv.DictReader(io.StringIO(text))
    
    results = {
        "total_processed": 0,
        "success_count": 0,
        "error_count": 0,
        "errors": []
    }
    
    campaign_result = await db.execute(select(Campaign).where(Campaign.tenant_id == current_user.tenant_id))
    campaigns = {c.name.upper(): c.id for c in campaign_result.scalars().all()}
    
    # Pre-map headers to handle spaces/case variations
    header_map = {}
    if reader.fieldnames:
        for f in reader.fieldnames:
            clean_f = f.strip().lower()
            header_map[clean_f] = f

    def get_val(row, clean_name, default=""):
        real_key = header_map.get(clean_name.lower())
        if real_key:
            return row.get(real_key, "").strip()
        return default

    for i, row in enumerate(reader, start=2):
        results["total_processed"] += 1
        try:
            camp_name = get_val(row, "Campaña")
            family = get_val(row, "Familia")
            if family:
                family = family.upper()
            name = get_val(row, "Producto")
            concept = get_val(row, "Concepto Factura")
            plan = get_val(row, "Plan")
            pp = get_val(row, "Referencia PP")
            
            # Strict price validation
            price_raw = get_val(row, "Precio", None)
            if price_raw is None or price_raw == "":
                raise ValueError("La columna 'Precio' no se encuentra o está vacía")
            
            try:
                price = float(price_raw)
                import math
                if not math.isfinite(price):
                    raise ValueError(f"Precio '{price_raw}' no es un número finito")
            except ValueError:
                raise ValueError(f"Precio '{price_raw}' no es un número válido")
                
            # Incentive is optional in requirement but we want it valid if present
            incentive_raw = get_val(row, "Incentivo", "0")
            if incentive_raw == "": incentive_raw = "0"
            try:
                incentive = float(incentive_raw)
                if not math.isfinite(incentive):
                    raise ValueError(f"Incentivo '{incentive_raw}' no es un número finito")
            except ValueError:
                raise ValueError(f"Incentivo '{incentive_raw}' no es un número válido")
            
            if not camp_name:
                raise ValueError("La Campaña es obligatoria")
            if not name:
                raise ValueError("El nombre del Producto es obligatorio")
            if not pp:
                raise ValueError("La Referencia PP es obligatoria")
                
            camp_id = campaigns.get(camp_name.upper())
            if not camp_id:
                raise ValueError(f"Campaña '{camp_name}' no encontrada")
            
            query = select(Product).where(
                Product.current_pp == pp,
                Product.campaign_id == camp_id,
                Product.tenant_id == current_user.tenant_id
            )
            existing_result = await db.execute(query)
            product = existing_result.scalar_one_or_none()
            
            if product:
                product.campaign_id = camp_id
                product.family_name = family
                product.name = name
                product.current_concept = concept
                product.plan_name = plan
                product.current_price = price
                product.incentive = incentive
                product.is_active = True  # Reactivate if it was soft-deleted
            else:
                product = Product(
                    tenant_id=current_user.tenant_id,
                    campaign_id=camp_id,
                    family_name=family,
                    name=name,
                    current_concept=concept,
                    plan_name=plan,
                    current_pp=pp,
                    current_price=price,
                    incentive=incentive,
                    is_active=True
                )
                db.add(product)
            
            await db.flush()
            results["success_count"] += 1
            
        except ValueError as e:
            results["error_count"] += 1
            results["errors"].append({
                "row": i,
                "column": "Varias",
                "message": str(e),
                "value": str(row)
            })
        except Exception as e:
            results["error_count"] += 1
            results["errors"].append({
                "row": i,
                "column": "Sistema",
                "message": "Error inesperado al procesar la fila",
                "value": str(e)
            })
            
    if results["success_count"] > 0:
        await db.commit()
        
    return results

@router.get("/export")
async def export_products(
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user)
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
    db: AsyncSession = Depends(get_db)
):
    """Logically deletes multiple products."""
    # Using a soft delete (setting is_active = False)
    from sqlalchemy import update
    query = update(Product).where(Product.id.in_(ids)).values(is_active=False)
    result = await db.execute(query)
    await db.commit()
    return {"status": "success", "deleted_count": result.rowcount}

@router.get("/{product_id}", response_model=ProductOut)
async def get_product(
    product_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Product).options(joinedload(Product.campaign)).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

@router.get("/all-for-select")
async def list_all_active_products_lite(
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user)
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

