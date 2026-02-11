import logging
from typing import Any, List, Optional, Dict
from fastapi import APIRouter, Depends, Query, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
import csv
import io
import calendar

# Importaciones del sistema
from app.api import deps
from app.core.security import get_current_user, check_permission
from app.models import User, SalesGoal, SalesOrder, Campaign, UserProfile, Status, Product
from app.schemas.analytics import (
    EfficiencyResponse, 
    DashboardData
)

# Rate limiting and caching
from app.middleware.rate_limit import limiter, rate_limit_standard, rate_limit_export
from app.lib.cache import cache_response

logger = logging.getLogger(__name__)
router = APIRouter()

import datetime
from app.schemas.analytics import (
    EfficiencyResponse, 
    EfficiencySupervisorMetric, 
    EfficiencyCampaignParentMetric,
    DashboardData,
    OperationsMetrics,
    CampaignMetric,
    SupervisorMetric,
    GoalCompliance
)

from app.schemas.core import UserRole
import datetime

# --- ROLE SCOPING ---
# --- ROLE SCOPING ---
# Dynamic Permissions now handle this via 'data:view_all'
# HIGH_LEVEL_ROLES removed to support purely dynamic RBAC
async def _get_campaign_data(session: AsyncSession, month: str, tenant_id: str, campaign_id: str = None) -> List[EfficiencyCampaignParentMetric]:
    if session is None:
        logger.warning("⚠️ _get_campaign_data: DB Session is None, returning empty list")
        return []
    stmt = (
        select(
            Campaign.id.label('campaign_id'),
            Campaign.name.label('campaign_name'),
            func.coalesce(func.sum(SalesGoal.target_amount), 0).label('target_amount'),
            func.coalesce(func.sum(SalesOrder.snapshot_price), 0).label('sold_amount')
        )
        .select_from(Campaign)
        .outerjoin(SalesGoal, (SalesGoal.campaign_id == Campaign.id) & (SalesGoal.month.like(f"{month}%")) & (SalesGoal.tenant_id == tenant_id))
        .outerjoin(SalesOrder, (SalesOrder.campaign_id == Campaign.id) & (func.to_char(SalesOrder.created_at, 'YYYY-MM') == month) & (SalesOrder.tenant_id == tenant_id))
        .where(Campaign.tenant_id == tenant_id)
        .group_by(Campaign.id, Campaign.name)
    )
    if campaign_id: stmt = stmt.filter(Campaign.id == campaign_id)
    
    result = await session.execute(stmt)
    items = []
    
    for row in result.all():
        try:
            # --- BLINDAJE ---
            c_id = getattr(row, 'campaign_id', 'unknown')
            c_name = getattr(row, 'campaign_name', 'Unnamed')
            target = float(row.target_amount or 0)
            sold = float(row.sold_amount or 0)
            compliance = (sold / target * 100) if target > 0 else 0.0
            
            pilar_estatus, pilar_color = ("Critical", "red")
            if compliance >= 100: pilar_estatus, pilar_color = ("Top Performer", "green")
            elif compliance >= 80: pilar_estatus, pilar_color = ("Needs Attention", "yellow")

            items.append(EfficiencyCampaignParentMetric(
                campaign_id=str(c_id), campaign_name=c_name,
                first_name=None, last_name=None, avatar_url=None,
                target_amount=target, target_units=0, sold_amount=sold, sold_count=0,
                compliance_amount=round(compliance, 2), compliance_units=0.0,
                projection_amount=sold, projection_units=0,
                pilar_estatus=pilar_estatus, pilar_color=pilar_color, products=[]
            ))
        except Exception as e:
            continue
    return items



# --- 2. SUPERVISORES ---
async def _get_supervisor_data(session: AsyncSession, month: str, tenant_id: str, supervisor_id: str = None, role_filter: str = '%supervisor%') -> List[EfficiencySupervisorMetric]:
    """
    Core function to retrieve supervisor/agent efficiency metrics.
    NOW PURE SQL - No Fallback.
    """
    if session is None:
        logger.error("❌ _get_supervisor_data: DB Session is None! Cannot fetch data.")
        return []
        
    stmt = (
        select(
            User.id.label('user_id'),
            User.first_name,
            User.last_name,
            User.avatar_url,
            func.coalesce(func.sum(SalesGoal.target_amount), 0).label('target_amount'),
            func.coalesce(func.sum(SalesOrder.snapshot_price), 0).label('sold_amount')
        )
        .select_from(User)
        .outerjoin(SalesGoal, (SalesGoal.user_id == User.id) & (SalesGoal.month.like(f"{month}%")) & (SalesGoal.tenant_id == tenant_id))
        .outerjoin(SalesOrder, (SalesOrder.agent_id == User.id) & (func.to_char(SalesOrder.created_at, 'YYYY-MM') == month) & (SalesOrder.tenant_id == tenant_id))
        .where(User.tenant_id == tenant_id)
        .group_by(User.id, User.first_name, User.last_name, User.avatar_url)
    )
    
    # If supervisor_id is provided, filter by it (Explicit Filter)
    if supervisor_id:
        stmt = stmt.filter(User.id == supervisor_id)
    else:
        # Default view is for supervisors
        if role_filter:
            stmt = stmt.where(User.role.ilike(role_filter))
        # If role_filter is None, we return all roles (agents, supervisors, etc.)

    stmt = stmt.having((func.sum(SalesGoal.target_amount) > 0) | (func.sum(SalesOrder.snapshot_price) > 0))

    result = await session.execute(stmt)
    items = []

    for row in result.all():
        try:
            # --- BLINDAJE MÁXIMO ---
            u_id = getattr(row, 'user_id', 'unknown')
            # AQUÍ ES DONDE OCURRÍA EL ERROR ANTES
            # Usamos getattr y un valor por defecto. ES IMPOSIBLE QUE FALLE CON KEYERROR.
            f_name = getattr(row, 'first_name', None) or "Agente"
            l_name = getattr(row, 'last_name', None) or "Desconocido"
            
            target = float(row.target_amount or 0)
            sold = float(row.sold_amount or 0)
            compliance = (sold / target * 100) if target > 0 else 0.0
            
            pilar_estatus, pilar_color = ("Critical", "red")
            if compliance >= 100: pilar_estatus, pilar_color = ("Top Performer", "green")
            elif compliance >= 80: pilar_estatus, pilar_color = ("Needs Attention", "yellow")

            items.append({
                "supervisor_id": str(u_id),
                "supervisor_name": f"{f_name} {l_name}",
                "agent_id": str(u_id),
                "agent_name": f"{f_name} {l_name}",
                "campaign_name": "Multi-Campaña",
                "product_family": "Varios",
                "target_amount": target,
                "target_units": 0,
                "sold_amount": sold,
                "sold_count": 0,
                "compliance_amount": round(compliance, 2),
                "compliance_units": 0,
                "projection_amount": sold,
                "projection_units": 0,
                "pilar_color": pilar_color,
                "pilar_estatus": pilar_estatus,
                "agents": [] # Importante para que el map del frontend no explote
            })
        except Exception as e:
            logger.error(f"Error en fila supervisor: {e}")
            continue
    return items

