'use client';

import { useState, useEffect } from 'react';
import {
    ShoppingBagIcon,
    ArrowPathIcon,
    MagnifyingGlassIcon,
    DocumentTextIcon,
    ChevronUpIcon
} from '@heroicons/react/24/outline';
import { fetchFromAPI } from '@/lib/api';
import RealTimeTable, { Sale } from '@/components/dashboard/RealTimeTable';
import SalesExportModal from './SalesExportModal';

export default function SalesHistoryTable() {
    const [sales, setSales] = useState<Sale[]>([]);
    const [statuses, setStatuses] = useState<any[]>([]);
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [totalRecords, setTotalRecords] = useState(0);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [pageIndex, setPageIndex] = useState(0);
    const [pageSize, setPageSize] = useState(20);

    const loadData = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: (pageIndex + 1).toString(),
                size: pageSize.toString(),
                scope: 'history', // FORCE HISTORY SCOPE
                sort_by: '-created_at'
            });

            const [salesData, statusesData, campaignsData] = await Promise.all([
                fetchFromAPI(`/api/v1/sales/?${params.toString()}`),
                fetchFromAPI("/api/v1/statuses/"),
                fetchFromAPI("/api/v1/campaigns/")
            ]);

            const safeSalesRaw = salesData?.items || [];

            // --- DATA MAPPING: Identical to Dashboard ---
            const safeSales: Sale[] = safeSalesRaw.map((s: any) => {
                const createdAt = s.created_at ? new Date(s.created_at) : new Date();
                return {
                    id: s.id,
                    date: createdAt.toLocaleDateString('es-DO'),
                    time: createdAt.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' }),
                    campaign: s.campaign_name || s.campaign?.name || "--",
                    campaign_id: s.campaign_id,
                    client: s.customer_name || "--",
                    doc_id: s.customer_doc_id || "--",
                    contact: s.customer_contact || "--",
                    os_madre: s.os_madre || "--",
                    os_hija: s.os_hija || "--",
                    family: s.snapshot_family || s.product?.family_name || "--",
                    product: s.snapshot_product_name || s.product?.name || "--",
                    plan: s.snapshot_plan || s.product?.plan_name || s.product?.name || "--",
                    pp: s.snapshot_pp || "--",
                    concept: s.snapshot_concept || "--",
                    price: s.snapshot_price || 0,
                    status: s.status || "pending",
                    assigned_to: s.assigned_to || "--",
                    comms_claro: s.comms_claro || "",
                    comms_orion: s.comms_orion || "",
                    comms_dofu: s.comms_dofu || "",
                    inst_num: s.inst_num || "--",
                    auditor: s.last_updated_by || "--",
                    last_status_change: s.last_status_change,
                    updated_at: s.updated_at,
                    agent: s.agent?.first_name
                        ? `${s.agent.first_name} ${s.agent.last_name || ''}`.trim()
                        : (s.agent?.email || s.agent_email || "SISTEMA")
                };
            });

            setSales(safeSales);
            setTotalRecords(salesData?.total || safeSales.length);
            setStatuses(statusesData?.items || []);
            setCampaigns(campaignsData?.items || []);
        } catch (err) {
            console.error("Error loading history data:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [pageIndex, pageSize]);

    const handleUpdate = async (id: string, field: string, value: any) => {
        try {
            const payload = { [field]: value, last_updated_by: "HISTORIAL" };
            const res = await fetchFromAPI(`/api/v1/sales/${id}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
            if (res.status === 'success') {
                loadData(); // Re-fetch to apply scope filtering if changed back to active
            }
        } catch (err) {
            console.error("Update failed:", err);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("¿Desea eliminar permanentemente?")) return;
        try {
            await fetchFromAPI(`/api/v1/sales/${id}`, { method: 'DELETE' });
            loadData();
        } catch (err) {
            console.error("Delete failed:", err);
        }
    };

    return (
        <div className="w-full max-w-full pl-6 pr-6 py-4 space-y-6 bg-gray-50/30 min-h-screen">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-black text-[#072D44] flex items-center gap-3 tracking-tight">
                        <ShoppingBagIcon className="w-8 h-8 text-blue-600" />
                        HISTORIAL MAESTRO
                    </h2>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mt-1">
                        Bóveda de Transacciones Terminadas e Históricas
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-[#072D44] text-white px-4 py-1.5 rounded-full shadow-lg">
                        <span className="text-[9px] font-black uppercase tracking-widest opacity-60">Registros</span>
                        <span className="text-sm font-black">{totalRecords.toLocaleString()}</span>
                    </div>
                    <button
                        onClick={() => setIsExportModalOpen(true)}
                        className="bg-white hover:bg-slate-50 text-[#072D44] border border-gray-200 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-sm active:scale-95"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Exportar
                    </button>
                    <button
                        onClick={() => loadData()}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-white rounded-full transition-all shadow-sm border border-gray-100"
                    >
                        <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* TABLA REUTILIZADA (MISMA CALIDAD) */}
            <div className="relative">
                {loading && (
                    <div className="absolute inset-0 z-50 bg-white/60 backdrop-blur-sm flex items-center justify-center rounded-xl">
                        <div className="flex flex-col items-center gap-3">
                            <ArrowPathIcon className="w-10 h-10 text-blue-600 animate-spin" />
                            <span className="text-[10px] font-black text-[#072D44] uppercase tracking-widest">Sincronizando Historial...</span>
                        </div>
                    </div>
                )}

                <RealTimeTable
                    data={sales}
                    statuses={statuses}
                    campaigns={campaigns}
                    onUpdate={handleUpdate}
                    onDelete={handleDelete}
                />
            </div>

            {/* PAGINACIÓN */}
            <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-4">
                    <select
                        value={pageSize}
                        onChange={(e) => setPageSize(Number(e.target.value))}
                        className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1 text-[11px] font-black text-[#072D44]"
                    >
                        {[10, 20, 50, 100].map(s => <option key={s} value={s}>{s} filas</option>)}
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        disabled={pageIndex === 0}
                        onClick={() => setPageIndex(p => p - 1)}
                        className="p-2 border border-gray-100 rounded-lg hover:bg-gray-50 disabled:opacity-30"
                    >
                        <ChevronUpIcon className="w-5 h-5 -rotate-90" />
                    </button>
                    <span className="text-[11px] font-black text-[#072D44]">PÁGINA {pageIndex + 1}</span>
                    <button
                        disabled={sales.length < pageSize}
                        onClick={() => setPageIndex(p => p + 1)}
                        className="p-2 border border-gray-100 rounded-lg hover:bg-gray-50 disabled:opacity-30"
                    >
                        <ChevronUpIcon className="w-5 h-5 rotate-90" />
                    </button>
                </div>
            </div>

            <SalesExportModal
                isOpen={isExportModalOpen}
                onClose={() => setIsExportModalOpen(false)}
                scope="history"
            />
        </div>
    );
}
