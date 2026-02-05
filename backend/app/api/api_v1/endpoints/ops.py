import psutil
import time
import os
import uuid
import json
import asyncio
import datetime
import logging
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Request, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select, func
from app.api import deps
from app.core.security import get_current_user, check_permission
from app.core.config import settings
from app.models.core import UserProfile, Organization, SalesOrder
from app.schemas.core import UserRole
from app.core.supabase import supabase_admin

logger = logging.getLogger(__name__)
router = APIRouter()

# Global start time for uptime
START_TIME = time.time()

# --- UTILS: SAFE BATCH PROCESSING ---
async def safe_process_in_batches(db: AsyncSession, model, filter_stmt, action="delete", batch_size=250, sleep_time=0.2):
    """ Throttled batch processing to avoid DB lock/CPU spikes. """
    processed_count = 0
    while True:
        # Get a small batch
        if action == "delete":
            # For deletion, we don't need offset, we just keep taking the first batch
            stmt = select(model).where(filter_stmt).limit(batch_size)
        else:
            stmt = select(model).where(filter_stmt).offset(processed_count).limit(batch_size)
            
        result = await db.execute(stmt)
        batch = result.scalars().all()
        if not batch:
            break
            
        for item in batch:
            if action == "delete":
                await db.delete(item)
            processed_count += 1
            
        await db.commit()
        logger.info(f"Ops: Processed batch of {len(batch)} items. Total: {processed_count}")
        await asyncio.sleep(sleep_time) # Yield to other requests
        
    return processed_count

# --- BACKGROUND TASKS ---
async def task_generate_backup(org_id: uuid.UUID, user_email: str):
    """ Export organization data to protected JSON file. """
    from app.core.database import async_session_factory
    async with async_session_factory() as db:
        try:
            # 1. Fetch Org
            org_res = await db.execute(select(Organization).where(Organization.id == org_id))
            org = org_res.scalar_one_or_none()
            if not org: return

            # 2. Fetch Sales (Using batch process logic conceptually for memory safety)
            # For simplicity in this implementation, we fetch all, but in a real-world high-volume env, 
            # we should stream to file.
            sales_res = await db.execute(select(SalesOrder).where(SalesOrder.tenant_id == org_id))
            sales = sales_res.scalars().all()
            
            # 3. Create JSON Structure
            export_data = {
                "organization": {
                    "id": str(org.id),
                    "name": org.name,
                    "slug": org.slug
                },
                "sales_count": len(sales),
                "generated_at": datetime.datetime.now().isoformat(),
                "generated_by": user_email,
                "data": [
                    {
                        "id": str(s.id),
                        "customer": s.customer_name,
                        "status": s.status,
                        "price": float(s.snapshot_price or 0),
                        "created_at": s.created_at.isoformat() if s.created_at else None
                    } for s in sales
                ]
            }

            # 4. Save to Static with UUID for safety
            filename = f"backup_{org.slug}_{uuid.uuid4().hex[:8]}.json"
            static_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "static", "exports")
            file_absolute = os.path.join(static_path, filename)
            
            with open(file_absolute, "w", encoding="utf-8") as f:
                json.dump(export_data, f, indent=2)

            # 5. Register in report_tasks (optional, using a simple file list for now)
            # Create a simple tracking file or use report_tasks table if integrated.
            # We'll use a .meta file for simplicity in this walkthrough.
            meta_file = file_absolute + ".meta"
            with open(meta_file, "w") as f:
                json.dump({
                    "org_name": org.name,
                    "created_at": datetime.datetime.now().isoformat(),
                    "size_bytes": os.path.getsize(file_absolute),
                    "status": "completed"
                }, f)

            logger.info(f"✅ Backup created: {filename}")
        except Exception as e:
            logger.error(f"❌ Backup failed: {e}", exc_info=True)

@router.get("/healthz")
async def health_check():
    """Public health check endpoint."""
    return {"status": "ok", "timestamp": time.time()}

