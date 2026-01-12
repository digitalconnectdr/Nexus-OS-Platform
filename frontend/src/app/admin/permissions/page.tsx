'use client';

import { useState, useEffect, Fragment } from 'react';
import { ShieldCheckIcon, LockClosedIcon, CheckCircleIcon, XCircleIcon, ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { fetchFromAPI } from '@/lib/api';

interface PermissionEntry {
    id: string;
    role: string;
    module: string;
    resource: string;
    action: string;
    is_allowed: boolean;
}

type PermissionsMatrix = Record<string, Record<string, PermissionEntry[]>>;

const ROLES = [
    "Super Admin", "Administrador", "Cliente", "Gerente",
    "Supervisor Senior", "Supervisor", "Dpto Estadistica",
    "Auditor Calidad", "Seguimiento", "Digitación", "Representante"
];

const ACTIONS = ["read", "write", "delete", "export", "change_role"];

export default function PermissionsPage() {
    const [matrix, setMatrix] = useState<PermissionsMatrix>({});
    const [loading, setLoading] = useState(true);
    const [isSuperAdmin, setIsSuperAdmin] = useState(true); // Mocked for now, in prod check auth
    const [updating, setUpdating] = useState<string | null>(null);
    const [collapsedModules, setCollapsedModules] = useState<Record<string, boolean>>({});

    const toggleModule = (module: string) => {
        setCollapsedModules(prev => ({
            ...prev,
            [module]: !prev[module]
        }));
    };

    useEffect(() => {
        loadPermissions();
    }, []);

    const loadPermissions = async () => {
        try {
            const data = await fetchFromAPI('/api/v1/permissions/');

            // Robust Grouping Logic: Ensure one block per module
            const grouped = Object.entries(data).reduce((acc: any, [mod, res]: [string, any]) => {
                const moduleName = mod.trim().toUpperCase();
                if (!acc[moduleName]) acc[moduleName] = {};

                Object.entries(res).forEach(([resourceName, perms]) => {
                    if (!acc[moduleName][resourceName]) {
                        acc[moduleName][resourceName] = perms;
                    } else {
                        // Merge perms if they somehow exist already
                        acc[moduleName][resourceName] = [...acc[moduleName][resourceName], ...(perms as any[])];
                    }
                });
                return acc;
            }, {});

            setMatrix(grouped);
        } catch (err) {
            console.error('Error loading permissions:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = async (role: string, resource: string, action: string, currentValue: boolean) => {
        if (!isSuperAdmin || role === "Super Admin") return;

        const updateKey = `${role}-${resource}-${action}`;
        setUpdating(updateKey);

        try {
            await fetchFromAPI('/api/v1/permissions/toggle', {
                method: 'POST',
                body: JSON.stringify({
                    target_role: role,
                    resource: resource,
                    action: action,
                    value: !currentValue
                })
            });

            // Optimistic Update
            setMatrix(prev => {
                const newMatrix = { ...prev };
                for (const module in newMatrix) {
                    if (newMatrix[module][resource]) {
                        newMatrix[module][resource] = newMatrix[module][resource].map(p =>
                            (p.role === role && p.action === action) ? { ...p, is_allowed: !currentValue } : p
                        );
                    }
                }
                return newMatrix;
            });

        } catch (err) {
            console.error('Error toggling permission:', err);
            alert('Error al actualizar el permiso');
        } finally {
            setUpdating(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#001741] rounded-lg shadow-lg shadow-blue-900/10">
                        <ShieldCheckIcon className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 tracking-tight uppercase leading-tight">Matriz de Permisos</h1>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em] mt-0.5">Control Maestro de Accesos por Rol</p>
                    </div>
                </div>
            </div>

            {!isSuperAdmin && (
                <div className="p-3 bg-orange-50 border border-orange-200 rounded-md flex items-center gap-3 text-orange-700">
                    <LockClosedIcon className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Modo Lectura: Solo el Super Admin puede modificar privilegios.</span>
                </div>
            )}

            <div className="w-full overflow-x-auto border border-gray-200 rounded-lg shadow-sm bg-white">
                <table className="w-full text-left text-sm text-gray-700 border-collapse table-fixed min-w-[2080px]">
                    <thead className="bg-gray-50 uppercase font-bold text-xs text-gray-500 border-b border-gray-200 sticky top-0 z-20">
                        <tr>
                            <th className="px-4 py-3 text-[13px] font-medium text-gray-400 uppercase tracking-widest border-r border-gray-100 sticky left-0 z-30 bg-gray-50 w-[320px]">
                                Módulo / Recurso / Acción
                            </th>
                            {ROLES.map((role) => (
                                <th key={role} className="px-3 py-3 text-[13px] font-medium uppercase tracking-widest text-center w-[160px] text-gray-500 border-r border-gray-100 last:border-r-0">
                                    {role}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {Object.entries(matrix).map(([module, resources]) => (
                            <Fragment key={module}>
                                <tr key={module} className="bg-gray-100/80 cursor-pointer hover:bg-gray-200/80 transition-colors" onClick={() => toggleModule(module)}>
                                    <td colSpan={ROLES.length + 1} className="px-4 py-3 border-y border-gray-200">
                                        <div className="flex items-center gap-2">
                                            {collapsedModules[module] ? (
                                                <ChevronRightIcon className="w-5 h-5 text-slate-800" />
                                            ) : (
                                                <ChevronDownIcon className="w-5 h-5 text-slate-800" />
                                            )}
                                            <span className="text-[16px] font-black text-slate-800 uppercase tracking-widest">
                                                📁 Módulo: {module}
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-400 ml-auto uppercase bg-white/50 px-2 py-0.5 rounded border border-gray-200">
                                                {collapsedModules[module] ? 'Expandir' : 'Ocultar'}
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                                {!collapsedModules[module] && Object.entries(resources).map(([resource, perms]) => (
                                    ACTIONS.map((action) => (
                                        <tr key={`${resource}-${action}`} className="hover:bg-blue-50/30 transition-all group">
                                            <td className="px-4 py-2 border-r border-gray-100 border-b border-gray-100 sticky left-0 bg-white z-10 group-hover:bg-blue-50 transition-colors shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                                <div className="flex flex-col">
                                                    <span className="text-[14.5px] font-bold text-slate-700 uppercase tracking-tight">{resource}</span>
                                                    <span className="text-[12.5px] font-medium text-slate-600 uppercase tracking-widest">{action}</span>
                                                </div>
                                            </td>
                                            {ROLES.map((role) => {
                                                const perm = perms.find(p => p.role === role && p.action === action);
                                                const isAllowed = perm?.is_allowed || role === "Super Admin";
                                                const isUpdating = updating === `${role}-${resource}-${action}`;
                                                const isDisabled = !isSuperAdmin || role === "Super Admin";

                                                return (
                                                    <td key={role} className="px-2 py-2 text-center border-r border-gray-100 border-b border-gray-100 last:border-r-0">
                                                        <button
                                                            onClick={() => handleToggle(role, resource, action, isAllowed)}
                                                            disabled={isDisabled}
                                                            className={`
                                                                relative inline-flex items-center justify-center p-1 rounded-lg transition-all
                                                                ${isDisabled ? 'cursor-not-allowed opacity-30 grayscale' : 'hover:scale-110 active:scale-95'}
                                                                ${isAllowed ? 'text-emerald-600 bg-emerald-50' : 'text-gray-300 bg-gray-50 border border-gray-100/50'}
                                                            `}
                                                        >
                                                            {isUpdating ? (
                                                                <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent animate-spin rounded-full"></div>
                                                            ) : isAllowed ? (
                                                                <CheckCircleIcon className="w-5 h-5" />
                                                            ) : (
                                                                <XCircleIcon className="w-5 h-5" />
                                                            )}
                                                        </button>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))
                                ))}
                            </Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
