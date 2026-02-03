import asyncio
import uuid
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from dotenv import load_dotenv

# Load .env
base_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(base_dir, '.env')
if os.path.exists(env_path):
    load_dotenv(env_path)

DATABASE_URL = os.getenv("DATABASE_URL")

ROLES = [
    "Super Admin", "Administrador", "Cliente", "Gerente",
    "Supervisor Senior", "Supervisor", "Dpto Estadistica",
    "Auditor Calidad", "Seguimiento", "Digitación", "Representante"
]

# (Module, Resource, Action, Name/Label)
MASTER_CATALOG = [
    # DASHBOARD
    ('DASHBOARD', 'dashboard', 'view', 'Acceso a Pestaña Dashboard'),
    ('DASHBOARD', 'dashboard', 'filters', 'Uso de Filtros Avanzados'),
    ('DASHBOARD', 'dashboard', 'export', 'Botón Exportar Data'),
    ('DASHBOARD', 'sales', 'create', 'Botón Nueva Venta (Registrar)'),
    ('DASHBOARD', 'sales', 'update', 'Editar Venta Registrada'),
    ('DASHBOARD', 'sales', 'delete', 'Eliminar Venta Registrada'),
    ('DASHBOARD', 'sales', 'change_status', 'Cambiar Estatus de Venta'),
    # HISTORY
    ('HISTORY', 'history', 'view', 'Acceso a Pestaña Historial'),
    ('HISTORY', 'history', 'charts', 'Ver Gráficos'),
    ('HISTORY', 'history', 'filters', 'Uso de Filtros'),
    ('HISTORY', 'history', 'export', 'Botón Exportar Historial'),
    # PERFORMANCE
    ('PERFORMANCE', 'performance', 'view', 'Acceso al Módulo'),
    ('PERFORMANCE', 'performance', 'scorecard', 'Ver Scorecard Agentes'),
    ('PERFORMANCE', 'performance', 'backoffice', 'Ver Digitación & Backoffice'),
    ('PERFORMANCE', 'performance', 'efficiency', 'Ver Eficiencia Operativa'),
    ('PERFORMANCE', 'performance', 'reports', 'Botón Reporte de Ventas'),
    # FINANCE
    ('FINANCE', 'finance', 'view', 'Acceso al Módulo'),
    ('FINANCE', 'finance', 'results', 'Ver Resultados Financieros'),
    ('FINANCE', 'finance', 'payroll', 'Ver Nómina de Comisiones'),
    ('FINANCE', 'finance', 'management', 'Ver Visión Gerencial'),
    ('FINANCE', 'finance', 'export', 'Botón Exportar Finanzas'),
    # CONFIG
    ('CONFIG_CAMPAIGNS', 'campaigns', 'view_tab', 'Pestaña Campañas'),
    ('CONFIG_CAMPAIGNS', 'campaigns', 'create', 'Botón Nueva Campaña'),
    ('CONFIG_CAMPAIGNS', 'campaigns', 'manage', 'Editar/Borrar Campañas'),
    ('CONFIG_PRODUCTS', 'products', 'view_tab', 'Pestaña Productos'),
    ('CONFIG_PRODUCTS', 'products', 'create', 'Botón Nuevo Producto'),
    ('CONFIG_PRODUCTS', 'products', 'update', 'Editar Productos'),
    ('CONFIG_PRODUCTS', 'products', 'delete', 'Eliminar Productos'),
    ('CONFIG_PRODUCTS', 'products', 'export', 'Botón Exportar Todo'),
    ('CONFIG_PRODUCTS', 'products', 'import', 'Botón Carga Masiva'),
    ('CONFIG_GOALS', 'goals', 'create', 'Botón Nuevo Objetivo'),
    ('CONFIG_GOALS', 'goals', 'update', 'Editar Objetivos'),
    ('CONFIG_GOALS', 'goals', 'delete', 'Eliminar Objetivos'),
    ('CONFIG_STATUSES', 'statuses', 'view_tab', 'Pestaña Estatus'),
    ('CONFIG_STATUSES', 'statuses', 'create', 'Botón Nuevo Estatus'),
    ('CONFIG_STATUSES', 'statuses', 'update', 'Editar Estatus'),
    ('CONFIG_STATUSES', 'statuses', 'delete', 'Eliminar Estatus'),
    ('CONFIG_USERS', 'config_users', 'view_tab', 'Pestaña Usuarios (Config)'),
    ('CONFIG_USERS', 'config_users', 'manage', 'Gestión de Usuarios (Config)'),
    ('CONFIG_POLICIES', 'policies', 'view_tab', 'Pestaña Políticas de Rol'),
    # USERS
    ('USERS_MANAGER', 'users_manager', 'view_tab', 'Pestaña Gestión Usuarios'),
    ('USERS_MANAGER', 'users', 'create', 'Botón Nuevo Usuario'),
    ('USERS_MANAGER', 'users', 'update', 'Botón Edición de Usuarios'),
    ('USERS_MANAGER', 'users', 'change_password', 'Botón Cambiar Contraseña'),
    ('USERS_MANAGER', 'users', 'block', 'Botón Bloquear Usuario'),
    ('USERS_MANAGER', 'users', 'delete', 'Botón Eliminar Usuario'),
    ('USERS_MANAGER', 'users', 'view_deleted', 'Botón Ver Eliminados'),
    # ADMIN
    ('PERMISSIONS', 'permissions', 'view_tab', 'Pestaña Matriz Permisos'),
    ('PERMISSIONS', 'permissions', 'update', 'Edición de Permisos'),
    ('ORGANIZATIONS', 'organizations', 'view_tab', 'Pestaña Organizaciones'),
    ('ORGANIZATIONS', 'organizations', 'create', 'Botón Nueva Organización'),
    ('ORGANIZATIONS', 'organizations', 'update', 'Edición de Organizaciones'),
    ('ORGANIZATIONS', 'organizations', 'delete', 'Eliminar Organizaciones'),
    # OPS
    ('OPS', 'ops', 'view_tab', 'Acceso a Estado del Sistema'),
    ('OPS', 'ops', 'monitor', 'Ver Métricas de Infraestructura'),
    ('OPS', 'ops', 'maintenance', 'Ejecutar Purga de Datos'),
]

