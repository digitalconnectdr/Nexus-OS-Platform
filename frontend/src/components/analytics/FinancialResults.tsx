'use client';

import { useState, useEffect, memo, useCallback } from 'react';
import { fetchFromAPI } from '@/lib/api';
import SkeletonTable from '@/components/ui/SkeletonTable';
import { usePermission } from '@/hooks/usePermission';
import {
    DollarSign,
    TrendingDown,
    TrendingUp,
    PieChart,
    Package,
    User,
    Trophy,
    Lock
} from 'lucide-react';

interface Props {
    startDate: string;
    endDate: string;
    status?: string;
    campaignId?: string;
}

const FinancialResults = memo(function FinancialResults({ startDate, endDate, status, campaignId }: Props) {
    const { can } = usePermission();
    const hasPermission = can('finance', 'finance', 'summary'); // Corrected to match backend summary key
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        if (!hasPermission) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            let url = `/api/v1/finance/summary?start_date=${startDate}&end_date=${endDate}`;
            if (status) url += `&status=${status}`;
            if (campaignId) url += `&campaign_id=${campaignId}`;

            const result = await fetchFromAPI(url);
            setData(result);
        } catch (err) {
            console.error("Error loading financial summary:", err);
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate, status, campaignId, hasPermission]);

    useEffect(() => {
        if (!hasPermission) return; // Silent return if no permission
        loadData();
    }, [loadData, hasPermission]);

    if (!hasPermission) {
        return (
            <div className="p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/20">
                <div className="w-12 h-12 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center shadow-sm mx-auto mb-4 border border-slate-100 dark:border-slate-800">
                    <Lock className="w-6 h-6 text-slate-400" />
                </div>
                <h3 className="text-slate-600 dark:text-slate-300 font-black uppercase tracking-tight text-sm">Visualización Restringida</h3>
                <p className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1 max-w-xs mx-auto leading-relaxed">
                    No tienes permisos para ver el resumen detallado de resultados financieros.
                </p>
            </div>
        );
    }

    if (loading && !data) return <SkeletonTable rows={10} cols={4} />;

    if (!data || data.error) return (
        <div className="bg-white dark:bg-slate-900 p-12 text-center rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No hay datos financieros disponibles para esta combinación de filtros.</p>
        </div>
    );

    return (
        <div className="space-y-8 animate-fade-in text-slate-800 dark:text-slate-100">
            {/* KPIs Principales - Resultados Financieros */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

                {/* Ingreso Bruto */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-md group">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors">
                            <DollarSign className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mb-1">Ingreso Bruto Total</p>
                            <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 leading-none">${(data.gross_revenue || 0).toLocaleString()}</h3>
                        </div>
                    </div>
                </div>

                {/* Costo Comisiones */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-md group">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl group-hover:bg-amber-100 dark:group-hover:bg-amber-900/30 transition-colors">
                            <TrendingDown className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mb-1">Costo de Comisiones</p>
                            <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 leading-none">${(data.commission_cost || 0).toLocaleString()}</h3>
                        </div>
                    </div>
                </div>

                {/* Ingreso Neto */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg shadow-emerald-100/50 dark:shadow-none border-l-4 border-l-emerald-500 transition-all hover:shadow-md group">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/30 transition-colors">
                            <TrendingUp className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest leading-none mb-1">Ingreso Neto (Utilidad)</p>
                            <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 leading-none">${(data.net_revenue || 0).toLocaleString()}</h3>
                        </div>
                    </div>
                </div>

                {/* Margen */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-md group">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/30 transition-colors">
                            <PieChart className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mb-1">Margen de Operación</p>
                            <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 leading-none">{data.profit_margin || 0}%</h3>
                        </div>
                    </div>
                </div>
            </div>

            {/* Detalles de Rentabilidad - Top Products & Agents */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* Top Productos */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] overflow-hidden isolation-isolate z-0 shadow-sm">
                    <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                            <h2 className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">🏆 Top 5 Productos</h2>
                        </div>
                        <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">Por Ingreso Generado</span>
                    </div>
                    <div className="p-4">
                        {data.top_products?.length > 0 ? (
                            <table className="w-full text-left">
                                <thead className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.1em] border-b border-slate-50 dark:border-slate-800">
                                    <tr>
                                        <th className="pb-3 pl-2">Producto</th>
                                        <th className="pb-3 text-center">Ventas</th>
                                        <th className="pb-3 text-right pr-2">Total ($)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                    {data.top_products.map((p: any, idx: number) => (
                                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                            <td className="py-3 pl-2">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[10px] font-black text-slate-300 dark:text-slate-600 w-4">{idx + 1}</span>
                                                    <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-tight">{p.name}</span>
                                                </div>
                                            </td>
                                            <td className="py-3 text-center">
                                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{p.count}</span>
                                            </td>
                                            <td className="py-3 text-right pr-2 font-black text-xs text-slate-900 dark:text-slate-100 tabular-nums">
                                                ${p.revenue.toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="py-8 text-center text-slate-400 text-[10px] font-bold uppercase tracking-widest">Sin datos de productos</div>
                        )}
                    </div>
                </div>

                {/* Top Agentes */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] overflow-hidden isolation-isolate z-0 shadow-sm">
                    <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                            <h2 className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">👤 Top 5 Agentes</h2>
                        </div>
                        <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">Por Volumen de Venta</span>
                    </div>
                    <div className="p-4">
                        {data.top_agents?.length > 0 ? (
                            <table className="w-full text-left">
                                <thead className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.1em] border-b border-slate-50 dark:border-slate-800">
                                    <tr>
                                        <th className="pb-3 pl-2">Agente</th>
                                        <th className="pb-3 text-right pr-2">Ingreso Generado ($)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                    {data.top_agents.map((a: any, idx: number) => (
                                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                            <td className="py-3 pl-2">
                                                <div className="flex items-center gap-3">
                                                    {idx === 0 ? <Trophy className="w-3.5 h-3.5 text-amber-500" /> : <span className="text-[10px] font-black text-slate-300 dark:text-slate-600 w-4">{idx + 1}</span>}
                                                    <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-tight">{a.name}</span>
                                                </div>
                                            </td>
                                            <td className="py-3 text-right pr-2 font-black text-xs text-emerald-600 dark:text-emerald-400 tabular-nums">
                                                ${a.revenue.toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="py-8 text-center text-slate-400 text-[10px] font-bold uppercase tracking-widest">Sin datos de agentes</div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
});

export default FinancialResults;
