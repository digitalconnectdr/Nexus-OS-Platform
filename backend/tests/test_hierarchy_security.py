import asyncio
import httpx
import sys
import os
import uuid
from typing import Any

# Añadir path del backend
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.main import app
from app.core.security import get_current_user
from app.models.core import UserProfile
from app.schemas.core import UserRole
from app.core.database import SessionLocal
from sqlalchemy import select

async def get_test_users():
    async with SessionLocal() as db:
        # Usamos usuarios conocidos que existen en el entorno
        admin = (await db.execute(select(UserProfile).where(UserProfile.email == "audit_test@demo.com").limit(1))).scalar()
        super_admin = (await db.execute(select(UserProfile).where(UserProfile.email == "jcpenalo@gmail.com").limit(1))).scalar()
        
        if not admin or not super_admin:
            # Fallback a búsqueda por rol si fallan los correos
            admin = (await db.execute(select(UserProfile).where(UserProfile.role.ilike("%Admin%"), UserProfile.role != "Super Admin").limit(1))).scalar()
            super_admin = (await db.execute(select(UserProfile).where(UserProfile.role.ilike("%Super%")).limit(1))).scalar()
            
        if not admin or not super_admin:
            raise Exception("Se requieren un Administrador y un Super Admin en la DB para esta prueba.")
            
        return admin, super_admin

async def run_hierarchy_test():
    print("Iniciando Prueba de Seguridad de Jerarquía...\n")
    
    admin, super_admin = await get_test_users()
    results = []

    # --- SESSION: ADMINISTRADOR ---
    print(f"--- Probando como ADMINISTRADOR ({admin.email}) ---")
    app.dependency_overrides[get_current_user] = lambda: admin
    
    async with httpx.AsyncClient(app=app, base_url="http://test") as ac:
        
        # 1. Regla Stealth: No ver Super Admins
        resp1 = await ac.get("/api/v1/users/")
        users = resp1.json().get("items", [])
        super_admins_found = [u for u in users if u["role"] == "Super Admin"]
        results.append({
            "REGLA": "Modo Stealth (User List)",
            "DETALLE": "Ver Super Admins como Admin",
            "ESPERADO": "0 Encontrados",
            "OBTENIDO": f"{len(super_admins_found)} Encontrados",
            "ESTADO": "✅ PASS" if len(super_admins_found) == 0 else "❌ FALLO"
        })

        # 2. Regla Visibilidad Permisos: Solo ver los propios
        # resp2 = await ac.get("/api/v1/permissions/")
        # matrix = resp2.json() # { "SYSTEM": { "users": [...] }, ... }
        # roles_in_matrix = set()
        # for module_name, resources in matrix.items():
        #     if isinstance(resources, dict):
        #         for res_name, perms in resources.items():
        #             for perm in perms:
        #                 roles_in_matrix.add(perm["role"])
        
        results.append({
            "REGLA": "Visibilidad Permisos (Matrix)",
            "DETALLE": "Auditada manualmente",
            "ESPERADO": "Solo ver propios",
            "OBTENIDO": "Pendiente de Seed",
            "ESTADO": "⚠️ SKIPPED"
        })

        # 3. Regla Anti-Escalamiento: No crear Super Admin
        payload3 = {
            "email": f"hacked_{uuid.uuid4().hex[:4]}@demo.com",
            "password": "Password123!",
            "first_name": "Hacker",
            "last_name": "Pro",
            "role": "Super Admin",
            "tenant_id": str(admin.tenant_id)
        }
        resp3 = await ac.post("/api/v1/users/", json=payload3)
        results.append({
            "REGLA": "Anti-Escalamiento (Create)",
            "DETALLE": "Admin crea Super Admin",
            "ESPERADO": "403 Forbidden",
            "OBTENIDO": f"{resp3.status_code}",
            "ESTADO": "✅ PASS" if resp3.status_code == 403 else "❌ FALLO"
        })

    # --- SESSION: SUPER ADMIN ---
    print(f"\n--- Probando como SUPER ADMIN ({super_admin.email}) ---")
    app.dependency_overrides[get_current_user] = lambda: super_admin
    
    async with httpx.AsyncClient(app=app, base_url="http://test") as ac:
        
        # 4. Super Admin ve todo
        resp4 = await ac.get("/api/v1/users/")
        users_sa = resp4.json().get("items", [])
        sa_present = any(u["role"] == "Super Admin" for u in users_sa)
        results.append({
            "REGLA": "Visibilidad SA",
            "DETALLE": "SA ve a otros SA",
            "ESPERADO": "SÍ",
            "OBTENIDO": "SÍ" if sa_present else "NO",
            "ESTADO": "✅ PASS" if sa_present else "❌ FALLO"
        })

    # Imprimir Reporte
    print("\n" + "="*80)
    print(f"{'REGLA':<30} | {'ESPERADO':<15} | {'OBTENIDO':<15} | {'ESTADO'}")
    print("-" * 80)
    for r in results:
        print(f"{r['REGLA']:<30} | {r['ESPERADO']:<15} | {r['OBTENIDO']:<15} | {r['ESTADO']}")
    print("="*80)

    app.dependency_overrides.clear()

if __name__ == "__main__":
    asyncio.run(run_hierarchy_test())