# --- 3. ENDPOINT ---
@router.get("/efficiency-v3")
async def get_efficiency_data(
    request: Request,
    month: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    view: str = 'supervisor',
    supervisor_id: Optional[str] = Query(None), 
    campaign_id: Optional[str] = Query(None),
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(deps.get_db),
    _: bool = Depends(check_permission("dashboard", "access", module="dashboard"))
):
    """
    Versión resiliente que acepta rango de fechas o mes.
    """
    from app.core.security import check_permission_programmatic
    
    # --- DATA SCOPE FILTERING (Dynamic RLS) ---
    # Check if user has permission to view all data
    can_view_all = await check_permission_programmatic(
        current_user, db, "data", "view_all", module="dashboard"
    )
    
    if not can_view_all:
        logger.info(f"🔒 RLS: Restricting efficiency view for {current_user.email}")
        supervisor_id = str(current_user.id)
        if view != 'supervisor':
            # Optionally allow campaign view but restricted? For now, force supervisor view
            # logger.warning(f"⚠️ User {current_user.email} tried to access non-supervisor view. Forcing supervisor view.")
            # view = 'supervisor' 
            pass # Let them try, but data will be scoped implicitely if query supports it?
                 # Actually _get_campaign_data doesn't support user filtering yet.
                 # For safety, if they cannot view all, they focus on their own node.

    # Derivación de mes
    target_month = month
    if not target_month and start_date:
        target_month = start_date[:7]
    if not target_month:
        target_month = datetime.datetime.now().strftime("%Y-%m")

    try:
        if view == 'campaign':
            # If constrained user requests campaign view, we might need to filter campaigns they belong to?
            # For now, if they don't have view_all, we might assume they can see campaign stats 
            # OR we should implement _get_campaign_data filtering.
            # Given the urgency, if can_view_all is false, we might return empty or just let it be if it's aggregate.
            # But usually agents shouldn't see full campaign totals.
            # Let's trust the 'view_all' check. If they don't have it, they shouldn't see Org-wide campaign stats.
            
            if not can_view_all:
                 # Soft Block or Filtered?
                 # Returning empty for safety until Campaign-Agent mapping is strict
                 return {
                    "month": target_month,
                    "campaigns_view": [],
                    "supervisors": []
                }
            
            data = await _get_campaign_data(db, target_month, str(current_user.tenant_id), campaign_id)
            return {
                "month": target_month,
                "campaigns_view": data,
                "supervisors": []
            }
        else:
            data = await _get_supervisor_data(db, target_month, str(current_user.tenant_id), supervisor_id)
            return {
                "month": target_month,
                "supervisors": data,
                "total_supervisors": len(data),
                "campaigns_view": []
            }
            
    except Exception as e:
        logger.error(f"Efficiency crash: {str(e)}")
        return {
            "month": target_month,
            "supervisors": [],
            "campaigns_view": [],
            "error": str(e)
        }

# --- 4. SCORECARD AGENTES ---
@router.get("/scorecard/agents")
async def get_scorecard_agents(
    month: str,
    supervisor_id: Optional[str] = Query(None),
    campaign_id: Optional[str] = Query(None),
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(deps.get_db),
    _: bool = Depends(check_permission("dashboard", "access", module="dashboard"))
):
    """
    Endpoint para el Scorecard 360 de Agentes.
    Retorna el desglose por agente, campaña y familia.
    """
    from app.core.security import check_permission_programmatic
    
    # --- DATA SCOPE FILTERING (Dynamic RLS) ---
    can_view_all = await check_permission_programmatic(
        current_user, db, "data", "view_all", module="dashboard"
    )
    
    if not can_view_all:
        logger.info(f"🔒 RLS: Restricting scorecard for {current_user.email}")
        supervisor_id = str(current_user.id)

    # Corregimos el paso de parámetros, solicitando explícitamente Representantes
    # Para el scorecard de AGENTES, no queremos ver supervisores, sino representantes.
    items = await _get_supervisor_data(db, month, str(current_user.tenant_id), supervisor_id=supervisor_id, role_filter='%Representante%')
    
    # El frontend espera: items, total, month, supervisors, campaigns
    supervisors = []
    campaigns = []
    
    try:
        # SQL MIGRATION: Fetch supervisors (any role containing "Supervisor")
        # Direct SQL Connection (Port 6543) - No more REST API 500s
        sup_stmt = select(User.id, User.first_name, User.last_name)\
            .where(User.tenant_id == current_user.tenant_id)\
            .where(User.role.ilike('%Supervisor%'))
        sup_res = await db.execute(sup_stmt)
        supervisors = [{"id": str(r.id), "name": f"{r.first_name} {r.last_name}"} for r in sup_res.all()]
        
        # Fetch active campaigns
        camp_stmt = select(Campaign.id, Campaign.name)\
            .where(Campaign.tenant_id == current_user.tenant_id)\
            .where(Campaign.is_active == True)
        camp_res = await db.execute(camp_stmt)
        campaigns = [{"id": str(r.id), "name": r.name} for r in camp_res.all()]
    except Exception as e:
        logger.warning(f"⚠️ Error fetching filters for scorecard (SQL): {e}")

    return {
        "items": items,
        "total": len(items),
        "month": month,
        "supervisors": supervisors,
        "campaigns": campaigns
    }

