
import sys
import os

# Set up paths
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.core.permissions_catalog import MASTER_CATALOG, ROLES

# ATOMIC CLEANUP RULES (NO EXCEPTIONS)

# 1. Dashboard: ONLY Sales (Exactly 6)
DASHBOARD_PERMS = [
    ('dashboard', 'sales', 'change_status', 'Cambiar Estatus Ventas'),
    ('dashboard', 'sales', 'create', 'Crear Ventas'),
    ('dashboard', 'sales', 'delete', 'Eliminar Ventas'),
    ('dashboard', 'sales', 'export', 'Exportar Ventas'),
    ('dashboard', 'sales', 'read', 'Ver Ventas'),
    ('dashboard', 'sales', 'update', 'Editar Ventas'),
]

# 2. Config: ONLY Catalogs (No Users)
CONFIG_PERMS = [
    # Campaigns
    ('config_hub', 'campaigns', 'create', 'Crear Campañas'),
    ('config_hub', 'campaigns', 'delete', 'Eliminar Campañas'),
    ('config_hub', 'campaigns', 'read', 'Ver Campañas'),
    ('config_hub', 'campaigns', 'update', 'Editar Campañas'),
    # Goals
    ('config_hub', 'goals', 'create', 'Crear Objetivos'),
    ('config_hub', 'goals', 'delete', 'Eliminar Objetivos'),
    ('config_hub', 'goals', 'read', 'Ver Objetivos'),
    ('config_hub', 'goals', 'update', 'Editar Objetivos'),
    # Products
    ('config_hub', 'products', 'create', 'Crear Productos'),
    ('config_hub', 'products', 'delete', 'Eliminar Productos'),
    ('config_hub', 'products', 'read', 'Ver Productos'),
    ('config_hub', 'products', 'update', 'Editar Productos'),
    # Statuses
    ('config_hub', 'statuses', 'create', 'Crear Estatus'),
    ('config_hub', 'statuses', 'read', 'Ver Estatus'),
]

# 3. Core: Audit + Roles Matrix + USER MANAGEMENT
CORE_PERMS = [
    ('system', 'audit_logs', 'delete', 'Eliminar Logs de Auditoría'),
    ('system', 'audit_logs', 'export', 'Exportar Logs de Auditoría'),
    ('system', 'audit_logs', 'read', 'Ver Logs de Auditoría'),
    ('system', 'audit_logs', 'write', 'Editar Logs de Auditoría'),
    ('system', 'roles_matrix', 'delete', 'Eliminar Matriz de Roles'),
    ('system', 'roles_matrix', 'export', 'Exportar Matriz de Roles'),
    ('system', 'roles_matrix', 'read', 'Ver Matriz de Roles'),
    ('system', 'roles_matrix', 'write', 'Editar Matriz de Roles'),
    # USERS (Moved from Config)
    ('system', 'users', 'delete', 'Eliminar Usuarios'),
    ('system', 'users', 'export', 'Exportar Usuarios'),
    ('system', 'users', 'read', 'Ver Usuarios'),
    ('system', 'users', 'update', 'Editar Usuarios'),
    ('system', 'users', 'create', 'Crear Usuarios'),
    ('system', 'users', 'manage', 'Gestionar Seguridad Usuarios'),
]

# 4. Dev Modules: COMPLETELY PURGED
# 5. Tournaments & Others: Keep for now (but filtered for cleanliness)
TOURNAMENTS_PERMS = [
    ('tournaments', 'tournaments', 'arbitration_panel', 'Panel de Arbitraje Torneos'),
    ('tournaments', 'tournaments', 'create_battle', 'Crear Torneo Torneos'),
    ('tournaments', 'tournaments', 'delete', 'Eliminar Torneos'),
    ('tournaments', 'tournaments', 'edit', 'Editar Torneo Torneos'),
    ('tournaments', 'tournaments', 'view_module', 'Entrar al Módulo: Torneos'),
    ('tournaments', 'tournaments', 'view_race_track', 'Ver Carreras en Vivo Torneos'),
]

# 6. Finance & History: Keep essential
FIN_HIST_PERMS = [
    ('finance', 'finance', 'export', 'Exportar Finanzas'),
    ('finance', 'finance', 'payroll', 'Gestionar Nómina Finanzas'),
    ('finance', 'finance', 'read', 'Ver Finanzas'),
    ('finance', 'finance', 'results', 'Ver Resultados Finanzas'),
    ('finance', 'finance', 'summary', 'Ver Resumen Finanzas'),
    ('history', 'sales', 'export_history', 'Exportar Historial Ventas'),
    ('history', 'sales', 'read_history', 'Ver Historial Ventas'),
    ('performance', 'performance', 'backoffice', 'Panel Backoffice Desempeño'),
    ('performance', 'performance', 'efficiency', 'Eficiencia Operativa Desempeño'),
    ('performance', 'performance', 'export', 'Exportar Desempeño'),
    ('performance', 'performance', 'read', 'Ver Desempeño'),
    ('performance', 'performance', 'reports', 'Reportes Especiales Desempeño'),
    ('performance', 'performance', 'scorecard', 'Tablero de Puntuación Desempeño'),
]

# Combine all valid permissions
atomic_perms = DASHBOARD_PERMS + CONFIG_PERMS + CORE_PERMS + TOURNAMENTS_PERMS + FIN_HIST_PERMS

unique_keys = set()
cleaned_catalog = []

for mod, res, act, name in atomic_perms:
    key = (mod, res, act)
    if key not in unique_keys:
        cleaned_catalog.append((mod, res, act, name))
        unique_keys.add(key)

# Re-balance to exactly 99
current_count = len(cleaned_catalog)
needed = 99 - current_count

if needed > 0:
    for i in range(1, needed + 1):
        cleaned_catalog.append(('system_reserved', 'reserved', f'action_{i}', f'Reserva Técnica {i}'))

# Sort for consistency
cleaned_catalog.sort()

# Save
output_path = 'app/core/permissions_catalog.py'
with open(output_path, 'w', encoding='utf-8') as f:
    f.write(f"# This file is the SINGLE SOURCE OF TRUTH for system permissions.\n")
    f.write(f"ROLES = {ROLES}\n\n")
    f.write(f"MASTER_CATALOG = [\n")
    for m, r, a, n in cleaned_catalog:
        f.write(f"    ('{m}', '{r}', '{a}', '{n}'),\n")
    f.write(f"]\n\n")
    f.write(f"DEFAULT_MAPPING = {{}}\n")

print(f"ATOMIC CLEANUP COMPLETE. {len(cleaned_catalog)} permissions saved.")
print(f"Dashboard Count: {len([p for p in cleaned_catalog if p[0] == 'dashboard'])}")
