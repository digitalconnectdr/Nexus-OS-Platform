import json
import os

# Load jprs_matrix.json
jprs_path = 'backend/app/core/jprs_matrix.json'
with open(jprs_path, 'r', encoding='utf-8') as f:
    jprs_data = json.load(f)

# Load rbac_output.json (UTF-16)
rbac_path = 'rbac_output.json'
with open(rbac_path, 'r', encoding='utf-16') as f:
    rbac_data = json.load(f)

unique_catalog = {} # (module, resource, action) -> name

# Process jprs_data
for role, modules in jprs_data.items():
    for module, resources in modules.items():
        for resource, actions in resources.items():
            for action_item in actions:
                key = (module.lower(), resource.lower(), action_item['action'].lower())
                if key not in unique_catalog:
                    unique_catalog[key] = action_item['name']

# Process rbac_data (Module -> Resource -> List)
for module, resources in rbac_data.items():
    for resource, actions in resources.items():
        for action_item in actions:
            # action_item here seems to be a dict with 'action', 'name', etc.
            key = (module.lower(), resource.lower(), action_item['action'].lower())
            if key not in unique_catalog:
                unique_catalog[key] = action_item.get('name', action_item['action'].upper())

print(f"Total unique permissions FOUND across both files: {len(unique_catalog)}")

# List them for audit
for key, name in sorted(unique_catalog.items()):
    print(f"{key}: {name}")
