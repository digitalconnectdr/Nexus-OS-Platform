'use client';

import { useState, useEffect, memo, useCallback, Fragment } from 'react';
import { fetchFromAPI } from '@/lib/api';
import {
    BarChart3Icon,
    AlertTriangleIcon,
    RefreshCwIcon,
    DatabaseIcon,
    ChevronRightIcon,
    ChevronDownIcon,
    SearchIcon,
    UserIcon,
    InfoIcon,
    LayersIcon
} from 'lucide-react';
import CampaignProductPerformance from './CampaignProductPerformance';

// --- DEFINICIÓN DE TIPOS ---
interface MetricData {
    id: string;
    nombre: string;
    avatar_url: string | null;
    role?: string;
    supervisor_id?: string;
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
    team_size?: number;
}

interface OperationalResponse {
    month: string;
    supervisors: MetricData[];
    agents: MetricData[];
}

interface Props {
    startDate: string;
    endDate: string;
    searchTerm: string;
    subTab: 'hierarchy' | 'campaign';
    setSubTab: (tab: 'hierarchy' | 'campaign') => void;
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
const OperationalEfficiency = memo(function OperationalEfficiency({ startDate, endDate, searchTerm: globalSearchTerm, subTab, setSubTab }: Props) {
    const [data, setData] = useState<OperationalResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Derivamos el mes de la fecha de inicio global (formato YYYY-MM)
    const month = startDate.substring(0, 7);
    const [selectedSupervisorId, setSelectedSupervisorId] = useState<string | null>(null);
    const [refreshCount, setRefreshCount] = useState(0);


    // --- CARGA DE DATOS ---
    const loadData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setRefreshCount(prev => prev + 1);
        try {
            const url = `/api/v1/results/?month=${month}`;
            const result = await fetchFromAPI(url);

            if (result) {
                setData(result);
                // Si hay supervisores, por defecto podríamos no seleccionar ninguno o el primero
                // Pero lo dejaremos libre para que el usuario elija.
            }
        } catch (err: any) {
            console.error("Error loading operational data:", err);
            setError("No se pudo conectar con el servidor de métricas.");
        } finally {
            setIsLoading(false);
        }
    }, [month]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const formatCurrency = (val: number) => `$${val.toLocaleString()}`;

    // Filtrado de agentes basado en el supervisor seleccionado y el término de búsqueda
    const filteredAgents = (data?.agents || []).filter(agent => {
        const matchesSup = selectedSupervisorId ? agent.supervisor_id === selectedSupervisorId : true;
        const matchesSearch = agent.nombre.toLowerCase().includes(globalSearchTerm.toLowerCase());
        return matchesSup && matchesSearch;
    });

    const supervisors = (data?.supervisors || []).filter(sup =>
        sup.nombre.toLowerCase().includes(globalSearchTerm.toLowerCase())
    );

    if (isLoading) {
        return (
            <div className="flex h-96 items-center justify-center space-x-3 bg-white rounded-3xl border border-dashed border-slate-200">
                <div className="h-4 w-4 bg-blue-600 rounded-full animate-bounce"></div>
                <div className="h-4 w-4 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="h-4 w-4 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <span className="text-slate-400 text-xs font-bold uppercase tracking-widest ml-2">Calculando KPIs en tiempo real...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white/50 p-4 rounded-3xl border border-slate-100 backdrop-blur-sm">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-100">
                        <LayersIcon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight">Análisis Operativo</h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Métricas de Rendimiento & Estructura</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex gap-1 p-1 bg-slate-100/50 rounded-xl">
                        <button
                            onClick={() => setSubTab('hierarchy')}
                            className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${subTab === 'hierarchy' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            Jerarquía de Ventas
                        </button>
                        <button
                            onClick={() => setSubTab('campaign')}
                            className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${subTab === 'campaign' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            Campaña y Producto
                        </button>
                    </div>

                    <div className="w-px h-8 bg-slate-200 mx-2" />

                    <button
                        onClick={loadData}
                        className="p-2.5 bg-white border border-slate-200 hover:border-indigo-500 hover:text-indigo-600 rounded-xl text-slate-400 transition-all shadow-sm active:scale-95"
                        title="Actualizar datos"
                    >
                        <RefreshCwIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {subTab === 'hierarchy' ? (
                <>
                    {/* --- TABLA 1: SUPERVISORES --- */}
                    <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-xl shadow-slate-200/50">
                        <div className="px-8 py-5 border-b border-slate-100 bg-slate-50/30 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-6 bg-indigo-500 rounded-full" />
                                <h2 className="text-[12px] font-black text-slate-800 uppercase tracking-widest">Gestión de Supervisores</h2>
                            </div>
                            <span className="text-[10px] font-black text-slate-500 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm uppercase tracking-tighter">
                                {supervisors.length} Líderes Identificados
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-slate-50/50 border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">
                                        <th className="px-8 py-4 text-left">Supervisor / Líder</th>
                                        <th className="px-4 py-4">Logro ($)</th>
                                        <th className="px-4 py-4">Logro (#)</th>
                                        <th className="px-4 py-4">Objetivo ($)</th>
                                        <th className="px-4 py-4">Objetivo (#)</th>
                                        <th className="px-4 py-4">
                                            Cumpl. ($)
                                            <InfoTooltip content="Porcentaje de avance respecto a la meta monetaria: (Logro / Objetivo) * 100" />
                                        </th>
                                        <th className="px-4 py-4">
                                            Cumpl. (#)
                                            <InfoTooltip content="Porcentaje de avance respecto a la meta en unidades: (Cantidad / Objetivo) * 100" />
                                        </th>
                                        <th className="px-4 py-4 text-indigo-600 bg-indigo-50/30">
                                            Proy ($)
                                            <InfoTooltip content="Estimación de cierre basada en el ritmo de ventas diario actual y días restantes." />
                                        </th>
                                        <th className="px-4 py-4 text-indigo-600 bg-indigo-50/30">
                                            Proy (#)
                                            <InfoTooltip content="Estimación de unidades al cierre basada en el ritmo de ventas diario." />
                                        </th>
                                        <th className="px-4 py-4">
                                            Ritmo %
                                            <InfoTooltip content="Tendencia comparativa: Proyección de este mes vs. Cierre real del mes anterior." />
                                        </th>
                                        <th className="px-8 py-4 text-right">
                                            Estatus
                                            <InfoTooltip content="Calificación: Óptimo (>100%), Alerta (90-99%) o Riesgo (<90%)" />
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {supervisors.map((sup) => {
                                        const isSelected = selectedSupervisorId === sup.id;
                                        return (
                                            <tr
                                                key={sup.id}
                                                onClick={() => setSelectedSupervisorId(isSelected ? null : sup.id)}
                                                className={`group cursor-pointer transition-all duration-300 hover:bg-indigo-50/40 ${isSelected ? 'bg-indigo-50/80' : ''}`}
                                            >
                                                <td className="px-8 py-4">
                                                    <div className="flex items-center gap-4">
                                                        <div className="relative">
                                                            {sup.avatar_url ? (
                                                                <img src={sup.avatar_url} className="w-9 h-9 rounded-full object-cover ring-2 ring-white shadow-sm" alt="" />
                                                            ) : (
                                                                <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 ring-2 ring-white shadow-sm">
                                                                    <UserIcon className="w-5 h-5" />
                                                                </div>
                                                            )}
                                                            {isSelected && <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-indigo-600 rounded-full border-2 border-white flex items-center justify-center"><ChevronDownIcon className="w-3 h-3 text-white" /></div>}
                                                        </div>
                                                        <div>
                                                            <p className={`text-xs font-black uppercase tracking-tight ${isSelected ? 'text-indigo-700' : 'text-slate-700 group-hover:text-indigo-600'}`}>
                                                                {sup.nombre}
                                                            </p>
                                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                                                                {sup.team_size} Representantes
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-center text-[11px] font-black text-slate-800 tabular-nums">
                                                    {formatCurrency(sup.logro_money)}
                                                </td>
                                                <td className="px-4 py-4 text-center text-[11px] font-black text-slate-800 tabular-nums">
                                                    {sup.logro_count}
                                                </td>
                                                <td className="px-4 py-4 text-center text-[11px] font-bold text-slate-400 tabular-nums">
                                                    {formatCurrency(sup.objetivo_money)}
                                                </td>
                                                <td className="px-4 py-4 text-center text-[11px] font-bold text-slate-400 tabular-nums">
                                                    {sup.objetivo_count}
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <span className={`text-[11px] font-black ${sup.cumplimiento_money >= 100 ? 'text-emerald-600' : 'text-slate-600'}`}>
                                                        {sup.cumplimiento_money}%
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <span className={`text-[11px] font-black ${sup.cumplimiento_count >= 100 ? 'text-emerald-600' : 'text-slate-600'}`}>
                                                        {sup.cumplimiento_count}%
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 text-center text-[11px] font-black text-indigo-600 bg-indigo-50/50 rounded-lg">
                                                    {formatCurrency(sup.proy_money)}
                                                </td>
                                                <td className="px-4 py-4 text-center text-[11px] font-black text-indigo-600">
                                                    {sup.proy_count}
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    {sup.pace_diff !== undefined && (
                                                        <div className="flex items-center justify-center gap-1">
                                                            <span className={`text-[10px] font-black ${sup.pace_diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                                {sup.pace_diff > 0 ? '+' : ''}{sup.pace_diff}%
                                                            </span>
                                                            {sup.pace_diff >= 0 ? (
                                                                <ChevronRightIcon className="w-3 h-3 text-emerald-500 -rotate-90" />
                                                            ) : (
                                                                <ChevronRightIcon className="w-3 h-3 text-rose-500 rotate-90" />
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-8 py-4 text-right">
                                                    <StatusBadge status={sup.status} />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* --- TABLA 2: REPRESENTANTES --- */}
                    <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-xl shadow-slate-200/50">
                        <div className="px-8 py-5 border-b border-slate-100 bg-slate-50/30 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-6 bg-emerald-500 rounded-full" />
                                <h2 className="text-[12px] font-black text-slate-800 uppercase tracking-widest">Ejecución de Representantes</h2>
                            </div>
                            {selectedSupervisorId && (
                                <button
                                    onClick={() => setSelectedSupervisorId(null)}
                                    className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200 uppercase tracking-tighter hover:bg-indigo-100 transition-colors"
                                >
                                    Ver Todos los Agentes
                                </button>
                            )}
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-slate-50/50 border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                        <th className="px-8 py-4">Representante</th>
                                        <th className="px-3 py-4">
                                            Logro ($)
                                            <InfoTooltip content="Valor total de ventas realizadas." />
                                        </th>
                                        <th className="px-3 py-4">
                                            Logro (#)
                                            <InfoTooltip content="Cantidad total de unidades vendidas." />
                                        </th>
                                        <th className="px-3 py-4">
                                            Objetivo ($)
                                            <InfoTooltip content="Meta monetaria establecida para el período." />
                                        </th>
                                        <th className="px-3 py-4">
                                            Objetivo (#)
                                            <InfoTooltip content="Meta en unidades establecida para el período." />
                                        </th>
                                        <th className="px-3 py-4">
                                            Cumpl. ($)
                                            <InfoTooltip content="Porcentaje de cumplimiento de la meta monetaria." />
                                        </th>
                                        <th className="px-3 py-4">
                                            Cumpl. (#)
                                            <InfoTooltip content="Porcentaje de cumplimiento de la meta en unidades." />
                                        </th>
                                        <th className="px-3 py-4 text-emerald-600 bg-emerald-50/20">
                                            Proy ($)
                                            <InfoTooltip content="Proyección de venta al cierre del mes." />
                                        </th>
                                        <th className="px-3 py-4 text-emerald-600 bg-emerald-50/20">
                                            Proy (#)
                                            <InfoTooltip content="Proyección de unidades al cierre del mes." />
                                        </th>
                                        <th className="px-3 py-4">
                                            Ritmo %
                                            <InfoTooltip content="Evolución respecto al mes anterior (Proyección vs Real)." />
                                        </th>
                                        <th className="px-8 py-4 text-right">
                                            Estatus
                                            <InfoTooltip content="Nivel de ejecución actual del representante." />
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {filteredAgents.map((agent) => (
                                        <tr key={agent.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-8 py-4">
                                                <div className="flex items-center gap-3">
                                                    <ChevronRightIcon className="w-3 h-3 text-slate-300" />
                                                    <div>
                                                        <p className="text-xs font-black text-slate-700 uppercase tracking-tight">{agent.nombre}</p>
                                                        <p className="text-[8px] font-bold text-slate-400 uppercase">{agent.role || 'Representante'}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-3 py-4 text-center text-[10px] font-black text-slate-800 tabular-nums">
                                                {formatCurrency(agent.logro_money)}
                                            </td>
                                            <td className="px-3 py-4 text-center text-[10px] font-black text-slate-800 tabular-nums">
                                                {agent.logro_count}
                                            </td>
                                            <td className="px-3 py-4 text-center text-[10px] font-bold text-slate-400 tabular-nums">
                                                {formatCurrency(agent.objetivo_money)}
                                            </td>
                                            <td className="px-3 py-4 text-center text-[10px] font-bold text-slate-400 tabular-nums">
                                                {agent.objetivo_count}
                                            </td>
                                            <td className="px-3 py-4 text-center">
                                                <span className={`text-[10px] font-black ${agent.cumplimiento_money >= 100 ? 'text-emerald-500' : 'text-slate-500'}`}>
                                                    {agent.cumplimiento_money}%
                                                </span>
                                            </td>
                                            <td className="px-3 py-4 text-center">
                                                <span className={`text-[10px] font-black ${agent.cumplimiento_count >= 100 ? 'text-emerald-500' : 'text-slate-500'}`}>
                                                    {agent.cumplimiento_count}%
                                                </span>
                                            </td>
                                            <td className="px-3 py-4 text-center text-[10px] font-black text-emerald-600 bg-emerald-50/30 rounded-lg">
                                                {formatCurrency(agent.proy_money)}
                                            </td>
                                            <td className="px-3 py-4 text-center text-[10px] font-black text-emerald-600">
                                                {agent.proy_count}
                                            </td>
                                            <td className="px-3 py-4 text-center">
                                                {agent.pace_diff !== undefined && (
                                                    <div className="flex items-center justify-center gap-1">
                                                        <span className={`text-[10px] font-black ${agent.pace_diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                            {agent.pace_diff > 0 ? '+' : ''}{agent.pace_diff}%
                                                        </span>
                                                        {agent.pace_diff >= 0 ? (
                                                            <ChevronRightIcon className="w-3 h-3 text-emerald-500 -rotate-90" />
                                                        ) : (
                                                            <ChevronRightIcon className="w-3 h-3 text-rose-500 rotate-90" />
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-8 py-4 text-right">
                                                <StatusBadge status={agent.status} />
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredAgents.length === 0 && (
                                        <tr>
                                            <td colSpan={11} className="px-8 py-16 text-center">
                                                <div className="flex flex-col items-center gap-3">
                                                    <UserIcon className="w-10 h-10 text-slate-100" />
                                                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No se encontraron representantes asociados</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            ) : (
                <CampaignProductPerformance
                    startDate={startDate}
                    endDate={endDate}
                    searchTerm={globalSearchTerm}
                    hideHeader={true}
                    refreshTrigger={refreshCount}
                />
            )}

            {
                error && (
                    <div className="bg-rose-50 border border-current p-4 rounded-3xl text-rose-600 text-[10px] font-black uppercase tracking-widest text-center animate-pulse">
                        {error}
                    </div>
                )
            }
        </div >
    );
});

export default OperationalEfficiency;
