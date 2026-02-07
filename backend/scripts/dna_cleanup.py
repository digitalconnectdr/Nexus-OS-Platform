
import sys
import os

# Set up paths
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.core.permissions_catalog import MASTER_CATALOG, ROLES

# Rules for final polish:
# 1. Purge redundant dashboard/system deletions for catalogs (already done, but let's be explicit).
# 2. Align system:users actions for the Admin Table.
# 3. Align config_hub:users actions for the Operatividad Table.

EXCLUDE = [
    ('dashboard', 'campaigns', 'delete'),
    ('dashboard', 'goals', 'delete'),
    ('dashboard', 'products', 'delete'),
    ('system', 'campaigns', 'delete'),
    ('system', 'campaigns', 'read'),
    ('system', 'campaigns', 'write'),
]

# Mandatory system:users alignment
MANDATORY = [
    ('system', 'users', 'create', 'Crear Usuarios'),
    ('system', 'users', 'read', 'Ver Usuarios'),
    ('system', 'users', 'update', 'Editar Usuarios'),
    ('system', 'users', 'delete', 'Eliminar Usuarios'),
    ('system', 'users', 'manage', 'Gestionar Seguridad Usuarios'),
    ('system', 'users', 'export', 'Exportar Usuarios'),
    
    ('config_hub', 'users', 'update', 'Editar Operatividad'),
    ('config_hub', 'users', 'read', 'Ver Operatividad'),
]

cleaned_catalog = []
unique_keys = set()

# First pass: Mandatory
for mod, res, act, name in MANDATORY:
    key = (mod, res, act)
    cleaned_catalog.append((mod, res, act, name))
    unique_keys.add(key)

# Second pass: Catalog (skipping excluded and duplicates of mandatory)
for mod, res, act, name in MASTER_CATALOG:
    # Skip excluded
    if (mod, res, act) in EXCLUDE:
        continue
    
    # Skip reservations
    if mod == 'system_reserved':
        continue
        
    key = (mod, res, act)
    if key not in unique_keys:
        cleaned_catalog.append((mod, res, act, name))
        unique_keys.add(key)

# Re-add reservations to reach exactly 99
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

print(f"DNA Polishing complete. {len(cleaned_catalog)} permissions saved with aligned user actions.")
