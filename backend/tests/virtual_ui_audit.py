import json

# Roles definidos en el sistema
ROLES = [
    "Super Admin", "Administrador", "Cliente", "Gerente",
    "Supervisor Senior", "Supervisor", "Dpto Estadistica",
    "Auditor Calidad", "Seguimiento", "Digitación", "Representante"
]

# Matriz de permisos esperada (Lo que el backend enviará a /permissions/me)
PERMISSIONS_MATRIX = {
    "Administrador": ["sales:read", "sales:write", "sales:export", "finance:read_global", "operational:read", "users:read", "permissions:read", "organizations:read", "system:configure"],
    "Cliente": ["sales:read", "operational:read"], # SOLO dashboards
    "Gerente": ["sales:read", "sales:write", "sales:export", "sales:approve", "finance:read_global", "operational:read", "users:read"],
    "Supervisor Senior": ["sales:read", "sales:write", "sales:export", "operational:read", "finance:read_own"],
    "Supervisor": ["sales:read", "sales:write", "operational:read", "finance:read_own"],
    "Dpto Estadistica": ["sales:read", "sales:export", "operational:read", "operational:export"],
    "Auditor Calidad": ["sales:read", "sales:approve", "operational:read"],
    "Seguimiento": ["sales:read", "sales:update"],
    "Digitación": ["sales:create", "sales:update", "sales:read"],
    "Representante": ["sales:read_own", "finance:read_own"]
}

# Lógica del Sidebar (Copiada de Sidebar.tsx)
def get_visible_menus(role, permissions, is_super_admin=False):
    def can(res, act):
        if is_super_admin: return True
        return f"{res}:{act}" in permissions
    
    menus = []
    # Operaciones
    if True: menus.append("Dashboard Real-Time")
    if can('sales', 'read'): menus.append("Historial Ventas")
    if can('operational', 'read'): menus.append("Gestión Desempeño")
    if can('finance', 'read_global') or can('finance', 'read_own'): menus.append("Gestión Financiera")
    if can('system', 'configure'): menus.append("Configuración")
    
    # Administración
    if can('users', 'read'): menus.append("Gestión Usuarios")
    if can('permissions', 'read'): menus.append("Matriz Permisos")
    if can('organizations', 'read'): menus.append("Organizaciones")
    
    return menus

def audit_all_roles():
    print("# 🛡️ AUDITORÍA DE UI (VIRTUAL ROLE SWEEP)")
    print("| Rol | Menús Visibles | Estado |")
    print("| :--- | :--- | :--- |")
    
    for role in ROLES:
        is_sa = (role == "Super Admin")
        perms = PERMISSIONS_MATRIX.get(role, [])
        visible = get_visible_menus(role, perms, is_sa)
        
        # Validaciones de Seguridad
        status = "✅ OK"
        if role == "Cliente" and any(m in visible for m in ["Gestión Usuarios", "Matriz Permisos", "Organizaciones", "Configuración"]):
            status = "❌ BRECHA (Ve administración)"
        if role == "Representante" and "Gestión Usuarios" in visible:
            status = "❌ BRECHA (Ve usuarios)"
            
        print(f"| {role} | {', '.join(visible)} | {status} |")

if __name__ == "__main__":
    audit_all_roles()
