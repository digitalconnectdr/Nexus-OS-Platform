'use client';

import { useState, useEffect } from 'react';
import Modal from '@/components/Modal';
import { fetchFromAPI } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import {
    CloudArrowDownIcon,
    CalendarIcon,
    FunnelIcon,
    ArrowPathIcon,
    TableCellsIcon
} from '@heroicons/react/24/outline';
import { useToast } from '@/hooks/use-toast';

interface SalesExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    scope: 'active' | 'history' | 'all';
}

export default function SalesExportModal({ isOpen, onClose, scope }: SalesExportModalProps) {
    const { toast } = useToast();
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);

    // Default dates: Current month
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = now.toISOString().split('T')[0];

    const [startDate, setStartDate] = useState(firstDay);
    const [endDate, setEndDate] = useState(lastDay);
    const [campaignId, setCampaignId] = useState('');

    useEffect(() => {
        if (isOpen) {
            loadCampaigns();
        }
    }, [isOpen]);

    const loadCampaigns = async () => {
        setLoading(true);
        try {
            const data = await fetchFromAPI('/api/v1/selectors/campaigns');
            setCampaigns(data?.items || (Array.isArray(data) ? data : []));
        } catch (err) {
            console.error('Error loading campaigns:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            const params = new URLSearchParams({
                start_date: startDate,
                end_date: endDate,
                scope: scope
            });
            if (campaignId) params.append('campaign_id', campaignId);

            const apiUrl = process.env.NEXT_PUBLIC_API_URL;
            const response = await fetch(`${apiUrl}/api/v1/sales/export?${params.toString()}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) throw new Error('Export failed');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `reporte_ventas_${scope}_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            onClose();
            toast({
                title: "Reporte Generado",
                description: "La descarga ha comenzado correctamente.",
            });
        } catch (err: any) {
            toast({
                title: "Error de Exportación",
                description: err.message || "No se pudo generar el reporte.",
                variant: "destructive"
            });
        } finally {
            setExporting(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={
                <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-white/10 rounded-lg backdrop-blur-md border border-white/20">
                        <TableCellsIcon className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-white tracking-tight uppercase leading-tight">
                            Exportar Reporte de Ventas
                        </h3>
                        <p className="text-[10px] text-blue-200/60 font-medium uppercase tracking-widest mt-0.5">
                            Generar reporte CSV con filtros específicos
                        </p>
                    </div>
                </div>
            }
            maxWidth="max-w-md"
        >
            <div className="space-y-6">
                {/* Date Range */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                            <CalendarIcon className="w-3 h-3 text-blue-500" />
                            FECHA DESDE
                        </label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold text-gray-900 focus:bg-white focus:border-blue-600 outline-none transition-all"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                            <CalendarIcon className="w-3 h-3 text-blue-500" />
                            FECHA HASTA
                        </label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold text-gray-900 focus:bg-white focus:border-blue-600 outline-none transition-all"
                        />
                    </div>
                </div>

                {/* Campaign Selector */}
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                        <FunnelIcon className="w-3 h-3 text-blue-500" />
                        CAMPAÑA (OPCIONAL)
                    </label>
                    <select
                        value={campaignId}
                        onChange={(e) => setCampaignId(e.target.value)}
                        disabled={loading}
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold text-gray-900 focus:bg-white focus:border-blue-600 outline-none transition-all appearance-none cursor-pointer"
                    >
                        <option value="">TODAS LAS CAMPAÑAS</option>
                        {campaigns.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>

                {/* Scope Info */}
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xs">
                            {scope === 'active' ? 'V' : scope === 'history' ? 'H' : 'A'}
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-blue-900 uppercase tracking-tight">
                                ALCANCE DEL REPORTE: {scope === 'active' ? 'DATA VIVA' : scope === 'history' ? 'HISTÓRICO' : 'TODO'}
                            </p>
                            <p className="text-[9px] text-blue-700/70 font-bold uppercase tracking-widest">
                                El archivo incluirá detalles de agentes y productos.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="flex gap-3 pt-2">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 text-xs font-bold text-gray-400 uppercase hover:text-gray-900 transition-all border border-transparent hover:border-gray-200 rounded-lg"
                    >
                        Cancelar
                    </button>
                    <button
                        disabled={exporting}
                        onClick={handleExport}
                        className="flex-[1.5] flex items-center justify-center gap-2 bg-[#001741] hover:bg-black text-white px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 disabled:opacity-50"
                    >
                        {exporting ? (
                            <>
                                <ArrowPathIcon className="w-4 h-4 animate-spin" />
                                GENERANDO...
                            </>
                        ) : (
                            <>
                                <CloudArrowDownIcon className="w-4 h-4" />
                                DESCARGAR CSV
                            </>
                        )}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
