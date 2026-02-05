import logging
from typing import List, Any
from datetime import datetime
from calendar import monthrange
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case

from app.api import deps
from app.core.security import get_current_user, check_permission
from app.models import User, SalesGoal, SalesOrder, Campaign, UserProfile

router = APIRouter()
logger = logging.getLogger(__name__)

print(">>> [OPERATIONAL] MÓDULO CARGADO: V3 - KPIs Completos (Unidades + $ + Proyección) <<<")

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

# --- ENDPOINT PRINCIPAL ---
@router.get("/")
async def get_operational_results(
    month: str = Query(..., description="Format YYYY-MM"),
    db: AsyncSession = Depends(deps.get_db),
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("dashboard", "access", module="dashboard"))
):
    prev_month = get_prev_month(month)
    
    try:
        # 1. Obtener todos los usuarios (perfiles) - EXCLUYENDO ADMINS/SUPER ADMINS
        # Filtramos por tenant y aseguramos que no estén borrados y que NO sean administrativos
        print(f"DEBUG: Endpoint called by {current_user.email} | Tenant Logic: {current_user.tenant_id}")
        
        user_stmt = select(UserProfile).where(
            UserProfile.tenant_id == current_user.tenant_id, 
            UserProfile.is_deleted == False,
            UserProfile.role.notin_(['Super Admin', 'Administrador'])
        )
        user_result = await db.execute(user_stmt)
        users = {str(u.id): u for u in user_result.scalars().all()}

        # 2. Obtener Metas (Mes Actual)
        goal_stmt = select(
            SalesGoal.user_id,
            func.sum(SalesGoal.target_amount).label('money'),
            func.sum(SalesGoal.target_units).label('count')
        ).where(SalesGoal.month == month, SalesGoal.tenant_id == current_user.tenant_id).group_by(SalesGoal.user_id)
        goal_res = await db.execute(goal_stmt)
        goals = {str(r.user_id): r for r in goal_res.all()}

        # 3. Obtener Ventas (Mes Actual) Filtradas por Estatus Productivos
        from app.models.status import Status
        prod_status_stmt = select(Status.name).where(Status.tenant_id == current_user.tenant_id, Status.is_productive == True)
        prod_status_res = await db.execute(prod_status_stmt)
        productive_statuses = prod_status_res.scalars().all()
        
        # If no productive statuses are defined, we return empty results rather than hardcoded fallbacks
        # to force the user to configure their lifecycle correctly.
        if not productive_statuses:
            logger.warning(f"⚠️ No productive statuses defined for tenant {current_user.tenant_id}. KPI counts will be zero.")
            productive_statuses = []

        # Optimizamos filtros de fecha para usar rangos (mejor para índices)
        start_date = datetime(int(month.split('-')[0]), int(month.split('-')[1]), 1)
        if int(month.split('-')[1]) == 12:
            end_date = datetime(int(month.split('-')[0]) + 1, 1, 1)
        else:
            end_date = datetime(int(month.split('-')[0]), int(month.split('-')[1]) + 1, 1)

        sales_stmt = select(
            SalesOrder.agent_id,
            func.sum(SalesOrder.snapshot_price).label('money'),
            func.count(SalesOrder.id).label('count')
        ).where(
            SalesOrder.created_at >= start_date,
            SalesOrder.created_at < end_date,
            SalesOrder.tenant_id == current_user.tenant_id,
            SalesOrder.is_deleted == False,
            SalesOrder.status.in_(productive_statuses)
        ).group_by(SalesOrder.agent_id)
        sales_res = await db.execute(sales_stmt)
        sales = {str(r.agent_id): r for r in sales_res.all()}

        # 4. Obtener Ventas (Mes Anterior) para comparación
        prev_start = datetime(int(prev_month.split('-')[0]), int(prev_month.split('-')[1]), 1)
        prev_end = start_date
        
        prev_sales_stmt = select(
            SalesOrder.agent_id,
            func.sum(SalesOrder.snapshot_price).label('money'),
            func.count(SalesOrder.id).label('count')
        ).where(
            SalesOrder.created_at >= prev_start,
            SalesOrder.created_at < prev_end,
            SalesOrder.tenant_id == current_user.tenant_id,
            SalesOrder.is_deleted == False,
            SalesOrder.status.in_(productive_statuses)
        ).group_by(SalesOrder.agent_id)
        prev_sales_res = await db.execute(prev_sales_stmt)
        prev_sales = {str(r.agent_id): r for r in prev_sales_res.all()}

        # 5. Construir lista de Agentes y calcular sus métricas
        agents_data = []
        for uid, user in users.items():
            # FILTRO ESTRICTO: Solo mostrar en la tabla de agentes a los que tienen rol 'Representante'
            u_role = (user.role or "").lower()
            if u_role != "representante":
                continue
            
            # Datos del mes actual
            g = goals.get(uid)
            s = sales.get(uid)
            ps = prev_sales.get(uid)
            
            target_money = float(g.money or 0) if g else 0.0
            target_count = int(g.count or 0) if g else 0
            sold_money = float(s.money or 0) if s else 0.0
            sold_count = int(s.count or 0) if s else 0
            prev_money = float(ps.money or 0) if ps else 0.0
            
            proj_money = calculate_projection(sold_money, month)
            proj_count = int(calculate_projection(sold_count, month))
            
            comp_money = round((sold_money / target_money * 100), 1) if target_money > 0 else 0.0
            comp_count = round((sold_count / target_count * 100), 1) if target_count > 0 else 0.0
            
            # Estatus
            status = "Good"
            if comp_money < 80: status = "Critical"
            elif comp_money < 100: status = "Warning"
            
            # Ritmo vs Mes Anterior
            # Si proyecto vender más que el mes pasado -> up, sino down
            pace_diff = 0
            if prev_money > 0:
                pace_diff = round(((proj_money - prev_money) / prev_money * 100), 1)

            agent_info = {
                "id": uid,
                "nombre": f"{user.first_name or ''} {user.last_name or ''}".strip() or user.email,
                "supervisor_id": str(user.supervisor_id) if user.supervisor_id else None,
                "role": user.role,
                "logro_money": sold_money,
                "logro_count": sold_count,
                "objetivo_money": target_money,
                "objetivo_count": target_count,
                "cumplimiento_money": comp_money,
                "cumplimiento_count": comp_count,
                "proy_money": round(proj_money, 2),
                "proy_count": proj_count,
                "status": status,
                "pace_diff": pace_diff, # % de mejora vs mes anterior
                "avatar_url": user.avatar_url
            }
            agents_data.append(agent_info)

        # Requerimiento: Supervisor senior, Supervision, Supervisor, Lider, Liderazgo, Administrador, Gerente, Líder
        supervisor_roles = ["supervisor senior", "supervision", "supervisión", "supervisor", "lider", "líder", "gerente"]
        supervisors = []
        
        for uid, user in users.items():
            u_role = (user.role or "").lower()
            if any(role in u_role for role in supervisor_roles):
                # Es un supervisor. Calculamos agregados de sus subordinados (que sí son Representantes)
                team = [a for a in agents_data if a["supervisor_id"] == uid]
                
                # Totales del equipo
                t_logro_m = sum(a["logro_money"] for a in team)
                t_logro_c = sum(a["logro_count"] for a in team)
                t_obj_m = sum(a["objetivo_money"] for a in team)
                t_obj_c = sum(a["objetivo_count"] for a in team)
                t_proy_m = sum(a["proy_money"] for a in team)
                t_proy_c = sum(a["proy_count"] for a in team)
                
                # Para el ritmo (pace_diff) del supervisor, necesitamos el acumulado del mes anterior de su equipo
                # t_prev_m será la suma de las ventas reales del mes anterior de sus agentes actuales
                # Buscamos en el diccionario prev_sales filtrando por los UIDs del equipo
                t_prev_m = sum(float(prev_sales.get(a["id"]).money or 0) if prev_sales.get(a["id"]) else 0.0 for a in team)
                
                t_comp_m = round((t_logro_m / t_obj_m * 100), 1) if t_obj_m > 0 else 0.0
                t_comp_c = round((t_logro_c / t_obj_c * 100), 1) if t_obj_c > 0 else 0.0
                
                t_status = "Good"
                if t_comp_m < 80: t_status = "Critical"
                elif t_comp_m < 100: t_status = "Warning"

                t_pace_diff = 0
                if t_prev_m > 0:
                    t_pace_diff = round(((t_proy_m - t_prev_m) / t_prev_m * 100), 1)

                supervisors.append({
                    "id": uid,
                    "nombre": f"{user.first_name or ''} {user.last_name or ''}".strip() or user.email,
                    "logro_money": t_logro_m,
                    "logro_count": t_logro_c,
                    "objetivo_money": t_obj_m,
                    "objetivo_count": t_obj_c,
                    "cumplimiento_money": t_comp_m,
                    "cumplimiento_count": t_comp_c,
                    "proy_money": round(t_proy_m, 2),
                    "proy_count": t_proy_c,
                    "status": t_status,
                    "pace_diff": t_pace_diff,
                    "team_size": len(team),
                    "avatar_url": user.avatar_url
                })

        return {
            "month": month,
            "supervisors": supervisors,
            "agents": agents_data # El frontend filtrará por supervisor_id
        }

    except Exception as e:
        logger.error(f"Error en operational results: {str(e)}")
        import traceback
        traceback.print_exc()
        return {"error": str(e), "supervisors": [], "agents": []}