async def seed():
    engine = create_async_engine(DATABASE_URL)
    AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with AsyncSessionLocal() as session:
        # 1. Truncate
        print("🧹 Truncating role_permissions...")
        await session.execute(text("DELETE FROM role_permissions;"))
        
        # 2. Get Orgs
        res = await session.execute(text("SELECT id FROM organizations;"))
        orgs = [row[0] for row in res]
        print(f"🏢 Orgs found: {len(orgs)}")
        
        # 3. Build Inserts
        to_insert = []
        for org_id in orgs:
            for role in ROLES:
                for mod, res_name, act, label in MASTER_CATALOG:
                    is_allowed = False
                    
                    # Safety logic
                    if role in ["Super Admin", "Admin", "Administrador"]:
                        is_allowed = True
                        if (role in ["Admin", "Administrador"]) and mod == "OPS" and act == "maintenance":
                            is_allowed = False
                    elif role in ["Gerente", "Manager"]:
                        if mod in ["DASHBOARD", "HISTORY", "PERFORMANCE", "FINANCE", "USERS_MANAGER"]:
                            is_allowed = True
                    elif role in ["Representante", "Agent", "QA"]:
                        if mod in ["DASHBOARD", "HISTORY", "PERFORMANCE"]:
                            is_allowed = True
                            if role == "QA" and act in ["create", "update", "delete"]:
                                is_allowed = False
                    
                    to_insert.append({
                        "id": str(uuid.uuid4()),
                        "tenant_id": org_id,
                        "role": role,
                        "module": mod,
                        "resource": res_name,
                        "action": act,
                        "name": label,
                        "is_allowed": is_allowed
                    })
        
        print(f"📦 Inserting {len(to_insert)} records...")
        # Chunked insert
        query = text("""
            INSERT INTO role_permissions (id, tenant_id, role, module, resource, action, name, is_allowed)
            VALUES (:id, :tenant_id, :role, :module, :resource, :action, :name, :is_allowed);
        """)
        for i in range(0, len(to_insert), 500):
            chunk = to_insert[i:i+500]
            for record in chunk:
                await session.execute(query, record)
        
        await session.commit()
    print("✅ Seed complete.")

if __name__ == "__main__":
    asyncio.run(seed())
