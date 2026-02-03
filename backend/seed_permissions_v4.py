import asyncio
import uuid
import os
import asyncpg
from dotenv import load_dotenv

# Load .env
base_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(base_dir, '.env')
if os.path.exists(env_path):
    load_dotenv(env_path)

DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL and DATABASE_URL.startswith("postgresql+asyncpg://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")

ROLES = [
    "Super Admin", "Administrador", "Cliente", "Gerente",
    "Supervisor Senior", "Supervisor", "Dpto Estadistica",
    "Auditor Calidad", "Seguimiento", "Digitación", "Representante"
]

MASTER_CATALOG = [
    ('DASHBOARD', 'dashboard', 'view', 'Acceso a Pestaña Dashboard'),
    ('DASHBOARD', 'dashboard', 'filters', 'Búsqueda Avanzada'),
    ('DASHBOARD', 'dashboard', 'export', 'Botón Exportar Data'),
    ('DASHBOARD', 'sales', 'create', 'Botón Nueva Venta (Registrar)'),
    ('DASHBOARD', 'sales', 'update', 'Editar Venta Registrada'),
    ('DASHBOARD', 'sales', 'delete', 'Eliminar Venta Registrada'),
    ('DASHBOARD', 'sales', 'change_status', 'Cambiar Estatus de Venta'),
    ('HISTORY', 'history', 'view', 'Acceso a Pestaña Historial'),
    ('HISTORY', 'history', 'charts', 'Ver Análisis (Gráficos)'),
    ('HISTORY', 'history', 'filters', 'Búsqueda Avanzada'),
    ('HISTORY', 'history', 'export', 'Botón Exportar Historial'),
    ('HISTORY', 'history_sales', 'update', 'Editar Venta Registrada'),
    ('HISTORY', 'history_sales', 'delete', 'Eliminar Venta Registrada'),
    ('HISTORY', 'history_sales', 'change_status', 'Cambiar Estatus de Venta'),
    ('PERFORMANCE', 'performance', 'view', 'Acceso al Módulo'),
    ('PERFORMANCE', 'performance', 'scorecard', 'Ver Scorecard Agentes'),
    ('PERFORMANCE', 'performance', 'backoffice', 'Ver Digitación & Backoffice'),
    ('PERFORMANCE', 'performance', 'efficiency', 'Ver Eficiencia Operativa'),
    ('PERFORMANCE', 'performance', 'reports', 'Botón Reporte de Ventas'),
    ('FINANCE', 'finance', 'view', 'Acceso al Módulo'),
    ('FINANCE', 'finance', 'results', 'Ver Resultados Financieros'),
    ('FINANCE', 'finance', 'payroll', 'Ver Nómina de Comisiones'),
    ('FINANCE', 'finance', 'management', 'Ver Visión Gerencial'),
    ('FINANCE', 'finance', 'export', 'Botón Exportar Finanzas'),
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
    ('USERS_MANAGER', 'users_manager', 'view_tab', 'Pestaña Gestión Usuarios'),
    ('USERS_MANAGER', 'users', 'create', 'Botón Nuevo Usuario'),
    ('USERS_MANAGER', 'users', 'update', 'Botón Edición de Usuarios'),
    ('USERS_MANAGER', 'users', 'change_password', 'Botón Cambiar Contraseña'),
    ('USERS_MANAGER', 'users', 'block', 'Botón Bloquear Usuario'),
    ('USERS_MANAGER', 'users', 'delete', 'Botón Eliminar Usuario'),
    ('USERS_MANAGER', 'users', 'view_deleted', 'Botón Ver Eliminados'),
    ('PERMISSIONS', 'permissions', 'view_tab', 'Pestaña Matriz Permisos'),
    ('PERMISSIONS', 'permissions', 'update', 'Edición de Permisos'),
    ('ORGANIZATIONS', 'organizations', 'view_tab', 'Pestaña Organizaciones'),
    ('ORGANIZATIONS', 'organizations', 'create', 'Botón Nueva Organización'),
    ('ORGANIZATIONS', 'organizations', 'update', 'Edición de Organizaciones'),
    ('ORGANIZATIONS', 'organizations', 'delete', 'Eliminar Organizaciones'),
    ('COMPETENCIAS', 'tournaments', 'view_module', 'Ver Pestaña de Torneos'),
    ('COMPETENCIAS', 'tournaments', 'create_battle', 'Crear Nueva Batalla'),
    ('COMPETENCIAS', 'tournaments', 'edit', 'Editar Competencias'),
    ('COMPETENCIAS', 'tournaments', 'delete', 'Eliminar Competencias'),
    ('COMPETENCIAS', 'tournaments', 'view_race_track', 'Ver Pista de Carreras'),
    ('COMPETENCIAS', 'tournaments', 'arbitration_panel', 'Botón de Arbitraje'),
    ('OPS', 'ops', 'view_tab', 'Acceso a Estado del Sistema'),
]

async def seed():
    if not DATABASE_URL:
        print("❌ DATABASE_URL not found")
        return

    print("🔍 Starting Role Seed (Direct asyncpg)...")
    conn = await asyncpg.connect(DATABASE_URL, statement_cache_size=0)
    
    try:
        async with conn.transaction():
            print("🧹 Truncating role_permissions...")
            await conn.execute("DELETE FROM role_permissions;")
            
            orgs = await conn.fetch("SELECT id FROM organizations;")
            print(f"🏢 Orgs found: {len(orgs)}")
            
            data = []
            for row in orgs:
                org_id = row['id']
                for role in ROLES:
                    for mod, res_name, act, label in MASTER_CATALOG:
                        is_allowed = False
                        
                        if role in ["Super Admin", "Administrador"]:
                            is_allowed = True
                            if role == "Administrador" and mod == "OPS" and act == "maintenance":
                                is_allowed = False
                        elif role == "Gerente":
                            if mod in ["DASHBOARD", "HISTORY", "PERFORMANCE", "FINANCE", "USERS_MANAGER"]:
                                is_allowed = True
                        elif role in ["Representante", "Digitación", "Seguimiento", "Auditor Calidad"]:
                            if mod in ["DASHBOARD", "HISTORY", "PERFORMANCE"]:
                                is_allowed = True
                                if role == "Auditor Calidad" and act in ["create", "update", "delete"]:
                                    is_allowed = False
                        
                        data.append((
                            str(uuid.uuid4()),
                            org_id,
                            role,
                            mod,
                            res_name,
                            act,
                            label,
                            is_allowed
                        ))
            
            print(f"📦 Inserting {len(data)} records...")
            await conn.executemany("""
                INSERT INTO role_permissions (id, tenant_id, role, module, resource, action, name, is_allowed)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
            """, data)
            
        print("✨ Database Seeding complete.")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(seed())
