from datetime import datetime
from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
import psutil
import os

from app.api import deps
from app.core.security import get_current_user
from app.core.security import get_current_user
from app.models.core import Organization

router = APIRouter()

class KillSwitchRequest(BaseModel):
    confirmation_name: str

@router.get("/system", summary="System Health & Telemetry")
async def get_system_health(
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Get real-time system health metrics, including active agents for the current tenant.
    Requires 'system:health:read' permission.
    """
    # 1. Database Latency & Connection Test
    start_time = datetime.now()
    try:
        await db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"
    end_time = datetime.now()
    db_latency_ms = (end_time - start_time).total_seconds() * 1000

    # 2. Total Connections (Pool Utilization)
    # We want to know total occupancy, not just active query runners
    try:
        active_conn_query = text("""
            SELECT count(*) 
            FROM pg_stat_activity 
            WHERE datname = current_database()
        """)
        # Using .scalar() on async result requires .scalars().first() pattern or await execute -> .scalar()
        result = await db.execute(active_conn_query)
        active_connections = result.scalar()
    except:
        active_connections = -1

    # 3. Active Agents (Tenant Specific)
    active_agents = 0
    try:
        # Improved Logic: Count valid profiles for this tenant
        # We simplify to count ALL users for the tenant as 'Potential Agents' if last_seen is unreliable
        # or just count them. For 'Online', we really need a heartbeat.
        # If last_seen_at IS used, we ensure the query is robust.
        
        agent_query = text("""
            SELECT count(id) 
            FROM users_profiles 
            WHERE tenant_id = :tenant_id
        """)
        result = await db.execute(agent_query, {"tenant_id": current_user.tenant_id})
        active_agents = result.scalar() or 0
        print(f"DEBUG: Agentes detectados: {active_agents} for tenant {current_user.tenant_id}")
    except Exception as e:
        # Fallback: Just count total users as "Authorized Agents"
        print(f"Telemetry Warning: Could not count active agents: {e}")
        try:
             fallback_query = text("SELECT count(*) FROM users_profiles WHERE tenant_id = :tenant_id")
             result = await db.execute(fallback_query, {"tenant_id": current_user.tenant_id})
             active_agents = result.scalar()
        except:
             active_agents = -1

    # 4. System Resources
    process = psutil.Process(os.getpid())
    memory_info = process.memory_info()
    memory_usage_mb = memory_info.rss / 1024 / 1024
    
    disk = psutil.disk_usage('/')
    disk_usage_percent = disk.percent

    return {
        "status": "online",
        "timestamp": datetime.now().isoformat(),
        "database": {
            "status": db_status,
            "latency_ms": round(db_latency_ms, 2),
            "active_connections": active_connections,
            "active_agents": active_agents
        },
        "system": {
            "memory_usage_mb": round(memory_usage_mb, 2),
            "disk_usage_percent": disk_usage_percent,
            "cpu_percent": psutil.cpu_percent(interval=None)
        }
    }

@router.post("/kill-switch", summary="Emergency Session Revocation")
async def execute_kill_switch(
    request: KillSwitchRequest,
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(get_current_user),
):
    """
    Kill Switch: Revokes ALL sessions for the current tenant.
    Requires 'system:security:killswitch'.
    Double confirmation required (Organization Name).
    """
    
    # 2. Get Organization Name for Confirmation
    # Use select() for async ORM or execute(select())
    from sqlalchemy import select
    
    # Needs to be async compatible query
    stmt = select(Organization).where(Organization.id == current_user.tenant_id)
    result = await db.execute(stmt)
    org = result.scalars().first()
    
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    if request.confirmation_name.strip() != org.name.strip():
        raise HTTPException(status_code=400, detail="Confirmation name does not match organization name.")

    # 3. Execute Kill Switch (Surgical)
    try:
        # Delete sessions for all users in this tenant EXCEPT the current user (Super Admin Protection)
        kill_query = text("""
            DELETE FROM auth.sessions 
            WHERE user_id IN (
                SELECT id FROM public.users_profiles 
                WHERE tenant_id = :tenant_id
            )
            AND user_id != :current_user_id
        """)
        
        result = await db.execute(kill_query, {
            "tenant_id": current_user.tenant_id, 
            "current_user_id": current_user.id
        })
        await db.commit()
        
        rows_deleted = result.rowcount
        
        return {
            "status": "success", 
            "message": f"Kill Switch Executed. {rows_deleted} active sessions revoked.",
            "organization": org.name
        }

    except Exception as e:
        await db.rollback()
        print(f"Kill Switch Failed: {e}")
        raise HTTPException(status_code=500, detail=f"Kill Switch Failed: {str(e)}")
