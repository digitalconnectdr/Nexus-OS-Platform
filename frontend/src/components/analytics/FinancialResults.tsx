'use client';

import { useState, useEffect, memo, useCallback } from 'react';
import { fetchFromAPI } from '@/lib/api';
import SkeletonTable from '@/components/ui/SkeletonTable';
import {
    InfoIcon,
    TrendingUpIcon,
    BarChart3Icon,
    DollarSignIcon
} from 'lucide-react';

interface Props {
    startDate: string;
    endDate: string;
    campaignId?: string;
    supervisorId?: string;
}

const FinancialResults = memo(function FinancialResults({ startDate, endDate, campaignId, supervisorId }: Props) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            let url = `/api/v1/analytics/efficiency-v3?start_date=${startDate}&end_date=${endDate}`;
            if (campaignId) url += `&campaign_id=${campaignId}`;
            if (supervisorId) url += `&supervisor_id=${supervisorId}`;

            const result = await fetchFromAPI(url);
            setData(result.financial_metrics);
        } catch (err) {
            console.error("Error loading financial data:", err);
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate, campaignId, supervisorId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    if (loading && !data) return <SkeletonTable rows={5} cols={4} />;

    if (!data) return null;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
            {/* KPIs Principales */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md group">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-emerald-50 rounded-xl group-hover:bg-emerald-100 transition-colors">
                        <DollarSignIcon className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Revenue Total</p>
                        <h3 className="text-xl font-black text-slate-900 leading-none">${(data.total_revenue || 0).toLocaleString()}</h3>
                    </div>
                </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md group">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-50 rounded-xl group-hover:bg-blue-100 transition-colors">
                        <TrendingUpIcon className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Ticket Promedio</p>
                        <h3 className="text-xl font-black text-slate-900 leading-none">${(data.avg_ticket || 0).toLocaleString()}</h3>
                    </div>
                </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md group">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-50 rounded-xl group-hover:bg-indigo-100 transition-colors">
                        <BarChart3Icon className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Producción Total</p>
                        <h3 className="text-xl font-black text-slate-900 leading-none">{data.total_units || 0} UDS</h3>
                    </div>
                </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md group">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-amber-50 rounded-xl group-hover:bg-amber-100 transition-colors">
                        <InfoIcon className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Costo Estimado</p>
                        <h3 className="text-xl font-black text-slate-900 leading-none">${(data.total_estimated_cost || 0).toLocaleString()}</h3>
                    </div>
                </div>
            </div>

            {/* Tabla de Productos */}
            <div className="md:col-span-2 lg:col-span-4 mt-4">
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-1.5 h-4 bg-emerald-500 rounded-full" />
                    <h2 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Desglose de Rentabilidad por Producto</h2>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                    <table className="w-full text-[12px]">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="px-6 py-4 text-left font-black text-slate-400 uppercase tracking-wider">Producto/Familia</th>
                                <th className="px-6 py-4 text-center font-black text-slate-400 uppercase tracking-wider">Unidades</th>
                                <th className="px-6 py-4 text-right font-black text-slate-400 uppercase tracking-wider">Revenue</th>
                                <th className="px-6 py-4 text-right font-black text-slate-900 uppercase tracking-wider tracking-widest">Rentabilidad</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {(data.by_product || []).map((item: any) => (
                                <tr key={item.name} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 font-black text-slate-900 uppercase tracking-tight">{item.name}</td>
                                    <td className="px-6 py-4 text-center font-bold text-slate-400">{item.units}</td>
                                    <td className="px-6 py-4 text-right font-bold text-slate-900 tabular-nums">${(item.revenue || 0).toLocaleString()}</td>
                                    <td className="px-6 py-4 text-right">
                                        <span className={`px-3 py-1 rounded-full font-black text-[11px] ${item.profitability >= 30 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                                            {item.profitability}%
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
});

export default FinancialResults;
