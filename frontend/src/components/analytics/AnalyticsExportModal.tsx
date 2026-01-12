'use client';

import { useState, useEffect } from 'react';
import { fetchFromAPI } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import {
    XMarkIcon,
    ArrowDownTrayIcon,
    CalendarIcon,
    Bars3CenterLeftIcon,
    UserGroupIcon
} from '@heroicons/react/24/outline';

interface AnalyticsExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentStartDate: string;
    currentEndDate: string;
    mode?: 'scorecard' | 'backoffice' | 'efficiency' | 'financial' | 'campaign-perf';
}

export default function AnalyticsExportModal({ isOpen, onClose, currentStartDate, currentEndDate, mode = 'scorecard' }: AnalyticsExportModalProps) {
    const [startDate, setStartDate] = useState(currentStartDate);
    const [endDate, setEndDate] = useState(currentEndDate);
    const [campaignId, setCampaignId] = useState('');
    const [supervisorId, setSupervisorId] = useState('');
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [supervisors, setSupervisors] = useState<any[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState(0);
    const [taskId, setTaskId] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchFilters();
            setStartDate(currentStartDate);
            setEndDate(currentEndDate);
        }
    }, [isOpen]);

    const fetchFilters = async () => {
        try {
            const campaignsRes = await fetchFromAPI('/api/v1/campaigns?size=100');
            setCampaigns(Array.isArray(campaignsRes) ? campaignsRes : (campaignsRes.items || []));

            const supervisorsRes = await fetchFromAPI('/api/v1/users/?role=Supervisor&size=100');
            setSupervisors(supervisorsRes.items || []);
        } catch (err) {
            console.error("Error fetching export filters:", err);
        }
    };

    const getModalContent = () => {
        switch (mode) {
            case 'financial':
                return {
                    title: 'Reporte Financiero',
                    subtitle: 'Detalle de Ventas e Ingresos',
                    endpoint: '/api/v1/analytics/financial/export',
                    showFilters: true
                };
            case 'backoffice':
                return {
                    title: 'Reporte Backoffice',
                    subtitle: 'Efectividad de Digitación y Seguimiento',
                    endpoint: '/api/v1/analytics/backoffice/export',
                    showFilters: false
                };
            case 'efficiency':
                return {
                    title: 'Reporte Eficiencia',
                    subtitle: 'Productividad por Campaña y Supervisión',
                    endpoint: '/api/v1/analytics/efficiency-v3/export',
                    showFilters: true
                };
            case 'campaign-perf':
                return {
                    title: 'Reporte de Campañas',
                    subtitle: 'Rendimiento por Línea de Negocio y Productos',
                    endpoint: '/api/v1/campaign-performance/export',
                    showFilters: false // Usamos el mes de la fecha de inicio
                };
            default:
                return {
                    title: 'Reporte de Ventas',
                    subtitle: 'Scorecard de Desempeño de Agentes',
                    endpoint: '/api/v1/analytics/scorecard/export',
                    showFilters: true
                };
        }
    };

    const content = getModalContent();

    const handleDownload = async () => {
        try {
            setIsGenerating(true);
            setProgress(10);

            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                alert("Tu sesión ha expirado. Por favor recarga.");
                setIsGenerating(false);
                return;
            }

            const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
            const exportUrlParams = mode === 'campaign-perf'
                ? `month=${startDate.substring(0, 7)}`
                : `start_date=${startDate}&end_date=${endDate}`;

            let url = `${baseUrl}${content.endpoint}?${exportUrlParams}`;

            if (content.showFilters) {
                if (campaignId) url += `&campaign_id=${campaignId}`;
                if (supervisorId) url += `&supervisor_id=${supervisorId}`;
            }

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Error: ${response.statusText}`);
            }

            const contentType = response.headers.get('content-type');

            // Check if SYNC (CSV) or ASYNC (JSON)
            if (contentType?.includes('text/csv')) {
                // SYNC MODE: Download immediately
                const blob = await response.blob();
                const downloadUrl = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = `reporte_${mode}_${new Date().toISOString().split('T')[0]}.csv`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(downloadUrl);
                document.body.removeChild(a);

                setIsGenerating(false);
                setProgress(0);
                onClose();
            } else {
                // ASYNC MODE: Start polling
                const data = await response.json();

                if (data.mode === 'async' && data.task_id) {
                    setTaskId(data.task_id);
                    setProgress(30);
                    pollTaskStatus(data.task_id, session.access_token);
                } else {
                    throw new Error('Unexpected response format');
                }
            }
        } catch (error) {
            console.error('Download error:', error);
            alert('Error al generar el reporte');
            setIsGenerating(false);
            setProgress(0);
        }
    };

    const pollTaskStatus = (taskId: string, token: string) => {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

        const interval = setInterval(async () => {
            try {
                const response = await fetch(`${baseUrl}/api/v1/reports/${taskId}/status`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                const data = await response.json();

                // Update progress
                setProgress(prev => Math.min(prev + 10, 90));

                if (data.status === 'completed') {
                    clearInterval(interval);
                    setProgress(100);

                    // Download from Supabase
                    if (data.download_url) {
                        window.open(data.download_url, '_blank');
                    }

                    setTimeout(() => {
                        setIsGenerating(false);
                        setProgress(0);
                        setTaskId(null);
                        onClose();
                    }, 1000);
                } else if (data.status === 'failed') {
                    clearInterval(interval);
                    alert(`Error: ${data.error || 'Unknown error'}`);
                    setIsGenerating(false);
                    setProgress(0);
                    setTaskId(null);
                }
            } catch (error) {
                console.error('Polling error:', error);
                clearInterval(interval);
                setIsGenerating(false);
                setProgress(0);
                setTaskId(null);
            }
        }, 3000); // Poll every 3 seconds
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-slide-up">
                {/* Header */}
                <div className="bg-slate-900 px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="bg-emerald-500 p-2 rounded-lg">
                            <ArrowDownTrayIcon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="text-white font-black uppercase tracking-tight text-sm">{content.title}</h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{content.subtitle}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-xl transition-colors text-slate-400">
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-8 space-y-6">
                    {/* Date Range */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha Inicio</label>
                            <div className="relative">
                                <CalendarIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha Fin</label>
                            <div className="relative">
                                <CalendarIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                                />
                            </div>
                        </div>
                    </div>

                    {content.showFilters && (
                        <>
                            {/* Campaign Selector */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Filtrar por Campaña</label>
                                <div className="relative">
                                    <Bars3CenterLeftIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                                    <select
                                        value={campaignId}
                                        onChange={(e) => setCampaignId(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none appearance-none cursor-pointer"
                                    >
                                        <option value="">Todas las Campañas</option>
                                        {campaigns.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Supervisor Selector */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Filtrar por Supervisor</label>
                                <div className="relative">
                                    <UserGroupIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                                    <select
                                        value={supervisorId}
                                        onChange={(e) => setSupervisorId(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none appearance-none cursor-pointer"
                                    >
                                        <option value="">Todos los Supervisores</option>
                                        {supervisors.map(s => (
                                            <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Info box */}
                    <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                        <p className="text-[10px] font-bold text-emerald-800 leading-relaxed text-center">
                            El archivo se generará en formato <span className="font-black">CSV</span> e incluirá todos los registros que coincidan con los filtros seleccionados.
                        </p>
                    </div>
                </div>

                {/* Actions */}
                <div className="p-6 bg-slate-50 border-t border-slate-200 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-xs font-black text-slate-500 uppercase tracking-widest hover:bg-white transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleDownload}
                        className="flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg shadow-emerald-100 flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                        <ArrowDownTrayIcon className="w-4 h-4" />
                        Descargar Reporte
                    </button>
                </div>
            </div>

            {/* Progress Modal for Async Reports */}
            {isGenerating && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[110]">
                    <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full mx-4">
                        <h3 className="text-xl font-semibold mb-4 text-slate-900">
                            {progress < 30 ? '🔄 Preparando reporte...' :
                                progress < 90 ? '⚙️ Generando reporte...' :
                                    '✅ Finalizando...'}
                        </h3>

                        <div className="w-full h-4 bg-slate-200 rounded-full overflow-hidden mb-3">
                            <div
                                className="h-full bg-gradient-to-r from-emerald-500 to-green-600 transition-all duration-500 ease-out"
                                style={{ width: `${progress}%` }}
                            />
                        </div>

                        <p className="text-sm text-slate-600 text-center font-medium">
                            {progress}% completado
                        </p>

                        {taskId && (
                            <p className="text-xs text-slate-400 mt-3 text-center font-mono">
                                Task: {taskId.substring(0, 8)}...
                            </p>
                        )}

                        <p className="text-xs text-slate-500 mt-4 text-center">
                            Por favor espera, esto puede tomar unos segundos...
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
