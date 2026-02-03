'use client';

import { useState, useEffect, memo, useCallback } from 'react';
import { fetchFromAPI } from '@/lib/api';
import SkeletonTable from '@/components/ui/SkeletonTable';
import { usePermission } from '@/hooks/usePermission';
import {
    ResponsiveContainer,
    ComposedChart,
    Bar,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    BarChart,
    Cell
} from 'recharts';
import { TrendingUpIcon, CalendarIcon, PieChartIcon, LockIcon } from 'lucide-react';

interface Props {
    startDate: string;
    endDate: string;
    status?: string;
    campaignId?: string;
}

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4'];

const ManagerialVisionTab = memo(function ManagerialVisionTab({ startDate, endDate, status, campaignId }: Props) {
    const { can } = usePermission();
    const hasPermission = can('finance', 'finance', 'management');
    const [trends, setTrends] = useState<any[]>([]);
    const [campaignData, setCampaignData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        if (!hasPermission) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            let baseUrl = `/api/v1/finance/trends?start_date=${startDate}&end_date=${endDate}`;
            let campUrl = `/api/v1/finance/campaign-revenue?start_date=${startDate}&end_date=${endDate}`;

            if (status) {
                baseUrl += `&status=${status}`;
                campUrl += `&status=${status}`;
            }
            if (campaignId) baseUrl += `&campaign_id=${campaignId}`;

            const [trendsRes, campRes] = await Promise.all([
                fetchFromAPI(baseUrl),
                fetchFromAPI(campUrl)
            ]);

            setTrends(trendsRes || []);
            setCampaignData(campRes || []);
        } catch (err) {
            console.error("Error loading financial trends:", err);
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate, status, campaignId, hasPermission]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    if (!hasPermission) {
        return (
            <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mx-auto mb-4 border border-slate-100">
                    <LockIcon className="w-6 h-6 text-slate-400" />
                </div>
                <h3 className="text-slate-600 font-black uppercase tracking-tight text-sm">Visualización Restringida</h3>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1 max-w-xs mx-auto leading-relaxed">
                    No tienes permisos para ver el análisis de rentabilidad y visión gerencial.
                </p>
            </div>
        );
    }

    if (loading && trends.length === 0) return <SkeletonTable rows={10} cols={3} />;

    return (
        <div className="space-y-8 animate-fade-in text-slate-800">
            {/* Header Section */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                        <TrendingUpIcon className="w-5 h-5 text-indigo-600" />
                        Visión Gerencial & Rentabilidad
                    </h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                        Análisis comparativo de Ingresos vs. Gasto en Comisiones
                    </p>
                </div>
                <div className="bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 flex items-center gap-3">
                    <CalendarIcon className="w-4 h-4 text-slate-400" />
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                        Filtros Globales Activos
                    </span>
                </div>
            </div>

            {/* Grid de Gráficos */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

                {/* Chart 1: Tendencias (Ocupa 2 cols) */}
                <div className="xl:col-span-2 bg-white p-8 rounded-3xl border border-slate-200 shadow-lg shadow-slate-100/50">
                    <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest mb-8 flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full" />
                        Serie de Tiempo: Ingresos vs Comisiones
                    </h4>
                    <div className="h-[350px] w-full">
                        {trends.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart
                                    data={trends}
                                    margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis
                                        dataKey="date"
                                        fontSize={10}
                                        fontWeight="bold"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#94a3b8' }}
                                    />
                                    <YAxis
                                        fontSize={10}
                                        fontWeight="bold"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#94a3b8' }}
                                        tickFormatter={(value) => `$${value.toLocaleString()}`}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#fff',
                                            borderRadius: '16px',
                                            border: '1px solid #e2e8f0',
                                            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                                            padding: '12px'
                                        }}
                                        labelStyle={{ fontWeight: 'black', textTransform: 'uppercase', fontSize: '10px', marginBottom: '8px', color: '#1e293b' }}
                                    />
                                    <Legend
                                        verticalAlign="top"
                                        align="right"
                                        iconType="circle"
                                        wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', paddingBottom: '20px' }}
                                    />
                                    <Bar
                                        dataKey="revenue"
                                        name="Ingreso Bruto"
                                        fill="#10b981"
                                        radius={[4, 4, 0, 0]}
                                        barSize={30}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="commissions"
                                        name="Comisiones"
                                        stroke="#3b82f6"
                                        strokeWidth={3}
                                        dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                                        activeDot={{ r: 6, strokeWidth: 0 }}
                                    />
                                </ComposedChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                                No hay datos de tendencia para estos filtros
                            </div>
                        )}
                    </div>
                </div>

                {/* Chart 2: Mix de Campañas (Ocupa 1 col) */}
                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-lg shadow-slate-100/50">
                    <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest mb-8 flex items-center gap-2">
                        <PieChartIcon className="w-4 h-4 text-indigo-500" />
                        Ingresos por Campaña
                    </h4>
                    <div className="h-[350px] w-full">
                        {campaignData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={campaignData}
                                    layout="vertical"
                                    margin={{ top: 0, right: 30, left: 40, bottom: 0 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                    <XAxis type="number" hide />
                                    <YAxis
                                        dataKey="name"
                                        type="category"
                                        fontSize={9}
                                        fontWeight="black"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#475569' }}
                                        width={100}
                                    />
                                    <Tooltip
                                        cursor={{ fill: 'transparent' }}
                                        contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '10px' }}
                                        formatter={(val: any) => [`$${val.toLocaleString()}`, 'Ingreso']}
                                    />
                                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                                        {campaignData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                                Sin datos de campañas
                            </div>
                        )}
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-50 flex flex-wrap gap-2">
                        {campaignData.map((c, i) => (
                            <div key={i} className="flex items-center gap-2 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">{c.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
});

export default ManagerialVisionTab;
