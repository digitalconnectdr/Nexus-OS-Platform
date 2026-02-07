export const ROLES_CONFIG = [
    { id: "super_admin", label: "Super Admin" },
    { id: "administrador", label: "Administrador" },
    { id: "cliente", label: "Cliente" },
    { id: "gerente", label: "Gerente" },
    { id: "supervisor_senior", label: "Supervisor Senior" },
    { id: "supervisor", label: "Supervisor" },
    { id: "dpto_estadistica", label: "Dpto Estadistica" },
    { id: "seguimiento", label: "Seguimiento" },
    { id: "digitacion", label: "Digitación" },
    { id: "auditor_calidad", label: "Auditor Calidad" },
    { id: "representante", label: "Representante" }
];

export const getRoleLabel = (roleId?: string) => {
    if (!roleId) return "---";
    const normalizedId = roleId.toLowerCase().replace(/ /g, '_').replace(/-/g, '_');
    const role = ROLES_CONFIG.find(r => r.id === normalizedId);
    return role ? role.label : roleId;
};
