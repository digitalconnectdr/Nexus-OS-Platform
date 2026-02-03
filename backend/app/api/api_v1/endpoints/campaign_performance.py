import logging
from typing import List, Any
from datetime import datetime
from calendar import monthrange
from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
import csv
import io

from app.api import deps
from app.models import Campaign, Product, SalesOrder, SalesGoal, Status, UserProfile
from app.api.deps import get_db

router = APIRouter()
logger = logging.getLogger(__name__)

# --- UTILERÍA: Calcular Proyección ---
def calculate_projection(current_val: float, month_str: str) -> float:
    """Calcula la proyección lineal basada en el día actual del mes."""
    try:
        now = datetime.now()
        year, month = map(int, month_str.split('-'))
        _, days_in_month = monthrange(year, month)
        
        # Meses pasados: proyección = real
        if now.year > year or (now.year == year and now.month > month):
            return current_val
            
        # Mes actual: proyección lineal
        if now.year == year and now.month == month:
            days_passed = now.day
            if days_passed == 0: return 0.0
            return (current_val / days_passed) * days_in_month
            
        return 0.0 # Mes futuro
    except:
        return 0.0

def get_prev_month(month_str: str) -> str:
    """Retorna el mes anterior en formato YYYY-MM."""
    year, month = map(int, month_str.split('-'))
    if month == 1:
        return f"{year-1}-12"
    return f"{year}-{month-1:02d}"

from app.core.security import get_current_user, check_permission
from app.models.core import UserProfile
from app.core.security import get_current_user, check_permission
from app.models.core import UserProfile

