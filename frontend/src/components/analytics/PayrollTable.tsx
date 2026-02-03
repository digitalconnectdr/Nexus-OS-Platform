'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchFromAPI } from '@/lib/api';
import SkeletonTable from '@/components/ui/SkeletonTable';
import { usePermission } from '@/hooks/usePermission';
import {
    BanknotesIcon,
    UserGroupIcon,
    CurrencyDollarIcon,
    ArrowTrendingUpIcon,
    InformationCircleIcon,
    ArrowUpIcon,
    ArrowDownIcon,
    PresentationChartLineIcon,
    LockClosedIcon
} from '@heroicons/react/24/outline';
import { Tooltip } from '@/components/ui/tooltip';

interface PayrollItem {
    agent_id: string;
    agent_name: string;
    sales_count: number;
    total_volume: number;
    total_commissions: number;
    avg_ticket: number;
    trend_mom: number;
    projection: number;
    goal_pct: number;
}

interface PayrollResponse {
    period: { start: string; end: string };
    payroll: PayrollItem[];
    totals: {
        total_sales_count: number;
        total_volume: number;
        total_commissions: number;
    };
}

interface Props {
    startDate: string;
    endDate: string;
    status?: string;
    campaignId?: string;
}

const HeaderTooltip = ({ label, tooltip }: { label: string; tooltip: string }) => (
    <div className="flex items-center gap-1.5 cursor-help">
        <span>{label}</span>
        <Tooltip content={tooltip}>
            <InformationCircleIcon className="w-3.5 h-3.5 text-slate-300 hover:text-blue-500 transition-colors" />
        </Tooltip>
    </div>
);

export default function PayrollTable({ startDate, endDate, status, campaignId }: Props) {
    const { can } = usePermission();
    const hasPermission = can('finance', 'finance', 'payroll');
    const [data, setData] = useState<PayrollResponse | null>(null);
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        if (!hasPermission) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            let url = `/api/v1/finance/payroll?start_date=${startDate}&end_date=${endDate}`;
            if (status) url += `&status=${status}`;
            if (campaignId) url += `&campaign_id=${campaignId}`;

            const result = await fetchFromAPI(url);
            setData(result);
        } catch (err) {
            console.error("Error loading payroll data:", err);
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate, status, campaignId, hasPermission]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    if (!hasPermission) {
        return (
            <div className="p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/20">
                <div className="w-12 h-12 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center shadow-sm mx-auto mb-4 border border-slate-100 dark:border-slate-800">
                    <LockClosedIcon className="w-6 h-6 text-slate-400" />
                </div>
                <h3 className="text-slate-600 dark:text-slate-300 font-black uppercase tracking-tight text-sm">Visualización Restringida</h3>
                <p className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1 max-w-xs mx-auto leading-relaxed">
                    No tienes permisos para ver la nómina de comisiones detallada.
                </p>
            </div>
        );
    }

    if (loading) return <SkeletonTable rows={8} cols={7} />;

    const payroll = data?.payroll || [];
    const totals = data?.totals || { total_sales_count: 0, total_volume: 0, total_commissions: 0 };

    return (
        <div className="space-y-6 animate-fade-in text-slate-800 dark:text-slate-100">
            {/* Intel Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm border-l-4 border-l-blue-600">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                            <UserGroupIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mb-1">Impacto en Ventas</p>
                            <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 leading-none">{totals.total_sales_count} Registros</h3>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm border-l-4 border-l-indigo-600">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
                            <ArrowTrendingUpIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mb-1">Volumen de Cartera</p>
                            <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 leading-none">${(totals.total_volume || 0).toLocaleString()}</h3>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg shadow-emerald-100/50 dark:shadow-none border-l-4 border-l-emerald-600 ring-2 ring-emerald-50 dark:ring-emerald-900/20">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                            <CurrencyDollarIcon className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest leading-none mb-1">Costo de Incentivos</p>
                            <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 leading-none">${(totals.total_commissions || 0).toLocaleString()}</h3>
                        </div>
                    </div>
                </div>
            </div>

            {/* Table Section */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
                <div className="px-8 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-2">
                        <PresentationChartLineIcon className="w-5 h-5 text-indigo-500" />
                        <h2 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest">Análisis de Rendimiento y Nómina</h2>
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 uppercase tracking-tight">
                            {payroll.length} Colaboradores
                        </span>
                    </div>
                </div>

                <div className="overflow-x-auto text-slate-800 dark:text-slate-200">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                <th className="px-8 py-4">Agente</th>
                                <th className="px-4 py-4 text-center">Ventas (#)</th>
                                <th className="px-4 py-4 text-right">
                                    <HeaderTooltip label="Ticket Promedio ($)" tooltip="Promedio de valor por venta realizada (Volumen Total / Cantidad Ventas)." />
                                </th>
                                <th className="px-4 py-4 text-right">
                                    <HeaderTooltip label="Tendencia (MoM)" tooltip="Comparativo de rendimiento vs. el mismo rango del mes anterior." />
                                </th>
                                <th className="px-4 py-4 text-center">
                                    <HeaderTooltip label="% Meta" tooltip="Porcentaje alcanzado del objetivo mensual asignado al agente." />
                                </th>
                                <th className="px-4 py-4 text-right bg-emerald-50/30 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-400">
                                    <HeaderTooltip label="Proyección ($)" tooltip="Estimación de cierre de mes basada en el ritmo de venta diario actual." />
                                </th>
                                <th className="px-8 py-4 text-right">Comisiones ($)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                            {payroll.map((item) => (
                                <tr key={item.agent_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group">
                                    <td className="px-8 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-black text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700">
                                                {item.agent_name?.charAt(0) || 'A'}
                                            </div>
                                            <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                                {item.agent_name || 'Desconocido'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-center text-xs font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                                        {item.sales_count || 0}
                                    </td>
                                    <td className="px-4 py-4 text-right text-xs font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                                        ${(item.avg_ticket || 0).toLocaleString(undefined, { minimumFractionDigits: 1 })}
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                        <div className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full ${item.trend_mom >= 0 ? 'text-emerald-600 bg-emerald-50' : 'text-red-600 bg-red-50'}`}>
                                            {item.trend_mom >= 0 ? <ArrowUpIcon className="w-2.5 h-2.5" /> : <ArrowDownIcon className="w-2.5 h-2.5" />}
                                            {Math.abs(item.trend_mom)}%
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex flex-col items-center gap-1">
                                            <div className="w-24 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700">
                                                <div
                                                    className={`h-full transition-all duration-1000 ${item.goal_pct >= 100 ? 'bg-emerald-500' : item.goal_pct >= 70 ? 'bg-blue-500' : 'bg-amber-500'}`}
                                                    style={{ width: `${Math.min(item.goal_pct, 100)}%` }}
                                                />
                                            </div>
                                            <span className="text-[9px] font-black text-slate-400 dark:text-slate-500">{item.goal_pct}%</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-right text-xs font-black text-indigo-600 dark:text-indigo-400 tabular-nums bg-emerald-50/10 dark:bg-emerald-900/5">
                                        ${(item.projection || 0).toLocaleString()}
                                    </td>
                                    <td className="px-8 py-4 text-right text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                                        ${(item.total_commissions || 0).toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                            {payroll.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-8 py-12 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                                        No se encontraron registros activos para los filtros seleccionados
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
