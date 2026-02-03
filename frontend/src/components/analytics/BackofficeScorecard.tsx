'use client';

import { useState, useEffect, useCallback, memo } from 'react';
import { fetchFromAPI } from '@/lib/api';
import {
    RefreshCwIcon,
    UserIcon,
    CheckCircle2Icon,
    ClockIcon,
    BarChart3Icon,
    ArrowUpRightIcon,
    ZapIcon,
    TargetIcon,
    InfoIcon
} from 'lucide-react';
import LoadingState from '@/components/ui/LoadingState';

interface BackofficeMetric {
    user_id: string;
    user_name: string;
    role: string;
    processed_count: number;
    avg_lead_time_mins: number;
    accuracy_rate: number;
    os_completed: number;
}

interface FollowUpMetric {
    user_id: string;
    user_name: string;
    role: string;
    managed_count: number;
    installed_count: number;
    canceled_count: number;
    conversion_rate: number;
    avg_closing_days: number;
}

interface Props {
    startDate: string;
    endDate: string;
}

const InfoTooltip = ({ content, position = 'bottom' }: { content: string, position?: 'top' | 'bottom' }) => (
    <div className="group relative inline-block ml-1.5 align-middle">
        <InfoIcon className="w-3.5 h-3.5 text-slate-300 cursor-help hover:text-blue-500 transition-colors" />
        <div className={`absolute ${position === 'top' ? 'bottom-full mb-3' : 'top-full mt-3'} left-1/2 -translate-x-1/2 w-60 bg-white border border-slate-200 text-slate-600 text-[10px] font-bold p-3 rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[100] pointer-events-none text-center leading-relaxed backdrop-blur-sm`}>
            {content}
            {position === 'top' ? (
                <>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-white" />
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-[7px] border-transparent border-t-slate-200 -z-10 translate-y-[1px]" />
                </>
            ) : (
                <>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-b-white" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-[7px] border-transparent border-b-slate-200 -z-10 -translate-y-[1px]" />
                </>
            )}
        </div>
    </div>
);

const MetricCard = ({ title, value, icon: Icon, color, subValue, tooltip }: any) => (
    <div className="bg-white p-4 rounded-[1.5rem] border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow group/card relative">
        <div className="flex justify-between items-start mb-3">
            <div className={`p-2 rounded-xl ${color} shadow-sm group-hover/card:scale-110 transition-transform`}>
                <Icon className="w-4 h-4 text-white" />
            </div>
            <div className="flex flex-col items-end">
                {subValue && <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{subValue}</span>}
                <InfoTooltip content={tooltip} />
            </div>
        </div>
        <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{title}</p>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">{value}</h3>
        </div>
    </div>
);

const safeValue = (val: any) => {
    if (val === null || val === undefined || isNaN(val) || !isFinite(val)) return 0;
    return val;
};