@router.get("/")
async def get_campaign_performance(
    month: str = Query(..., description="Format YYYY-MM"),
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(deps.get_db),
    _: bool = Depends(check_permission("performance", "read", module="performance"))
):
    """VERSION DB DIRECT - Bypass REST API"""
    logger.info(f"📊 Loading campaign performance via SQL for {month} (Tenant: {current_user.tenant_id})")
    
    tenant_id = str(current_user.tenant_id)

    try:
        # 1. Obtener Metadatos (Campañas y Productos) - FILTRADOS POR TENANT
        camp_stmt = select(Campaign.id, Campaign.name).where(Campaign.tenant_id == current_user.tenant_id)
        camp_res = await db.execute(camp_stmt)
        campaigns_meta = {str(c.id): c.name for c in camp_res.all()}

        prod_stmt = select(Product.id, Product.name, Product.campaign_id).where(Product.tenant_id == current_user.tenant_id)
        prod_res = await db.execute(prod_stmt)
        products_meta = {str(p.id): {"name": p.name, "cid": str(p.campaign_id)} for p in prod_res.all()}

        # 2. Rango de fechas
        year, m_num = map(int, month.split('-'))
        start_date = datetime(year, m_num, 1) # SQL alchemy handles datetime objects better than strings
        if m_num == 12:
            end_date = datetime(year + 1, 1, 1)
        else:
            end_date = datetime(year, m_num + 1, 1)

        # 0. Fetch Productive Statuses for this tenant
        st_stmt = select(Status.name).where(Status.tenant_id == current_user.tenant_id, Status.is_productive == True)
        st_res = await db.execute(st_stmt)
        productive_names = st_res.scalars().all()

        if not productive_names:
            return {"month": month, "campaigns": [], "products": []}

        # 3. Obtener Ventas (Mes Actual) - FILTRADAS POR TENANT Y ESTATUS PRODUCTIVOS
        sales_stmt = select(SalesOrder.id, SalesOrder.campaign_id, SalesOrder.product_id, SalesOrder.snapshot_price, SalesOrder.agent_id)\
            .where(
                SalesOrder.tenant_id == current_user.tenant_id,
                SalesOrder.is_deleted == False,
                SalesOrder.created_at >= start_date,
                SalesOrder.created_at < end_date,
                SalesOrder.status.in_(productive_names)
            )
        
        sales_res = await db.execute(sales_stmt)
        sales_data_raw = []
        for r in sales_res.all():
            sales_data_raw.append({
                "id": str(r.id),
                "campaign_id": str(r.campaign_id),
                "product_id": str(r.product_id),
                "snapshot_price": float(r.snapshot_price or 0),
                "agent_id": str(r.agent_id)
            })

        # --- EXCLUDE ADMIN SALES ---
        sales_raw = []
        if sales_data_raw:
            agent_ids = list(set([s['agent_id'] for s in sales_data_raw if s.get('agent_id')]))
            if agent_ids:
                # Optimized User Role Fetch
                valid_agents_stmt = select(UserProfile.id, UserProfile.role).where(UserProfile.id.in_(agent_ids))
                valid_agents_res = await db.execute(valid_agents_stmt)
                valid_ids = {str(u.id) for u in valid_agents_res.all() if u.role not in ['Super Admin', 'Administrador']}
                sales_raw = [s for s in sales_data_raw if s.get('agent_id') in valid_ids]
            else:
                sales_raw = []

        # 4. Obtener Metas (Mes Actual) - FILTRADAS POR TENANT
        goals_stmt = select(SalesGoal.campaign_id, SalesGoal.product_id, SalesGoal.target_amount, SalesGoal.target_units)\
            .where(
                SalesGoal.tenant_id == current_user.tenant_id,
                SalesGoal.month == month
            )
        goals_res = await db.execute(goals_stmt)
        goals_raw = []
        for r in goals_res.all():
            goals_raw.append({
                "campaign_id": str(r.campaign_id),
                "product_id": str(r.product_id),
                "target_amount": float(r.target_amount or 0),
                "target_units": int(r.target_units or 0)
            })

        # 5. Obtener Ventas (Mes Anterior) para el calculo de PACE
        prev_month = get_prev_month(month)
        py, pm = map(int, prev_month.split('-'))
        ps_date = datetime(py, pm, 1)
        pe_date = start_date
        
        ps_stmt = select(SalesOrder.campaign_id, SalesOrder.product_id, SalesOrder.snapshot_price)\
            .where(
                SalesOrder.tenant_id == current_user.tenant_id,
                SalesOrder.is_deleted == False,
                SalesOrder.created_at >= ps_date,
                SalesOrder.created_at < pe_date,
                SalesOrder.status.in_(productive_names)
            )
            
        prev_sales_res = await db.execute(ps_stmt)
        prev_sales_raw = []
        for r in prev_sales_res.all():
            prev_sales_raw.append({
                "campaign_id": str(r.campaign_id),
                "product_id": str(r.product_id),
                "snapshot_price": float(r.snapshot_price or 0)
            })

        # --- PROCESAMIENTO ---
        products_perf = {}
        
        # 0. Pre-llenado con TODOS los productos disponibles para que aparezcan en la tabla
        for pid, meta in products_meta.items():
            cid = meta["cid"]
            key = f"{cid}_{pid}"
            products_perf[key] = {
                "id": pid,
                "nombre": meta["name"],
                "campaign_id": cid,
                "logro_money": 0.0,
                "logro_count": 0,
                "objetivo_money": 0.0,
                "objetivo_count": 0,
                "prev_money": 0.0
            }

        def get_p_entry(pid, cid):
            key = f"{cid}_{pid}"
            if key not in products_perf:
                # Fallback para productos no encontrados en metadatos (ej: eliminados)
                meta = products_meta.get(pid)
                name = meta["name"] if meta else ("General" if pid == "NONE" else "Producto Desconocido")
                products_perf[key] = {
                    "id": pid,
                    "nombre": name,
                    "campaign_id": cid,
                    "logro_money": 0.0,
                    "logro_count": 0,
                    "objetivo_money": 0.0,
                    "objetivo_count": 0,
                    "prev_money": 0.0
                }
            return products_perf[key]

        # Metas
        for g in goals_raw:
            entry = get_p_entry(g.get('product_id') or "NONE", g['campaign_id'])
            entry["objetivo_money"] += float(g.get('target_amount') or 0)
            entry["objetivo_count"] += int(g.get('target_units') or 0)

        # Ventas actuales
        for s in sales_raw:
            entry = get_p_entry(s.get('product_id') or "NONE", s['campaign_id'])
            entry["logro_money"] += float(s.get('snapshot_price') or 0)
            entry["logro_count"] += 1

        # Ventas anteriores
        for ps in prev_sales_raw:
            entry = get_p_entry(ps.get('product_id') or "NONE", ps['campaign_id'])
            entry["prev_money"] += float(ps.get('snapshot_price') or 0)

        # Calculos finales productos
        final_products = []
        for p in products_perf.values():
            p["proy_money"] = round(calculate_projection(p["logro_money"], month), 2)
            p["proy_count"] = int(calculate_projection(p["logro_count"], month))
            p["cumplimiento_money"] = round((p["logro_money"] / p["objetivo_money"] * 100), 1) if p["objetivo_money"] > 0 else 0.0
            p["cumplimiento_count"] = round((p["logro_count"] / p["objetivo_count"] * 100), 1) if p["objetivo_count"] > 0 else 0.0
            p["status"] = "Good"
            if p["cumplimiento_money"] < 80: p["status"] = "Critical"
            elif p["cumplimiento_money"] < 100: p["status"] = "Warning"
            p["pace_diff"] = round(((p["proy_money"] - p["prev_money"]) / p["prev_money"] * 100), 1) if p["prev_money"] > 0 else 0.0
            final_products.append(p)

        # Agregación Campañas
        campaigns_perf = {}
        for p in final_products:
            cid = p["campaign_id"]
            if cid not in campaigns_perf:
                campaigns_perf[cid] = {
                    "id": cid,
                    "nombre": campaigns_meta.get(cid, "Campaña Desconocida"),
                    "logro_money": 0.0, "logro_count": 0, "objetivo_money": 0.0, "objetivo_count": 0,
                    "proy_money": 0.0, "proy_count": 0, "prev_money": 0.0
                }
            c = campaigns_perf[cid]
            c["logro_money"] += p["logro_money"]
            c["logro_count"] += p["logro_count"]
            c["objetivo_money"] += p["objetivo_money"]
            c["objetivo_count"] += p["objetivo_count"]
            c["proy_money"] += p["proy_money"]
            c["proy_count"] += p["proy_count"]
            c["prev_money"] += p["prev_money"]

        final_campaigns = []
        for c in campaigns_perf.values():
            c["cumplimiento_money"] = round((c["logro_money"] / c["objetivo_money"] * 100), 1) if c["objetivo_money"] > 0 else 0.0
            c["cumplimiento_count"] = round((c["logro_count"] / c["objetivo_count"] * 100), 1) if c["objetivo_count"] > 0 else 0.0
            c["status"] = "Good"
            if c["cumplimiento_money"] < 80: c["status"] = "Critical"
            elif c["cumplimiento_money"] < 100: c["status"] = "Warning"
            c["pace_diff"] = round(((c["proy_money"] - c["prev_money"]) / c["prev_money"] * 100), 1) if c["prev_money"] > 0 else 0.0
            final_campaigns.append(c)

        return {
            "month": month,
            "campaigns": final_campaigns,
            "products": final_products
        }

    except Exception as e:
        logger.error(f"Error en campaign performance (SQL): {str(e)}")
        return {"error": str(e), "campaigns": [], "products": []}

    except Exception as e:
        logger.error(f"Error en campaign performance: {str(e)}")
        import traceback
        traceback.print_exc()
        return {"error": str(e), "campaigns": [], "products": []}


