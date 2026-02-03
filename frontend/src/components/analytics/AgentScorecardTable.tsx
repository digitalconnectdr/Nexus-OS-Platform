'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { fetchFromAPI } from '@/lib/api';
import { RefreshCwIcon } from 'lucide-react';
import LoadingState from '@/components/ui/LoadingState';

interface AgentScorecard360 {
    agent_id: string;
    agent_name: string;
    campaign_name: string;
    product_family: string;
    supervisor_name: string;
    target_amount: number;
    target_units: number;
    sold_amount: number;
    sold_count: number;
    compliance_amount: number;
    compliance_units: number;
    projection_amount: number;
    projection_units: number;
    pilar_estatus: string;
    pilar_color: string;
}

interface GroupedAgent {
    agent_id: string;
    agent_name: string;
    supervisor_name: string;
    total_target_amount: number;
    total_target_units: number;
    total_sold_amount: number;
    total_sold_count: number;
    avg_compliance_amount: number;
    avg_compliance_units: number;
    total_projection_amount: number;
    total_projection_units: number;
    overall_pilar_color: string;
    overall_pilar_status: string;
    items: AgentScorecard360[];
}

interface Scorecard360Response {
    items: AgentScorecard360[];
    total: number;
    month: string;
    supervisors: Array<{ id: string, name: string }>;
    campaigns: Array<{ id: string, name: string }>;
}

interface Props {
    startDate: string;
    endDate: string;
    searchTerm: string;
    supervisorId?: string;
    campaignId?: string;
}

