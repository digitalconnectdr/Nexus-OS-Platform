'use client';

import { useState, useEffect } from 'react';
import { fetchFromAPI } from '@/lib/api';

export default function RolePoliciesTable() {
    const [policies, setPolicies] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [statuses, setStatuses] = useState<any[]>([]);
    const [tenantId, setTenantId] = useState<string | null>(null);

    const roles = [
        "Super Admin", "Administrador", "Cliente", "Gerente",
        "Supervisor Senior", "Supervisor", "Dpto Estadistica",
        "Auditor Calidad", "Seguimiento", "Digitación", "Representante"
    ];

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [policiesData, statusesData, orgData] = await Promise.all([
                fetchFromAPI('/api/v1/policies/').catch(err => {
                    console.warn("Policies not found or failed", err);
                    return []; // Fallback to empty list
                }),
                fetchFromAPI('/api/v1/statuses/').catch(err => {
                    console.error("Status fetch failed", err);
                    return [];
                }),
                fetchFromAPI('/api/v1/organizations/me').catch(() => ({ id: 'default-tenant' }))
            ]);
            setPolicies(policiesData?.items || (Array.isArray(policiesData) ? policiesData : []));
            setStatuses(statusesData?.items || (Array.isArray(statusesData) ? statusesData : []));
            setTenantId(orgData.id);
        } catch (err) {
            console.error("Error in loadData sequence", err);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleSmartRouting = async (policy: any) => {
        const updated = {
            ...policy,
            smart_routing_enabled: !policy.smart_routing_enabled,
            tenant_id: tenantId // Include tenant_id for Upsert
        };
        try {
            // We use POST / to perform an Upsert in the backend
            const saved = await fetchFromAPI(`/api/v1/policies/`, {
                method: 'POST',
                body: JSON.stringify(updated)
            });
            setPolicies(prev => {
                const existing = prev.find(p => p.role === policy.role);
                if (existing) {
                    return prev.map(p => p.role === policy.role ? saved : p);
                } else {
                    return [...prev, saved];
                }
            });
        } catch (err: any) {
            console.error("Error toggling smart routing", err);
        }
    };

    const handleUpdateLimit = async (policy: any, limit: number) => {
        const updated = {
            ...policy,
            default_limit: limit,
            tenant_id: tenantId // Include tenant_id for Upsert
        };
        try {
            const saved = await fetchFromAPI(`/api/v1/policies/`, {
                method: 'POST',
                body: JSON.stringify(updated)
            });
            setPolicies(prev => {
                const existing = prev.find(p => p.role === policy.role);
                if (existing) {
                    return prev.map(p => p.role === policy.role ? saved : p);
                } else {
                    return [...prev, saved];
                }
            });
        } catch (err: any) {
            console.error("Error updating limit", err);
        }
    };

    const handleToggleStatus = async (policy: any, statusName: string) => {
        const currentStatuses = policy.workable_statuses || [];
        const newStatuses = currentStatuses.includes(statusName)
            ? currentStatuses.filter((s: string) => s !== statusName)
            : [...currentStatuses, statusName];

        const updated = {
            ...policy,
            workable_statuses: newStatuses,
            tenant_id: tenantId // Include tenant_id for Upsert
        };

        try {
            const saved = await fetchFromAPI(`/api/v1/policies/`, {
                method: 'POST',
                body: JSON.stringify(updated)
            });
            setPolicies(prev => {
                const existing = prev.find(p => p.role === policy.role);
                if (existing) {
                    return prev.map(p => p.role === policy.role ? saved : p);
                } else {
                    return [...prev, saved];
                }
            });
        } catch (err: any) {
            console.error("Error toggling status", err);
        }
    };

    // Ensure all roles have a policy object for the UI
    const roleList = roles.map(roleName => {
        const policy = policies.find(p => p.role === roleName) || {
            role: roleName,
            smart_routing_enabled: false,
            default_limit: 5,
            workable_statuses: ["PENDIENTE"]
        };
        return policy;
    });

    if (loading) return <div className="p-8 text-center text-xs font-bold text-gray-400 uppercase tracking-widest animate-pulse">Cargando políticas de ruteo...</div>;

    return (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden animate-fade-in">
            <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                        <th className="px-6 py-4 text-[11px] font-black text-gray-500 uppercase tracking-widest">Rol de Sistema</th>
                        <th className="px-6 py-4 text-[11px] font-black text-gray-500 uppercase tracking-widest text-center">Smart Routing</th>
                        <th className="px-6 py-4 text-[11px] font-black text-gray-500 uppercase tracking-widest text-center">Límite Base (WIP)</th>
                        <th className="px-6 py-4 text-[11px] font-black text-gray-500 uppercase tracking-widest">Estatus de Carga Atómica</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {roleList.map((policy) => (
                        <tr key={policy.role} className="hover:bg-blue-50/20 transition-all">
                            <td className="px-6 py-4">
                                <div className="flex flex-col">
                                    <span className="text-[12px] font-bold text-gray-900 uppercase tracking-tight">{policy.role}</span>
                                    <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Configuración de Capacidad</span>
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex justify-center">
                                    <button
                                        onClick={() => handleToggleSmartRouting(policy)}
                                        className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${policy.smart_routing_enabled ? 'bg-blue-600' : 'bg-gray-200'}`}
                                    >
                                        <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${policy.smart_routing_enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                                    </button>
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex justify-center">
                                    <input
                                        type="number"
                                        defaultValue={policy.default_limit}
                                        onBlur={(e) => handleUpdateLimit(policy, parseInt(e.target.value))}
                                        className="w-16 h-8 text-center border border-gray-200 rounded-md text-[12px] font-bold text-blue-700 bg-blue-50/30 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                                    />
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex flex-wrap gap-1.5 max-w-md">
                                    {statuses.map(status => {
                                        const isSelected = (policy.workable_statuses || []).includes(status.name);
                                        return (
                                            <button
                                                key={status.id}
                                                onClick={() => handleToggleStatus(policy, status.name)}
                                                className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider border transition-all
                                                    ${isSelected
                                                        ? 'bg-blue-600 border-blue-700 text-white shadow-sm'
                                                        : 'bg-gray-50 border-gray-200 text-gray-400 hover:border-gray-300'}`}
                                            >
                                                {status.name}
                                            </button>
                                        );
                                    })}
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <div className="bg-gray-50 p-4 border-t border-gray-100">
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest text-center">
                    ℹ️ Los estatus seleccionados son los únicos que restan capacidad al límite WIP del usuario.
                </p>
            </div>
        </div>
    );
}