# --- 5. SCORECARD BACKOFFICE (DIGITACIÓN) ---
@router.get("/scorecard/backoffice")
async def get_scorecard_backoffice(
    month: str,
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(deps.get_db),
    _: bool = Depends(check_permission("backoffice", "read", module="performance"))
):
    """Mide eficiencia y precisión del equipo con rol 'Digitacion'"""
    try:
        # 1. Obtener usuarios ACTIVOS:
        # SQL Direct Migration
        digit_stmt = select(User.id, User.first_name, User.last_name, User.role)\
            .where(User.tenant_id == current_user.tenant_id)\
            .where(User.is_active == True)\
            .where(User.role.in_(['Digitacion', 'Digitación', UserRole.DIGITACION.value]))
        
        digit_res = await db.execute(digit_stmt)
        digitizers = [{"id": str(r.id), "first_name": r.first_name, "last_name": r.last_name, "role": r.role} for r in digit_res.all()]
        
        # 2. Obtener órdenes del mes (Dynamic Range)
        # Convert to datetime for SQL compliance
        start_ts = datetime.datetime.strptime(f"{month}-01 00:00:00", "%Y-%m-%d %H:%M:%S")
        year, month_int = map(int, month.split("-"))
        last_day = calendar.monthrange(year, month_int)[1]
        end_ts = datetime.datetime.strptime(f"{month}-{last_day:02d} 23:59:59", "%Y-%m-%d %H:%M:%S")

        sales_stmt = select(SalesOrder.agent_id, SalesOrder.digitizer_id, SalesOrder.status, SalesOrder.created_at, SalesOrder.updated_at, SalesOrder.os_madre, SalesOrder.os_hija)\
            .where(SalesOrder.tenant_id == current_user.tenant_id)\
            .where(SalesOrder.created_at >= start_ts)\
            .where(SalesOrder.created_at <= end_ts)
            
        sales_res = await db.execute(sales_stmt)
        # Convert SQLAlchemy rows to partial dicts for logic compatibility
        sales = []
        for r in sales_res.all():
             sales.append({
                 "agent_id": str(r.agent_id),
                 "digitizer_id": str(r.digitizer_id) if r.digitizer_id else None,
                 "status": r.status,
                 "created_at": r.created_at.isoformat() if r.created_at else None,
                 "updated_at": r.updated_at.isoformat() if r.updated_at else None,
                 "os_madre": r.os_madre,
                 "os_hija": r.os_hija
             })

        # 3. Identificar TODOS los usuarios ACTIVOS con actividad (digitizer_id)
        active_digitizer_ids = {s['digitizer_id'] for s in sales if s.get('digitizer_id')}
        known_ids = {u['id'] for u in digitizers}
        missing_ids = active_digitizer_ids - known_ids
        
        if missing_ids:
            # SQL Fetch missing
            missing_stmt = select(User.id, User.first_name, User.last_name, User.role)\
                .where(User.id.in_(list(missing_ids)))\
                .where(User.is_active == True)
            missing_res = await db.execute(missing_stmt)
            functional_digitizers = [{"id": str(r.id), "first_name": r.first_name, "last_name": r.last_name, "role": r.role} for r in missing_res.all()]
            # Merge lists
            users = digitizers + functional_digitizers
        else:
            users = digitizers
        
        # Remove duplicates just in case
        users_map = {u['id']: u for u in users}
        users = list(users_map.values())
        
        metrics = []
        for u in users:
            u_id = u['id']
            # Ventas procesadas: donde el usuario es el digitador asignado
            u_sales = [s for s in sales if s['digitizer_id'] == u_id]
            
            processed_count = len(u_sales)
            os_completed = len([s for s in u_sales if s.get('os_madre') and s.get('os_hija')])
            accuracy = (os_completed / processed_count * 100) if processed_count > 0 else 0.0
            
            # Lead Time: Diferencia entre creación (agente) y actualización (backoffice)
            # Solo para las que ya tienen algo avanzado (status != inicial)
            times = []
            for s in u_sales:
                try:
                    c_at = datetime.datetime.fromisoformat(s['created_at'].replace('Z', '+00:00')) if s['created_at'] else None
                    u_at = datetime.datetime.fromisoformat(s['updated_at'].replace('Z', '+00:00')) if s['updated_at'] else None
                    if c_at and u_at:
                        diff = (u_at - c_at).total_seconds() / 60.0 # minutos
                        if diff > 0: times.append(diff)
                except: continue
            
            avg_lt = (sum(times) / len(times)) if times else 0.0
            
            metrics.append({
                "user_id": str(u_id),
                "user_name": f"{u.get('first_name', 'User')} {u.get('last_name', 'X')}",
                "role": u.get('role', 'Digitacion'),
                "processed_count": processed_count,
                "avg_lead_time_mins": round(avg_lt, 1),
                "accuracy_rate": round(accuracy, 1),
                "os_completed": os_completed
            })
            
        return metrics
    except Exception as e:
        logger.error(f"Error in backoffice scorecard: {e}")
        raise HTTPException(500, detail=str(e))