export default function AgentScorecardTable({ startDate, endDate, searchTerm, supervisorId: propSupervisorId, campaignId: propCampaignId }: Props) {
    const month = startDate.substring(0, 7); // Derivado de la fecha global
    const [supervisorIdState, setSupervisorId] = useState('');
    const [campaignIdState, setCampaignId] = useState('');

    // Priorizamos los props sobre el estado local (si se proveen)
    const supervisorId = propSupervisorId !== undefined ? propSupervisorId : supervisorIdState;
    const campaignId = propCampaignId !== undefined ? propCampaignId : campaignIdState;
    const [data, setData] = useState<GroupedAgent[]>([]);
    const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());
    const [filters, setFilters] = useState<{ supervisors: any[], campaigns: any[] }>({ supervisors: [], campaigns: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const groupData = (items: AgentScorecard360[]): GroupedAgent[] => {
        if (!items || !Array.isArray(items)) return [];
        const groups: Record<string, GroupedAgent> = {};

        items.forEach(item => {
            if (!groups[item.agent_id]) {
                groups[item.agent_id] = {
                    agent_id: item.agent_id,
                    agent_name: item.agent_name,
                    supervisor_name: item.supervisor_name,
                    total_target_amount: 0,
                    total_target_units: 0,
                    total_sold_amount: 0,
                    total_sold_count: 0,
                    avg_compliance_amount: 0,
                    avg_compliance_units: 0,
                    total_projection_amount: 0,
                    total_projection_units: 0,
                    overall_pilar_color: 'slate',
                    overall_pilar_status: 'N/A',
                    items: []
                };
            }
            const g = groups[item.agent_id];
            g.items.push(item);
            g.total_target_amount += item.target_amount;
            g.total_target_units += item.target_units;
            g.total_sold_amount += item.sold_amount;
            g.total_sold_count += item.sold_count;
            g.total_projection_amount += item.projection_amount;
            g.total_projection_units += item.projection_units;
        });

        return Object.values(groups).map(g => {
            const compAmt = g.total_target_amount > 0 ? (g.total_sold_amount / g.total_target_amount * 100) : 0;
            const compUts = g.total_target_units > 0 ? (g.total_sold_count / g.total_target_units * 100) : 0;

            let color = 'red';
            let status = 'Critical';
            if (compAmt >= 100) { color = 'green'; status = 'Top Performer'; }
            else if (compAmt >= 90) { color = 'blue'; status = 'Good'; }
            else if (compAmt >= 80) { color = 'yellow'; status = 'Needs Attention'; }

            return {
                ...g,
                avg_compliance_amount: Math.round(compAmt),
                avg_compliance_units: Math.round(compUts),
                overall_pilar_color: color,
                overall_pilar_status: status
            };
        });
    };

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({ month });
            if (supervisorId) params.append('supervisor_id', supervisorId);
            if (campaignId) params.append('campaign_id', campaignId);

            const result: Scorecard360Response = await fetchFromAPI(`/api/v1/analytics/scorecard/agents?${params.toString()}`);
            setData(groupData(result.items));

            // Fallback for filters if not provided by parent (legacy/standalone support)
            if (propSupervisorId === undefined && propCampaignId === undefined) {
                setFilters({ supervisors: result.supervisors, campaigns: result.campaigns });
            }
        } catch (err: any) {
            console.error("Scorecard Load Error:", err);
            setError("Error al cargar el scorecard comercial.");
        } finally {
            setLoading(false);
        }
    }, [month, supervisorId, campaignId, propSupervisorId, propCampaignId]);

    const toggleAgent = (agentId: string) => {
        setExpandedAgents(prev => {
            const next = new Set(prev);
            if (next.has(agentId)) next.delete(agentId);
            else next.add(agentId);
            return next;
        });
    };

    const expandAll = () => setExpandedAgents(new Set(data.map(g => g.agent_id)));
    const collapseAll = () => setExpandedAgents(new Set());

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Filtrado client-side usando el searchTerm global
    const filteredData = data.filter(group => {
        const matchesSearch =
            group.agent_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            group.supervisor_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            group.items.some(item => item.campaign_name.toLowerCase().includes(searchTerm.toLowerCase()));
        return matchesSearch;
    });

    const getPilarStyles = (color: string) => {
        switch (color) {
            case 'green': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
            case 'blue': return 'bg-blue-50 text-blue-700 border-blue-100';
            case 'yellow': return 'bg-amber-50 text-amber-700 border-amber-100';
            case 'red': return 'bg-rose-50 text-rose-700 border-rose-100';
            default: return 'bg-slate-50 text-slate-700 border-slate-100';
        }
    };

    const getProgressColor = (color: string) => {
        switch (color) {
            case 'green': return 'bg-emerald-500';
            case 'blue': return 'bg-blue-500';
            case 'yellow': return 'bg-amber-500';
            case 'red': return 'bg-rose-500';
            default: return 'bg-slate-300';
        }
    };

    return (
        <div className="space-y-6">
            {/* Header con Filtros Específicos (Solo se muestran si no se pasan por props) */}
            {(propSupervisorId === undefined && propCampaignId === undefined) && (
                <div className="flex flex-wrap items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">

                    <div className="flex flex-col gap-1 min-w-[200px]">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Supervisor</label>
                        <select
                            value={supervisorId}
                            onChange={(e) => setSupervisorId(e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none appearance-none cursor-pointer"
                        >
                            <option value="">Todos los Supervisores</option>
                            {filters.supervisors.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-col gap-1 min-w-[200px]">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Campaña</label>
                        <select
                            value={campaignId}
                            onChange={(e) => setCampaignId(e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none appearance-none cursor-pointer"
                        >
                            <option value="">Todas las Campañas</option>
                            {filters.campaigns.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-end gap-2 ml-auto">
                        <button
                            onClick={expandAll}
                            className="bg-white border border-slate-200 text-slate-600 px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm"
                        >
                            Expandir Todo
                        </button>
                        <button
                            onClick={collapseAll}
                            className="bg-white border border-slate-200 text-slate-600 px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm"
                        >
                            Colapsar Todo
                        </button>
                        <button
                            onClick={loadData}
                            className="p-2.5 bg-white border border-slate-200 hover:border-blue-500 hover:text-blue-600 rounded-xl text-slate-400 transition-all shadow-sm active:scale-95 ml-2"
                            title="Sincronizar Data"
                        >
                            <RefreshCwIcon className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Si los filtros están arriba, solo mostramos los botones de acción */}
            {(propSupervisorId !== undefined || propCampaignId !== undefined) && (
                <div className="flex items-center gap-2 justify-end">
                    <button
                        onClick={expandAll}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm"
                    >
                        Expandir Todo
                    </button>
                    <button
                        onClick={collapseAll}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm"
                    >
                        Colapsar Todo
                    </button>
                    <button
                        onClick={loadData}
                        className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500 hover:text-blue-600 rounded-xl text-slate-400 dark:text-slate-500 transition-all shadow-sm active:scale-95 ml-2"
                        title="Sincronizar Data"
                    >
                        <RefreshCwIcon className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Tabla Principal */}
            <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-400px)] scrollbar-thin scrollbar-thumb-slate-200">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10 border-b border-slate-200">
                            <tr className="uppercase text-[9px] font-black text-slate-500 tracking-widest">
                                <th className="px-6 py-4 min-w-[220px]">Agente</th>
                                <th className="px-6 py-4">Campaña</th>
                                <th className="px-6 py-4">Familia</th>
                                <th className="px-6 py-4">Supervisor</th>
                                <th className="px-6 py-4 text-right">Objetivo $$</th>
                                <th className="px-6 py-4 text-right">Objetivo #</th>
                                <th className="px-6 py-4 text-right">Logro $$</th>
                                <th className="px-6 py-4 text-right">Logro #</th>
                                <th className="px-6 py-4 min-w-[160px]">Cumplimiento %</th>
                                <th className="px-6 py-4 text-right">Proy $$</th>
                                <th className="px-6 py-4 text-right">Proy #</th>
                                <th className="px-6 py-4 text-center">Estatus</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={12} className="px-6 py-12">
                                        <LoadingState message="Analizando rendimiento de agentes..." />
                                    </td>
                                </tr>
                            ) : filteredData.length === 0 ? (
                                <tr>
                                    <td colSpan={12} className="px-6 py-20 text-center">
                                        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No se encontraron registros para los filtros seleccionados</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredData.map((group) => {
                                    const isExpanded = expandedAgents.has(group.agent_id);
                                    return (
                                        <React.Fragment key={group.agent_id}>
                                            {/* Summary Row */}
                                            <tr
                                                onClick={() => toggleAgent(group.agent_id)}
                                                className={`cursor-pointer hover:bg-slate-50/80 transition-all border-l-4 ${isExpanded ? 'border-blue-500 bg-blue-50/30' : 'border-transparent'}`}
                                            >
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`p-1 rounded-md transition-transform ${isExpanded ? 'rotate-180 bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                                                            </svg>
                                                        </div>
                                                        <span className="text-[13px] font-black text-slate-900 uppercase tracking-tight">{group.agent_name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase italic">Consolidado</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase italic">Multiproducto</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="text-[11px] font-bold text-slate-700 uppercase">{group.supervisor_name}</span>
                                                </td>
                                                <td className="px-6 py-4 text-right font-bold text-slate-400 text-[11px]">
                                                    ${group.total_target_amount.toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4 text-right font-bold text-slate-400 text-[11px]">
                                                    {group.total_target_units}
                                                </td>
                                                <td className="px-6 py-4 text-right font-black text-slate-900 text-[13px]">
                                                    ${group.total_sold_amount.toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4 text-right font-black text-slate-900 text-[13px]">
                                                    {group.total_sold_count}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col gap-1.5 min-w-[120px]">
                                                        <div className="flex justify-between items-baseline">
                                                            <span className="text-[12px] font-black text-slate-900">{group.avg_compliance_amount}%</span>
                                                            <span className="text-[9px] font-bold text-slate-400">{group.avg_compliance_units}% #</span>
                                                        </div>
                                                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
                                                            <div
                                                                className={`h-full rounded-full transition-all duration-1000 ${getProgressColor(group.overall_pilar_color)}`}
                                                                style={{ width: `${Math.min(group.avg_compliance_amount, 100)}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className="text-[11px] font-black text-blue-800 bg-blue-100/50 px-2.5 py-1.5 rounded-xl border border-blue-200">
                                                        ${group.total_projection_amount.toLocaleString()}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right font-black text-slate-700 text-[11px]">
                                                    {group.total_projection_units} <span className="text-[8px] text-slate-400">UDS</span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest border border-current shadow-sm ${getPilarStyles(group.overall_pilar_color)}`}>
                                                        {group.overall_pilar_status}
                                                    </span>
                                                </td>
                                            </tr>

                                            {/* Detail Rows */}
                                            {isExpanded && group.items.map((row, idx) => (
                                                <tr key={`${group.agent_id}-${idx}`} className="bg-slate-50/40 hover:bg-slate-100/50 transition-colors animate-in fade-in slide-in-from-top-1 duration-200">
                                                    <td className="px-6 py-2 border-l-4 border-slate-200">
                                                        <div className="flex items-center gap-2 pl-8">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                                            <span className="text-[11px] font-bold text-slate-400 uppercase italic">Desglose {idx + 1}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-2">
                                                        <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">{row.campaign_name}</span>
                                                    </td>
                                                    <td className="px-6 py-2">
                                                        <span className="text-[10px] font-black text-slate-600 uppercase bg-slate-200/50 px-2 py-1 rounded-lg">{row.product_family}</span>
                                                    </td>
                                                    <td className="px-6 py-2">
                                                        <span className="text-[10px] font-medium text-slate-400 uppercase italic">{row.supervisor_name}</span>
                                                    </td>
                                                    <td className="px-6 py-2 text-right font-bold text-slate-400 text-[10px]">
                                                        ${row.target_amount.toLocaleString()}
                                                    </td>
                                                    <td className="px-6 py-2 text-right font-bold text-slate-400 text-[10px]">
                                                        {row.target_units}
                                                    </td>
                                                    <td className="px-6 py-2 text-right font-black text-slate-700 text-[11px]">
                                                        ${row.sold_amount.toLocaleString()}
                                                    </td>
                                                    <td className="px-6 py-2 text-right font-black text-slate-700 text-[11px]">
                                                        {row.sold_count}
                                                    </td>
                                                    <td className="px-6 py-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[11px] font-black text-slate-700">{row.compliance_amount}%</span>
                                                            <div className="h-1 w-20 bg-slate-200 rounded-full overflow-hidden">
                                                                <div
                                                                    className={`h-full ${getProgressColor(row.pilar_color)}`}
                                                                    style={{ width: `${Math.min(row.compliance_amount, 100)}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-2 text-right">
                                                        <span className="text-[10px] font-bold text-slate-500">
                                                            ${row.projection_amount.toLocaleString()}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-2 text-right text-[10px] text-slate-500">
                                                        {row.projection_units}
                                                    </td>
                                                    <td className="px-6 py-2 text-center">
                                                        <span className={`px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-tighter border border-current ${getPilarStyles(row.pilar_color)}`}>
                                                            {row.pilar_estatus}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            {error && (
                <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl text-rose-600 text-[10px] font-black uppercase tracking-widest text-center mt-8 mb-4">
                    {error}
                </div>
            )}
        </div>
    );
}
