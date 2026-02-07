import json
import os

json_path = 'app/core/jprs_matrix.json'
with open(json_path, 'r', encoding='utf-8') as f:
    matrix = json.load(f)

# Collect all permissions
all_perms = []
for role, modules in matrix.items():
    for module, resources in modules.items():
        for resource, actions in resources.items():
            for action_item in actions:
                all_perms.append({
                    "role": role,
                    "module": module,
                    "resource": resource,
                    "action": action_item['action'],
                    "name": action_item['name'],
                    "is_allowed": action_item['is_allowed']
                })

# Unique permissions (module, resource, action)
unique_catalog = {}
for p in all_perms:
    key = (p['module'], p['resource'], p['action'])
    # Prefer standardized names if possible
    name = p['name']
    if key not in unique_catalog:
        unique_catalog[key] = name

print(f"Roles: {len(matrix.keys())}")
print(f"Total entries in JSON: {len(all_perms)}")
print(f"Unique catalog items: {len(unique_catalog)}")

# If we have 11 roles, and we want 99 unique perms...
# Let's see if some roles have permissions that others don't
role_perms_count = {}
for role in matrix.keys():
    perms = set()
    for module, resources in matrix[role].items():
        for resource, actions in resources.items():
            for action_item in actions:
                perms.add((module, resource, action_item['action']))
    role_perms_count[role] = len(perms)
    print(f"Role '{role}': {len(perms)} perms")

# Let's also check duplicates in names
names_by_key = {}
for p in all_perms:
    key = (p['module'], p['resource'], p['action'])
    if key not in names_by_key:
        names_by_key[key] = set()
    names_by_key[key].add(p['name'])

for key, names in names_by_key.items():
    if len(names) > 1:
        print(f"Mismatch for {key}: {names}")