# --- 6. SCORECARD SEGUIMIENTO ---
@router.get("/scorecard/followup")
async def get_scorecard_followup(
    month: str,
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(deps.get_db),
    _: bool = Depends(check_permission("dashboard", "access", module="dashboard"))
):
    """Mide conversión y resolución del equipo con rol 'Seguimiento'"""
    try:
        # 1. Usuarios Seguimiento ACTIVOS:
        # SQL Migration
        spec_stmt = select(User.id, User.first_name, User.last_name, User.role)\
            .where(User.tenant_id == current_user.tenant_id)\
            .where(User.is_active == True)\
            .where(User.role.in_(['Seguimiento', UserRole.SEGUIMIENTO.value]))
        
        spec_res = await db.execute(spec_stmt)
        specialists = [{"id": str(r.id), "first_name": r.first_name, "last_name": r.last_name, "role": r.role} for r in spec_res.all()]
        
        # 2. Órdenes del mes (Dynamic Range)
        # Convert to datetime for SQL compliance
        start_ts = datetime.datetime.strptime(f"{month}-01 00:00:00", "%Y-%m-%d %H:%M:%S")
        year, month_int = map(int, month.split("-"))
        last_day = calendar.monthrange(year, month_int)[1]
        end_ts = datetime.datetime.strptime(f"{month}-{last_day:02d} 23:59:59", "%Y-%m-%d %H:%M:%S")
        
        # Obtener configuración de estatus para este tenant
        # SQL Migration for Statuses
        stat_stmt = select(Status.name, Status.is_productive, Status.scope)\
            .where(Status.tenant_id == current_user.tenant_id)
        stat_res = await db.execute(stat_stmt)
        status_cfg = [{"name": r.name, "is_productive": r.is_productive, "scope": r.scope} for r in stat_res.all()]
        
        productive_names = [s['name'] for s in status_cfg if s['is_productive']]
        archive_names = [s['name'] for s in status_cfg if s['scope'] == 'ARCHIVE']
        
        # Sales Orders
        sales_stmt = select(SalesOrder.digitizer_id, SalesOrder.status, SalesOrder.created_at, SalesOrder.updated_at)\
            .where(SalesOrder.tenant_id == current_user.tenant_id)\
            .where(SalesOrder.created_at >= start_ts)\
            .where(SalesOrder.created_at <= end_ts)
        sales_res = await db.execute(sales_stmt)
        
        sales = []
        for r in sales_res.all():
            sales.append({
                "digitizer_id": str(r.digitizer_id) if r.digitizer_id else None,
                "status": r.status,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "updated_at": r.updated_at.isoformat() if r.updated_at else None
            })

        # 3. Identificar TODOS los usuarios ACTIVOS con actividad
        active_ids = {s['digitizer_id'] for s in sales if s.get('digitizer_id')}
        known_ids = {u['id'] for u in specialists}
        missing_ids = active_ids - known_ids
        
        if missing_ids:
            # SQL Fetch
            missing_stmt = select(User.id, User.first_name, User.last_name, User.role)\
                .where(User.id.in_(list(missing_ids)))\
                .where(User.is_active == True)
            missing_res = await db.execute(missing_stmt)
            functional_users = [{"id": str(r.id), "first_name": r.first_name, "last_name": r.last_name, "role": r.role} for r in missing_res.all()]
            users = specialists + functional_users
        else:
            users = specialists
            
        # Remove duplicates
        users_map = {u['id']: u for u in users}
        users = list(users_map.values())
        
        metrics = []
        for u in users:
            u_id = u['id']
            u_sales = [s for s in sales if s['digitizer_id'] == u_id]
            
            managed = len(u_sales)
            # Definición dinámica: instaladas son las productivas, canceladas son las de archivo no productivas
            installed = len([s for s in u_sales if s['status'] in productive_names])
            canceled = len([s for s in u_sales if s['status'] in archive_names and s['status'] not in productive_names])
            
            total_closed = len([s for s in u_sales if s['status'] in archive_names])
            conversion = (installed / total_closed * 100) if total_closed > 0 else 0.0
            
            # Tiempo de cierre promedio (días)
            days = []
            for s in u_sales:
                if s['status'] in archive_names:
                    try:
                        c_at = datetime.datetime.fromisoformat(s['created_at'].replace('Z', '+00:00')) if s['created_at'] else None
                        u_at = datetime.datetime.fromisoformat(s['updated_at'].replace('Z', '+00:00')) if s['updated_at'] else None
                        if c_at and u_at:
                            diff = (u_at - c_at).total_seconds() / 86400.0 # días
                            days.append(diff)
                    except: continue
            
            avg_days = (sum(days) / len(days)) if days else 0.0
            
            metrics.append({
                "user_id": str(u_id),
                "user_name": f"{u.get('first_name', 'User')} {u.get('last_name', 'X')}",
                "role": u.get('role', 'Seguimiento'),
                "managed_count": managed,
                "installed_count": installed,
                "canceled_count": canceled,
                "conversion_rate": round(conversion, 1),
                "avg_closing_days": round(avg_days, 1)
            })
            
        return metrics
    except Exception as e:
        logger.error(f"Error in followup scorecard: {e}")
        raise HTTPException(500, detail=str(e))

