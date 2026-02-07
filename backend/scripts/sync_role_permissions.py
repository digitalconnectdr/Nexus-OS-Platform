import asyncio
import asyncpg
import os
import uuid
from dotenv import load_dotenv

# Load environment variables
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

async def sync():
    if not DATABASE_URL:
        print("❌ DATABASE_URL not found.")
        return 

    print("🔄 Starting Total Permission Synchronization...")
    conn = await asyncpg.connect(DATABASE_URL, statement_cache_size=0)
    
    try:
        async with conn.transaction():
            # 1. Get all organizations
            orgs = await conn.fetch("SELECT id FROM organizations;")
            
            # 2. Get existing permissions to avoid duplicates
            existing = await conn.fetch("SELECT tenant_id, role, resource, action FROM role_permissions;")
            existing_keys = set((str(r['tenant_id']), r['role'], r['resource'], r['action']) for r in existing)
            
            new_records = []
            
            for org in orgs:
                org_id = str(org['id'])
                for role in ROLES:
                    for mod, res, act, label in MASTER_CATALOG:
                        key = (org_id, role, res, act)
                        if key not in existing_keys:
                            # Missing entry detected
                            new_records.append((
                                str(uuid.uuid4()),
                                org['id'], # UUID type
                                role,
                                mod,
                                res,
                                act,
                                label,
                                False # Default to False as requested
                            ))
            
            if new_records:
                print(f"📦 Filling {len(new_records)} gaps in role_permissions matrix...")
                await conn.executemany("""
                    INSERT INTO role_permissions (id, tenant_id, role, module, resource, action, name, is_allowed)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
                """, new_records)
            else:
                print("✅ No gaps found. Matrix is already synchronized.")
                
        print("✨ Synchronization complete.")
    except Exception as e:
        print(f"❌ Error during sync: {e}")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(sync())
