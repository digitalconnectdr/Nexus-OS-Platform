from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Body, Query
from fastapi.encoders import jsonable_encoder
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.api import deps
from app.api.pagination import CommonQueryParams, apply_pagination_logic
from app.models.core import SalesOrder, Product, Campaign, UserProfile
from app.models.status import Status
from app.schemas.sales import SalesOrderOut
from app.schemas.core import PaginatedResponse, UserRole
from app.core.security import get_current_user, check_permission
import uuid
import datetime
import csv
import io
from fastapi.responses import StreamingResponse
import logging
from app.core.supabase import supabase_admin

logger = logging.getLogger(__name__)

def to_uuid(val):
    if not val: return None
    try:
        return uuid.UUID(str(val))
    except:
        return None

router = APIRouter()

@router.get("/", response_model=PaginatedResponse[SalesOrderOut])
async def read_sales(
    scope: Optional[str] = Query(None, description="active | history"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    """Listado de ventas vía SQL Directo"""
    # 1. Permission checks
    permissions_to_check = ["sales:read", "dashboard:view"]
    if scope == "history":
        permissions_to_check.extend(["sales:read_history", "history:view"])
    
    has_permission = False
    for p_name in permissions_to_check:
        try:
            res, act = p_name.split(":")
            checker = check_permission(res, act)
            await checker(current_user, db)
            has_permission = True
            break
        except HTTPException: continue
            
    if not has_permission:
        logger.warning(f"🚫 Access Denied: {current_user.email}")
        raise HTTPException(status_code=403, detail="Acceso denegado")

    try:
        # 2. Base Query
        stmt = (
            select(SalesOrder)
            .options(
                selectinload(SalesOrder.campaign),
                selectinload(SalesOrder.product),
                selectinload(SalesOrder.agent),
                selectinload(SalesOrder.supervisor)
            )
            .where(SalesOrder.is_deleted == False, SalesOrder.tenant_id == current_user.tenant_id)
        )
        
        # 3. Role Scoping
        if current_user.role not in [UserRole.SUPER_ADMIN, UserRole.ADMINISTRADOR, UserRole.GERENTE, UserRole.SUPERVISOR, UserRole.SUPERVISOR_SENIOR]:
            stmt = stmt.where(SalesOrder.agent_id == current_user.id)
        
        # 4. Scope filtering (Status Scope)
        if scope in ["active", "history"]:
            target_scope = "DASHBOARD" if scope == "active" else "ARCHIVE"
            # Subquery to get statuses with the target scope
            status_stmt = select(Status.name).where(Status.tenant_id == current_user.tenant_id, Status.scope == target_scope)
            status_result = await db.execute(status_stmt)
            status_names = [s[0] for s in status_result.all()]
            stmt = stmt.where(SalesOrder.status.in_(status_names))

        # 5. Search
        if search:
            from sqlalchemy import or_
            stmt = stmt.where(or_(
                SalesOrder.customer_name.ilike(f"%{search}%"),
                SalesOrder.customer_doc_id.ilike(f"%{search}%"),
                SalesOrder.status.ilike(f"%{search}%")
            ))

        # 6. Count
        from sqlalchemy import func
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_count_res = await db.execute(count_stmt)
        total_count = total_count_res.scalar() or 0

        # 7. Pagination and Sort
        stmt = stmt.order_by(SalesOrder.created_at.desc())
        stmt = stmt.offset((page - 1) * size).limit(size)

        # 8. Execute
        result = await db.execute(stmt)
        sales = result.scalars().all()

        return PaginatedResponse(
            total=total_count,
            page=page,
            size=size,
            items=sales
        )
    except Exception as e:
        logger.error(f"Error list sales SQL: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/", response_model=SalesOrderOut)
async def create_sale(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: UserProfile = Depends(get_current_user),
    payload: dict = Body(...),
    _: bool = Depends(check_permission("sales", "create", module="dashboard"))
) -> Any:
    try:
        # Helper relocate to module scope

        # Safeguard: Use current_user.tenant_id if payload tenant_id is missing or default
        payload_tenant = to_uuid(payload.get("tenant_id"))
        if not payload_tenant or str(payload_tenant) == '00000000-0000-0000-0000-000000000000':
            tenant_id = current_user.tenant_id
        else:
            tenant_id = payload_tenant

        # --- BUSINESS LOGIC VALDATIONS ---
        # 1. Price Validation
        try:
            price_val = float(payload.get("snapshot_price", 0))
            if price_val < 0:
                raise HTTPException(status_code=400, detail="El precio no puede ser negativo.")
        except ValueError:
            raise HTTPException(status_code=400, detail="Formato de precio inválido.")

        # 2. Campaign Validation
        campaign_id = to_uuid(payload.get("campaign_id"))
        campaign_obj = None
        if campaign_id:
            camp_query = select(Campaign).where(Campaign.id == campaign_id)
            camp_res = await db.execute(camp_query)
            campaign_obj = camp_res.scalar_one_or_none()
            if not campaign_obj:
                raise HTTPException(status_code=404, detail="La campaña especificada no existe.")

        # 3. Product Validation
        product_id = to_uuid(payload.get("product_id"))
        product_obj = None
        if product_id:
            prod_query = select(Product).where(Product.id == product_id)
            prod_res = await db.execute(prod_query)
            product_obj = prod_res.scalar_one_or_none()
            if not product_obj:
                raise HTTPException(status_code=404, detail="El producto especificado no existe.")

        new_id = uuid.uuid4()
        
        # --- DYNAMIC INITIAL STATUS (WATERFALL) ---
        initial_status = None
        
        # 1. Check for Campaign-Specific Default
        if campaign_obj and campaign_obj.default_status_id:
            status_query = select(Status).where(Status.id == campaign_obj.default_status_id)
            status_res = await db.execute(status_query)
            initial_status = status_res.scalar_one_or_none()
        
        # 2. Check for Global Default
        if not initial_status:
            status_query = select(Status).where(Status.tenant_id == tenant_id, Status.is_default == True)
            status_res = await db.execute(status_query)
            initial_status = status_res.scalar_one_or_none()
        
        # 3. Fallback: Take the first active status by ID
        if not initial_status:
            status_query = select(Status).where(Status.tenant_id == tenant_id, Status.is_active == True).order_by(Status.id.asc())
            status_res = await db.execute(status_query)
            initial_status = status_res.scalar_one_or_none()
            
        if not initial_status:
            raise HTTPException(
                status_code=400, 
                detail="Configuración incompleta: No hay estados de venta definidos para esta organización. Por favor, configure los estados en Ajustes."
            )

        sale = SalesOrder(
            id=new_id,
            tenant_id=tenant_id,
            agent_id=current_user.id, # ALWAYS force current user as author
            product_id=product_id,
            campaign_id=campaign_id,
            supervisor_id=to_uuid(payload.get("supervisor_id")),
            customer_name=payload.get("customer_name") or payload.get("client_name") or "Cliente",
            customer_doc_id=payload.get("customer_doc_id") or payload.get("doc_id"),
            customer_contact=payload.get("customer_contact") or payload.get("contact"),
            os_madre=payload.get("os_madre"),
            os_hija=payload.get("os_hija"),
            status=initial_status.name,
            snapshot_price=price_val,
            snapshot_pp=payload.get("snapshot_pp"),
            snapshot_concept=payload.get("snapshot_concept"),
            snapshot_family=payload.get("snapshot_family") or (product_obj.family_name if product_obj else None),
            snapshot_plan=payload.get("snapshot_plan") or (product_obj.plan_name if product_obj else None),
            assigned_to=payload.get("assigned_to"),
            comms_claro=payload.get("comms_claro"),
            comms_orion=payload.get("comms_orion"),
            comms_dofu=payload.get("comms_dofu"),
            inst_num=payload.get("inst_num"),
            last_updated_by=current_user.email,
            created_at=datetime.datetime.now()
        )
        
        db.add(sale)
        await db.commit()
        
        # Re-fetch with relationships for Frontend Eager Loading
        result = await db.execute(
            select(SalesOrder)
            .options(
                selectinload(SalesOrder.campaign),
                selectinload(SalesOrder.product),
                selectinload(SalesOrder.agent),
                selectinload(SalesOrder.supervisor)
            )
            .where(SalesOrder.id == new_id)
        )
        sale_enriched = result.scalar_one()
        return sale_enriched
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"SAVE ERROR: {e}", exc_info=True)
        try:
            await db.rollback()
        except:
            pass
        raise HTTPException(
            status_code=500, 
            detail=f"Hubo un problema interno al procesar el registro de venta. Por favor, contacte a soporte si el problema persiste. ||| TECH_DETAILS: {str(e)}"
        )

@router.delete("/{sale_id}")
async def delete_sale(
    sale_id: uuid.UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: UserProfile = Depends(get_current_user)
):
    # --- DYNAMIC PERMISSION CHECK (Dashboard OR History) ---
    has_perm = False
    for mod, res, act in [("dashboard", "sales", "delete"), ("history", "history_sales", "delete")]:
        try:
            checker = check_permission(res, act, module=mod)
            await checker(current_user, db)
            has_perm = True
            break
        except HTTPException:
            continue
            
    if not has_perm:
        logger.warning(f"🚫 Delete Denied for {current_user.email} on sale {sale_id}")
        raise HTTPException(status_code=403, detail="No tiene permiso para eliminar ventas.")

    result = await db.execute(
        select(SalesOrder)
        .where(SalesOrder.id == sale_id)
        .where(SalesOrder.tenant_id == current_user.tenant_id)
    )
    sale = result.scalar_one_or_none()
    if not sale:
        raise HTTPException(
            status_code=404, 
            detail="Venta no encontrada: El registro solicitado no existe o no tiene permisos para acceder a él."
        )
    
    sale.is_deleted = True
    await db.commit()
    return {"status": "success"}

@router.put("/{sale_id}", response_model=Any)
async def update_sale(
    sale_id: uuid.UUID,
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: UserProfile = Depends(get_current_user),
    payload: dict = Body(...)
) -> Any:
    # --- DYNAMIC PERMISSION CHECK (Dashboard OR History) ---
    # We check for general 'update' or specific 'change_status' if only status is changing
    is_only_status = set(payload.keys()).issubset({"status", "status_id", "auditor_name"})
    
    perms_to_check = [
        ("dashboard", "sales", "update"),
        ("history", "history_sales", "update")
    ]
    
    if is_only_status:
        perms_to_check.extend([
            ("dashboard", "sales", "change_status"),
            ("history", "history_sales", "change_status")
        ])
    
    has_perm = False
    for mod, res, act in perms_to_check:
        try:
            checker = check_permission(res, act, module=mod)
            await checker(current_user, db)
            has_perm = True
            break
        except HTTPException:
            continue
            
    if not has_perm:
        logger.warning(f"🚫 Update Denied for {current_user.email} on sale {sale_id}")
        raise HTTPException(status_code=403, detail="No tiene permiso para editar ventas o cambiar su estatus.")

    try:
        query = (
            select(SalesOrder)
            .where(SalesOrder.id == sale_id)
            .where(SalesOrder.tenant_id == current_user.tenant_id)
        )
        result = await db.execute(query)
        sale = result.scalar_one_or_none()
        
        if not sale:
            raise HTTPException(
                status_code=404, 
                detail="Venta no encontrada: No se pudo localizar el registro para su actualización."
            )
            
        # Tracking changes for audit
        modified = []

        def check_change(attr, new_val):
            # Normalizar para comparación
            old_val = getattr(sale, attr)
            
            # Handle possible types
            # 1. Clean strings (ignore whitespace and handle None)
            o_str = str(old_val).strip() if old_val is not None else ""
            n_str = str(new_val).strip() if new_val is not None else ""
            
            # 2. Check for numeric equality if applicable
            is_match = False
            if isinstance(old_val, (float, int, complex)) or isinstance(new_val, (float, int, complex)):
                try:
                    if float(o_str or 0) == float(n_str or 0):
                        is_match = True
                except:
                    pass
            
            if not is_match and o_str != n_str:
                setattr(sale, attr, new_val)
                return True
            return False

        # Mapping for human readable labels
        # Update fields from payload
        if "client" in payload:
            if check_change("customer_name", payload["client"]): modified.append("Cliente")
        if "doc_id" in payload:
            if check_change("customer_doc_id", payload["doc_id"]): modified.append("Doc ID")
        if "contact" in payload:
            if check_change("customer_contact", payload["contact"]): modified.append("Contacto")
        if "campaign_id" in payload:
            if check_change("campaign_id", payload["campaign_id"]): modified.append("Campaña")
        if "product" in payload:
            if check_change("snapshot_product_name", payload["product"]): modified.append("Producto")
        if "family" in payload:
            if check_change("snapshot_family", payload["family"]): modified.append("Familia")
        if "plan" in payload:
            if check_change("snapshot_plan", payload["plan"]): modified.append("Plan")
        if "price" in payload: 
            try:
                if check_change("snapshot_price", float(payload["price"])): modified.append("Monto")
            except:
                pass
        if "os_madre" in payload:
            if check_change("os_madre", payload["os_madre"]): modified.append("OS Madre")
        if "os_hija" in payload:
            if check_change("os_hija", payload["os_hija"]): modified.append("OS Hija")
        if "pp" in payload:
            if check_change("snapshot_pp", payload["pp"]): modified.append("PP")
        if "concept" in payload:
            if check_change("snapshot_concept", payload["concept"]): modified.append("Concepto")
        if "assigned_to" in payload:
            if check_change("assigned_to", payload["assigned_to"]): modified.append("Asignado A")
        if "comms_claro" in payload:
            if check_change("comms_claro", str(payload["comms_claro"])): modified.append("Com Claro")
        if "comms_orion" in payload:
            if check_change("comms_orion", str(payload["comms_orion"])): modified.append("Com Orion")
        if "comms_dofu" in payload:
            if check_change("comms_dofu", str(payload["comms_dofu"])): modified.append("Com Dofu")
        if "inst_num" in payload:
            if check_change("inst_num", payload["inst_num"]): modified.append("Inst Num")
            
        if "status_id" in payload:
            old_status = sale.status
            mapped_status_id = to_uuid(payload["status_id"])
            s_query = select(Status).where(Status.id == mapped_status_id)
            s_res = await db.execute(s_query)
            status_obj = s_res.scalar_one_or_none()
            if status_obj:
                sale.status = status_obj.name
                modified.append("Estatus")
                # Capture metadata for status change
                sale.last_status_change = {
                    "user": current_user.email,
                    "at": datetime.datetime.now().isoformat()
                }
        elif "status" in payload:
            if (sale.status or "").strip() != (payload["status"] or "").strip():
                sale.status = payload["status"]
                modified.append("Estatus")
                # Capture metadata for status change
                sale.last_status_change = {
                    "user": current_user.email,
                    "at": datetime.datetime.now().isoformat()
                }

        if modified:
            # Append new changes to existing ones or just keep latest? 
            # Usually for a single update session we record what changed now.
            sale.modified_fields = modified

        if "auditor_name" in payload:
            sale.last_updated_by = payload["auditor_name"]
        else:
            sale.last_updated_by = current_user.email

        # --- Lógica de Atribución Operativa (Claim / Last Touch) ---
        # Si el usuario no es un vendedor (Representante o Agent), reclama la responsabilidad operativa
        sales_roles = [UserRole.REPRESENTANTE, "Representante"]
        if current_user.role not in sales_roles:
            sale.digitizer_id = current_user.id
            
        sale.updated_at = datetime.datetime.now() # Fallback for explicit audit
        
        await db.commit()
        return {"status": "success", "id": str(sale_id), "status_name": sale.status}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"UPDATE ERROR: {e}", exc_info=True)
        try:
            await db.rollback()
        except:
            pass
        raise HTTPException(
            status_code=500, 
            detail=f"No se pudo completar la actualización de la venta. Por favor, verifique la conexión o contacte a soporte. ||| TECH_DETAILS: {str(e)}"
        )