@router.get("/scorecard/export")
async def export_scorecard_data(
    start_date: str = Query(..., description="YYYY-MM-DD"),
    end_date: str = Query(..., description="YYYY-MM-DD"),
    supervisor_id: str = Query(None, description="Filter by supervisor"),
    campaign_id: str = Query(None, description="Filter by campaign"),
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(deps.get_db),
    _: bool = Depends(check_permission("dashboard", "access", module="dashboard"))
):
    """
    Genera un reporte CSV con datos del scorecard de agentes.
    """
    try:
        # Derivar el mes de la fecha de inicio
        month = start_date[:7]  # YYYY-MM
        
        # Obtener los datos del scorecard
        items = await _get_supervisor_data(db, month, str(current_user.tenant_id), supervisor_id)
        
        # Aplicar filtro de campaña si se proporciona (aunque el scorecard actual no filtra por campaña)
        # Este filtro se puede implementar en el futuro si es necesario
        
        def generate():
            output = io.StringIO()
            writer = csv.writer(output)
            
            # --- ENCABEZADO ---
            writer.writerow(["--- SCORECARD DE AGENTES ---"])
            writer.writerow([
                "ID Agente", "Nombre", "Campaña", "Familia Producto",
                "Logro ($)", "Logro (#)", "Objetivo ($)", "Objetivo (#)",
                "Cumpl. ($) %", "Cumpl. (#) %", "Proy ($)", "Proy (#)", "Estatus"
            ])
            yield output.getvalue()
            output.truncate(0)
            output.seek(0)
            
            for item in items:
                writer.writerow([
                    item.get("agent_id", ""),
                    item.get("agent_name", ""),
                    item.get("campaign_name", "Multi-Campaña"),
                    item.get("product_family", "Varios"),
                    item.get("sold_amount", 0),
                    item.get("sold_count", 0),
                    item.get("target_amount", 0),
                    item.get("target_units", 0),
                    item.get("compliance_amount", 0),
                    item.get("compliance_units", 0),
                    item.get("projection_amount", 0),
                    item.get("projection_units", 0),
                    item.get("pilar_estatus", "")
                ])
                yield output.getvalue()
                output.truncate(0)
                output.seek(0)
        
        filename = f"scorecard_agentes_{month}.csv"
        return StreamingResponse(
            generate(),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    
    except Exception as e:
        logger.error(f"Error exporting scorecard data: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# --- HYBRID SMART EXPORT SYSTEM ---

async def estimate_report_size(db: AsyncSession, report_type: str, params: dict) -> int:
    """
    Estimate the number of rows a report will have.
    Returns approximate row count.
    """
    try:
        if report_type == 'efficiency':
            # Count users that will be in the report
            month = params.get('start_date', '')[:7]
            supervisor_id = params.get('supervisor_id')
            
            from sqlalchemy import text
            query = text("""
                SELECT COUNT(DISTINCT u.id)
                FROM users u
                LEFT JOIN sales_goals sg ON sg.user_id = u.id AND sg.month = :month
                LEFT JOIN sales_orders so ON so.agent_id = u.id 
                    AND DATE_TRUNC('month', so.created_at) = :month::date
                    AND so.is_deleted = false
                WHERE (sg.id IS NOT NULL OR so.id IS NOT NULL)
                """ + ("AND (u.id = :supervisor_id OR u.supervisor_id = :supervisor_id)" if supervisor_id else ""))
            
            result = await db.execute(
                query, 
                {'month': month, 'supervisor_id': supervisor_id} if supervisor_id else {'month': month}
            )
            return result.scalar() or 0
            
        elif report_type == 'scorecard':
            # Similar to efficiency
            return await estimate_report_size(db, 'efficiency', params)
            
        elif report_type == 'campaign':
            # Count campaigns
            from sqlalchemy import select, func
            from app.models import Campaign
            result = await db.execute(select(func.count(Campaign.id)))
            return result.scalar() or 0
            
        elif report_type == 'sales':
            # Count sales orders in date range
            from sqlalchemy import text
            query = text("""
                SELECT COUNT(*) FROM sales_orders
                WHERE created_at >= cast(:start_date as timestamp) AND created_at <= cast(:end_date as timestamp)
            """)
            result = await db.execute(query, {
                'start_date': params.get('start_date'),
                'end_date': params.get('end_date')
            })
            return result.scalar() or 0
            
        return 0
    except Exception as e:
        logger.error(f"Error estimating report size: {str(e)}")
        return 0

# Threshold for switching to async (rows)
ASYNC_THRESHOLD = 1000

@router.post("/efficiency-v3/export")
@limiter.limit("5/minute")
async def smart_export_efficiency(
    request: Request,
    start_date: str = Query(..., description="YYYY-MM-DD"),
    end_date: str = Query(..., description="YYYY-MM-DD"),
    supervisor_id: str = Query(None),
    campaign_id: str = Query(None),
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(get_current_user)
):
    """
    Smart export: Auto-detects report size and uses sync or async accordingly.
    - Small reports (< 1000 rows): Immediate download
    - Large reports (>= 1000 rows): Async with task_id
    """
    try:
        params = {
            'start_date': start_date,
            'end_date': end_date,
            'supervisor_id': supervisor_id,
            'campaign_id': campaign_id
        }
        
        # Estimate report size
        estimated_rows = await estimate_report_size(db, 'efficiency', params)
        logger.info(f"Efficiency report estimated at {estimated_rows} rows")
        
        # Decision: Sync or Async?
        if estimated_rows < ASYNC_THRESHOLD:
            # SYNC: Direct download (existing logic)
            logger.info("Using SYNC export (small report)")
            month = start_date[:7]
            
            from app.api.api_v1.endpoints.operational import get_operational_results
            data = await get_operational_results(month, db)
            
            if "error" in data:
                raise Exception(data["error"])
            
            supervisors = data.get("supervisors", [])
            agents = data.get("agents", [])
            supervisor_map = {s["id"]: s["nombre"] for s in supervisors}
            
            if supervisor_id:
                supervisors = [s for s in supervisors if s["id"] == supervisor_id]
                agents = [a for a in agents if a.get("supervisor_id") == supervisor_id]
            
            def generate():
                output = io.StringIO()
                writer = csv.writer(output)
                
                writer.writerow(["--- RENDIMIENTO DE SUPERVISORES ---"])
                writer.writerow([
                    "ID", "Nombre", "Tamaño Equipo", "Logro ($)", "Logro (#)", 
                    "Objetivo ($)", "Objetivo (#)", "Cumpl. ($) %", "Cumpl. (#) %", 
                    "Proy ($)", "Proy (#)", "Ritmo %", "Estatus"
                ])
                yield output.getvalue()
                output.truncate(0)
                output.seek(0)
                
                for s in supervisors:
                    writer.writerow([
                        s["id"], s["nombre"], s.get("team_size", 0),
                        s["logro_money"], s["logro_count"], 
                        s["objetivo_money"], s["objetivo_count"],
                        s["cumplimiento_money"], s["cumplimiento_count"], 
                        s["proy_money"], s["proy_count"], 
                        s.get("pace_diff", 0), s["status"]
                    ])
                    yield output.getvalue()
                    output.truncate(0)
                    output.seek(0)
                
                writer.writerow([])
                writer.writerow(["--- RENDIMIENTO DE AGENTES ---"])
                writer.writerow([
                    "ID", "Nombre", "Rol", "Supervisor", "Logro ($)", "Logro (#)", 
                    "Objetivo ($)", "Objetivo (#)", "Cumpl. ($) %", "Cumpl. (#) %", 
                    "Proy ($)", "Proy (#)", "Ritmo %", "Estatus"
                ])
                yield output.getvalue()
                output.truncate(0)
                output.seek(0)
                
                for a in agents:
                    supervisor_name = supervisor_map.get(a.get("supervisor_id"), "Sin Supervisor")
                    writer.writerow([
                        a["id"], a["nombre"], a.get("role", ""), supervisor_name,
                        a["logro_money"], a["logro_count"], 
                        a["objetivo_money"], a["objetivo_count"],
                        a["cumplimiento_money"], a["cumplimiento_count"], 
                        a["proy_money"], a["proy_count"], 
                        a.get("pace_diff", 0), a["status"]
                    ])
                    yield output.getvalue()
                    output.truncate(0)
                    output.seek(0)
            
            filename = f"reporte_eficiencia_{month}.csv"
            return StreamingResponse(
                generate(),
                media_type="text/csv",
                headers={"Content-Disposition": f"attachment; filename={filename}"}
            )
        
        else:
            # ASYNC: Create task and return task_id
            logger.info("Using ASYNC export (large report)")
            from app.lib.supabase_client import get_supabase_admin
            supabase = get_supabase_admin()
            
            task_data = {
                'user_id': str(current_user.id),
                'report_type': 'efficiency',
                'status': 'pending',
                'params': params
            }
            
            result = supabase.table('report_tasks').insert(task_data).execute()
            task_id = result.data[0]['id']
            
            # Trigger Edge Function
            supabase.functions.invoke('generate-report', {
                'body': {'task_id': task_id}
            })
            
            return {
                "mode": "async",
                "task_id": task_id,
                "status": "pending",
                "estimated_rows": estimated_rows,
                "message": "Report is being generated. Check status with /reports/{task_id}/status"
            }
            
    except Exception as e:
        logger.error(f"Error in smart export: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/scorecard/export")
@limiter.limit("5/minute")
async def smart_export_scorecard(
    request: Request,
    start_date: str = Query(..., description="YYYY-MM-DD"),
    end_date: str = Query(..., description="YYYY-MM-DD"),
    supervisor_id: str = Query(None),
    campaign_id: str = Query(None),
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(get_current_user)
):
    """Smart export for scorecard (same hybrid logic)"""
    try:
        params = {
            'start_date': start_date,
            'end_date': end_date,
            'supervisor_id': supervisor_id,
            'campaign_id': campaign_id
        }
        
        estimated_rows = await estimate_report_size(db, 'scorecard', params)
        logger.info(f"Scorecard report estimated at {estimated_rows} rows")
        
        if estimated_rows < ASYNC_THRESHOLD:
            # SYNC: Use existing scorecard export logic
            logger.info("Using SYNC export (small report)")
            month = start_date[:7]
            items = await _get_supervisor_data(db, month, supervisor_id)
            
            def generate():
                output = io.StringIO()
                writer = csv.writer(output)
                
                writer.writerow(["--- SCORECARD DE AGENTES ---"])
                writer.writerow([
                    "ID Agente", "Nombre", "Campaña", "Familia Producto",
                    "Logro ($)", "Logro (#)", "Objetivo ($)", "Objetivo (#)",
                    "Cumpl. ($) %", "Cumpl. (#) %", "Proy ($)", "Proy (#)", "Estatus"
                ])
                yield output.getvalue()
                output.truncate(0)
                output.seek(0)
                
                for item in items:
                    writer.writerow([
                        item.get("agent_id", ""),
                        item.get("agent_name", ""),
                        item.get("campaign_name", "Multi-Campaña"),
                        item.get("product_family", "Varios"),
                        item.get("sold_amount", 0),
                        item.get("sold_count", 0),
                        item.get("target_amount", 0),
                        item.get("target_units", 0),
                        item.get("compliance_amount", 0),
                        item.get("compliance_units", 0),
                        item.get("projection_amount", 0),
                        item.get("projection_units", 0),
                        item.get("pilar_estatus", "")
                    ])
                    yield output.getvalue()
                    output.truncate(0)
                    output.seek(0)
            
            filename = f"scorecard_agentes_{month}.csv"
            return StreamingResponse(
                generate(),
                media_type="text/csv",
                headers={"Content-Disposition": f"attachment; filename={filename}"}
            )
        else:
            # ASYNC
            logger.info("Using ASYNC export (large report)")
            from app.lib.supabase_client import get_supabase_admin
            supabase = get_supabase_admin()
            
            task_data = {
                'user_id': str(current_user.id),
                'report_type': 'scorecard',
                'status': 'pending',
                'params': params
            }
            
            result = supabase.table('report_tasks').insert(task_data).execute()
            task_id = result.data[0]['id']
            
            supabase.functions.invoke('generate-report', {
                'body': {'task_id': task_id}
            })
            
            return {
                "mode": "async",
                "task_id": task_id,
                "status": "pending",
                "estimated_rows": estimated_rows
            }
            
    except Exception as e:
        logger.error(f"Error in smart scorecard export: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/reports/{task_id}/status")
async def get_report_status(task_id: str):
    """Check status of async report generation"""
    try:
        from app.lib.supabase_client import get_supabase_admin
        supabase = get_supabase_admin()
        
        result = supabase.table('report_tasks')\
            .select('*')\
            .eq('id', task_id)\
            .single()\
            .execute()
        
        task = result.data
        download_url = None
        
        if task['status'] == 'completed' and task['file_path']:
            signed_url = supabase.storage\
                .from_('reports')\
                .create_signed_url(task['file_path'], 3600)
            download_url = signed_url['signedURL']
        
        return {
            "status": task['status'],
            "download_url": download_url,
            "error": task.get('error_message'),
            "created_at": task['created_at'],
            "completed_at": task.get('completed_at')
        }
    except Exception as e:
        logger.error(f"Error getting report status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# --- 5. DASHBOARD PRINCIPAL ---
@router.get("/dashboard", response_model=DashboardData)
async def get_dashboard_data(
    request: Request,
    start_date: str = Query(..., description="YYYY-MM-DD"),
    end_date: str = Query(..., description="YYYY-MM-DD"),
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(deps.get_db),
    _: bool = Depends(check_permission("dashboard", "access", module="dashboard"))
):
    """
    VERSION SQL DIRECT - Bypass Cloudflare Logs
    """
    logger.info(f"Dashboard metrics request (SQL): {start_date} to {end_date}")
    
    try:
        # 1. Fetch only tenant-specific active campaigns
        camp_stmt = select(Campaign.id, Campaign.name)\
            .where(Campaign.tenant_id == current_user.tenant_id)\
            .where(Campaign.is_active == True)
        camp_res = await db.execute(camp_stmt)
        campaigns = [{"id": str(r.id), "name": r.name} for r in camp_res.all()]
        
        # 2. Fetch sales counts by campaign
        # Explicitly cast to datetime for PostgreSQL compliance
        start_ts = datetime.datetime.strptime(f"{start_date} 00:00:00", "%Y-%m-%d %H:%M:%S")
        end_ts = datetime.datetime.strptime(f"{end_date} 23:59:59", "%Y-%m-%d %H:%M:%S")
        
        # Optimized: Group by campaign_id in SQL
        sales_stmt = select(SalesOrder.campaign_id, func.count(SalesOrder.id))\
            .where(SalesOrder.tenant_id == current_user.tenant_id)\
            .where(SalesOrder.is_deleted == False)\
            .where(SalesOrder.created_at >= start_ts)\
            .where(SalesOrder.created_at <= end_ts)\
            .group_by(SalesOrder.campaign_id)
            
        sales_res = await db.execute(sales_stmt)
        sales_count_map = {str(r[0]): r[1] for r in sales_res.all() if r[0]} # r[0] is campaign_id
            
        campaign_metrics = []
        for c in campaigns:
            c_id = c.get('id')
            if not c_id: continue
            
            campaign_metrics.append(CampaignMetric(
                campaign_name=c.get('name') or "Campaña Sin Nombre",
                leads_generated=int(sales_count_map.get(c_id, 0)),
                conversion_rate=0.0,
                active=True
            ))

        # 3. Goal Compliance (Simplified logic for dashboard)
        month_str = start_date[:7]
        try:
            # Goals SQL
            goal_stmt = select(func.sum(SalesGoal.target_amount))\
                .where(SalesGoal.tenant_id == current_user.tenant_id)\
                .where(SalesGoal.month.like(f"{month_str}%"))
            goal_res = await db.execute(goal_stmt)
            total_target = float(goal_res.scalar() or 0)
            
            # Sales SQL
            val_stmt = select(func.sum(SalesOrder.snapshot_price))\
                .where(SalesOrder.is_deleted == False)\
                .where(SalesOrder.tenant_id == current_user.tenant_id)\
                .where(SalesOrder.created_at >= start_ts)\
                .where(SalesOrder.created_at <= end_ts) # Dashboard uses exact range? Logic said month_str% in old code for sales_val_res but created_at like month_str%?
                # Old code: like('created_at', f"{month_str}%")
                # But get_dashboard_data takes start/end date.
                # If the dashboard shows "Monthly Compliance", it should respect the MONTH of the start_date.
                # The old code used month_str for BOTH goals and sales.
                # Let's replicate old logic: Sales for the WHOLE month
            
            # Replicating old logic: fetch sales for the MONTH of start_date
            val_stmt = select(func.sum(SalesOrder.snapshot_price))\
                .where(SalesOrder.is_deleted == False)\
                .where(SalesOrder.tenant_id == current_user.tenant_id)\
                .where(func.to_char(SalesOrder.created_at, 'YYYY-MM') == month_str)
            
            val_res = await db.execute(val_stmt)
            total_sold = float(val_res.scalar() or 0)
            
            compliance = (total_sold / total_target * 100) if total_target > 0 else 0.0
            
            # Garantizar que el status sea exacto al Enum de Zod: 'On Track', 'Risk', 'Behind'
            if compliance >= 80:
                status = "On Track"
            elif compliance >= 50:
                status = "Risk"
            else:
                status = "Behind"
                
        except Exception as goal_e:
            logger.warning(f"Error calculating goals (SQL): {goal_e}")
            total_target = 0.0
            total_sold = 0.0
            status = "Behind"
        
        goal_compliance = [
            GoalCompliance(
                metric_name="Meta Mensual Global",
                target=float(total_target),
                current=float(total_sold),
                status=status
            )
        ]

        return DashboardData(
            period_start=str(start_date),
            period_end=str(end_date),
            operations_metrics=OperationsMetrics(
                by_campaign=campaign_metrics,
                by_supervisor=[]
            ),
            goals_compliance=goal_compliance
        )
        
    except Exception as e:
        logger.error(f"Error generating dashboard data (SQL): {str(e)}")
        # No queremos que el dashboard rompa el frontend, devolvemos algo seguro
        return DashboardData(
            period_start=start_date,
            period_end=end_date,
            operations_metrics=OperationsMetrics(by_campaign=[], by_supervisor=[]),
            goals_compliance=[]
        )


# --- 6. EXPORT EFFICIENCY DATA ---
@router.get("/efficiency-v3/export")
async def export_efficiency_data(
    start_date: str = Query(..., description="YYYY-MM-DD"),
    end_date: str = Query(..., description="YYYY-MM-DD"),
    supervisor_id: str = Query(None, description="Filter by supervisor"),
    campaign_id: str = Query(None, description="Filter by campaign"),
    db: AsyncSession = Depends(deps.get_db),
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("dashboard", "access", module="dashboard"))
):
    """
    Genera un reporte CSV con datos de eficiencia operativa.
    Incluye métricas de supervisores y agentes.
    """
    try:
        # Derivar el mes de la fecha de inicio
        month = start_date[:7]  # YYYY-MM
        
        # Importar la función del módulo operational
        from app.api.api_v1.endpoints.operational import get_operational_results
        
        # Obtener los datos usando el endpoint existente
        data = await get_operational_results(month, db)
        
        if "error" in data:
            raise Exception(data["error"])
        
        # Aplicar filtros si se proporcionan
        supervisors = data.get("supervisors", [])
        agents = data.get("agents", [])
        
        # Crear un diccionario de mapeo de supervisor_id -> nombre
        supervisor_map = {s["id"]: s["nombre"] for s in supervisors}
        
        if supervisor_id:
            # Filtrar supervisores
            supervisors = [s for s in supervisors if s["id"] == supervisor_id]
            # Filtrar agentes por supervisor
            agents = [a for a in agents if a.get("supervisor_id") == supervisor_id]
        
        def generate():
            output = io.StringIO()
            writer = csv.writer(output)
            
            # --- SECCIÓN 1: SUPERVISORES ---
            writer.writerow(["--- RENDIMIENTO DE SUPERVISORES ---"])
            writer.writerow([
                "ID", "Nombre", "Tamaño Equipo", "Logro ($)", "Logro (#)", 
                "Objetivo ($)", "Objetivo (#)", "Cumpl. ($) %", "Cumpl. (#) %", 
                "Proy ($)", "Proy (#)", "Ritmo %", "Estatus"
            ])
            yield output.getvalue()
            output.truncate(0)
            output.seek(0)
            
            for s in supervisors:
                writer.writerow([
                    s["id"], s["nombre"], s.get("team_size", 0),
                    s["logro_money"], s["logro_count"], 
                    s["objetivo_money"], s["objetivo_count"],
                    s["cumplimiento_money"], s["cumplimiento_count"], 
                    s["proy_money"], s["proy_count"], 
                    s.get("pace_diff", 0), s["status"]
                ])
                yield output.getvalue()
                output.truncate(0)
                output.seek(0)
            
            # --- SECCIÓN 2: AGENTES ---
            writer.writerow([])
            writer.writerow(["--- RENDIMIENTO DE AGENTES ---"])
            writer.writerow([
                "ID", "Nombre", "Rol", "Supervisor", "Logro ($)", "Logro (#)", 
                "Objetivo ($)", "Objetivo (#)", "Cumpl. ($) %", "Cumpl. (#) %", 
                "Proy ($)", "Proy (#)", "Ritmo %", "Estatus"
            ])
            yield output.getvalue()
            output.truncate(0)
            output.seek(0)
            
            for a in agents:
                # Resolver el nombre del supervisor usando el mapeo
                supervisor_name = supervisor_map.get(a.get("supervisor_id"), "Sin Supervisor")
                
                writer.writerow([
                    a["id"], a["nombre"], a.get("role", ""), supervisor_name,
                    a["logro_money"], a["logro_count"], 
                    a["objetivo_money"], a["objetivo_count"],
                    a["cumplimiento_money"], a["cumplimiento_count"], 
                    a["proy_money"], a["proy_count"], 
                    a.get("pace_diff", 0), a["status"]
                ])
                yield output.getvalue()
                output.truncate(0)
                output.seek(0)
        
        filename = f"reporte_eficiencia_{month}.csv"
        return StreamingResponse(
            generate(),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    
    except Exception as e:
        logger.error(f"Error exporting efficiency data: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# --- 7. COMMISSION BOOSTER (NEW) ---
from app.schemas.commission import CommissionProjectionResponse, CommissionTier, ProjectionScenario

@router.get("/commission-projection", response_model=CommissionProjectionResponse)
async def get_commission_projection(
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(deps.get_db),
    _: bool = Depends(check_permission("commission_calculator", "read", module="analytics"))
):
    """
    Calculates commission projection based on current month performance.
    Dynamic Tiers:
    - Bronze: 0-9 sales (5%)
    - Silver: 10-19 sales (7%)
    - Gold: 20+ sales (10%)
    """
    try:
        # 1. Get Current Month
        today = datetime.datetime.now()
        month_str = today.strftime("%Y-%m")
        start_date = today.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        # End date logic same as before
        if today.month == 12:
            end_date = today.replace(year=today.year+1, month=1, day=1)
        else:
            end_date = today.replace(month=today.month+1, day=1)
            
        # 2. Fetch User's Approved Sales (Productive Statuses)
        # Assuming 'INSTALADA' or 'COMPLETADA' (We need to fetch IDs of these statuses for the tenant)
        st_stmt = select(Status.name).where(Status.tenant_id == current_user.tenant_id, Status.is_productive == True)
        st_res = await db.execute(st_stmt)
        productive_names = st_res.scalars().all()
        
        if not productive_names:
            # Fallback if no productive statuses configured
            productive_names = ['INSTALADA', 'COMPLETADA', 'CONECTADO', 'EXITOSA']

        # Query Sales (Strict filtering by current_user.id and tenant_id)
        # Dates are handled as timestamps/datetimes (start_date, end_date)
        stmt = select(SalesOrder.snapshot_price)\
            .where(
                SalesOrder.tenant_id == current_user.tenant_id,
                SalesOrder.agent_id == current_user.id,
                SalesOrder.is_deleted == False,
                SalesOrder.created_at >= start_date,
                SalesOrder.created_at < end_date,
                SalesOrder.status.in_(productive_names)
            )
        result = await db.execute(stmt)
        sales = [float(r or 0) for r in result.scalars().all()]
        
        count = len(sales)
        total_value = sum(sales)
        if count > 0:
            avg_ticket = total_value / count
        else:
            try:
                # Fallback: Average price of all active products for the tenant
                prod_stmt = select(func.avg(Product.current_price)).where(
                    Product.tenant_id == current_user.tenant_id,
                    Product.is_active == True
                )
                prod_res = await db.execute(prod_stmt)
                result = prod_res.scalar()
                avg_ticket = float(result) if result is not None else 50.0
            except Exception as e:
                logger.error(f"Error calculating fallback avg_ticket: {e}")
                avg_ticket = 50.0
        
        # 3. Define Tiers (Hardcoded for MVP, should be DB driven later)
        tiers = [
            {"name": "Bronze", "min": 0, "rate": 0.05},
            {"name": "Silver", "min": 10, "rate": 0.07},
            {"name": "Gold", "min": 20, "rate": 0.10}
        ]
        
        # Determine Current Tier
        current_tier_def = tiers[0]
        next_tier_def = None
        
        for i, t in enumerate(tiers):
            if count >= t["min"]:
                current_tier_def = t
                if i + 1 < len(tiers):
                    next_tier_def = tiers[i+1]
            else:
                break
                
        current_commission = total_value * current_tier_def["rate"]
        
        # 4. Scenarios
        scenarios = []
        for extra in [1, 3, 5, 7, 10]:
            new_count = count + extra
            projected_value = total_value + (avg_ticket * extra)
            
            # Helper to find tier for a count
            new_tier = tiers[0]
            for t in tiers:
                if new_count >= t["min"]:
                    new_tier = t
            
            new_comm = projected_value * new_tier["rate"]
            incremental = new_comm - current_commission
            
            scenarios.append(ProjectionScenario(
                additional_sales=extra,
                projected_total_sales=new_count,
                projected_commission_amount=round(new_comm, 2),
                incremental_earnings=round(incremental, 2),
                new_tier_name=new_tier["name"]
            ))
            
        return CommissionProjectionResponse(
            current_sales_count=count,
            current_sales_value=round(total_value, 2),
            current_commission_amount=round(current_commission, 2),
            current_tier=CommissionTier(
                name=current_tier_def["name"],
                min_sales=current_tier_def["min"],
                commission_rate=current_tier_def["rate"],
                is_current=True
            ),
            next_tier=CommissionTier(
                name=next_tier_def["name"],
                min_sales=next_tier_def["min"],
                commission_rate=next_tier_def["rate"],
                is_current=False
            ) if next_tier_def else None,
            sales_to_next_tier=(next_tier_def["min"] - count) if next_tier_def else 0,
            scenarios=scenarios
        )

    except Exception as e:
        logger.error(f"Commission projection error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
