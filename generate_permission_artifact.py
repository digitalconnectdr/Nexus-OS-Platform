
import json
import os

# --- COPY OF MATRIX FROM reseed_permissions_v2.py (Single Source of Truth) ---
MATRIX = {
    # --- DASHBOARD ---
    "dashboard": {
        "access": ["super_admin", "administrador", "gerente", "supervisor_senior", "supervisor", "representative", "representante"],
        "sales": {
            "read": ["super_admin", "administrador", "gerente", "supervisor_senior", "supervisor", "representative", "representante"],
            "create": ["super_admin", "administrador", "gerente", "supervisor_senior", "supervisor", "representante"], # Agents create sales
            "update": ["super_admin", "administrador", "gerente", "supervisor_senior", "supervisor"], # Edit sales
            "change_status": ["super_admin", "administrador", "gerente", "supervisor_senior", "supervisor", "auditor_calidad"], # Status workflow
            "delete_soft": ["super_admin", "administrador"], # Trash
            "delete_hard": ["super_admin"], # Purge
            "export": ["super_admin", "administrador", "gerente"]
        }
    },
    
    # --- HISTORY ---
    "history": {
        "access": ["super_admin", "administrador", "gerente", "supervisor_senior", "supervisor", "dpto_estadistica", "auditor_calidad", "seguimiento"],
        "sales": {
            "read_history": ["super_admin", "administrador", "gerente", "supervisor_senior", "supervisor", "dpto_estadistica", "auditor_calidad", "seguimiento"],
            "export": ["super_admin", "administrador", "gerente", "dpto_estadistica"],
            "update": ["super_admin", "administrador"], # Edit in history?
            "delete_soft": ["super_admin", "administrador"],
            "change_status": ["super_admin", "administrador", "gerente", "auditor_calidad"]
        }
    },

    # --- PERFORMANCE (Analytics) ---
    "performance": {
        "access": ["super_admin", "administrador", "gerente", "supervisor_senior", "supervisor", "digitacion"],
        "efficiency": {
            "read": ["super_admin", "administrador", "gerente", "supervisor_senior", "supervisor"],
            "export": ["super_admin", "administrador", "gerente"]
        },
        "scorecard": {
            "read": ["super_admin", "administrador", "gerente", "supervisor_senior"],
            "export": ["super_admin", "administrador", "gerente"]
        },
        "backoffice": {
            "read": ["super_admin", "administrador", "gerente", "digitacion"],
            "export": ["super_admin", "administrador", "gerente"]
        }
    },

    # --- FINANCE ---
    "finance": {
        "access": ["super_admin", "administrador", "gerente"],
        "payroll": {
            "read": ["super_admin", "administrador", "gerente"],
            "export": ["super_admin", "administrador", "gerente"],
            "approve": ["super_admin", "gerente"]
        }
    },

    # --- CONFIGURATION (Catalogos) ---
    "config": {
        "access": ["super_admin", "administrador", "gerente", "dpto_estadistica"], 
        "campaigns": {
            "view_tab": ["super_admin", "administrador", "gerente"],
            "create": ["super_admin", "administrador"],
            "update": ["super_admin", "administrador"],
            "delete_soft": ["super_admin", "administrador"]
        },
        "products": {
            "view_tab": ["super_admin", "administrador", "gerente"],
            "create": ["super_admin", "administrador"],
            "update": ["super_admin", "administrador"],
            "delete_soft": ["super_admin", "administrador"]
        },
        "goals": {
            "view_tab": ["super_admin", "administrador", "gerente", "supervisor_senior"],
            "create": ["super_admin", "administrador"],
            "update": ["super_admin", "administrador"]
        },
        "statuses": {
            "view_tab": ["super_admin", "administrador"],
            "create": ["super_admin", "administrador"],
            "update": ["super_admin", "administrador"]
        }
    },

    # --- ADMINISTRATION (Users & Security) ---
    "users": {
        "access": ["super_admin", "administrador"], 
        "manager": {
            "view_tab": ["super_admin", "administrador"],
            "create": ["super_admin", "administrador"],
            "update": ["super_admin", "administrador"],
            "reset_password": ["super_admin", "administrador"],
            "delete_soft": ["super_admin", "administrador"]
        }
    },
    
    "permissions": {
        "access": ["super_admin"],
        "policies": {
            "view_tab": ["super_admin"],
            "update_matrix": ["super_admin"]
        }
    },
    
    "organizations": {
        "access": ["super_admin"],
        "tenants": {
            "view_tab": ["super_admin"],
            "create": ["super_admin"],
            "update": ["super_admin"],
            "delete_soft": ["super_admin"],
            "delete_hard": ["super_admin"]
        }
    },

    # --- SYSTEM (Ops) ---
    "system": {
        "access": ["super_admin"],
        "monitor": {
            "read": ["super_admin"]
        },
        "maintenance": {
             "backup": ["super_admin"],
             "clear_cache": ["super_admin"],
             "purge_data": ["super_admin"] # HARD DELETE
        }
    },
    
    # --- TOURNAMENTS ---
    "tournaments": {
        "access": ["super_admin", "administrador", "gerente", "supervisor_senior", "supervisor", "representante"],
        "tournaments": {
             "view_module": ["super_admin", "administrador", "gerente", "supervisor_senior", "supervisor"], # Main view
             "edit": ["super_admin", "administrador"],
             "delete": ["super_admin", "administrador"],
             "purge": ["super_admin"]
        },
        "battle": {
            "create": ["super_admin", "administrador"],
            "view_race_track": ["super_admin", "administrador", "gerente", "supervisor_senior", "supervisor", "representante"],
            "arbitration_panel": ["super_admin", "administrador", "gerente"]
        }
    }
}

DEST_DIR = r"c:\Users\JCPENALO\.gemini\antigravity\brain\f836d832-0eb4-4b5b-b180-2a9e8f6cb1c6"
OUTPUT_FILE = os.path.join(DEST_DIR, "permission_map.json")

def generate_map():
    permission_list = []
    
    for module, content in MATRIX.items():
        # Level 1: Module Access
        if "access" in content:
            roles = content["access"]
            permission_list.append({
                "module": module,
                "resource": module,
                "action": "access",
                "description": f"Access to {module.capitalize()} Module",
                "roles": roles,
                "dependency": None
            })
            
        # Level 2: Resources
        for resource, actions in content.items():
            if resource == "access": continue
            
            for action, roles in actions.items():
                desc = f"{action.replace('_', ' ').capitalize()} {resource}"
                if action == "view_tab":
                    desc = f"View {resource.capitalize()} Tab"
                
                permission_list.append({
                    "module": module,
                    "resource": resource,
                    "action": action,
                    "description": desc,
                    "roles": roles,
                    "dependency": f"{module}:access" # Explicit dependency
                })
                
    # Sort for readability
    permission_list.sort(key=lambda x: (x["module"], x["resource"]))
    
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(permission_list, f, indent=2)
        
    print(f"Generated permission map at: {OUTPUT_FILE}")

if __name__ == "__main__":
    generate_map()
