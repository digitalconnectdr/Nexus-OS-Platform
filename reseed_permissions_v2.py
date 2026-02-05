import asyncio
import uuid
import logging
from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import SessionLocal as async_session_factory
from app.models.core import Organization, UserProfile, RolePermission

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- NEW ROLE STANDARD (Snake Case & Lowercase) ---
ROLES = {
    "super_admin": "Super Admin",
    "administrador": "Administrador",
    "gerente": "Gerente",
    "supervisor_senior": "Supervisor Senior",
    "supervisor": "Supervisor",
    "dpto_estadistica": "Dpto Estadistica",
    "seguimiento": "Seguimiento",
    "auditor_calidad": "Auditor Calidad",
    "representante": "Representante",
    "digitacion": "Digitacion",
    "cliente": "Cliente",
    "lider": "Lider"
}

# --- PERMISSION MATRIX (Zero Translation) ---
# Format: Module -> Resource -> Action -> [Roles]
# Actions: access (L1), view_tab (L2), create, update, delete_soft, delete_hard, export, etc.

MATRIX = {
    # --- DASHBOARD ---
    "dashboard": {
        "access": ["super_admin", "administrador", "gerente", "supervisor_senior", "supervisor", "representante"],
        "sales": {
            "read": ["super_admin", "administrador", "gerente", "supervisor_senior", "supervisor", "representante"],
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


async def normalize_users():
    """Update all UserProfiles to use snake_case roles."""
    async with async_session_factory() as db:
        print(" >>> 🛠️ Normalizing User Roles to Snake Case...")
        
        # Map of old -> new
        replacements = {
            "Super Admin": "super_admin",
            "Administrador": "administrador",
            "Gerente": "gerente",
            "Supervisor Senior": "supervisor_senior",
            "Supervisor": "supervisor",
            "Lider": "lider",
            "Representante": "representante",
            "Dpto Estadistica": "dpto_estadistica",
            "Seguimiento": "seguimiento",
            "Auditor Calidad": "auditor_calidad",
            "Digitacion": "digitacion",
            "Digitación": "digitacion", # Handle accent
            "Cliente": "cliente"
        }
        
        # Also handle lowercase versions just in case
        replacements_lower = {k.lower(): v for k, v in replacements.items()}
        replacements.update(replacements_lower)
        
        result = await db.execute(select(UserProfile))
        users = result.scalars().all()
        
        count = 0
        for user in users:
            if not user.role: continue
            
            current_role = user.role
            new_role = replacements.get(current_role)
            if not new_role:
                 new_role = replacements.get(current_role.lower())
            if not new_role and " " in current_role:
                 new_role = current_role.lower().replace(" ", "_")
                 
            if new_role and new_role != current_role:
                user.role = new_role
                count += 1
                
        await db.commit()
        print(f" ✅ Normalized {count} users to snake_case.")

async def truncate_permissions():
    async with async_session_factory() as db:
        print(" >>> 🗑️ Truncating role_permissions table...")
        await db.execute(text("TRUNCATE TABLE role_permissions CASCADE"))
        await db.commit()
        print(" ✅ Truncated.")

async def reseed_permissions():
    """Reseed Permissions."""
    async with async_session_factory() as db:
        print(" >>> 🌱 Reseeding Permissions Matrix...")
        
        # Get all tenants
        print("   -> Fetching Organizations...")
        orgs_res = await db.execute(select(Organization))
        orgs = orgs_res.scalars().all()
        print(f"   -> Found {len(orgs)} Organizations.")
        
        permissions_to_add = []
        
        unique_keys = set()
        
        for org in orgs:
            # For each Module
            for module, resources in MATRIX.items():
                for key, value in resources.items():
                    if key == "access":
                        target_roles = set(value) # Dedup roles
                        for role in target_roles:
                            perm_key = (org.id, role, module, "access")
                            if perm_key in unique_keys:
                                print(f" ⚠️ Skipping duplicate permission: {perm_key}")
                                continue
                            unique_keys.add(perm_key)

                            permissions_to_add.append(RolePermission(
                                tenant_id=org.id,
                                role=role,
                                module=module,
                                resource=module, 
                                action="access",
                                name=f"Ver Módulo {module.capitalize()}",
                                is_allowed=True
                            ))
                    elif isinstance(value, dict):
                        resource_name = key
                        actions = value
                        for action, roles in actions.items():
                             target_roles = set(roles) # Dedup roles
                             for role in target_roles:
                                 perm_key = (org.id, role, resource_name, action)
                                 if perm_key in unique_keys:
                                     print(f" ⚠️ Skipping duplicate permission: {perm_key}")
                                     continue
                                 unique_keys.add(perm_key)

                                 friendly = f"{action.upper()} {resource_name}"
                                 if action == "view_tab": friendly = f"Pestaña {resource_name.capitalize()}"
                                 if action == "access": friendly = f"Acceso {resource_name.capitalize()}"
                                 
                                 permissions_to_add.append(RolePermission(
                                    tenant_id=org.id,
                                    role=role,
                                    module=module,
                                    resource=resource_name,
                                    action=action,
                                    name=friendly,
                                    is_allowed=True
                                ))
                                
        print(f"   -> Prepared {len(permissions_to_add)} permissions to insert.")
        db.add_all(permissions_to_add)
        await db.commit()
        print(f" ✅ Seeding Complete. Inserted {len(permissions_to_add)} permissions across {len(orgs)} tenants.")

async def main():
    await normalize_users()
    await truncate_permissions()
    await reseed_permissions()

if __name__ == "__main__":
    asyncio.run(main())
