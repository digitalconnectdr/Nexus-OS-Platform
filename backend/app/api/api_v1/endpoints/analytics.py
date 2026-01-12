import logging
from typing import Any, List, Optional, Dict
from fastapi import APIRouter, Depends, Query, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
import csv
import io

# Importaciones del sistema
from app.api import deps
from app.core.security import get_current_user
from app.models import User, SalesGoal, SalesOrder, Campaign
from app.schemas.analytics import (
    EfficiencyResponse, 
    DashboardData
)

# Rate limiting and caching
from app.middleware.rate_limit import limiter, rate_limit_standard, rate_limit_export
from app.lib.cache import cache_response

logger = logging.getLogger(__name__)
router = APIRouter()
# Si alguna importación de schemas falla, avísame.
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
import datetime

router = APIRouter()
logger = logging.getLogger(__name__)

# --- 1. CAMPAÑAS ---
async def _get_campaign_data(session: AsyncSession, month: str, campaign_id: str = None) -> List[EfficiencyCampaignParentMetric]:
    stmt = (
        select(
            Campaign.id.label('campaign_id'),
            Campaign.name.label('campaign_name'),
            func.coalesce(func.sum(SalesGoal.target_amount), 0).label('target_amount'),
            func.coalesce(func.sum(SalesOrder.snapshot_price), 0).label('sold_amount')
        )
        .select_from(Campaign)
        .outerjoin(SalesGoal, (SalesGoal.campaign_id == Campaign.id) & (SalesGoal.month.like(f"{month}%")))
        .outerjoin(SalesOrder, (SalesOrder.campaign_id == Campaign.id) & (func.to_char(SalesOrder.created_at, 'YYYY-MM') == month))
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
async def _get_supervisor_data(session: AsyncSession, month: str, supervisor_id: str = None) -> List[EfficiencySupervisorMetric]:
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
        .outerjoin(SalesGoal, (SalesGoal.user_id == User.id) & (SalesGoal.month.like(f"{month}%")))
        .outerjoin(SalesOrder, (SalesOrder.agent_id == User.id) & (func.to_char(SalesOrder.created_at, 'YYYY-MM') == month))
        .group_by(User.id, User.first_name, User.last_name, User.avatar_url)
    )
    stmt = stmt.having((func.sum(SalesGoal.target_amount) > 0) | (func.sum(SalesOrder.snapshot_price) > 0))
    if supervisor_id: stmt = stmt.filter(User.id == supervisor_id)

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
@router.get("/efficiency-v3", response_model=EfficiencyResponse)
@limiter.limit("20/minute")
@cache_response(ttl_seconds=300)
async def get_efficiency_data(
    request: Request,
    month: str, view: str = 'supervisor',
    supervisor_id: Optional[str] = Query(None), campaign_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(deps.get_db)
):
    logger.info(f"Efficiency request received: month={month}, view={view}")
    
    # Respuesta por defecto vacía (SAFE)
    resp = EfficiencyResponse(
        month=month, total_supervisors=0, supervisors=[], campaigns_view=[], 
        metadata_supervisors=[], metadata_campaigns=[], metadata_families=[]
    )
    try:
        if view == 'campaign':
            resp.campaigns_view = await _get_campaign_data(db, month, campaign_id)
        else:
            resp.supervisors = await _get_supervisor_data(db, month, supervisor_id)
            resp.total_supervisors = len(resp.supervisors)
            
    except Exception as e:
        logger.error(f"Analytics crash: {str(e)}")
        # Importante: No lanzamos error, devolvemos respuesta vacía si explota todo
        # O lanzamos un 500 limpio si prefieres
        raise HTTPException(500, f"Error interno controlado: {str(e)}")
    
    return resp

# --- 4. SCORECARD AGENTES ---
@router.get("/scorecard/agents")
async def get_scorecard_agents(
    month: str,
    supervisor_id: Optional[str] = Query(None),
    campaign_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(deps.get_db)
):
    """
    Endpoint para el Scorecard 360 de Agentes.
    Retorna el desglose por agente, campaña y familia.
    """
    # Por ahora reutilizamos la lógica de supervisores pero enfocada a agentes
    # En el futuro esto puede ser un desglose más detallado con familias de productos
    items = await _get_supervisor_data(db, month, supervisor_id)
    
    # El frontend espera: items, total, month, supervisors, campaigns
    # Simulamos los filtros para que el frontend no rompa al hacer .map
    return {
        "items": items,
        "total": len(items),
        "month": month,
        "supervisors": [], # TODO: Poblar con supervisores reales para los filtros
        "campaigns": []    # TODO: Poblar con campañas reales para los filtros
    }

