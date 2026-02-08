'use client';

import { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
import {
    ShieldCheckIcon,
    LockClosedIcon,
    ChevronDownIcon,
    ChevronRightIcon,
    CircleStackIcon,
    CurrencyDollarIcon,
    Cog6ToothIcon,
    PresentationChartLineIcon,
    UserGroupIcon,
    BriefcaseIcon,
    CubeIcon,
    BuildingOfficeIcon
} from '@heroicons/react/24/outline';
import { ROLES_CONFIG } from '@/lib/constants';
import { Trophy } from 'lucide-react';
import { fetchFromAPI } from '@/lib/api';
import LoadingState from '@/components/ui/LoadingState';
import { useAuth } from '@/context/AuthContext';
import { Switch } from '@/components/ui/switch';

interface PermissionEntry {
    id: string;
    role: string;
    module: string;
    resource: string;
    action: string;
    name: string;
    is_allowed: boolean;
}

const MODULE_CONFIG: Record<string, { label: string, icon: any, color: string }> = {
    'dashboard': { label: 'Dashboard Real Time', icon: PresentationChartLineIcon, color: 'text-blue-600' },
    'history': { label: 'Historial de Ventas', icon: CircleStackIcon, color: 'text-indigo-600' },
    'performance': { label: 'Gestión del Desempeño', icon: BriefcaseIcon, color: 'text-emerald-600' },
    'finance': { label: 'Gestión Financiera', icon: CurrencyDollarIcon, color: 'text-orange-600' },
    'config_hub': { label: 'Configuración', icon: Cog6ToothIcon, color: 'text-purple-600' },
    'system': { label: 'Núcleo del Sistema', icon: ShieldCheckIcon, color: 'text-gray-600' },
    'tournaments': { label: 'Torneos y Competencias', icon: Trophy, color: 'text-yellow-600' },
    'dev_modules': { label: 'Módulos en Desarrollo', icon: CubeIcon, color: 'text-rose-600' },
    'system_reserved': { label: 'SISTEMA: RESERVAS TÉCNICAS', icon: LockClosedIcon, color: 'text-slate-400' },
};

const MODULE_ORDER = [
    'dashboard',
    'history',
    'performance',
    'finance',
    'config_hub',
    'system',
    'tournaments',
    'dev_modules',
    'system_reserved'
];

const HIERARCHY_ORDER = [
    'super_admin',
    'administrador',
    'gerente',
    'supervisor_senior',
    'supervisor',
    'representante',
    'auditor_calidad',
    'seguimiento',
    'digitacion',
    'dpto_estadistica',
    'cliente'
];

export default function PermissionsPage() {
    const { user } = useAuth();
    const [rawPermissions, setRawPermissions] = useState<PermissionEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
    const [collapsedModules, setCollapsedModules] = useState<Record<string, boolean>>({});

    const isSuperAdmin = useMemo(() => {
        const role = user?.role?.toLowerCase();
        return role === 'super_admin' || role === 'super admin' || user?.is_super_admin;
    }, [user]);

    const isReadOnly = !isSuperAdmin; // UI Indicator only, logic is stricter below

    const loadPermissions = useCallback(async () => {
        try {
            setLoading(true);
            const timestamp = new Date().getTime();
            const data = await fetchFromAPI(`/api/v1/permissions/?t=${timestamp}`);

            const flattened: PermissionEntry[] = [];
            Object.entries(data).forEach(([mod, resources]: [string, any]) => {
                Object.entries(resources).forEach(([res, perms]: [string, any]) => {
                    perms.forEach((p: any) => flattened.push({
                        ...p,
                        module: mod.toLowerCase(),
                        resource: p.resource.toLowerCase(),
                        name: p.name && p.name.trim() !== '' ? p.name : p.action.toUpperCase()
                    }));
                });
            });

            setRawPermissions(flattened);
        } catch (err) {
            console.error('Error loading permissions:', err);
        } finally {
            setLoading(false);
            setLoadingStates({});
        }
    }, []);

    useEffect(() => {
        loadPermissions();
    }, [loadPermissions, user?.tenant]);

    const handleToggle = (perm: PermissionEntry, currentValue: boolean) => {
        // Double Check logic even here
        const myRole = user?.role?.toLowerCase();
        const myLevel = HIERARCHY_ORDER.indexOf(myRole || '');
        const targetLevel = HIERARCHY_ORDER.indexOf(perm.role);

        let canEdit = false;
        if (isSuperAdmin) {
            canEdit = true;
        } else if (myLevel !== -1 && targetLevel !== -1) {
            // Strict Heirarchy: Admin (1) can edit Gerente (2). 1 < 2 is True.
            canEdit = myLevel < targetLevel;
        }

        if (!canEdit) {
            console.error("Security Violation: Attempt to edit protected role.");
            return;
        }

        const newValue = !currentValue;
        const cellKey = `${perm.role}-${perm.resource}:${perm.action}`;

        setLoadingStates(prev => ({ ...prev, [cellKey]: true }));

        // Optimistic Update
        setRawPermissions(prev => prev.map(p =>
            (p.role === perm.role && p.resource === perm.resource && p.action === perm.action)
                ? { ...p, is_allowed: newValue }
                : p
        ));

        fetchFromAPI('/api/v1/permissions/toggle_status', {
            method: 'POST',
            body: JSON.stringify({
                target_role: perm.role,
                module: perm.module,
                resource: perm.resource,
                action: perm.action,
                value: newValue,
                name: perm.name
            })
        }).catch(err => {
            console.error("Fallo al guardar permiso:", err);
            setRawPermissions(prev => prev.map(p =>
                (p.role === perm.role && p.resource === perm.resource && p.action === perm.action)
                    ? { ...p, is_allowed: currentValue }
                    : p
            ));
        }).finally(() => {
            setLoadingStates(prev => ({ ...prev, [cellKey]: false }));
        });
    };

    const groupedMatrix = useMemo(() => {
        const matrix: Record<string, Record<string, Record<string, PermissionEntry>>> = {};

        // HIERARCHICAL INVISIBILITY RULE:
        // A user can ONLY see rows where they THEMSELVES have the permission.
        const myRole = user?.role?.toLowerCase() || 'public';
        const amISuper = isSuperAdmin;

        const validFuncKeys = new Set<string>();

        // 1. First pass: Identify which permissions *I* have
        rawPermissions.forEach(p => {
            const funcKey = `${p.resource}:${p.action}`;

            if (amISuper) {
                validFuncKeys.add(funcKey);
            } else {
                // I only see rows where I have the permission enabled myself
                if (p.role === myRole && p.is_allowed) {
                    validFuncKeys.add(funcKey);
                }
            }
        });

        // 2. Second pass: Build the matrix only with valid keys
        rawPermissions.forEach(p => {
            const mod = p.module.toLowerCase();
            const funcKey = `${p.resource}:${p.action}`;

            // FILTER: Only show this row if I have access to it
            if (!validFuncKeys.has(funcKey)) return;

            if (!matrix[mod]) matrix[mod] = {};
            if (!matrix[mod][funcKey]) matrix[mod][funcKey] = {};

            matrix[mod][funcKey][p.role] = p;
        });

        return matrix;
    }, [rawPermissions, user, isSuperAdmin]);

    if (loading) return <LoadingState message="Sincronizando Matriz de Jerarquía..." />;

    const myRole = user?.role?.toLowerCase();
    const myLevel = HIERARCHY_ORDER.indexOf(myRole || '');

    return (
        <div className="p-6 space-y-6 bg-white min-h-screen">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-blue-50 rounded-xl border border-blue-100 shadow-sm">
                        <ShieldCheckIcon className="w-7 h-7 text-blue-600" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 tracking-tight uppercase">Matriz de Jerarquía</h1>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Visibilidad y Control Estrictamente Jerárquico</p>
                    </div>
                </div>
            </header>

            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mt-4">
                <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-220px)] custom-scrollbar">
                    <table className="w-full text-left text-xs border-separate border-spacing-0">
                        <thead className="sticky top-0 z-50">
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="py-2.5 px-4 border-b border-slate-200 border-r border-slate-100 sticky left-0 z-[60] bg-slate-50 min-w-[350px] w-[350px] font-semibold text-slate-600 uppercase tracking-wider shadow-[4px_0_8px_rgba(0,0,0,0.02)]">
                                    <div className="flex items-center gap-2">
                                        <CubeIcon className="w-3.5 h-3.5 text-slate-400" />
                                        <span>Funcionalidad</span>
                                    </div>
                                </th>
                                {ROLES_CONFIG.map(role => (
                                    <th key={role.id} className={`py-2.5 px-2 text-center border-b border-slate-200 border-r border-slate-100 w-[100px] min-w-[100px] font-semibold text-slate-600 uppercase tracking-tighter text-[10px] ${role.id === 'super_admin' ? 'bg-blue-50/50' : ''}`}>
                                        {role.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {MODULE_ORDER.map(module => {
                                const functionalities = groupedMatrix[module];
                                if (!functionalities) return null;

                                const modConfig = MODULE_CONFIG[module] || { label: module, icon: CubeIcon, color: 'text-gray-400' };
                                const isCollapsed = collapsedModules[module];
                                const funcCount = Object.keys(functionalities).length;

                                return (
                                    <Fragment key={module}>
                                        <tr
                                            onClick={() => setCollapsedModules(prev => ({ ...prev, [module]: !prev[module] }))}
                                            className="bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer sticky top-[37px] z-40"
                                        >
                                            <td colSpan={ROLES_CONFIG.length + 1} className="px-4 py-1.5 border-b border-slate-200">
                                                <div className="flex items-center gap-2">
                                                    {isCollapsed ? <ChevronRightIcon className="w-3.5 h-3.5" /> : <ChevronDownIcon className="w-3.5 h-3.5" />}
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{modConfig.label}</span>
                                                    <span className="text-[9px] text-slate-400 font-medium uppercase px-2 py-0.5 bg-slate-200/50 rounded ml-auto">
                                                        {funcCount} {funcCount === 1 ? 'Control' : 'Controles'}
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>

                                        {!isCollapsed && Object.entries(functionalities).map(([funcKey, rolePerms], fIdx) => {
                                            const firstPerm = Object.values(rolePerms)[0];
                                            const label = firstPerm?.name || funcKey.toUpperCase();

                                            return (
                                                <tr key={funcKey} className={`group hover:bg-slate-50/50 transition-colors ${fIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/20'}`}>
                                                    <td className="py-2 pl-4 border-r border-slate-100 sticky left-0 z-20 bg-white group-hover:bg-slate-50 transition-colors shadow-[4px_0_12px_rgba(0,0,0,0.05)] max-w-[350px]">
                                                        <span className={`text-sm font-medium tracking-tight whitespace-normal break-words block ${module === 'system_reserved' ? 'text-slate-400 italic' : 'text-slate-700'}`}>
                                                            {label}
                                                        </span>
                                                    </td>
                                                    {ROLES_CONFIG.map(role => {
                                                        const p = rolePerms[role.id];
                                                        const cellKey = `${role.id}-${funcKey}`;
                                                        const isUpdating = loadingStates[cellKey];

                                                        // --- COLUMN PROTECTION LOGIC ---
                                                        const targetLevel = HIERARCHY_ORDER.indexOf(role.id);

                                                        let isDisabled = true;
                                                        if (isSuperAdmin) {
                                                            isDisabled = false; // God Mode
                                                        } else if (myLevel !== -1 && targetLevel !== -1) {
                                                            // Logic: Available ONLY if I am STRICTLY higher (lower index) than target
                                                            // Admin(1) vs Admin(1) -> 1 < 1 False -> Disabled
                                                            // Admin(1) vs Gerente(2) -> 1 < 2 True -> Enabled
                                                            if (myLevel < targetLevel) {
                                                                isDisabled = false;
                                                            }
                                                        }

                                                        // Always disable if module reserved or updating or no permission object
                                                        if (module === 'system_reserved' || isUpdating || !p) isDisabled = true;

                                                        return (
                                                            <td key={role.id} className="py-2 border-r border-slate-100 text-center bg-transparent">
                                                                <div className="flex justify-center items-center h-full">
                                                                    <div className="relative">
                                                                        {isDisabled ? (
                                                                            p?.is_allowed ? (
                                                                                <LockClosedIcon className="w-4 h-4 text-green-600/50" />
                                                                            ) : (
                                                                                <div className="w-4 h-4 rounded-full bg-slate-100 border border-slate-200"></div>
                                                                            )
                                                                        ) : (
                                                                            <Switch
                                                                                checked={p?.is_allowed || false}
                                                                                onCheckedChange={() => p && handleToggle(p, p.is_allowed)}
                                                                                disabled={isDisabled}
                                                                            />
                                                                        )}
                                                                        {isUpdating && (
                                                                            <div className="absolute inset-0 flex items-center justify-center bg-white/40 rounded-full">
                                                                                <div className="w-2.5 h-2.5 border-2 border-blue-600 border-t-transparent animate-spin rounded-full" />
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            );
                                        })}
                                    </Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="flex flex-col gap-1 mt-6">
                <p className="text-[10px] text-slate-400 italic font-bold">• VISIBILIDAD JERÁRQUICA ACTIVA: Solo visualiza funciones que su propio rol posee.</p>
                <p className="text-[10px] text-slate-400 italic font-bold">• PROTECCIÓN DE COLUMNAS: Solo puede editar roles de menor jerarquía (índice inferior).</p>
            </div>
        </div>
    );
}
