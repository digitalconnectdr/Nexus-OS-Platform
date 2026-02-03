'use client';

import { useAnalytics } from '@/hooks/useAnalytics';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

export default function OperationalStats() {
    const { toast } = useToast();
    const { metrics, isLoading, isError, filters } = useAnalytics();
    const [exportStatus, setExportStatus] = useState<'idle' | 'processing' | 'ready'>('idle');
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

    const handleAsyncExport = async () => {
        setExportStatus('processing');

        try {
            const { data: { session } } = await supabase.auth.getSession();

            // 1. Iniciar Trabajo
            const startRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/analytics/export/async?start_date=${filters.startDate}&end_date=${filters.endDate}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session?.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            });

            if (!startRes.ok) throw new Error("Error al iniciar exportación");

            const { job_id } = await startRes.json();

            // 2. Polling (Preguntar cada 2 segundos)
            const intervalId = setInterval(async () => {
                const statusRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/analytics/export/status/${job_id}`, {
                    headers: { 'Authorization': `Bearer ${session?.access_token}` }
                });

                if (!statusRes.ok) return; // Continuar intentando o manejar error

                const jobData = await statusRes.json();

                if (jobData.status === 'completed') {
                    clearInterval(intervalId);
                    setDownloadUrl(jobData.file_url);
                    setExportStatus('ready');
                } else if (jobData.status === 'failed') {
                    clearInterval(intervalId);
                    toast({
                        title: "Error de Reporte",
                        description: "No se pudo generar el reporte estadístico.",
                        variant: "destructive"
                    });
                    setExportStatus('idle');
                }
            }, 2000);

        } catch (e: any) {
            console.error(e);
            toast({
                title: "Falla de Conexión",
                description: e.message || "Hubo un problema al conectar con el servidor de exportación.",
                variant: "destructive"
            });
            setExportStatus('idle');
        }
    };

    if (isLoading) {
        return (
            <div className="p-8 space-y-4 animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-1/3"></div>
                <div className="h-64 bg-gray-100 rounded"></div>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-red-700">
                <h3 className="font-bold flex items-center gap-2">⚠️ Error de Sistema</h3>
                <p>No se pudieron cargar las métricas. {isError.message}</p>
            </div>
        );
    }

    // --- SAFE DATA NORMALIZATION ---
    const campaignMetrics = metrics?.operations_metrics?.by_campaign || [];
    const goalsCompliance = metrics?.goals_compliance || [];

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Eficiencia Operativa</h2>
                    <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                        {filters.startDate} — {filters.endDate}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    {exportStatus === 'idle' && (
                        <button
                            onClick={handleAsyncExport}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 shadow-sm flex items-center gap-2"
                        >
                            📊 Exportar Reporte
                        </button>
                    )}

                    {exportStatus === 'processing' && (
                        <button
                            disabled
                            className="bg-slate-100 text-slate-500 px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 animate-pulse cursor-wait"
                        >
                            <span className="animate-spin text-lg">↻</span> Generando Excel...
                        </button>
                    )}

                    {exportStatus === 'ready' && downloadUrl && (
                        <a
                            href={downloadUrl}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg animate-bounce flex items-center gap-2"
                        >
                            ⬇️ Descargar Ahora
                        </a>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Tabla de Campañas */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="font-bold mb-4 text-slate-700 uppercase text-[10px] tracking-widest">Rendimiento por Campaña</h3>

                    {campaignMetrics.length === 0 ? (
                        <p className="text-slate-400 italic text-sm text-center py-10">
                            No hay datos de campañas disponibles o no tienes permisos para verlos.
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-[10px] text-slate-400 uppercase font-black tracking-wider border-b border-slate-50">
                                    <tr>
                                        <th className="px-4 py-3">Campaña</th>
                                        <th className="px-4 py-3 text-right">Leads</th>
                                        <th className="px-4 py-3 text-right">Conv. %</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {campaignMetrics.map((camp) => (
                                        <tr key={camp.campaign_name} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-4 py-4 font-bold text-slate-900">{camp.campaign_name}</td>
                                            <td className="px-4 py-4 text-right tabular-nums text-slate-500 font-medium">{camp.leads_generated}</td>
                                            <td className={`px-4 py-4 text-right font-black tabular-nums ${camp.conversion_rate > 10 ? 'text-emerald-600' : 'text-amber-600'
                                                }`}>
                                                {camp.conversion_rate}%
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Cumplimiento de Metas */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="font-bold mb-4 text-slate-700 uppercase text-[10px] tracking-widest">Cumplimiento de Metas</h3>
                    <div className="space-y-3">
                        {goalsCompliance.length > 0 ? (
                            goalsCompliance.map((goal) => (
                                <div key={goal.metric_name} className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition-all">
                                    <span className="font-bold text-slate-700 text-sm">{goal.metric_name}</span>
                                    <span className={`px-3 py-1 text-[10px] rounded-full font-black uppercase tracking-widest ${goal.status === 'On Track' ? 'bg-emerald-100 text-emerald-700' :
                                        goal.status === 'Risk' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                                        }`}>
                                        {goal.status}
                                    </span>
                                </div>
                            ))
                        ) : (
                            <p className="text-slate-400 italic text-sm text-center py-10">No hay objetivos definidos o acceso limitado.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
