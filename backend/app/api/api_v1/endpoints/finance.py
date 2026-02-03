import logging
import calendar
from typing import List, Optional, Dict
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.api import deps
from app.core.security import get_current_user, check_permission
from app.models.core import UserProfile, SalesOrder, Product, Organization
from app.models.status import Status
from app.models.sales_goal import SalesGoal
from app.schemas.core import UserRole
from app.core.supabase import supabase_admin

router = APIRouter()
logger = logging.getLogger(__name__)

# --- ROLE SCOPING ---
HIGH_LEVEL_ROLES = [UserRole.SUPER_ADMIN, UserRole.ADMINISTRADOR, UserRole.GERENTE, UserRole.SUPERVISOR, UserRole.SUPERVISOR_SENIOR]

# --- BUSINESS RULES HELPERS ---

def get_commission_for_sale(sale: dict, prod_map: dict, productive_names: List[str]) -> float:
    """
    Aplica las reglas de negocio para el cálculo de comisiones:
    1. Si el estatus no es productivo, la comisión es 0.
    2. Fallback a 0 si no hay producto o incentivo.
    """
    status = str(sale.get('status') or "")
    
    if status not in productive_names:
        return 0.0
    
    product_id = sale.get('product_id')
    return float(prod_map.get(product_id, 0.0))

def get_date_range_last_month(start_date: str, end_date: str):
    """Calcula el rango equivalente el mes anterior."""
    s = datetime.strptime(start_date, "%Y-%m-%d")
    e = datetime.strptime(end_date, "%Y-%m-%d")
    
    delta = (e - s).days + 1
    prev_s = s - timedelta(days=delta)
    prev_e = e - timedelta(days=delta)
    
    return prev_s.strftime("%Y-%m-%d"), prev_e.strftime("%Y-%m-%d")

# --- ENDPOINTS ---

@router.get("/payroll")
async def get_preliminary_payroll(
    start_date: str = Query(..., description="YYYY-MM-DD"),
    end_date: str = Query(..., description="YYYY-M-DD"),
    status: Optional[str] = Query(None, description="Filter by sale status"),
    campaign_id: Optional[str] = Query(None, description="Filter by campaign ID"),
    db: AsyncSession = Depends(deps.get_db),
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("finance", "results", module="finance"))
):
    """Cálculo de nómina vía SQL Directo"""
    tenant_id = current_user.tenant_id
    start_dt = datetime.strptime(start_date, "%Y-%m-%d")
    end_dt = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)

    try:
        # 1. Fetch Sales with Product and Agent info
        stmt = (
            select(SalesOrder)
            .options(selectinload(SalesOrder.product), selectinload(SalesOrder.agent))
            .where(
                SalesOrder.tenant_id == tenant_id,
                SalesOrder.is_deleted == False,
                SalesOrder.created_at >= start_dt,
                SalesOrder.created_at < end_dt
            )
        )
        
        if current_user.role not in HIGH_LEVEL_ROLES:
            stmt = stmt.where(SalesOrder.agent_id == current_user.id)
        
        if status and status != "All": stmt = stmt.where(SalesOrder.status == status)
        if campaign_id and campaign_id != "All": stmt = stmt.where(SalesOrder.campaign_id == campaign_id)
        
        result = await db.execute(stmt)
        sales = result.scalars().all()
        
        # 2. Statuses
        st_stmt = select(Status.name).where(Status.tenant_id == tenant_id, Status.is_productive == True)
        st_res = await db.execute(st_stmt)
        productive_names = [s[0] for s in st_res.all()]

        # 3. Goals
        target_month = start_date[:7] + "-01"
        goal_stmt = select(SalesGoal).where(SalesGoal.tenant_id == tenant_id, SalesGoal.month == target_month, SalesGoal.is_active == True)
        goal_res = await db.execute(goal_stmt)
        goals = {g.user_id: g.target_amount for g in goal_res.scalars().all()}

        if not sales:
            return { "period": {"start": start_date, "end": end_date}, "payroll": [], "totals": { "total_sales_count": 0, "total_volume": 0.0, "total_commissions": 0.0 } }

        # Aggregations
        agg = {}
        for s in sales:
            a_id = s.agent_id
            if a_id not in agg: agg[a_id] = {"name": f"{s.agent.first_name} {s.agent.last_name}" if s.agent else "N/A", "revenue": 0.0, "commissions": 0.0, "count": 0}
            
            price = float(s.snapshot_price or 0.0)
            comm = float(s.product.incentive or 0.0) if s.status in productive_names and s.product else 0.0
            
            agg[a_id]["revenue"] += price
            agg[a_id]["commissions"] += comm
            agg[a_id]["count"] += 1

        payroll_list = []
        global_vol = 0.0
        global_comm = 0.0

        for a_id, m in agg.items():
            revenue = m["revenue"]
            commissions = m["commissions"]
            count = m["count"]
            goal = goals.get(a_id, 0.0)
            
            payroll_list.append({
                "agent_id": str(a_id),
                "agent_name": m["name"],
                "sales_count": count,
                "total_volume": round(revenue, 2),
                "total_commissions": round(commissions, 2),
                "avg_ticket": round(revenue / count, 2) if count > 0 else 0,
                "goal_pct": round(revenue / goal * 100, 1) if goal > 0 else 0.0
            })
            global_vol += revenue
            global_comm += commissions

        payroll_list.sort(key=lambda x: x['total_commissions'], reverse=True)

        return {
            "period": {"start": start_date, "end": end_date},
            "payroll": payroll_list,
            "totals": {
                "total_sales_count": len(sales),
                "total_volume": round(global_vol, 2),
                "total_commissions": round(global_comm, 2)
            }
        }
    except Exception as e:
        logger.error(f"Error payroll SQL: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/summary")