const BackofficeScorecard = memo(function BackofficeScorecard({ startDate, endDate }: Props) {
    const [subTab, setSubTab] = useState<'digitacion' | 'seguimiento'>('digitacion');
    const [data, setData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const month = startDate.substring(0, 7);

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const endpoint = subTab === 'digitacion' ? '/api/v1/analytics/scorecard/backoffice' : '/api/v1/analytics/scorecard/followup';
            const result = await fetchFromAPI(`${endpoint}?month=${month}`);
            if (result) setData(result);
        } catch (err) {
            console.error("Error loading backoffice data:", err);
        } finally {
            setIsLoading(false);
        }
    }, [month, subTab]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    if (isLoading) return <LoadingState message="Cargando métricas del equipo..." />;

    return (
        <div className="space-y-6">
            {/* Header & Internal Nav */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white/50 p-4 rounded-3xl border border-slate-100 backdrop-blur-sm gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-slate-900 rounded-2xl shadow-lg shadow-slate-200">
                        <ZapIcon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight">Rendimiento Operativo</h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gestión Interna & Control de Calidad</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex gap-1 p-1 bg-slate-100/50 rounded-xl">
                        <button
                            onClick={() => setSubTab('digitacion')}
                            className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${subTab === 'digitacion' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            Digitación
                        </button>
                        <button
                            onClick={() => setSubTab('seguimiento')}
                            className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${subTab === 'seguimiento' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            Seguimiento
                        </button>
                    </div>

                    <div className="w-px h-8 bg-slate-200 mx-2" />

                    <button
                        onClick={loadData}
                        className="p-2.5 bg-white border border-slate-200 hover:border-slate-900 rounded-xl text-slate-400 hover:text-slate-900 transition-all shadow-sm active:scale-95"
                    >
                        <RefreshCwIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Main Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {subTab === 'digitacion' ? (
                    <>
                        <MetricCard
                            title="Total Procesado"
                            value={safeValue(data.reduce((acc, curr) => acc + (curr.processed_count || 0), 0))}
                            icon={BarChart3Icon}
                            color="bg-slate-900"
                            tooltip="Ventas totales donde el usuario ha sido asignado como responsable del flujo."
                        />
                        <MetricCard
                            title="Llenado OS"
                            value={`${Math.round(safeValue(data.reduce((acc, curr) => acc + (curr.accuracy_rate || 0), 0) / (data.length || 1)))}%`}
                            icon={CheckCircle2Icon}
                            color="bg-emerald-500"
                            tooltip="Porcentaje de registros procesados que tienen completos los campos críticos (OS Madre y OS Hija)."
                        />
                        <MetricCard
                            title="Avg. Lead Time"
                            value={`${Math.round(safeValue(data.reduce((acc, curr) => acc + (curr.avg_lead_time_mins || 0), 0) / (data.length || 1)))}m`}
                            icon={ClockIcon}
                            color="bg-indigo-500"
                            tooltip="Tiempo promedio transcurrido desde que el agente crea la venta hasta que el equipo de digitación realiza el procesamiento."
                        />
                        <MetricCard
                            title="OS Completadas"
                            value={safeValue(data.reduce((acc, curr) => acc + (curr.os_completed || 0), 0))}
                            icon={ZapIcon}
                            color="bg-amber-500"
                            tooltip="Cantidad neta de registros con información técnica (OS) completa."
                        />
                    </>
                ) : (
                    <>
                        <MetricCard
                            title="Gestiones Totales"
                            value={safeValue(data.reduce((acc, curr) => acc + (curr.managed_count || 0), 0))}
                            icon={BarChart3Icon}
                            color="bg-slate-900"
                            tooltip="Total de movimientos de estatus realizados por el equipo de seguimiento."
                        />
                        <MetricCard
                            title="Tasa Conversión"
                            value={`${Math.round(safeValue(data.reduce((acc, curr) => acc + (curr.conversion_rate || 0), 0) / (data.length || 1)))}%`}
                            icon={ArrowUpRightIcon}
                            color="bg-emerald-500"
                            tooltip="Porcentaje de ventas gestionadas que finalizaron con éxito en el estado 'Instalada'."
                        />
                        <MetricCard
                            title="Tiempo Cierre"
                            value={`${Math.round(safeValue(data.reduce((acc, curr) => acc + (curr.avg_closing_days || 0), 0) / (data.length || 1)))}d`}
                            icon={ClockIcon}
                            color="bg-indigo-500"
                            tooltip="Tiempo promedio en días para llevar una venta desde su procesamiento inicial hasta el cierre definitivo (Instalada/Cancelada)."
                        />
                        <MetricCard
                            title="Instaladas"
                            value={safeValue(data.reduce((acc, curr) => acc + (curr.installed_count || 0), 0))}
                            icon={TargetIcon}
                            color="bg-blue-500"
                            tooltip="Cantidad de ventas que llegaron exitosamente al estado final de instalación."
                        />
                    </>
                )}
            </div>

            {/* Details Table - Using relative and high z-index to manage tooltips safely */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] shadow-xl shadow-slate-200/50 relative z-0 isolation-isolate overflow-hidden">
                {/* Increased bottom padding (pb-12) to create a safe zone for tooltips appearing above the table headers */}
                <div className="px-8 py-5 pb-10 border-b border-slate-100 bg-slate-50/30">
                    <h3 className="text-[12px] font-black text-slate-800 uppercase tracking-widest">
                        {subTab === 'digitacion' ? 'Scorecard Individual de Digitación' : 'Scorecard Individual de Seguimiento'}
                    </h3>
                </div>
                {/* Ensure table container allows tooltips to break out vertically */}
                <div className="overflow-visible px-4 relative">
                    <table className="w-full text-left border-separate border-spacing-y-0">
                        <thead className="relative z-20">
                            <tr className="bg-slate-50/50 border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                <th className="px-8 py-4">Usuario / Especialista</th>
                                {subTab === 'digitacion' ? (
                                    <>
                                        <th className="px-4 py-4 text-center">Procesadas</th>
                                        <th className="px-4 py-4 text-center relative">
                                            Avg. Lead Time (Mins)
                                            <InfoTooltip content="Tiempo promedio de procesamiento por registro." position="top" />
                                        </th>
                                        <th className="px-4 py-4 text-center relative">
                                            OS Madre/Hija (%)
                                            <InfoTooltip content="Calidad del llenado de información técnica." position="top" />
                                        </th>
                                        <th className="px-4 py-4 text-center relative">
                                            OS Completas (#)
                                            <InfoTooltip content="Volumen neto de OS terminadas." position="top" />
                                        </th>
                                    </>
                                ) : (
                                    <>
                                        <th className="px-4 py-4 text-center">Gestiones</th>
                                        <th className="px-4 py-4 text-center">Instaladas</th>
                                        <th className="px-4 py-4 text-center">Canceladas</th>
                                        <th className="px-4 py-4 text-center relative">
                                            Eficiencia (%)
                                            <InfoTooltip content="Tasa de éxito en la instalación final." position="top" />
                                        </th>
                                        <th className="px-4 py-4 text-center relative">
                                            Cierre (Días)
                                            <InfoTooltip content="Días transcurridos hasta la resolución final." position="top" />
                                        </th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {data.map((user) => (
                                <tr key={user.user_id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-all">
                                                <UserIcon className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-black text-slate-700 uppercase tracking-tight">{user.user_name}</p>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{user.role}</p>
                                            </div>
                                        </div>
                                    </td>
                                    {subTab === 'digitacion' ? (
                                        <>
                                            <td className="px-4 py-5 text-center text-[11px] font-black text-slate-800">{safeValue(user.processed_count)}</td>
                                            <td className="px-4 py-5 text-center text-[11px] font-bold text-slate-500">
                                                {user.processed_count > 0 ? `${safeValue(user.avg_lead_time_mins)}m` : '-'}
                                            </td>
                                            <td className="px-4 py-5 text-center">
                                                <span className={`text-[11px] font-black ${(user.accuracy_rate || 0) >= 90 ? 'text-emerald-500' : 'text-slate-500'}`}>
                                                    {user.processed_count > 0 ? `${safeValue(user.accuracy_rate)}%` : '-'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-5 text-center text-[11px] font-black text-slate-800">{safeValue(user.os_completed)}</td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="px-4 py-5 text-center text-[11px] font-black text-slate-800">{safeValue(user.managed_count)}</td>
                                            <td className="px-4 py-5 text-center text-[11px] font-black text-emerald-500">{safeValue(user.installed_count)}</td>
                                            <td className="px-4 py-5 text-center text-[11px] font-black text-rose-500">{safeValue(user.canceled_count)}</td>
                                            <td className="px-4 py-5 text-center">
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className="text-[11px] font-black text-slate-800">
                                                        {user.managed_count > 0 ? `${safeValue(user.conversion_rate)}%` : '-'}
                                                    </span>
                                                    <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full ${(user.conversion_rate || 0) >= 70 ? 'bg-emerald-500' : 'bg-slate-400'}`}
                                                            style={{ width: `${safeValue(user.conversion_rate)}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-5 text-center text-[11px] font-bold text-slate-500">
                                                {user.managed_count > 0 ? `${safeValue(user.avg_closing_days)}d` : '-'}
                                            </td>
                                        </>
                                    )}
                                </tr>
                            ))}
                            {data.length === 0 && (
                                <tr>
                                    <td colSpan={subTab === 'digitacion' ? 5 : 6} className="px-8 py-16 text-center">
                                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No hay datos registrados para este período</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
});

export default BackofficeScorecard;