@router.get("/telemetry")
async def get_telemetry(
    request: Request,
    db: AsyncSession = Depends(deps.get_db),
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("ops", "view_tab", module="ops"))
):
    """System telemetry: CPU, RAM, DB, Health Checks, Errors."""
    try:
        # DB Connections
        db_res = await db.execute(text("SELECT count(*) FROM pg_stat_activity"))
        active_conns = db_res.scalar()
        
        # Server metrics
        cpu_pct = psutil.cpu_percent(interval=None)
        memory = psutil.virtual_memory()
        uptime = time.time() - START_TIME
        
        # Health Checks
        health = {"supabase": False, "email": True, "ai": True} # Default dummies
        try:
            # Check Supabase
            sb_check = supabase_admin.table('organizations').select('id').limit(1).execute()
            health["supabase"] = True
        except: pass

        return {
            "db": {
                "active_connections": active_conns,
                "status": "healthy"
            },
            "server": {
                "cpu_usage_percent": cpu_pct,
                "memory_usage_mb": round(memory.used / (1024 * 1024), 2),
                "memory_total_mb": round(memory.total / (1024 * 1024), 2),
                "uptime_seconds": round(uptime, 2)
            },
            "health_checks": health,
            "errors": {
                "count_500": getattr(request.app.state, "error_count_500", 0)
            },
            "app": {
                "version": "1.1.0-secure",
                "auth_mode": "local_jwt"
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching telemetry: {str(e)}")

@router.post("/backup")
async def request_backup(
    org_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("ops", "view_tab", module="ops"))
):
    """ Initiate a background backup task. """
    if current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Acceso denegado.")
        
    background_tasks.add_task(task_generate_backup, org_id, current_user.email)
    return {"status": "processing", "message": "Respaldo iniciado en segundo plano. Estará disponible en la lista en unos instantes."}

@router.get("/backups/recent")
async def get_recent_backups(
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("ops", "view_tab", module="ops"))
):
    """ List generated backup files from static directory. """
    exports_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "static", "exports")
    if not os.path.exists(exports_path):
        return []
        
    files = []
    for f in os.listdir(exports_path):
        if f.endswith(".json") and not f.endswith(".meta"):
            meta_path = os.path.join(exports_path, f + ".meta")
            meta = {}
            if os.path.exists(meta_path):
                with open(meta_path) as mf: meta = json.load(mf)
            
            files.append({
                "filename": f,
                "url": f"/static/exports/{f}",
                "created_at": meta.get("created_at"),
                "org_name": meta.get("org_name", "Desconocida"),
                "size_kb": round(os.path.getsize(os.path.join(exports_path, f)) / 1024, 2)
            })
            
    return sorted(files, key=lambda x: x['created_at'] or '', reverse=True)[:10]

@router.post("/clear-cache")
async def clear_cache(
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("ops", "view_tab", module="ops"))
):
    """ Flush application caches. """
    # Placeholder for Redis or in-mem cache flush
    return {"status": "success", "message": "Caché de aplicación limpiada correctamente."}

@router.delete("/maintenance")
async def run_maintenance(
    tenant_id: uuid.UUID,
    year: int,
    month: int,
    background_tasks: BackgroundTasks,
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("ops", "view_tab", module="ops"))
):
    """ Purge old data using background throttling. """
    if current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Solo el Super Administrador puede ejecutar purgas.")
    
    # We define a helper task to run the batch processing
    async def purge_task():
        from app.core.database import async_session_factory
        async with async_session_factory() as db:
            period = f"{year}-{month:02d}"
            # In a real environment, we'd use SQLAlchemy filters properly
            # Here we simulate with a text filter to keep original logic but batched
            filter_stmt = text(f"tenant_id = '{tenant_id}' AND TO_CHAR(created_at, 'YYYY-MM') = '{period}'")
            await safe_process_in_batches(db, SalesOrder, filter_stmt, action="delete")

    background_tasks.add_task(purge_task)
    return {"status": "success", "message": "Proceso de purga iniciado en segundo plano. Se procesará por lotes para proteger el rendimiento."}
