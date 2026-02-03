'use client';

import { useState, useEffect, memo, useCallback } from 'react';
import { fetchFromAPI } from '@/lib/api';
import {
    BarChart3Icon,
    RefreshCwIcon,
    ChevronRightIcon,
    ChevronDownIcon,
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
    pace_diff?: number; // % Mejora vs mes anterior
}

interface CampaignPerformanceResponse {
    month: string;
    campaigns: MetricData[];
    products: MetricData[];
}

interface Props {
    startDate: string;
    endDate: string;
    searchTerm: string;
    hideHeader?: boolean;
    refreshTrigger?: number;
    campaignId?: string;
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
const CampaignProductPerformance = memo(function CampaignProductPerformance({
    startDate,
    endDate,
    searchTerm: globalSearchTerm,
    hideHeader = false,
    refreshTrigger,
    campaignId: propCampaignId
}: Props) {
    const [data, setData] = useState<CampaignPerformanceResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Derivamos el mes de la fecha de inicio global (formato YYYY-MM)
    const month = startDate.substring(0, 7);
    const [selectedCampaignIdState, setSelectedCampaignId] = useState<string | null>(null);

    // Priorizar la campaña global si existe
    const selectedCampaignId = propCampaignId || selectedCampaignIdState;

    const safeValue = (val: any) => {
        if (val === null || val === undefined || isNaN(val) || !isFinite(val)) return 0;
        return val;
    };

    // --- CARGA DE DATOS ---
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
            console.error("Error loading campaign performance data:", err);
            setError("No se pudo conectar con el servidor de métricas de campaña.");
        } finally {
            setIsLoading(false);
        }
    }, [startDate, endDate]);

    useEffect(() => {
        loadData();
    }, [loadData, refreshTrigger]);

    const formatCurrency = (val: number) => `$${val.toLocaleString()}`;

    // Filtrado de productos basado en la campaña seleccionada y el término de búsqueda
    const filteredProducts = (data?.products || []).filter(product => {
        const matchesCampaign = (selectedCampaignId && selectedCampaignId !== 'Todos' && selectedCampaignId !== 'All')
            ? product.campaign_id === selectedCampaignId
            : true;
        const matchesSearch = (product.nombre || "").toLowerCase().includes(globalSearchTerm.toLowerCase());
        return matchesCampaign && matchesSearch;
    });

    const campaigns = (data?.campaigns || []).filter(camp =>
        camp.nombre.toLowerCase().includes(globalSearchTerm.toLowerCase())
    );

    if (isLoading) {
        return (
            <div className="space-y-8 pb-20 animate-pulse">
                {!hideHeader && (
                    <div className="h-24 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 flex items-center px-6">
                        <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-2xl mr-4" />
                        <div className="space-y-2">
                            <div className="h-4 w-48 bg-slate-100 dark:bg-slate-800 rounded" />
                            <div className="h-3 w-32 bg-slate-100 dark:bg-slate-800 rounded" />
                        </div>
                    </div>
                )}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] min-h-[400px] overflow-hidden isolation-isolate z-0 shadow-sm">
                    <div className="px-8 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/30 h-16" />
                    <div className="p-8 space-y-4">
                        {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="h-10 bg-slate-50 dark:bg-slate-800/30 rounded-xl" />
                        ))}
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] min-h-[400px] overflow-hidden isolation-isolate z-0 shadow-sm">
                    <div className="px-8 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/30 h-16" />
                    <div className="p-8 space-y-4">
                        {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="h-10 bg-slate-50 dark:bg-slate-800/30 rounded-xl" />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-20 animate-in fade-in duration-500">

            {/* --- CABECERA DE SECCIÓN --- */}
            {!hideHeader && (
                <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl shadow-inner dark:shadow-none">
                            <LayersIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <h1 className="text-base font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest">Rendimiento por Campaña y Producto</h1>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-tighter">Métricas de cumplimiento y proyecciones por línea de negocio</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
                            <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Periodo:</label>
                            <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase">
                                {new Date(startDate + "T12:00:00").toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} - {new Date(endDate + "T12:00:00").toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                        </div>

                        <button
                            onClick={loadData}
                            className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500 hover:text-blue-600 rounded-xl text-slate-400 dark:text-slate-500 transition-all shadow-sm active:scale-95"
                            title="Actualizar datos"
                        >
                            <RefreshCwIcon className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* --- TABLA 1: CAMPAÑAS --- */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden isolation-isolate z-0">
                <div className="px-8 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/30 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-6 bg-blue-500 rounded-full" />
                        <h2 className="text-[12px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest">Desempeño de Campañas</h2>
                    </div>
                    <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-950 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-800 shadow-sm uppercase tracking-tighter">
                        {campaigns.length} Campañas Activas
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">
                                <th className="px-8 py-4 text-left">Campaña / Línea</th>
                                <th className="px-4 py-4">Logro ($)</th>
                                <th className="px-4 py-4">Logro (#)</th>
                                <th className="px-4 py-4">Objetivo ($)</th>
                                <th className="px-4 py-4">Objetivo (#)</th>
                                <th className="px-4 py-4">
                                    Cumpl. ($)
                                    <InfoTooltip content="Avance vs Meta monetaria." />
                                </th>
                                <th className="px-4 py-4">
                                    Cumpl. (#)
                                    <InfoTooltip content="Avance vs Meta en unidades." />
                                </th>
                                <th className="px-4 py-4 text-blue-600 dark:text-blue-400 bg-blue-50/30 dark:bg-blue-900/10">
                                    Proy ($)
                                    <InfoTooltip content="Cierre estimado en dinero." />
                                </th>
                                <th className="px-4 py-4 text-blue-600 dark:text-blue-400 bg-blue-50/30 dark:bg-blue-900/10">
                                    Proy (#)
                                    <InfoTooltip content="Cierre estimado en unidades." />
                                </th>
                                <th className="px-4 py-4">
                                    Ritmo %
                                    <InfoTooltip content="Mejora proyectada vs Cierre mes anterior." />
                                </th>
                                <th className="px-8 py-4 text-right">Estatus</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                            {campaigns.map((camp) => {
                                const isSelected = selectedCampaignId === camp.id;
                                return (
                                    <tr
                                        key={camp.id}
                                        onClick={() => setSelectedCampaignId(isSelected ? null : camp.id)}
                                        className={`group cursor-pointer transition-all duration-300 hover:bg-blue-50/40 dark:hover:bg-blue-900/20 ${isSelected ? 'bg-blue-50/80 dark:bg-blue-900/40' : ''}`}
                                    >
                                        <td className="px-8 py-4">
                                            <div className="flex items-center gap-4">
                                                <div className="relative">
                                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center ring-2 ring-white dark:ring-slate-800 shadow-sm ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'}`}>
                                                        <LayersIcon className="w-5 h-5" />
                                                    </div>
                                                    {isSelected && <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-blue-600 rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center"><ChevronDownIcon className="w-3 h-3 text-white" /></div>}
                                                </div>
                                                <div>
                                                    <p className={`text-xs font-black uppercase tracking-tight ${isSelected ? 'text-blue-700 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-blue-400'}`}>
                                                        {camp.nombre}
                                                    </p>
                                                    <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter">ID: {camp.id.substring(0, 8)}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-center text-[11px] font-black text-slate-800 dark:text-slate-200 tabular-nums">
                                            {formatCurrency(safeValue(camp.logro_money))}
                                        </td>
                                        <td className="px-4 py-4 text-center text-[11px] font-black text-slate-800 dark:text-slate-200 tabular-nums">
                                            {safeValue(camp.logro_count)}
                                        </td>
                                        <td className="px-4 py-4 text-center text-[11px] font-bold text-slate-400 dark:text-slate-500 tabular-nums">
                                            {formatCurrency(camp.objetivo_money)}
                                        </td>
                                        <td className="px-4 py-4 text-center text-[11px] font-bold text-slate-400 dark:text-slate-500 tabular-nums">
                                            {camp.objetivo_count}
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <span className={`text-[11px] font-black ${camp.cumplimiento_money >= 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'}`}>
                                                {camp.cumplimiento_money}%
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <span className={`text-[11px] font-black ${camp.cumplimiento_count >= 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'}`}>
                                                {camp.cumplimiento_count}%
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-center text-[11px] font-black text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/20 rounded-lg">
                                            {formatCurrency(camp.proy_money)}
                                        </td>
                                        <td className="px-4 py-4 text-center text-[11px] font-black text-blue-600 dark:text-blue-400">
                                            {camp.proy_count}
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            {camp.pace_diff !== undefined && (
                                                <div className="flex items-center justify-center gap-1">
                                                    <span className={`text-[10px] font-black ${camp.pace_diff >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                        {camp.pace_diff > 0 ? '+' : ''}{camp.pace_diff}%
                                                    </span>
                                                    {camp.pace_diff >= 0 ? (
                                                        <ChevronRightIcon className="w-3 h-3 text-emerald-500 dark:text-emerald-400 -rotate-90" />
                                                    ) : (
                                                        <ChevronRightIcon className="w-3 h-3 text-rose-500 dark:text-rose-400 rotate-90" />
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-8 py-4 text-right">
                                            <StatusBadge status={camp.status} />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* --- TABLA 2: PRODUCTOS --- */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden isolation-isolate z-0">
                <div className="px-8 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/30 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-6 bg-emerald-500 rounded-full" />
                        <h2 className="text-[12px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest">Rentabilidad por Producto</h2>
                    </div>
                    {selectedCampaignId && (
                        <button
                            onClick={() => setSelectedCampaignId(null)}
                            className="text-[9px] font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded-full border border-blue-200 dark:border-blue-800 uppercase tracking-tighter hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                        >
                            Ver Todos los Productos
                        </button>
                    )}
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">
                                <th className="px-8 py-4 text-left">Producto / SKU</th>
                                <th className="px-3 py-4">Logro ($)</th>
                                <th className="px-3 py-4">Logro (#)</th>
                                <th className="px-3 py-4">Objetivo ($)</th>
                                <th className="px-3 py-4">Objetivo (#)</th>
                                <th className="px-3 py-4">Cumpl. ($)</th>
                                <th className="px-3 py-4">Cumpl. (#)</th>
                                <th className="px-3 py-4 text-emerald-600 dark:text-emerald-400 bg-emerald-50/20 dark:bg-emerald-900/10">Proy ($)</th>
                                <th className="px-3 py-4 text-emerald-600 dark:text-emerald-400 bg-emerald-50/20 dark:bg-emerald-900/10">Proy (#)</th>
                                <th className="px-3 py-4">Ritmo %</th>
                                <th className="px-8 py-4 text-right">Estatus</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                            {filteredProducts.map((product) => (
                                <tr key={product.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="px-8 py-4">
                                        <div className="flex items-center gap-3">
                                            <PackageIcon className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                                            <div>
                                                <p className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-tight">{product.nombre}</p>
                                                <p className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase">PRODUCTO</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-3 py-4 text-center text-[10px] font-black text-slate-800 dark:text-slate-200 tabular-nums">
                                        {formatCurrency(product.logro_money)}
                                    </td>
                                    <td className="px-3 py-4 text-center text-[10px] font-black text-slate-800 dark:text-slate-200 tabular-nums">
                                        {product.logro_count}
                                    </td>
                                    <td className="px-3 py-4 text-center text-[10px] font-bold text-slate-400 dark:text-slate-500 tabular-nums">
                                        {formatCurrency(product.objetivo_money)}
                                    </td>
                                    <td className="px-3 py-4 text-center text-[10px] font-bold text-slate-400 dark:text-slate-500 tabular-nums">
                                        {product.objetivo_count}
                                    </td>
                                    <td className="px-3 py-4 text-center">
                                        <span className={`text-[10px] font-black ${product.cumplimiento_money >= 100 ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
                                            {product.cumplimiento_money}%
                                        </span>
                                    </td>
                                    <td className="px-3 py-4 text-center">
                                        <span className={`text-[10px] font-black ${product.cumplimiento_count >= 100 ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
                                            {product.cumplimiento_count}%
                                        </span>
                                    </td>
                                    <td className="px-3 py-4 text-center text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50/30 dark:bg-emerald-900/20 rounded-lg">
                                        {formatCurrency(product.proy_money)}
                                    </td>
                                    <td className="px-3 py-4 text-center text-[10px] font-black text-emerald-600 dark:text-emerald-400">
                                        {product.proy_count}
                                    </td>
                                    <td className="px-3 py-4 text-center">
                                        {product.pace_diff !== undefined && (
                                            <div className="flex items-center justify-center gap-1">
                                                <span className={`text-[10px] font-black ${product.pace_diff >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                    {product.pace_diff > 0 ? '+' : ''}{product.pace_diff}%
                                                </span>
                                                {product.pace_diff >= 0 ? (
                                                    <ChevronRightIcon className="w-3 h-3 text-emerald-500 dark:text-emerald-400 -rotate-90" />
                                                ) : (
                                                    <ChevronRightIcon className="w-3 h-3 text-rose-500 dark:text-rose-400 rotate-90" />
                                                )}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-8 py-4 text-right">
                                        <StatusBadge status={product.status} />
                                    </td>
                                </tr>
                            ))}
                            {filteredProducts.length === 0 && (
                                <tr>
                                    <td colSpan={11} className="px-8 py-16 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <PackageIcon className="w-10 h-10 text-slate-100 dark:text-slate-800" />
                                            <p className="text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest">No se encontraron productos asociados</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {error && (
                <div className="bg-rose-50 dark:bg-rose-900/20 border border-current p-4 rounded-3xl text-rose-600 dark:text-rose-400 text-[10px] font-black uppercase tracking-widest text-center animate-pulse">
                    {error}
                </div>
            )}
        </div>
    );
});

export default CampaignProductPerformance;
