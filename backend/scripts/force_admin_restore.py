import uuid
from app.core.supabase import supabase_admin
from app.schemas.core import UserRole

def restore_admin():
    print("🚀 [EMERGENCY] Starting Super Admin Permission Restoration...")
    
    role_name = UserRole.SUPER_ADMIN.value
    
    resources = [
        "users", "sales", "finance", "payroll", "metrics", 
        "organizations", "campaigns", "products", "catalog", 
        "goals", "evaluations", "scorecards", "audit_logs", 
        "roles_matrix", "conversations", "history", "operational", "system",
        "permissions" # Added permissions module to ensure they can manage the matrix
    ]
    actions = ["read", "write", "create", "update", "delete", "export", "approve", "install", "archive", "configure", "change_role"]
    
    # modules mapping for consistency (optional but good for DB integrity)
    module_map = {
        "users": "SYSTEM", "campaigns": "SYSTEM", "organizations": "SYSTEM", 
        "roles_matrix": "SYSTEM", "audit_logs": "SYSTEM", "permissions": "SYSTEM",
        "sales": "SALES", "goals": "SALES", 
        "products": "PRODUCTS", "catalog": "PRODUCTS",
        "finance": "FINANCE", "payroll": "FINANCE", "metrics": "FINANCE",
        "history": "CHAT", "conversations": "CHAT",
        "scorecards": "QUALITY", "evaluations": "QUALITY",
        "operational": "SYSTEM", "system": "SYSTEM"
    }

    to_insert = []
    
    # 1. Clean existing (optional but safer to ensure clean state for recovery)
    print(f"🧹 Clearing existing permissions for {role_name}...")
    supabase_admin.table('role_permissions').delete().eq('role', role_name).execute()
    
    for res in resources:
        mod = module_map.get(res, "SYSTEM")
        for act in actions:
            to_insert.append({
                "id": str(uuid.uuid4()),
                "role": role_name,
                "module": mod,
                "resource": res,
                "action": act,
                "is_allowed": True
            })
            
    if to_insert:
        print(f"📦 Injecting {len(to_insert)} total permission combinations for Super Admin...")
        # Chunking
        for i in range(0, len(to_insert), 50):
            chunk = to_insert[i:i+50]
            supabase_admin.table('role_permissions').insert(chunk).execute()
            
    print("✅ [SUCCESS] Super Admin permissions restored. Pánico desactivado.")

if __name__ == "__main__":
    restore_admin()