@router.get("/export")
async def export_campaign_performance(
    month: str = Query(..., description="Format YYYY-MM"),
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(deps.get_db),
    _: bool = Depends(check_permission("performance", "export", module="performance"))
):
    """Genera un reporte CSV con el rendimiento de campañas y productos."""
    try:
        # Pass DB to the getter logic? No, get_campaign_performance is an Endpoint that depends on DB. 
        # But we are calling it as a function. We can't do that if it uses Depends.
        # We need to extract the logic to a helper function or allow passing DB.
        # Since we modified get_campaign_performance signature to accept db via Depends, we can call it directly passing arguments?
        # No, Depends only works when FastAPI calls it.
        # Correction: We must extract the logic or refactor get_campaign_performance to allow optional db argument logic, 
        # or simply duplicate logic/extract common private function.
        # Given urgency, I will adapt get_campaign_performance to simply use the passed DB.
        
        # Wait, get_campaign_performance is an async def endpoint. Calling it directly requires passing dependencies manually.
        data = await get_campaign_performance(month=month, current_user=current_user, db=db, _=True)
        
        if "error" in data:
            raise Exception(data["error"])

        # Crear un diccionario de mapeo de campaign_id -> nombre
        campaign_map = {c["id"]: c["nombre"] for c in data["campaigns"]}

        def generate():
            output = io.StringIO()
            writer = csv.writer(output)
            
            # --- SECCIÓN 1: CAMPAÑAS ---
            writer.writerow(["--- RENDIMIENTO DE CAMPAÑAS ---"])
            writer.writerow([
                "ID Campaña", "Nombre", "Logro ($)", "Logro (#)", "Objetivo ($)", "Objetivo (#)", 
                "Cumpl. ($) %", "Cumpl. (#) %", "Proy ($)", "Proy (#)", "Ritmo %", "Estatus"
            ])
            yield output.getvalue()
            output.truncate(0)
            output.seek(0)

            for c in data["campaigns"]:
                writer.writerow([
                    c["id"], c["nombre"], c["logro_money"], c["logro_count"], c["objetivo_money"], c["objetivo_count"],
                    c["cumplimiento_money"], c["cumplimiento_count"], c["proy_money"], c["proy_count"], 
                    c["pace_diff"], c["status"]
                ])
                yield output.getvalue()
                output.truncate(0)
                output.seek(0)

            writer.writerow([])
            writer.writerow(["--- RENDIMIENTO DE PRODUCTOS ---"])
            writer.writerow([
                "ID Producto", "Nombre", "Campaña", "Logro ($)", "Logro (#)", "Objetivo ($)", "Objetivo (#)", 
                "Cumpl. ($) %", "Cumpl. (#) %", "Proy ($)", "Proy (#)", "Ritmo %", "Estatus"
            ])
            yield output.getvalue()
            output.truncate(0)
            output.seek(0)

            for p in data["products"]:
                # Resolver el nombre de la campaña usando el mapeo
                campaign_name = campaign_map.get(p["campaign_id"], "Sin Campaña")
                
                writer.writerow([
                    p["id"], p["nombre"], campaign_name, p["logro_money"], p["logro_count"], p["objetivo_money"], p["objetivo_count"],
                    p["cumplimiento_money"], p["cumplimiento_count"], p["proy_money"], p["proy_count"], 
                    p["pace_diff"], p["status"]
                ])
                yield output.getvalue()
                output.truncate(0)
                output.seek(0)

        filename = f"reporte_campanas_{month}.csv"
        return StreamingResponse(
            generate(),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    except Exception as e:
        logger.error(f"Error exporting campaign performance: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