@router.get("/export")
async def export_sales(
    start_date: Optional[datetime.date] = Query(None),
    end_date: Optional[datetime.date] = Query(None),
    campaign_id: Optional[uuid.UUID] = Query(None),
    scope: str = Query("all", description="active | history | all"),
    db: AsyncSession = Depends(deps.get_db),
    current_user: UserProfile = Depends(get_current_user)
):
    # --- DYNAMIC FUNCTIONAL PERMISSION CHECK ---
    if scope == "history":
        checker = check_permission("sales", "export", module="history")
    else:
        checker = check_permission("sales", "export", module="dashboard")
    
    await checker(current_user, db)
    try:
        # Base query
        query = select(SalesOrder).options(
            selectinload(SalesOrder.campaign),
            selectinload(SalesOrder.product),
            selectinload(SalesOrder.agent),
            selectinload(SalesOrder.supervisor)
        )

        # Filters
        query = query.where(
            SalesOrder.is_deleted == False,
            SalesOrder.tenant_id == current_user.tenant_id
        )
        
        # --- DATA SCOPE FILTERING ---
        high_level_roles = [UserRole.SUPER_ADMIN, UserRole.ADMINISTRADOR, UserRole.GERENTE, UserRole.SUPERVISOR, UserRole.SUPERVISOR_SENIOR]
        if current_user.role not in high_level_roles:
            logger.info(f"🔒 Restricted export scope for {current_user.email}")
            query = query.where(SalesOrder.agent_id == current_user.id)

        if start_date:
            query = query.where(SalesOrder.created_at >= datetime.datetime.combine(start_date, datetime.time.min))
        if end_date:
            query = query.where(SalesOrder.created_at <= datetime.datetime.combine(end_date, datetime.time.max))
        
        if campaign_id:
            query = query.where(SalesOrder.campaign_id == campaign_id)
        
        from sqlalchemy import func
        if scope == "active":
            query = query.join(Status, func.lower(SalesOrder.status) == func.lower(Status.name)).where(Status.scope == "DASHBOARD")
        elif scope == "history":
            query = query.join(Status, func.lower(SalesOrder.status) == func.lower(Status.name)).where(Status.scope == "ARCHIVE")

        # Execute
        result = await db.execute(query.order_by(SalesOrder.created_at.desc()))
        sales = result.scalars().all()

        def generate():
            output = io.StringIO()
            writer = csv.writer(output)
            
            # Header - Strict Order
            writer.writerow([
                "Fecha", "Hora", "Agente", "Campaña", "Cliente", "Doc ID", "Contacto", 
                "OS Madre", "OS Hija", "Familia", "Producto", "Plan", "PP", "Concepto", 
                "Monto", "Estatus", "Asignado A", "Com Claro", "Com Orion", 
                "Com Dofu", "Inst Num", "Últ. Cambio", "Estatus Audit."
            ])
            yield output.getvalue()
            output.truncate(0)
            output.seek(0)

            for s in sales:
                agent_name = f"{s.agent.first_name} {s.agent.last_name}" if s.agent else (s.agent_email or "SISTEMA")
                
                # Mapping Row by Row
                writer.writerow([
                    s.created_at.strftime('%Y-%m-%d') if s.created_at else "",
                    s.created_at.strftime('%H:%M:%S') if s.created_at else "",
                    agent_name,
                    s.campaign.name if s.campaign else "--",
                    s.customer_name,
                    s.customer_doc_id,
                    s.customer_contact,
                    s.os_madre,
                    s.os_hija,
                    s.snapshot_family or (s.product.family_name if s.product else "--"),
                    s.snapshot_product_name or (s.product.name if s.product else "--"),
                    s.snapshot_plan or (s.product.plan_name if s.product else "--"),
                    s.snapshot_pp or "--",
                    s.snapshot_concept or "--",
                    s.snapshot_price or 0,
                    s.status,
                    s.assigned_to or "--",
                    s.comms_claro or "",
                    s.comms_orion or "",
                    s.comms_dofu or "",
                    s.inst_num or "--",
                    # Consolidated Last Change
                    f"[{s.last_updated_by or 'SISTEMA'}] {s.updated_at.strftime('%Y-%m-%d %H:%M') if s.updated_at else ''} | Modif: {', '.join(s.modified_fields) if s.modified_fields else 'Ninguno'}",
                    # Status Audit
                    f"{s.last_status_change['user'].split('@')[0]} | {s.last_status_change['at'][:16].replace('T', ' ')}" if s.last_status_change else "--"
                ])
                yield output.getvalue()
                output.truncate(0)
                output.seek(0)

        filename = f"reporte_ventas_{datetime.date.today()}.csv"
        return StreamingResponse(
            generate(),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        print(f"EXPORT ERROR: {e}")
        raise HTTPException(status_code=500, detail=str(e))