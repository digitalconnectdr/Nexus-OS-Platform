import asyncio
import os
import sys
import uuid
from typing import List, Dict

# Añadir el path del backend para importar los modelos
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from sqlalchemy import select, delete
from app.api.deps import get_db
from app.models.core import RolePermission
from app.schemas.core import UserRole
from app.database import AsyncSessionLocal

# Matriz de roles y recursos a probar
# Estructura: ROLE -> { RESOURCE -> [ACTIONS] }
PERMISSION_SCENARIOS = {
    "Administrador": {
        "sales": ["read", "write", "export"],
        "finance": ["read_global", "export"],
        "operational": ["read", "export"],
        "users": ["read", "write"],
        "permissions": ["read"],
        "organizations": ["read"]
    },
    "Cliente": {
        "sales": ["read"],
        "operational": ["read"]
        # No debe ver Users, Permissions, Finance Global, Organizations
    },
    "Gerente": {
        "sales": ["read", "write", "export", "approve"],
        "finance": ["read_global", "export"],
        "operational": ["read", "export"],
        "users": ["read"]
    },
    "Supervisor Senior": {
        "sales": ["read", "write", "export"],
        "operational": ["read"],
        "finance": ["read_own"]
    },
    "Supervisor": {
        "sales": ["read", "write"],
        "operational": ["read"],
        "finance": ["read_own"]
    },
    "Dpto Estadistica": {
        "sales": ["read", "export"],
        "operational": ["read", "export"]
    },
    "Auditor Calidad": {
        "sales": ["read", "approve"],
        "operational": ["read"]
    },
    "Seguimiento": {
        "sales": ["read", "update"]
    },
    "Digitación": {
        "sales": ["create", "update", "read"]
    },
    "Representante": {
        "sales": ["read_own"],
        "finance": ["read_own"]
    }
}

async def setup_test_permissions():
    print("🚀 Configurando Matriz de Permisos para Auditoría QA...")
    
    async with AsyncSessionLocal() as db:
        # 1. Limpiar permisos existentes de estos roles (excepto Super Admin)
        roles_to_clean = list(PERMISSION_SCENARIOS.keys())
        await db.execute(delete(RolePermission).where(RolePermission.role.in_(roles_to_clean)))
        
        # 2. Inyectar nuevos permisos según el escenario
        for role, resources in PERMISSION_SCENARIOS.items():
            print(f"   - Configurando '{role}'...")
            for resource, actions in resources.items():
                for action in actions:
                    new_perm = RolePermission(
                        id=uuid.uuid4(),
                        role=role,
                        resource=resource,
                        action=action,
                        module="SYSTEM" if resource in ["users", "permissions", "organizations"] else "BUSINESS",
                        is_allowed=True
                    )
                    db.add(new_perm)
        
        await db.commit()
        print("✅ Matriz de Permisos actualizada exitosamente.")

if __name__ == "__main__":
    asyncio.run(setup_test_permissions())
