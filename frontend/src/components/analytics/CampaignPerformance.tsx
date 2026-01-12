'use client';

import { useState, useEffect, memo, useCallback } from 'react';
import { fetchFromAPI } from '@/lib/api';
import {
    RefreshCwIcon,
    ChevronRightIcon,
    PackageIcon,
    LayersIcon,
    InfoIcon
} from 'lucide-react';

// --- DEFINICIÓN DE TIPOS ---
interface MetricData {
    id: string;
    nombre: string;
    campaign_id?: string;
    // Dinero
    logro_money: number;
    objetivo_money: number;
    cumplimiento_money: number;
    proy_money: number;
    // Cantidad
    logro_count: number;
    objetivo_count: number;
    cumplimiento_count: number;
    proy_count: number;
    // Estatus y Comparativa
    status: string;
    pace_diff?: number;
    product_count?: number;
}

interface PerformanceResponse {
    month: string;
    campaigns: MetricData[];
    products: MetricData[];
}

interface Props {
    startDate: string;
    endDate: string;
    searchTerm: string;
}

// --- COMPONENTE: BADGE DE ESTADO ---
const StatusBadge = ({ status }: { status: string }) => {
    const styles = {
        Good: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        Warning: 'bg-amber-100 text-amber-700 border-amber-200',
        Critical: 'bg-rose-100 text-rose-700 border-rose-200',
    }[status] || 'bg-slate-100 text-slate-700 border-slate-200';

    const label = {
        Good: 'ÓPTIMO',
        Warning: 'ALERTA',
        Critical: 'RIESGO'
    }[status] || status.toUpperCase();

    return (
        <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider border ${styles}`}>
            {label}
        </span>
    );
};

// --- COMPONENTE: TOOLTIP DE INFORMACIÓN ---
const InfoTooltip = ({ content }: { content: string }) => (
    <div className="group relative inline-block ml-1 align-middle">
        <InfoIcon className="w-3 h-3 text-slate-300 cursor-help hover:text-indigo-500 transition-colors" />
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 bg-slate-900 text-white text-[9px] font-bold p-2 rounded-lg shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[100] pointer-events-none text-center leading-relaxed">
            {content}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-slate-900" />
        </div>
    </div>
);

// --- VISTA PRINCIPAL ---
const CampaignPerformance = memo(function CampaignPerformance({ startDate, endDate, searchTerm: globalSearchTerm }: Props) {
    const [data, setData] = useState<PerformanceResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

    // Derivamos el mes (YYYY-MM)
    const month = startDate.substring(0, 7);

    const loadData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const url = `/api/v1/campaign-performance/?month=${month}`;
            const result = await fetchFromAPI(url);
            if (result) {
                setData(result);
            }
        } catch (err: any) {
            console.error("Error loading campaign performance:", err);
            setError("No se pudo conectar con el servidor de métricas.");
        } finally {
            setIsLoading(false);
        }
    }, [month]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const formatCurrency = (val: number) => `$${val.toLocaleString()}`;

    // Filtrado
    const campaigns = (data?.campaigns || []).filter(c =>
        c.nombre.toLowerCase().includes(globalSearchTerm.toLowerCase())
    );

    const filteredProducts = (data?.products || []).filter(p => {
        const matchesCamp = selectedCampaignId ? p.campaign_id === selectedCampaignId : true;
        const matchesSearch = p.nombre.toLowerCase().includes(globalSearchTerm.toLowerCase());
        return matchesCamp && matchesSearch;
    });

    if (isLoading) {
        return (
            <div className="flex h-96 items-center justify-center space-x-3 bg-white rounded-3xl border border-dashed border-slate-200">
                <div className="h-4 w-4 bg-blue-600 rounded-full animate-bounce"></div>
                <div className="h-4 w-4 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="h-4 w-4 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <span className="text-slate-400 text-xs font-bold uppercase tracking-widest ml-2">Analizando rendimiento por campaña...</span>
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-20 animate-in fade-in duration-500">

            {/* --- CABECERA (Simplificada) --- */}
            <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-50 rounded-2xl shadow-inner">
                        <LayersIcon className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                        <h1 className="text-base font-black text-slate-800 uppercase tracking-widest">Rendimiento de Campañas</h1>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Control de metas y proyecciones por línea de negocio</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Periodo:</label>
                        <span className="text-[10px] font-black text-blue-600 uppercase">
                            {new Date(startDate + "T12:00:00").toLocaleString('es-ES', { month: 'long', year: 'numeric' })}
                        </span>
                    </div>

                    <button
                        onClick={loadData}
                        className="p-3 bg-white border border-slate-200 hover:border-blue-500 hover:text-blue-600 rounded-xl text-slate-400 transition-all shadow-sm active:scale-95"
                        title="Actualizar datos"
                    >
                        <RefreshCwIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* --- TABLA 1: CAMPAÑAS --- */}
            <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-xl shadow-slate-200/50">
                <div className="px-8 py-5 border-b border-slate-100 bg-slate-50/30 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-6 bg-blue-500 rounded-full" />
                        <h2 className="text-[12px] font-black text-slate-800 uppercase tracking-widest">Gestión de Campañas</h2>
                    </div>
                    <span className="text-[10px] font-black text-slate-500 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm uppercase tracking-tighter">
                        {campaigns.length} Líneas de Negocio
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">
                                <th className="px-8 py-4 text-left">Campaña / Línea</th>
                                <th className="px-4 py-4">Logro ($)</th>
                                <th className="px-4 py-4">Logro (#)</th>
                                <th className="px-4 py-4">Objetivo ($)</th>
                                <th className="px-4 py-4">Objetivo (#)</th>
                                <th className="px-4 py-4">
                                    Cumpl. ($)
                                    <InfoTooltip content="Porcentaje de avance vs meta monetaria de toda la campaña." />
                                </th>
                                <th className="px-4 py-4">
                                    Cumpl. (#)
                                    <InfoTooltip content="Porcentaje de avance vs meta en unidades de la campaña." />
                                </th>
                                <th className="px-4 py-4 text-blue-600 bg-blue-50/30">
                                    Proy ($)
                                    <InfoTooltip content="Estimación de cierre basada en el ritmo actual de la campaña." />
                                </th>
                                <th className="px-4 py-4 text-blue-600 bg-blue-50/30">
                                    Proy (#)
                                    <InfoTooltip content="Estimación de unidades al cierre para esta campaña." />
                                </th>
                                <th className="px-4 py-4">
                                    Ritmo %
                                    <InfoTooltip content="Comparativa: Proyección actual vs Cierre anterior de la campaña." />
                                </th>
                                <th className="px-8 py-4 text-right">Estatus</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {campaigns.map((c) => {
                                const isSelected = selectedCampaignId === c.id;
                                return (
                                    <tr
                                        key={c.id}
                                        onClick={() => setSelectedCampaignId(isSelected ? null : c.id)}
                                        className={`group cursor-pointer transition-all duration-300 hover:bg-blue-50/40 ${isSelected ? 'bg-blue-50/80' : ''}`}
                                    >
                                        <td className="px-8 py-4">
                                            <div className="flex items-center gap-4">
                                                <div className={`p-2.5 rounded-xl ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors'}`}>
                                                    <LayersIcon className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <p className={`text-xs font-black uppercase tracking-tight ${isSelected ? 'text-blue-700' : 'text-slate-700'}`}>
                                                        {c.nombre}
                                                    </p>
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase">
                                                        {c.product_count} Productos Asociados
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-center text-[11px] font-black text-slate-800 tabular-nums">
                                            {formatCurrency(c.logro_money)}
                                        </td>
                                        <td className="px-4 py-4 text-center text-[11px] font-black text-slate-800 tabular-nums">
                                            {c.logro_count}
                                        </td>
                                        <td className="px-4 py-4 text-center text-[11px] font-bold text-slate-400 tabular-nums">
                                            {formatCurrency(c.objetivo_money)}
                                        </td>
                                        <td className="px-4 py-4 text-center text-[11px] font-bold text-slate-400 tabular-nums">
                                            {c.objetivo_count}
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <span className={`text-[11px] font-black ${c.cumplimiento_money >= 100 ? 'text-emerald-600' : 'text-slate-600'}`}>
                                                {c.cumplimiento_money}%
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <span className={`text-[11px] font-black ${c.cumplimiento_count >= 100 ? 'text-emerald-600' : 'text-slate-600'}`}>
                                                {c.cumplimiento_count}%
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-center text-[11px] font-black text-blue-600 bg-blue-50/50 rounded-lg">
                                            {formatCurrency(c.proy_money)}
                                        </td>
                                        <td className="px-4 py-4 text-center text-[11px] font-black text-blue-600">
                                            {c.proy_count}
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <span className={`text-[10px] font-black ${c.pace_diff! >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                    {c.pace_diff! > 0 ? '+' : ''}{c.pace_diff}%
                                                </span>
                                                {c.pace_diff! >= 0 ? (
                                                    <ChevronRightIcon className="w-3 h-3 text-emerald-500 -rotate-90" />
                                                ) : (
                                                    <ChevronRightIcon className="w-3 h-3 text-rose-500 rotate-90" />
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-8 py-4 text-right">
                                            <StatusBadge status={c.status} />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* --- TABLA 2: PRODUCTOS --- */}
            <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-xl shadow-slate-200/50">
                <div className="px-8 py-5 border-b border-slate-100 bg-slate-50/30 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-6 bg-emerald-500 rounded-full" />
                        <h2 className="text-[12px] font-black text-slate-800 uppercase tracking-widest">Ejecución por Producto</h2>
                    </div>
                    {selectedCampaignId && (
                        <button
                            onClick={() => setSelectedCampaignId(null)}
                            className="text-[9px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200 uppercase tracking-tighter hover:bg-blue-100 transition-colors"
                        >
                            Ver Todos los Productos
                        </button>
                    )}
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">
                                <th className="px-8 py-4 text-left">Producto</th>
                                <th className="px-3 py-4">Logro ($)</th>
                                <th className="px-3 py-4">Logro (#)</th>
                                <th className="px-3 py-4">Objetivo ($)</th>
                                <th className="px-3 py-4">Objetivo (#)</th>
                                <th className="px-3 py-4">Cumpl. ($)</th>
                                <th className="px-3 py-4">Cumpl. (#)</th>
                                <th className="px-3 py-4 text-emerald-600 bg-emerald-50/20">Proy ($)</th>
                                <th className="px-3 py-4 text-emerald-600 bg-emerald-50/20">Proy (#)</th>
                                <th className="px-3 py-4">Ritmo %</th>
                                <th className="px-8 py-4 text-right">Estatus</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredProducts.map((p) => (
                                <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-8 py-4">
                                        <div className="flex items-center gap-3">
                                            <PackageIcon className="w-4 h-4 text-slate-300" />
                                            <div>
                                                <p className="text-xs font-black text-slate-700 uppercase tracking-tight">{p.nombre}</p>
                                                <p className="text-[8px] font-bold text-slate-400 uppercase">SKU: {p.id.substring(0, 8).toUpperCase()}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-3 py-4 text-center text-[10px] font-black text-slate-800 tabular-nums">
                                        {formatCurrency(p.logro_money)}
                                    </td>
                                    <td className="px-3 py-4 text-center text-[10px] font-black text-slate-800 tabular-nums">
                                        {p.logro_count}
                                    </td>
                                    <td className="px-3 py-4 text-center text-[10px] font-bold text-slate-400 tabular-nums">
                                        {formatCurrency(p.objetivo_money)}
                                    </td>
                                    <td className="px-3 py-4 text-center text-[10px] font-bold text-slate-400 tabular-nums">
                                        {p.objetivo_count}
                                    </td>
                                    <td className="px-3 py-4 text-center">
                                        <span className={`text-[10px] font-black ${p.cumplimiento_money >= 100 ? 'text-emerald-500' : 'text-slate-500'}`}>
                                            {p.cumplimiento_money}%
                                        </span>
                                    </td>
                                    <td className="px-3 py-4 text-center">
                                        <span className={`text-[10px] font-black ${p.cumplimiento_count >= 100 ? 'text-emerald-500' : 'text-slate-500'}`}>
                                            {p.cumplimiento_count}%
                                        </span>
                                    </td>
                                    <td className="px-3 py-4 text-center text-[10px] font-black text-emerald-600 bg-emerald-50/30 rounded-lg">
                                        {formatCurrency(p.proy_money)}
                                    </td>
                                    <td className="px-3 py-4 text-center text-[10px] font-black text-emerald-600">
                                        {p.proy_count}
                                    </td>
                                    <td className="px-3 py-4 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            <span className={`text-[10px] font-black ${p.pace_diff! >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {p.pace_diff! > 0 ? '+' : ''}{p.pace_diff}%
                                            </span>
                                            {p.pace_diff! >= 0 ? (
                                                <ChevronRightIcon className="w-3 h-3 text-emerald-500 -rotate-90" />
                                            ) : (
                                                <ChevronRightIcon className="w-3 h-3 text-rose-500 rotate-90" />
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-8 py-4 text-right">
                                        <StatusBadge status={p.status} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {error && (
                <div className="bg-rose-50 border border-current p-4 rounded-3xl text-rose-600 text-[10px] font-black uppercase tracking-widest text-center animate-pulse">
                    {error}
                </div>
            )}
        </div>
    );
});

export default CampaignPerformance;
