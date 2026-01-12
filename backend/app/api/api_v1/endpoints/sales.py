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
from app.schemas.core import PaginatedResponse
from app.core.security import get_current_user
import uuid
import datetime
import csv
import io
from fastapi.responses import StreamingResponse

router = APIRouter()

@router.get("/", response_model=PaginatedResponse[SalesOrderOut])
async def read_sales(
    scope: Optional[str] = Query(None, description="active | history"),
    params: CommonQueryParams = Depends(),
    db: AsyncSession = Depends(deps.get_db),
):
    # 1. Base query with all relationships for the dashboard
    query = select(SalesOrder).options(
        selectinload(SalesOrder.campaign),
        selectinload(SalesOrder.product),
        selectinload(SalesOrder.agent),
        selectinload(SalesOrder.supervisor),
        selectinload(SalesOrder.digitizer)
    )

    # 2. Apply Scope Filtering (Workflow Engine)
    if scope == "active":
        # Dynamic filter: Only statuses configured to show in dashboard
        query = query.join(Status, SalesOrder.status == Status.name)\
                     .where(Status.is_active_work == True)
    elif scope == "history":
        # Dynamic filter: Terminal states configured as non-active work
        query = query.join(Status, SalesOrder.status == Status.name)\
                     .where(Status.is_active_work == False)

    # 3. Apply pagination logic
    # Searchable fields for sales orders
    search_fields = ["customer_name", "customer_doc_id", "status", "os_madre", "os_hija"]
    
    pagination_result = await apply_pagination_logic(
        db=db,
        model=SalesOrder,
        params=params,
        base_query=query,
        search_fields=search_fields
    )
    
    return pagination_result

@router.post("/", response_model=SalesOrderOut)
async def create_sale(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: UserProfile = Depends(get_current_user),
    payload: dict = Body(...),
) -> Any:
    try:
        def to_uuid(val):
            if not val: return None
            try:
                return uuid.UUID(str(val))
            except:
                return None

        tenant_id = to_uuid(payload.get("tenant_id")) or uuid.UUID('00000000-0000-0000-0000-000000000000')
        new_id = uuid.uuid4()
        
        # --- DYNAMIC INITIAL STATUS (WATERFALL) ---
        from app.models.core import Campaign
        initial_status = None
        
        # 1. Check for Campaign-Specific Default
        campaign_id = to_uuid(payload.get("campaign_id"))
        if campaign_id:
            camp_query = select(Campaign).where(Campaign.id == campaign_id)
            camp_res = await db.execute(camp_query)
            campaign_obj = camp_res.scalar_one_or_none()
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
            raise HTTPException(status_code=500, detail="No sales statuses configured in system.")

        sale = SalesOrder(
            id=new_id,
            tenant_id=tenant_id,
            agent_id=current_user.id, # ALWAYS force current user as author
            product_id=to_uuid(payload.get("product_id")),
            campaign_id=to_uuid(payload.get("campaign_id")),
            supervisor_id=to_uuid(payload.get("supervisor_id")),
            customer_name=payload.get("customer_name") or payload.get("client_name") or "Cliente",
            customer_doc_id=payload.get("customer_doc_id") or payload.get("doc_id"),
            customer_contact=payload.get("customer_contact") or payload.get("contact"),
            os_madre=payload.get("os_madre"),
            os_hija=payload.get("os_hija"),
            status=initial_status.name,
            snapshot_price=float(payload.get("snapshot_price", 0)),
            snapshot_pp=payload.get("snapshot_pp"),
            snapshot_concept=payload.get("snapshot_concept"),
            snapshot_family=payload.get("snapshot_family"),
            snapshot_plan=payload.get("snapshot_plan"),
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
    except Exception as e:
        print(f"SAVE ERROR: {e}")
        try:
            await db.rollback()
        except:
            pass
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{sale_id}")
async def delete_sale(
    sale_id: uuid.UUID,
    db: AsyncSession = Depends(deps.get_db)
):
    result = await db.execute(select(SalesOrder).where(SalesOrder.id == sale_id))
    sale = result.scalar_one_or_none()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    
    await db.delete(sale)
    await db.commit()
    return {"status": "success"}

@router.put("/{sale_id}", response_model=Any)
async def update_sale(
    sale_id: uuid.UUID,
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: UserProfile = Depends(get_current_user),
    payload: dict = Body(...),
) -> Any:
    try:
        query = select(SalesOrder).filter(SalesOrder.id == sale_id)
        result = await db.execute(query)
        sale = result.scalar_one_or_none()
        
        if not sale:
            raise HTTPException(status_code=404, detail="Sale not found")
            
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
            s_query = select(Status).where(Status.id == payload["status_id"])
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
        # Si el usuario no es un vendedor, reclama la responsabilidad operativa
        from app.schemas.core import UserRole
        if current_user.role != UserRole.REPRESENTANTE:
            sale.digitizer_id = current_user.id
            
        sale.updated_at = datetime.datetime.now() # Fallback for explicit audit
        
        await db.commit()
        return {"status": "success", "id": str(sale_id), "status_name": sale.status}
    except Exception as e:
        print(f"UPDATE ERROR: {e}")
        try:
            await db.rollback()
        except:
            pass
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/export")
async def export_sales(
    start_date: Optional[datetime.date] = Query(None),
    end_date: Optional[datetime.date] = Query(None),
    campaign_id: Optional[uuid.UUID] = Query(None),
    scope: str = Query("all", description="active | history | all"),
    db: AsyncSession = Depends(deps.get_db),
    current_user: UserProfile = Depends(get_current_user),
):
    try:
        # Base query
        query = select(SalesOrder).options(
            selectinload(SalesOrder.campaign),
            selectinload(SalesOrder.product),
            selectinload(SalesOrder.agent),
            selectinload(SalesOrder.supervisor)
        )

        # Filters
        if start_date:
            query = query.where(SalesOrder.created_at >= datetime.datetime.combine(start_date, datetime.time.min))
        if end_date:
            query = query.where(SalesOrder.created_at <= datetime.datetime.combine(end_date, datetime.time.max))
        
        if campaign_id:
            query = query.where(SalesOrder.campaign_id == campaign_id)
        
        if scope == "active":
            query = query.join(Status, SalesOrder.status == Status.name).where(Status.is_active_work == True)
        elif scope == "history":
            query = query.join(Status, SalesOrder.status == Status.name).where(Status.is_active_work == False)

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