@router.get("/scorecard/export")
async def export_scorecard_data(
    start_date: str = Query(..., description="YYYY-MM-DD"),
    end_date: str = Query(..., description="YYYY-MM-DD"),
    supervisor_id: str = Query(None, description="Filter by supervisor"),
    campaign_id: str = Query(None, description="Filter by campaign"),
    db: AsyncSession = Depends(deps.get_db)
):
    """
    Genera un reporte CSV con datos del scorecard de agentes.
    """
    try:
        # Derivar el mes de la fecha de inicio
        month = start_date[:7]  # YYYY-MM
        
        # Obtener los datos del scorecard
        items = await _get_supervisor_data(db, month, supervisor_id)
        
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
                WHERE created_at >= :start_date AND created_at <= :end_date
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
@limiter.limit("100/minute")
@cache_response(ttl_seconds=300)
async def get_dashboard_data(
    request: Request,
    start_date: str = Query(..., description="YYYY-MM-DD"),
    end_date: str = Query(..., description="YYYY-MM-DD"),
    db: AsyncSession = Depends(deps.get_db)
):
    """
    Endpoint principal para el Dashboard Real-Time.
    Retorna métricas operativas y cumplimiento de metas.
    """
    logger.info(f"Dashboard metrics request: {start_date} to {end_date}")
    
    try:
        # 0. Convertir strings a datetime para compatibilidad con la DB
        try:
            # start_date: YYYY-MM-DD
            # end_date: YYYY-MM-DD
            start_dt = datetime.datetime.strptime(start_date, "%Y-%m-%d")
            # Para el end_date, lo llevamos al final del día (23:59:59)
            end_dt = datetime.datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
        except ValueError as ve:
            logger.error(f"Invalid date format: {ve}")
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

        # 1. Métricas por Campaña
        # Contamos ventas por campaña en el rango de fechas
        stmt_campaigns = (
            select(
                Campaign.name.label('campaign_name'),
                func.count(SalesOrder.id).label('leads_generated')
            )
            .select_from(Campaign)
            .outerjoin(SalesOrder, (SalesOrder.campaign_id == Campaign.id) & 
                       (SalesOrder.created_at >= start_dt) & 
                       (SalesOrder.created_at <= end_dt))
            .group_by(Campaign.name)
        )
        
        res_camp = await db.execute(stmt_campaigns)
        campaign_metrics = []
        for row in res_camp.all():
            campaign_metrics.append(CampaignMetric(
                campaign_name=row.campaign_name,
                leads_generated=row.leads_generated or 0,
                conversion_rate=0.0, # TODO: Lógica de conversión real si hay leads vs ventas
                active=True
            ))

        # 2. Cumplimiento de Metas
        # Comparamos meta de ventas ($) vs venta real ($)
        month_str = start_date[:7] # YYYY-MM
        stmt_goals = (
            select(
                func.coalesce(func.sum(SalesGoal.target_amount), 0).label('target_amount'),
                func.coalesce(func.sum(SalesOrder.snapshot_price), 0).label('sold_amount')
            )
            .select_from(SalesGoal)
            .outerjoin(SalesOrder, (SalesGoal.user_id == SalesOrder.agent_id) & 
                       (func.to_char(SalesOrder.created_at, 'YYYY-MM') == month_str))
            .where(SalesGoal.month.like(f"{month_str}%"))
        )
        
        res_goals = await db.execute(stmt_goals)
        goal_row = res_goals.first()
        
        target = float(goal_row.target_amount) if goal_row else 0.0
        current = float(goal_row.sold_amount) if goal_row else 0.0
        
        compliance = (current / target * 100) if target > 0 else 0.0
        status = "On Track" if compliance >= 80 else "Risk" if compliance >= 50 else "Behind"
        
        goal_compliance = [
            GoalCompliance(
                metric_name="Meta Mensual Global",
                target=target,
                current=current,
                status=status
            )
        ]

        return DashboardData(
            period_start=start_date,
            period_end=end_date,
            operations_metrics=OperationsMetrics(
                by_campaign=campaign_metrics,
                by_supervisor=[] # Opcional por ahora para no recargar
            ),
            goals_compliance=goal_compliance
        )
        
    except Exception as e:
        logger.error(f"Error generating dashboard data: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# --- 6. EXPORT EFFICIENCY DATA ---
@router.get("/efficiency-v3/export")
async def export_efficiency_data(
    start_date: str = Query(..., description="YYYY-MM-DD"),
    end_date: str = Query(..., description="YYYY-MM-DD"),
    supervisor_id: str = Query(None, description="Filter by supervisor"),
    campaign_id: str = Query(None, description="Filter by campaign"),
    db: AsyncSession = Depends(deps.get_db)
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

