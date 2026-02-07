import json
import os

# Load the matrix
json_path = 'app/core/jprs_matrix.json'
with open(json_path, 'r', encoding='utf-8') as f:
    matrix = json.load(f)

# Extract all unique permissions across all roles
unique_perms = {} # (module, resource, action) -> name

for role, modules in matrix.items():
    for module, resources in modules.items():
        for resource, actions in resources.items():
            for action_item in actions:
                action = action_item['action']
                name = action_item['name']
                key = (module, resource, action)
                if key not in unique_perms:
                    unique_perms[key] = name

# Total count
print(f"Total unique permissions found: {len(unique_perms)}")

# Standardize names
catalog_lines = []
for (mod, res, act), name in sorted(unique_perms.items()):
    catalog_lines.append(f"    ('{mod}', '{res}', '{act}', '{name}'),")

# Generate the file
output_path = 'app/core/permissions_catalog.py'

roles_list = list(matrix.keys())

# Build DEFAULT_MAPPING
default_mapping_dict = {}
for role, modules in matrix.items():
    default_mapping_dict[role] = {}
    for module, resources in modules.items():
        for resource, actions in resources.items():
            for action_item in actions:
                action = action_item['action']
                is_allowed = action_item['is_allowed']
                default_mapping_dict[role][(module, resource, action)] = is_allowed

mapping_lines = []
for role, perms in default_mapping_dict.items():
    mapping_lines.append(f"    '{role}': {{")
    for (mod, res, act), is_allowed in perms.items():
        mapping_lines.append(f"        ('{mod}', '{res}', '{act}'): {is_allowed},")
    mapping_lines.append("    },")

content = f"""# This file is auto-generated from jprs_matrix.json
# It serves as the master source for all system permissions.

ROLES = {roles_list}

MASTER_CATALOG = [
{"\n".join(catalog_lines)}
]

# Default is_allowed mapping for each role
DEFAULT_MAPPING = {{
{"\n".join(mapping_lines)}
}}
"""

with open(output_path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Updated {output_path}")