async def get_finance_summary(
    start_date: str = Query(..., description="YYYY-MM-DD"),
    end_date: str = Query(..., description="YYYY-MM-DD"),
    status: Optional[str] = Query(None),
    campaign_id: Optional[str] = Query(None),
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("finance", "summary", module="finance"))
):
    """
    KPIs globales filtrados por fecha, estatus y campaña + Top Performers.
    """
    tenant_id = str(current_user.tenant_id)
    start_ts = f"{start_date}T00:00:00Z"
    end_ts = f"{end_date}T23:59:59Z"

    try:
        query = supabase_admin.table('sales_orders').select('product_id, agent_id, snapshot_price, status').match({
            'tenant_id': tenant_id,
            'is_deleted': False
        }).gte('created_at', start_ts).lte('created_at', end_ts)

        # --- DATA SCOPE FILTERING (RLS) ---
        if current_user.role not in HIGH_LEVEL_ROLES:
            logger.info(f"🔒 RLS: Restricting finance summary for {current_user.email}")
            query = query.eq('agent_id', str(current_user.id))

        # 0. Fetch Productive Statuses for this tenant
        st_res = supabase_admin.table('statuses').select('name').eq('tenant_id', tenant_id).eq('is_productive', True).execute()
        productive_names = [s['name'] for s in (st_res.data or [])]

        if status and status not in ["All", "Todos", "everyone", ""]:
            query = query.eq('status', status)
        elif not status or status in ["All", "Todos", "everyone", ""]:
            # Si no hay filtro explícito o es "Todos", usamos todos los productivos
            if productive_names:
                query = query.in_('status', productive_names)
            else:
                return { "gross_revenue": 0.0, "commission_cost": 0.0, "net_revenue": 0.0, "profit_margin": 0.0, "top_products": [], "top_agents": [] }

        if campaign_id and campaign_id not in ["All", "Todos", ""]:
            query = query.eq('campaign_id', campaign_id)

        sales_res = query.execute()
        raw_sales = sales_res.data or []
        
        # --- EXCLUDE ADMIN SALES ---
        # Fetch valid operational users (excluding Admins)
        if raw_sales:
            agent_ids_in_sales = list(set([s['agent_id'] for s in raw_sales if s.get('agent_id')]))
            valid_agents_res = supabase_admin.table('users_profiles').select('id, role').in_('id', agent_ids_in_sales).execute()
            # Valid roles: NOT Super Admin, NOT Administrador
            valid_ids = {u['id'] for u in valid_agents_res.data if u.get('role') not in ['Super Admin', 'Administrador']}
            
            # Filter sales
            sales = [s for s in raw_sales if s.get('agent_id') in valid_ids]
        else:
            sales = []
        
        if not sales:
            return { "gross_revenue": 0.0, "commission_cost": 0.0, "net_revenue": 0.0, "profit_margin": 0.0, "top_products": [], "top_agents": [] }

        # Metadata Mapping
        product_ids = list(set([s['product_id'] for s in sales if s.get('product_id')]))
        prod_res = supabase_admin.table('products').select('id, name, incentive').in_('id', product_ids).execute()
        prod_map = {p['id']: float(p.get('incentive') or 0) for p in (prod_res.data or [])}

        agent_ids = list(set([s['agent_id'] for s in sales if s.get('agent_id')]))
        agents_res = supabase_admin.table('users_profiles').select('id, first_name, last_name').in_('id', agent_ids).execute()
        agents_map = {a['id']: f"{a.get('first_name', '')} {a.get('last_name', '')}".strip() for a in (agents_res.data or [])}

        # Calculations & Top Aggregates
        gross = 0.0
        commissions = 0.0
        prod_agg = {}
        agent_agg = {}

        for s in sales:
            p_id = s.get('product_id')
            a_id = s.get('agent_id')
            price = float(s.get('snapshot_price') or 0.0)
            
            comm = get_commission_for_sale(s, prod_map, productive_names)
            
            gross += price
            commissions += comm
            
            if p_id:
                p_name = next((p['name'] for p in prod_res.data if p['id'] == p_id), "Desconocido")
                if p_id not in prod_agg: prod_agg[p_id] = {"name": p_name, "count": 0, "revenue": 0.0}
                prod_agg[p_id]["count"] += 1
                prod_agg[p_id]["revenue"] += price

            if a_id:
                a_name = agents_map.get(a_id, 'Agente Desconocido')
                if a_id not in agent_agg: agent_agg[a_id] = {"name": a_name, "revenue": 0.0}
                agent_agg[a_id]["revenue"] += price

        net = gross - commissions
        margin = (net / gross * 100) if gross > 0 else 0.0

        top_products = sorted(prod_agg.values(), key=lambda x: x['revenue'], reverse=True)[:5]
        top_agents = sorted(agent_agg.values(), key=lambda x: x['revenue'], reverse=True)[:5]

        return { 
            "gross_revenue": round(gross, 2), 
            "commission_cost": round(commissions, 2), 
            "net_revenue": round(net, 2), 
            "profit_margin": round(margin, 2),
            "top_products": top_products,
            "top_agents": top_agents
        }
    except Exception as e:
        logger.error(f"Error in /summary: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/campaign-revenue")
