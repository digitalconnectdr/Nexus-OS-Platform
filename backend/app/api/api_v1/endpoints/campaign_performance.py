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
from app.models import Campaign, Product, SalesOrder, SalesGoal

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

@router.get("/")
async def get_campaign_performance(
    month: str = Query(..., description="Format YYYY-MM"),
    db: AsyncSession = Depends(deps.get_db)
):
    prev_month = get_prev_month(month)
    
    # Rango de fechas para el mes actual
    try:
        year, m_num = map(int, month.split('-'))
        start_date = datetime(year, m_num, 1)
        if m_num == 12:
            end_date = datetime(year + 1, 1, 1)
        else:
            end_date = datetime(year, m_num + 1, 1)

        # Rango para el mes anterior
        prev_year, pm_num = map(int, prev_month.split('-'))
        prev_start = datetime(prev_year, pm_num, 1)
        prev_end = start_date

        # 1. Obtener metadatos
        camp_stmt = select(Campaign)
        camp_res = await db.execute(camp_stmt)
        campaigns_meta = {str(c.id): c.name for c in camp_res.scalars().all()}

        prod_stmt = select(Product)
        prod_res = await db.execute(prod_stmt)
        products_meta = {str(p.id): {"name": p.name, "cid": str(p.campaign_id)} for p in prod_res.scalars().all()}

        # 2. Obtener Metas (Mes Actual)
        goal_stmt = select(
            SalesGoal.campaign_id,
            SalesGoal.product_id,
            func.sum(SalesGoal.target_amount).label('money'),
            func.sum(SalesGoal.target_units).label('count')
        ).where(SalesGoal.month == month).group_by(SalesGoal.campaign_id, SalesGoal.product_id)
        goal_res = await db.execute(goal_stmt)
        goals_data = goal_res.all()
        logger.info(f"Metas encontradas para {month}: {len(goals_data)}")

        # 3. Obtener Ventas (Mes Actual)
        sales_stmt = select(
            SalesOrder.campaign_id,
            SalesOrder.product_id,
            func.sum(SalesOrder.snapshot_price).label('money'),
            func.count(SalesOrder.id).label('count')
        ).where(
            SalesOrder.created_at >= start_date,
            SalesOrder.created_at < end_date,
            SalesOrder.status == "Approved"
        ).group_by(SalesOrder.campaign_id, SalesOrder.product_id)
        sales_res = await db.execute(sales_stmt)
        sales_data = sales_res.all()
        logger.info(f"Ventas encontradas para {month}: {len(sales_data)}")

        # 4. Obtener Ventas (Mes Anterior)
        prev_sales_stmt = select(
            SalesOrder.campaign_id,
            SalesOrder.product_id,
            func.sum(SalesOrder.snapshot_price).label('money'),
            func.count(SalesOrder.id).label('count')
        ).where(
            SalesOrder.created_at >= prev_start,
            SalesOrder.created_at < prev_end,
            SalesOrder.status == "Approved"
        ).group_by(SalesOrder.campaign_id, SalesOrder.product_id)
        prev_sales_res = await db.execute(prev_sales_stmt)
        prev_sales_data = prev_sales_res.all()
        logger.info(f"Ventas mes anterior encontradas para {prev_month}: {len(prev_sales_data)}")

        # 5. Procesar Productos
        products_perf = {}
        
        def get_p_entry(pid, cid):
            # Usamos una clave combinada por si un producto se asocia a campañas distintas (teóricamente)
            # Pero principalmente para capturar productos nulos agrupados por campaña
            key = f"{cid}_{pid}"
            if key not in products_perf:
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

        # Llenar con metas
        for g in goals_data:
            entry = get_p_entry(str(g.product_id) if g.product_id else "NONE", str(g.campaign_id))
            entry["objetivo_money"] += float(g.money or 0)
            entry["objetivo_count"] += int(g.count or 0)

        # Llenar con ventas actuales
        for s in sales_data:
            entry = get_p_entry(str(s.product_id) if s.product_id else "NONE", str(s.campaign_id))
            entry["logro_money"] += float(s.money or 0)
            entry["logro_count"] += int(s.count or 0)

        # Llenar con ventas anteriores
        for ps in prev_sales_data:
            entry = get_p_entry(str(ps.product_id) if ps.product_id else "NONE", str(ps.campaign_id))
            entry["prev_money"] += float(ps.money or 0)

        # Calculamos métricas de producto
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

        # 6. Procesar Campañas (Agregado)
        campaigns_perf = {}
        for p in final_products:
            cid = p["campaign_id"]
            if cid not in campaigns_perf:
                campaigns_perf[cid] = {
                    "id": cid,
                    "nombre": campaigns_meta.get(cid, "Campaña Desconocida"),
                    "logro_money": 0.0,
                    "logro_count": 0,
                    "objetivo_money": 0.0,
                    "objetivo_count": 0,
                    "proy_money": 0.0,
                    "proy_count": 0,
                    "prev_money": 0.0,
                    "product_count": 0
                }
            c = campaigns_perf[cid]
            c["logro_money"] += p["logro_money"]
            c["logro_count"] += p["logro_count"]
            c["objetivo_money"] += p["objetivo_money"]
            c["objetivo_count"] += p["objetivo_count"]
            c["proy_money"] += p["proy_money"]
            c["proy_count"] += p["proy_count"]
            c["prev_money"] += p["prev_money"]
            c["product_count"] += 1

        final_campaigns = []
        for cid, c in campaigns_perf.items():
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
        logger.error(f"Error en campaign performance: {str(e)}")
        import traceback
        traceback.print_exc()
        return {"error": str(e), "campaigns": [], "products": []}


@router.get("/export")
async def export_campaign_performance(
    month: str = Query(..., description="Format YYYY-MM"),
    db: AsyncSession = Depends(deps.get_db)
):
    """Genera un reporte CSV con el rendimiento de campañas y productos."""
    try:
        data = await get_campaign_performance(month, db)
        
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
