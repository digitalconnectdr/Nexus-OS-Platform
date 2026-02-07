
import os
import sys

# Ensure we can import from app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.core.permissions_catalog import MASTER_CATALOG, ROLES

def to_title_case_es(act, res):
    # Mapping for actions
    action_map = {
        'delete': 'Eliminar',
        'read': 'Ver',
        'write': 'Editar',
        'update': 'Editar',
        'create': 'Crear',
        'export': 'Exportar',
        'change_status': 'Cambiar Estatus',
        'export_history': 'Exportar Historial',
        'read_history': 'Ver Historial',
        'payroll': 'Gestionar Nómina',
        'results': 'Ver Resultados',
        'summary': 'Ver Resumen',
        'backoffice': 'Panel Backoffice',
        'efficiency': 'Eficiencia Operativa',
        'reports': 'Reportes Especiales',
        'scorecard': 'Tablero de Puntuación',
        'create_battle': 'Crear Torneo',
        'edit': 'Editar Torneo',
        'view_module': 'Entrar al Módulo',
        'view_race_track': 'Ver Carreras en Vivo',
        'arbitration_panel': 'Panel de Arbitraje'
    }
    
    # Mapping for resources (English to Spanish)
    resource_map = {
        'evaluations': 'Evaluaciones',
        'scorecards': 'Tableros',
        'conversations': 'Conversaciones',
        'history': 'Historial',
        'campaigns': 'Campañas',
        'goals': 'Objetivos',
        'products': 'Productos',
        'statuses': 'Estatus',
        'users': 'Usuarios',
        'sales': 'Ventas',
        'finance': 'Finanzas',
        'performance': 'Desempeño',
        'audit_logs': 'Logs de Auditoría',
        'roles_matrix': 'Matriz de Roles',
        'tournaments': 'Torneos',
        'reserved': 'Reserva'
    }

    prefix = action_map.get(act, act.replace('_', ' ').capitalize())
    suffix = resource_map.get(res, res.replace('_', ' ').capitalize())
    
    # Custom combinations
    if act == 'view_module':
        return f"Entrar al Módulo: {suffix}"
    if act.startswith('action_'):
        return f"Reserva Técnica {act.split('_')[1]}"
    
    return f"{prefix} {suffix}"

new_catalog_set = set()

for mod, res, act, old_name in MASTER_CATALOG:
    new_mod = mod
    
    # 1. Salestrack -> Dashboard
    if mod == 'salestrack':
        new_mod = 'dashboard'
        
    # 2. Config Category Hub
    if mod in ['config_campaigns', 'config_goals', 'config_products', 'config_statuses', 'config_users']:
        new_mod = 'config_hub'
        
    # 3. Dev Modules
    if mod in ['calidad', 'chat']:
        new_mod = 'dev_modules'
        
    # Generate Title Case Name
    new_name = to_title_case_es(act, res)
    
    new_catalog_set.add((new_mod, res, act, new_name))

# Enforce exactly 99 by adding reservations if needed
current_count = len(new_catalog_set)
if current_count < 99:
    for i in range(10, 10 + (99 - current_count)):
        new_catalog_set.add(('system_reserved', 'reserved', f'action_{i}', f'Reserva Técnica {i}'))

# Sorting remains important for consistency but we will handle the UI order in the frontend
# However, we keep them sorted by module in the file
new_catalog = sorted(list(new_catalog_set))

# Output to permissions_catalog.py
output_path = 'app/core/permissions_catalog.py'
with open(output_path, 'w', encoding='utf-8') as f:
    f.write(f"# This file is the SINGLE SOURCE OF TRUTH for system permissions.\n")
    f.write(f"ROLES = {ROLES}\n\n")
    f.write(f"MASTER_CATALOG = [\n")
    for m, r, a, n in new_catalog:
        f.write(f"    ('{m}', '{r}', '{a}', '{n}'),\n")
    f.write(f"]\n\n")
    f.write(f"DEFAULT_MAPPING = {{}}\n")

print(f"Updated {output_path} with consolidated structure.")
