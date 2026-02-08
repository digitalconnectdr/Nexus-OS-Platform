
# This file is the SINGLE SOURCE OF TRUTH for system permissions.
# PHASE 1: ATOMIC 99 DICTIONARY RECONSTRUCTION
# GRANULARITY RULE: Users and Config actions have unique technical IDs.

ROLES = ['super_admin', 'administrador', 'gerente', 'supervisor_senior', 'supervisor', 'representante', 'auditor_calidad', 'seguimiento', 'digitacion', 'dpto_estadistica', 'cliente']

MASTER_CATALOG = [
    # --- BLOQUE 0: PLATAFORMA (1) ---
    ('system', 'access', 'platform', 'Acceso Principal a la Plataforma'), # ID PRIORITARIO

    # --- BLOQUE 1: OPERACIONES (10) ---
    ('dashboard', 'sales', 'read', 'Ver Ventas'),
    ('dashboard', 'sales', 'create', 'Crear Ventas'),
    ('dashboard', 'sales', 'update', 'Editar Ventas'),
    ('dashboard', 'sales', 'delete', 'Eliminar Ventas'),
    ('dashboard', 'sales', 'export', 'Exportar Ventas'),
    ('dashboard', 'sales', 'change_status', 'Cambiar Estatus'),
    ('dashboard', 'analytics', 'read', 'Ver Analíticas'),
    ('dashboard', 'filters', 'advanced', 'Filtros Avanzados'),
    ('dashboard', 'calculator', 'access', 'Calculadora de Comisiones'),
    ('dashboard', 'alerts', 'view', 'Ver Alertas Operativas'),

    # --- BLOQUE 2: COMPETICIÓN (10) ---
    ('tournaments', 'tournaments', 'read', 'Ver Torneos'),
    ('tournaments', 'tournaments', 'create', 'Crear Torneos'),
    ('tournaments', 'tournaments', 'update', 'Editar Torneos'),
    ('tournaments', 'tournaments', 'delete', 'Eliminar Torneos'),
    ('tournaments', 'battles', 'create', 'Crear Batallas'),
    ('tournaments', 'battles', 'update', 'Editar Batallas'),
    ('tournaments', 'track', 'view', 'Ver Carrera en Vivo'),
    ('tournaments', 'arbitration', 'panel', 'Panel de Arbitraje'),
    ('tournaments', 'rewards', 'manage', 'Gestionar Recompensas'),
    ('tournaments', 'config', 'general', 'Configuración General Torneos'),

    # --- BLOQUE 3: RESULTADOS & PERFORMANCE (15) ---
    ('perf', 'stats', 'read', 'Ver Estadísticas Desempeño'),
    ('perf', 'stats', 'summary', 'Ver Resumen Desempeño'),
    ('perf', 'stats', 'detailed', 'Ver Detalle Desempeño'),
    ('perf', 'export', 'sales', 'Exportar Ventas (Desempeño)'),
    ('perf', 'export', 'backoffice', 'Exportar Backoffice (Desempeño)'),
    ('perf', 'export', 'efficiency', 'Exportar Eficiencia (Desempeño)'),
    ('finance', 'payroll', 'manage', 'Gestionar Nómina'),
    ('finance', 'results', 'view', 'Ver Resultados Financieros'),
    ('history', 'sales', 'read', 'Ver Historial Ventas'),
    ('history', 'sales', 'export', 'Exportar Historial Ventas'),
    ('history', 'audit', 'view', 'Ver Auditoría Histórica'),
    ('perf', 'backoffice', 'panel', 'Panel Backoffice'),
    ('perf', 'efficiency', 'panel', 'Panel Eficiencia'),
    ('perf', 'kpis', 'config', 'Configurar KPIs'),
    ('perf', 'reports', 'custom', 'Reportes Personalizados'),

    # --- BLOQUE 4: CATÁLOGOS (15) ---
    # Granular IDs for Config
    ('config', 'campaigns', 'read', 'Ver Campañas'),
    ('config', 'campaigns', 'write', 'Editar Campañas'),
    ('config', 'campaigns', 'delete', 'Eliminar Campañas'),
    ('config', 'products', 'read', 'Ver Productos'),
    ('config', 'products', 'write', 'Editar Productos'),
    ('config', 'products', 'delete', 'Eliminar Productos'),
    ('config', 'goals', 'read', 'Ver Objetivos'),
    ('config', 'goals', 'write', 'Editar Objetivos'),
    ('config', 'goals', 'delete', 'Eliminar Objetivos'),
    ('config', 'statuses', 'read', 'Ver Estatus'),
    ('config', 'statuses', 'write', 'Editar Estatus'),
    ('config', 'statuses', 'delete', 'Eliminar Estatus'),
    ('config', 'prices', 'manage', 'Gestionar Precios'),
    ('config', 'selectors', 'manage', 'Gestionar Selectores'),
    ('config', 'hub', 'access', 'Acceso al Hub de Configuración'),

    # --- BLOQUE 5: USUARIOS (12) ---
    # Granular IDs for Users
    ('users', 'action', 'read', 'Ver Usuarios'),
    ('users', 'action', 'create', 'Crear Usuarios'),
    ('users', 'action', 'update', 'Editar Usuarios'),
    ('users', 'action', 'delete', 'Eliminar Usuarios'),
    ('users', 'action', 'export', 'Exportar Usuarios'),
    ('users', 'security', 'reset_pw', 'Restablecer Contraseña'),
    ('users', 'security', 'block', 'Bloquear/Desbloquear Usuario'),
    ('users', 'roles', 'assign', 'Asignar Roles'),
    ('users', 'supervisors', 'read', 'Ver Supervisores'),
    ('users', 'supervisors', 'assign', 'Asignar Supervisores'),
    ('users', 'audit', 'view', 'Ver Auditoría Usuarios'),
    ('users', 'module', 'access', 'Acceso Módulo Usuarios'),

    # --- BLOQUE 6: NÚCLEO (10) ---
    ('system', 'matrix', 'read', 'Ver Matriz de Roles'),
    ('system', 'matrix', 'update', 'Editar Matriz de Roles'),
    ('system', 'matrix', 'export', 'Exportar Matriz de Roles'),
    ('system', 'audit', 'read', 'Ver Logs de Auditoría'),
    ('system', 'audit', 'export', 'Exportar Logs de Auditoría'),
    ('system', 'audit', 'delete', 'Eliminar Logs de Auditoría'),
    ('system', 'security', 'config', 'Configuración de Seguridad'),
    ('system', 'logs', 'realtime', 'Ver Logs en Tiempo Real'),
    ('system', 'maintenance', 'mode', 'Modo Mantenimiento'),
    ('system', 'platform', 'settings', 'Configuración de Plataforma'),

    # --- BLOQUE 7: MULTI-TENANT (6) ---
    ('system', 'orgs', 'read', 'Ver Organizaciones'),
    ('system', 'orgs', 'create', 'Crear Organizaciones'),
    ('system', 'orgs', 'update', 'Editar Organizaciones'),
    ('system', 'orgs', 'delete', 'Eliminar Organizaciones'),
    ('system', 'orgs', 'switcher', 'Cambiar de Organización'),
    ('system', 'orgs', 'license', 'Gestionar Licencias'),
    ('system', 'health', 'read', 'Ver Salud del Sistema'),
    ('system', 'security', 'killswitch', 'Kill Switch (Expulsión Masiva)'),

    # --- BLOQUE 8: RESERVAS TÉCNICAS (20) ---
    ('technical', 'reserve', '01', 'Reserva Técnica 01'),
    ('technical', 'reserve', '02', 'Reserva Técnica 02'),
    ('technical', 'reserve', '03', 'Reserva Técnica 03'),
    ('technical', 'reserve', '04', 'Reserva Técnica 04'),
    ('technical', 'reserve', '05', 'Reserva Técnica 05'),
    ('technical', 'reserve', '06', 'Reserva Técnica 06'),
    ('technical', 'reserve', '07', 'Reserva Técnica 07'),
    ('technical', 'reserve', '08', 'Reserva Técnica 08'),
    ('technical', 'reserve', '09', 'Reserva Técnica 09'),
    ('technical', 'reserve', '10', 'Reserva Técnica 10'),
    ('technical', 'reserve', '11', 'Reserva Técnica 11'),
    ('technical', 'reserve', '12', 'Reserva Técnica 12'),
    ('technical', 'reserve', '13', 'Reserva Técnica 13'),
    ('technical', 'reserve', '14', 'Reserva Técnica 14'),
    ('technical', 'reserve', '15', 'Reserva Técnica 15'),
    ('technical', 'reserve', '16', 'Reserva Técnica 16'),
    ('technical', 'reserve', '17', 'Reserva Técnica 17'),
    ('technical', 'reserve', '18', 'Reserva Técnica 18'),
    ('technical', 'reserve', '19', 'Reserva Técnica 19'),
    ('technical', 'reserve', '20', 'Reserva Técnica 20'),
]

DEFAULT_MAPPING = {}
