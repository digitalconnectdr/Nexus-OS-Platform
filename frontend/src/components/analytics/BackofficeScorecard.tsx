'use client';

import { useState, useEffect, memo, useCallback } from 'react';
import { fetchFromAPI } from '@/lib/api';
import SkeletonTable from '@/components/ui/SkeletonTable';
import {
    UsersIcon,
    ClockIcon,
    LayoutGridIcon
} from 'lucide-react';

interface PerformanceMetric {
    value: number | string;
    formatted: string;
    tooltip: string;
}

interface AgentPerformance {
    agent_name: string;
    metrics: {
        success_rate: PerformanceMetric;
        rejection_rate: PerformanceMetric;
        backlog: PerformanceMetric;
        cycle_time: PerformanceMetric;
    };
    status_breakdown: Record<string, any>;
}

const BackofficeScorecard = memo(function BackofficeScorecard({ startDate, endDate }: { startDate: string, endDate: string }) {
    const [performanceData, setPerformanceData] = useState<AgentPerformance[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'digitization' | 'follow_up'>('digitization');

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            // Usamos el nuevo endpoint centralizado de performance
            const result = await fetchFromAPI(`/api/v1/analytics/performance?start_date=${startDate}&end_date=${endDate}`);
            setPerformanceData(result?.data_entry_scorecard || []);
        } catch (err) {
            console.error("Error loading performance data:", err);
            setPerformanceData([]);
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    if (loading && performanceData.length === 0) return <SkeletonTable rows={8} cols={5} />;

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            {/* Sub-Tab Navigation */}
            <div className="flex items-center gap-6 border-b border-slate-100 mb-2">
                <button
                    onClick={() => setActiveTab('digitization')}
                    className={`pb-3 text-[11px] font-black uppercase tracking-widest transition-all relative
                        ${activeTab === 'digitization' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    Digitación
                    {activeTab === 'digitization' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />}
                </button>
                <button
                    onClick={() => setActiveTab('follow_up')}
                    className={`pb-3 text-[11px] font-black uppercase tracking-widest transition-all relative
                        ${activeTab === 'follow_up' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    Seguimiento
                    {activeTab === 'follow_up' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />}
                </button>
            </div>

            <div className="flex items-center gap-2 mb-2">
                <LayoutGridIcon className="w-4 h-4 text-indigo-600" />
                <h2 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">
                    {activeTab === 'digitization' ? 'Scorecard de Digitación' : 'Rendimiento de Seguimiento'}
                </h2>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-[12px]">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-6 py-4 text-left font-black text-slate-400 uppercase tracking-wider">
                                {activeTab === 'digitization' ? 'Digitador' : 'Analista'}
                            </th>
                            <th className="px-6 py-4 text-center font-black text-slate-400 uppercase tracking-wider">Órdenes</th>
                            {activeTab === 'digitization' ? (
                                <>
                                    <th className="px-6 py-4 text-center font-black text-slate-400 uppercase tracking-wider">Tasa Rechazo</th>
                                    <th className="px-6 py-4 text-center font-black text-slate-400 uppercase tracking-wider">Tiempo Ciclo</th>
                                </>
                            ) : (
                                <>
                                    <th className="px-6 py-4 text-center font-black text-slate-400 uppercase tracking-wider">Tasa Éxito</th>
                                    <th className="px-6 py-4 text-center font-black text-slate-400 uppercase tracking-wider">Tasa Caída</th>
                                </>
                            )}
                            <th className="px-6 py-4 text-right font-black text-slate-900 uppercase tracking-wider">Backlog</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {performanceData.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-20 text-center">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No hay actividad registrada en este periodo</p>
                                </td>
                            </tr>
                        ) : (
                            performanceData.map((row) => {
                                // Calculamos total de órdenes desde el breakdown de estatus
                                const totalOrders = Object.values(row.status_breakdown).reduce((acc: number, s: any) => acc + s.count, 0);

                                return (
                                    <tr key={row.agent_name} className="hover:bg-slate-50 transition-colors group/row">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                                                    <UsersIcon className="w-4 h-4 text-indigo-600" />
                                                </div>
                                                <span className="font-black text-slate-900 uppercase tracking-tight">{row.agent_name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center relative group">
                                            <span className="font-black text-slate-900 text-lg tabular-nums cursor-help border-b border-dotted border-slate-300">
                                                {totalOrders}
                                            </span>

                                            {/* Drill-Down Tooltip */}
                                            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 bg-slate-900 text-white rounded-lg p-3 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none">
                                                <p className="text-[9px] font-black uppercase tracking-widest border-b border-slate-700 pb-2 mb-2">Desglose por Estatus</p>
                                                <div className="space-y-1.5">
                                                    {Object.entries(row.status_breakdown).map(([name, data]: [string, any]) => (
                                                        <div key={name} className="flex justify-between items-center text-[10px]">
                                                            <div className="flex items-center gap-1.5">
                                                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: data.color }} />
                                                                <span className="text-slate-300">{name}</span>
                                                            </div>
                                                            <span className="font-bold">{data.count}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-900" />
                                            </div>
                                        </td>

                                        {activeTab === 'digitization' ? (
                                            <>
                                                <td className="px-6 py-4 text-center" title={row.metrics.rejection_rate.tooltip}>
                                                    <div className="flex flex-col items-center">
                                                        <span className={`font-black text-lg tabular-nums ${(row.metrics.rejection_rate.value as number) > 15 ? 'text-rose-600' : 'text-slate-900'}`}>
                                                            {row.metrics.rejection_rate.formatted}
                                                        </span>
                                                        <div className="w-16 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full ${(row.metrics.rejection_rate.value as number) > 15 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                                                                style={{ width: `${Math.min(100, row.metrics.rejection_rate.value as number)}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center" title={row.metrics.cycle_time.tooltip}>
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <ClockIcon className="w-3.5 h-3.5 text-slate-400" />
                                                        <span className="font-black text-slate-700 tabular-nums">{row.metrics.cycle_time.formatted}</span>
                                                    </div>
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="px-6 py-4 text-center" title={row.metrics.success_rate.tooltip}>
                                                    <div className="flex flex-col items-center">
                                                        <span className={`font-black text-lg tabular-nums ${(row.metrics.success_rate.value as number) > 80 ? 'text-emerald-600' : 'text-slate-900'}`}>
                                                            {row.metrics.success_rate.formatted}
                                                        </span>
                                                        <div className="w-16 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full ${(row.metrics.success_rate.value as number) > 80 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                                                style={{ width: `${Math.min(100, row.metrics.success_rate.value as number)}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center" title={row.metrics.rejection_rate.tooltip}>
                                                    <div className="flex flex-col items-center">
                                                        <span className={`font-black text-lg tabular-nums ${(row.metrics.rejection_rate.value as number) > 10 ? 'text-rose-600' : 'text-slate-900'}`}>
                                                            {row.metrics.rejection_rate.formatted}
                                                        </span>
                                                        <div className="w-16 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full ${(row.metrics.rejection_rate.value as number) > 10 ? 'bg-rose-500' : 'bg-slate-300'}`}
                                                                style={{ width: `${Math.min(100, row.metrics.rejection_rate.value as number)}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </td>
                                            </>
                                        )}

                                        <td className="px-6 py-4 text-right" title={row.metrics.backlog.tooltip}>
                                            <span className={`px-4 py-1.5 rounded-xl font-black text-[13px] tabular-nums ${(row.metrics.backlog.value as number) > 5 ? 'bg-rose-50 text-rose-700' :
                                                (row.metrics.backlog.value as number) > 0 ? 'bg-amber-50 text-amber-700' : 'bg-slate-50 text-slate-400'
                                                }`}>
                                                {row.metrics.backlog.formatted}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
});

export default BackofficeScorecard;