async def get_campaign_revenue_share(
    start_date: str = Query(..., description="YYYY-MM-DD"),
    end_date: str = Query(..., description="YYYY-MM-DD"),
    status: Optional[str] = Query(None),
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("finance", "summary", module="finance"))
):
    """
    Distribución de ingresos por campaña.
    """
    tenant_id = str(current_user.tenant_id)
    start_ts = f"{start_date}T00:00:00Z"
    end_ts = f"{end_date}T23:59:59Z"

    try:
        query = supabase_admin.table('sales_orders').select('snapshot_price, campaign_id').match({
            'tenant_id': tenant_id,
            'is_deleted': False
        }).gte('created_at', start_ts).lte('created_at', end_ts)

        # --- DATA SCOPE FILTERING (RLS) ---
        if current_user.role not in HIGH_LEVEL_ROLES:
            query = query.eq('agent_id', str(current_user.id))

        if status and status != "All":
            query = query.eq('status', status)

        sales_res = query.execute()
        sales = sales_res.data or []
        if not sales: return []

        camp_ids = list(set([s['campaign_id'] for s in sales if s.get('campaign_id')]))
        camps_res = supabase_admin.table('campaigns').select('id, name').in_('id', camp_ids).execute()
        camps_map = {c['id']: c['name'] for c in camps_res.data}

        camp_agg = {}
        for s in sales:
            c_id = s.get('campaign_id')
            price = float(s.get('snapshot_price') or 0.0)
            name = camps_map.get(c_id, "Campaña General")
            if name not in camp_agg: camp_agg[name] = 0.0
            camp_agg[name] += price

        return [{"name": name, "value": round(val, 2)} for name, val in camp_agg.items()]
    except Exception as e:
        logger.error(f"Error in /campaign-revenue: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/trends")
async def get_finance_trends(
    start_date: str = Query(..., description="YYYY-MM-DD"),
    end_date: str = Query(..., description="YYYY-MM-DD"),
    status: Optional[str] = Query(None),
    campaign_id: Optional[str] = Query(None),
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("finance", "summary", module="finance"))
):
    """
    Series de tiempo filtradas por estatus y campaña con lógica de comisiones corregida.
    """
    tenant_id = str(current_user.tenant_id)
    start_ts = f"{start_date}T00:00:00Z"
    end_ts = f"{end_date}T23:59:59Z"

    try:
        query = supabase_admin.table('sales_orders').select('product_id, snapshot_price, created_at, status').match({
            'tenant_id': tenant_id,
            'is_deleted': False
        }).gte('created_at', start_ts).lte('created_at', end_ts)

        # --- DATA SCOPE FILTERING (RLS) ---
        if current_user.role not in HIGH_LEVEL_ROLES:
            query = query.eq('agent_id', str(current_user.id))

        if status and status != "All":
            query = query.eq('status', status)

        sales_res = query.execute()
        sales = sales_res.data or []
        if not sales: return []

        product_ids = list(set([s['product_id'] for s in sales if s.get('product_id')]))
        prod_res = supabase_admin.table('products').select('id, incentive').in_('id', product_ids).execute()
        prod_map = {p['id']: float(p.get('incentive') or 0) for p in (prod_res.data or [])}

        # 0. Fetch Productive Statuses (Missing in original code)
        st_res = supabase_admin.table('statuses').select('name').eq('tenant_id', tenant_id).eq('is_productive', True).execute()
        productive_names = [s['name'] for s in (st_res.data or [])]

        trends_map: Dict[str, Dict[str, float]] = {}
        for sale in sales:
            dt_str = sale['created_at'][:10]
            if dt_str not in trends_map: trends_map[dt_str] = {"revenue": 0.0, "commissions": 0.0}
            
            price = float(sale.get('snapshot_price') or 0)
            comm = get_commission_for_sale(sale, prod_map, productive_names)
            
            trends_map[dt_str]["revenue"] += price
            trends_map[dt_str]["commissions"] += comm

        trends_list = [{"date": d, "revenue": round(trends_map[d]["revenue"], 2), "commissions": round(trends_map[d]["commissions"], 2)} for d in sorted(trends_map.keys())]
        return trends_list
    except Exception as e:
        logger.error(f"Error in /trends: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
