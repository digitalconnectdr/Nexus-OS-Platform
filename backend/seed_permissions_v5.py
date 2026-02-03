import asyncio
import asyncpg
import os
import uuid
from dotenv import load_dotenv

env_path = os.path.join(os.getcwd(), ".env")
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

# (module_key, resource, action, label)
MASTER_CATALOG = [
    ('dashboard', 'sales', 'read', 'Ver Dashboard de Ventas'),
    ('dashboard', 'sales', 'create', 'Botón Nueva Venta'),
    ('dashboard', 'sales', 'update', 'Editar Venta'),
    ('dashboard', 'sales', 'delete', 'Eliminar Venta'),
    ('dashboard', 'sales', 'change_status', 'Cambiar Estatus'),
    ('dashboard', 'sales', 'export', 'Exportar Data Dashboard'),
    ('history', 'sales', 'read_history', 'Ver Historial de Ventas'),
    ('history', 'sales', 'export_history', 'Exportar Historial'),
    ('performance', 'performance', 'read', 'Ver Pestaña Performance'),
    ('performance', 'performance', 'efficiency', 'Ver Eficiencia Operativa'),
    ('performance', 'performance', 'scorecard', 'Ver Scorecard'),
    ('performance', 'performance', 'backoffice', 'Ver Backoffice'),
    ('performance', 'performance', 'reports', 'Generar Reportes Performance'),
    ('performance', 'performance', 'export', 'Exportar Data Performance'),
    ('finance', 'finance', 'read', 'Ver Pestaña Finanzas'),
    ('finance', 'finance', 'results', 'Ver Resultados Financieros'),
    ('finance', 'finance', 'summary', 'Ver Resumen Financiero'),
    ('finance', 'finance', 'payroll', 'Ver Nómina de Comisiones'),
    ('finance', 'finance', 'export', 'Exportar Data Financiera'),
    ('config_campaigns', 'campaigns', 'read', 'Ver Campañas'),
    ('config_campaigns', 'campaigns', 'create', 'Crear Campañas'),
    ('config_campaigns', 'campaigns', 'update', 'Actualizar Campañas'),
    ('config_campaigns', 'campaigns', 'delete', 'Eliminar Campañas'),
    ('config_products', 'products', 'read', 'Ver Productos'),
    ('config_products', 'products', 'create', 'Crear Productos'),
    ('config_products', 'products', 'update', 'Actualizar Productos'),
    ('config_products', 'products', 'delete', 'Eliminar Productos'),
    ('config_goals', 'goals', 'read', 'Ver Metas'),
    ('config_goals', 'goals', 'create', 'Crear Metas'),
    ('config_goals', 'goals', 'update', 'Actualizar Metas'),
    ('config_goals', 'goals', 'delete', 'Eliminar Metas'),
    ('config_statuses', 'statuses', 'read', 'Ver Estados'),
    ('config_statuses', 'statuses', 'create', 'Crear Estados'),
    ('config_users', 'users', 'read', 'Ver Usuarios'),
    ('config_users', 'users', 'create', 'Crear Usuarios'),
    ('config_users', 'users', 'update', 'Editar Usuarios'),
    ('config_users', 'users', 'delete', 'Eliminar Usuarios'),
    ('tournaments', 'tournaments', 'view_module', 'Entrar a Torneos'),
    ('tournaments', 'tournaments', 'create_battle', 'Botón Crear Torneo'),
    ('tournaments', 'tournaments', 'view_race_track', 'Ver Carreras Activas'),
    ('tournaments', 'tournaments', 'arbitration_panel', 'Panel de Arbitraje'),
    ('tournaments', 'tournaments', 'edit', 'Editar Torneo'),
    ('tournaments', 'tournaments', 'delete', 'Borrar Torneo')
]

async def seed():
    if not DATABASE_URL:
         return 

    print("🔍 Starting Role Seed v5.1 (Final Integration)...")
    conn = await asyncpg.connect(DATABASE_URL, statement_cache_size=0)
    
    try:
        async with conn.transaction():
            print("🧹 Truncating role_permissions...")
            await conn.execute("DELETE FROM role_permissions;")
            
            orgs = await conn.fetch("SELECT id FROM organizations;")
            unique_data = {} # (role, resource, action, tenant) -> Row data
            
            for row in orgs:
                org_id = row['id']
                for role in ROLES:
                    for mod, res_name, act, label in MASTER_CATALOG:
                        is_allowed = False
                        
                        if role == "Super Admin": is_allowed = True
                        elif role == "Administrador":
                            is_allowed = True
                            if res_name == "system" and act == "maintenance": is_allowed = False
                        elif role == "Gerente":
                            if mod in ["dashboard", "history", "performance", "finance", "config_users", "tournaments"]: is_allowed = True
                        elif role in ["Supervisor", "Supervisor Senior"]:
                            if mod in ["dashboard", "history", "performance", "config_campaigns", "config_products", "config_goals", "config_statuses", "tournaments"]: is_allowed = True
                            if mod == "finance" and act in ["summary", "read"]: is_allowed = True
                        elif role == "Representante":
                            if mod in ["dashboard", "history"]: is_allowed = True
                            if res_name == "sales" and act == "create": is_allowed = True
                            if mod == "tournaments": is_allowed = True # GIVE AGENTS TOURNAMENT ACCESS
                        
                        key = (role, res_name, act, org_id)
                        if key not in unique_data:
                            unique_data[key] = (str(uuid.uuid4()), org_id, role, mod, res_name, act, label, is_allowed)

            final_data = list(unique_data.values())
            print(f"📦 Inserting {len(final_data)} unique records...")
            
            # Using 'name' (confirmed in models/core.py)
            await conn.executemany("""
                INSERT INTO role_permissions (id, tenant_id, role, module, resource, action, name, is_allowed)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
            """, final_data)
            
        print("✨ Database Seeding v5.1 complete.")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(seed())
