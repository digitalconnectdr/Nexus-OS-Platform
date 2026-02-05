'use client';

import { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
import {
    ShieldCheckIcon,
    LockClosedIcon,
    ChevronDownIcon,
    ChevronRightIcon,
    Bars3Icon,
    CircleStackIcon,
    CurrencyDollarIcon,
    TagIcon,
    Cog6ToothIcon,
    EyeIcon,
    PresentationChartLineIcon,
    UserGroupIcon,
    KeyIcon,
    BriefcaseIcon,
    CubeIcon,
    AdjustmentsHorizontalIcon,
    CpuChipIcon,
    BuildingOfficeIcon,
    BoltIcon
} from '@heroicons/react/24/outline';
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

const ROLES = [
    "Super Admin", "Administrador", "Cliente", "Gerente",
    "Supervisor Senior", "Supervisor", "Dpto Estadistica",
    "Auditor Calidad", "Seguimiento", "Digitación", "Representante"
];

const MODULE_CONFIG: Record<string, { label: string, icon: any, color: string }> = {
    'dashboard': { label: 'Dashboard Real Time', icon: PresentationChartLineIcon, color: 'text-blue-600' },
    'history': { label: 'Historial Ventas', icon: CircleStackIcon, color: 'text-indigo-600' },
    'performance': { label: 'Gestión del Desempeño', icon: BriefcaseIcon, color: 'text-emerald-600' },
    'finance': { label: 'Gestión Financiera', icon: CurrencyDollarIcon, color: 'text-orange-600' },
    'users': { label: 'Gestión de Usuarios', icon: UserGroupIcon, color: 'text-sky-600' },
    'config_campaigns': { label: 'Catálogo: Campañas', icon: Bars3Icon, color: 'text-purple-600' },
    'config_products': { label: 'Catálogo: Productos', icon: TagIcon, color: 'text-pink-600' },
    'config_goals': { label: 'Catálogo: Objetivos', icon: TagIcon, color: 'text-rose-600' },
    'config_statuses': { label: 'Catálogo: Estatus', icon: AdjustmentsHorizontalIcon, color: 'text-slate-600' },
    'config_users': { label: 'Usuarios (Config)', icon: UserGroupIcon, color: 'text-sky-600' },
    'config_policies': { label: 'Políticas de Rol', icon: KeyIcon, color: 'text-gray-600' },
    'users_manager': { label: 'Gestión Usuarios', icon: UserGroupIcon, color: 'text-blue-800' },
    'permissions': { label: 'Matriz Permisos', icon: ShieldCheckIcon, color: 'text-indigo-600' },
    'config': { label: 'Configuración Sistema', icon: Cog6ToothIcon, color: 'text-slate-600' },
    'tournaments': { label: 'Torneos y Competencias', icon: Trophy, color: 'text-yellow-600' },
    'ops': { label: 'Estado del Sistema', icon: CpuChipIcon, color: 'text-rose-600' },
    'system': { label: 'Núcleo del Sistema', icon: ShieldCheckIcon, color: 'text-gray-600' },
};

export default function PermissionsPage() {
    const { user } = useAuth();
    const [rawPermissions, setRawPermissions] = useState<PermissionEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
    const [collapsedModules, setCollapsedModules] = useState<Record<string, boolean>>({});

    const isSuperAdmin = useMemo(() => {
        return user?.role === 'Super Admin' || user?.is_super_admin;
    }, [user]);

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
        if (!isSuperAdmin) return;

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

        rawPermissions.forEach(p => {
            const mod = p.module.toLowerCase();
            const funcKey = `${p.resource}:${p.action}`;

            if (!matrix[mod]) matrix[mod] = {};
            if (!matrix[mod][funcKey]) matrix[mod][funcKey] = {};

            matrix[mod][funcKey][p.role] = p;
        });

        return matrix;
    }, [rawPermissions]);

    if (loading) return <LoadingState message="Sincronizando Matriz de Funcionalidades..." />;

    return (
        <div className="p-6 space-y-6 bg-white min-h-screen">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-blue-50 rounded-xl border border-blue-100 shadow-sm">
                        <ShieldCheckIcon className="w-7 h-7 text-blue-600" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 tracking-tight uppercase">Matriz de Funcionalidades</h1>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Control de acceso basado en funcionalidades por rol</p>
                    </div>
                </div>
                {!isSuperAdmin && (
                    <div className="px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-amber-700">
                        <LockClosedIcon className="w-4 h-4" />
                        <span className="text-[9px] font-black uppercase tracking-widest">Solo Lectura</span>
                    </div>
                )}
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
                                {ROLES.map(role => (
                                    <th key={role} className={`py-2.5 px-2 text-center border-b border-slate-200 border-r border-slate-100 w-[100px] min-w-[100px] font-semibold text-slate-600 uppercase tracking-tighter text-[10px] ${role === 'Super Admin' ? 'bg-blue-50/50' : ''}`}>
                                        {role}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {Object.entries(groupedMatrix).map(([module, functionalities]) => {
                                const modConfig = MODULE_CONFIG[module] || { label: module, icon: CubeIcon, color: 'text-gray-400' };
                                const isCollapsed = collapsedModules[module];
                                const funcCount = Object.keys(functionalities).length;

                                return (
                                    <Fragment key={module}>
                                        <tr
                                            onClick={() => setCollapsedModules(prev => ({ ...prev, [module]: !prev[module] }))}
                                            className="bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer sticky top-[37px] z-40"
                                        >
                                            <td colSpan={ROLES.length + 1} className="px-4 py-1.5 border-b border-slate-200">
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
                                                        <span className="text-sm font-medium text-slate-700 tracking-tight whitespace-normal break-words block">{label}</span>
                                                    </td>
                                                    {ROLES.map(role => {
                                                        const p = rolePerms[role];
                                                        const cellKey = `${role}-${funcKey}`;
                                                        const isUpdating = loadingStates[cellKey];
                                                        const isDisabled = !isSuperAdmin || role === 'Super Admin';

                                                        if (!p) return <td key={role} className="py-2 border-r border-slate-100 bg-slate-50/10" />;

                                                        return (
                                                            <td key={role} className="py-2 border-r border-slate-100 text-center bg-transparent">
                                                                <div className="flex justify-center items-center h-full">
                                                                    <div className="relative">
                                                                        <Switch
                                                                            checked={p.is_allowed}
                                                                            onCheckedChange={() => handleToggle(p, p.is_allowed)}
                                                                            disabled={isDisabled || isUpdating}
                                                                        />
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
                <p className="text-[10px] text-slate-400 italic">• Los cambios en la matriz tienen efecto inmediato sobre la visibilidad de componentes.</p>
                <p className="text-[10px] text-slate-400 italic">• Solo usuarios con privilegios de Super Admin pueden modificar esta configuración.</p>
                <p className="text-[10px] text-slate-400 italic">• El modelo utiliza arquitectura de Feature Flags para optimización de seguridad.</p>
                <p className="text-[10px] text-slate-400 italic">• Los interruptores muestran el estado actual de acceso por funcionalidad y rol.</p>
            </div>
        </div>
    );
}
