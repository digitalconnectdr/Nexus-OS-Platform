from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.core import UserProfile, RolePolicy, SalesOrder
from typing import List, Optional
import uuid

async def check_user_availability(
    db: AsyncSession, 
    user_id: uuid.UUID, 
    product_name: Optional[str] = None
) -> dict:
    """
    Verifica si un usuario puede tomar más trabajo basado en:
    1. Skill (Especialización de producto)
    2. WIP (Work In Progress) actual basado en su Rol o Excepción Personal.
    """
    
    # 1. Obtener Perfil del Usuario
    result = await db.execute(select(UserProfile).where(UserProfile.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        return {"available": False, "reason": "Usuario no encontrado"}

    # 2. Validar Skill de Producto (si se provee)
    # product_skills es un JSONB (lista de strings)
    if product_name:
        skills = user.product_skills or []
        if skills and product_name not in skills:
            return {
                "available": False, 
                "reason": f"El usuario no tiene el skill para el producto: {product_name}"
            }

    # 3. Obtener Configuración de Ruta para el Rol
    result = await db.execute(select(RolePolicy).where(RolePolicy.role == user.role))
    policy = result.scalar_one_or_none()
    
    # Si no hay política o está desactivada, el ruteo es libre
    if not policy or not policy.smart_routing_enabled:
        return {"available": True, "reason": "Smart Routing desactivado para este rol"}

    # 4. Determinar Límite de Capacidad
    # Prioridad: Excepción Personal > Límite por Defecto del Rol
    max_tasks = int(user.custom_max_tasks) if user.custom_max_tasks is not None else int(policy.default_limit)
    
    # 5. Calcular Carga Actual (WIP)
    # Filtramos por los estatus configurados como "trabajables"
    workable_statuses = policy.workable_statuses or ["PENDIENTE"]
    
    # Counting active sales assigned to the user
    count_query = (
        select(func.count(SalesOrder.id))
        .where(SalesOrder.agent_id == user_id)
        .where(SalesOrder.status.in_(workable_statuses))
    )
    
    count_res = await db.execute(count_query)
    current_load = count_res.scalar() or 0

    if current_load >= max_tasks:
        return {
            "available": False, 
            "reason": f"Capacidad excedida ({current_load}/{max_tasks}). Usuario saturado.",
            "current_load": current_load,
            "max_tasks": max_tasks
        }

    return {
        "available": True, 
        "reason": "Disponible",
        "current_load": current_load,
        "max_tasks": max_tasks
    }
