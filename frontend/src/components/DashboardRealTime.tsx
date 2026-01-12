"use client";

import { useState, useEffect } from 'react';
import { fetchFromAPI } from '@/lib/api';
import RealTimeTable, { Sale, StatusOption, CampaignOption } from './dashboard/RealTimeTable';
import SalesExportModal from './sales/SalesExportModal';
import SalesActions from '@/components/SalesActions';
import {
    BanknotesIcon,
    ArrowTrendingUpIcon,
    CheckCircleIcon,
    XCircleIcon,
    ClockIcon,
    ChartBarIcon,
    ChevronUpIcon,
    ArrowPathIcon,
    PlusIcon // Added PlusIcon for the new sale button
} from '@heroicons/react/24/outline';

export default function DashboardRealTime() {
    const [sales, setSales] = useState<Sale[]>([]);
    const [statuses, setStatuses] = useState<StatusOption[]>([]);
    const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
    const [user, setUser] = useState<{ name: string } | null>(null);
    const [loading, setLoading] = useState(true);
    const [totalRecords, setTotalRecords] = useState(0);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);

    // Pagination states
    const [pageIndex, setPageIndex] = useState(0);
    const [pageSize, setPageSize] = useState(20);

    const loadData = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                scope: 'active',
                page: (pageIndex + 1).toString(),
                size: pageSize.toString()
            });

            const [salesData, statusesData, campaignsData, meData] = await Promise.all([
                fetchFromAPI(`/api/v1/sales/?${params.toString()}`),
                fetchFromAPI("/api/v1/statuses/"),
                fetchFromAPI("/api/v1/campaigns/"),
                fetchFromAPI("/api/v1/permissions/me")
            ]);

            const safeSalesRaw = salesData?.items || (Array.isArray(salesData) ? salesData : []);

            // --- DATA MAPPING: Sync Backend Schema with Frontend Table Expectations ---
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

            const safeStatuses = statusesData?.items || (Array.isArray(statusesData) ? statusesData : []);
            const safeCampaigns = campaignsData?.items || (Array.isArray(campaignsData) ? campaignsData : []);

            setStatuses(safeStatuses);
            setCampaigns(safeCampaigns);
            setUser({ name: `${meData.first_name || 'Admin'} ${meData.last_name || 'User'}` });
        } catch (err) {
            console.error("Error loading dashboard data:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();

        const handleRefresh = () => loadData();
        window.addEventListener('refresh-sales', handleRefresh);
        return () => window.removeEventListener('refresh-sales', handleRefresh);
    }, [pageIndex, pageSize]);

    const handleUpdate = async (id: string, field: string, value: any) => {
        const oldSales = [...sales];
        try {
            const payload: any = {
                [field]: value,
                auditor_name: (user?.name || "SISTEMA").toUpperCase()
            };

            const res = await fetchFromAPI(`/api/v1/sales/${id}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });

            if (res.status === 'success') {
                const updatedStatusId = value;
                const statusObj = statuses.find(s => s.id === updatedStatusId);

                // If it's a status update, check if it's still "active work"
                // Assuming statusObj has the is_active_work property, but we might not have it in options
                // Let's rely on the backend result or just force a reload if it's a status change
                if (field === "status_id") {
                    // Logic: If we changed status, it's safer to re-fetch to ensure scope filtering is applied
                    // or we can optimistically remove if the status name is in a terminal list
                    const terminalStatusNames = ['INSTALADA', 'CANCELADA', 'RECHAZADA', 'RETIRADA', 'COMPLETADA'];
                    if (terminalStatusNames.includes(res.status_name?.toUpperCase())) {
                        setSales(prev => prev.filter(s => s.id !== id));
                        return;
                    }
                }

                setSales(prev => prev.map(s => {
                    if (s.id === id) {
                        const updated = {
                            ...s,
                            [field]: value,
                            auditor: user?.name || "Sistema",
                            updated_at: new Date().toISOString()
                        };

                        if (field === "status_id") {
                            updated.status = res.status_name;
                        }

                        // Sync display name for campaign if ID was updated
                        if (field === "campaign_id") {
                            const campaign = campaigns.find(c => c.id === value);
                            if (campaign) updated.campaign = campaign.name;
                        }

                        return updated;
                    }
                    return s;
                }));
            }
        } catch (err) {
            console.error("Payload attempt:", { id, field, value, auditor: user?.name });
            setSales(oldSales);
            alert("Error crítico al actualizar registro. Ver consola para detalles del payload.");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("¿Desea eliminar este registro de forma permanente?")) return;
        try {
            await fetchFromAPI(`/api/v1/sales/${id}`, { method: 'DELETE' });
            setSales(prev => prev.filter(s => s.id !== id));
        } catch (err) {
            console.error("Delete failed:", err);
        }
    };

    // --- DYNAMIC ANALYTICS ---
    const totalRevenue = sales.reduce((acc, s) => acc + (Number(s.price) || 0), 0);

    // Status-based counts
    const statusStats = statuses.map(status => {
        const count = sales.filter(s => s.status.toLowerCase() === status.name.toLowerCase()).length;
        return { ...status, count };
    });

    if (loading) return (
        <div className="p-8 flex items-center justify-center min-h-[400px]">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent animate-spin rounded-full"></div>
                <p className="text-[11px] font-black text-blue-600 uppercase tracking-widest">Sincronizando Sistema de Ventas...</p>
            </div>
        </div>
    );

    return (
        <div className="w-full max-w-full pl-6 pr-6 py-4 space-y-8 bg-gray-50/30 min-h-screen">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex flex-col">
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                        DASHBOARD DE VENTAS
                    </h1>
                    <div className="flex items-center gap-2 text-xs font-medium text-gray-500 mt-1 uppercase tracking-wider">
                        <span>Transacciones en Tiempo Real</span>
                        <span className="text-gray-300">|</span>
                        <span className="flex items-center gap-1.5 text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                            </span>
                            SISTEMA EN LÍNEA
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setIsExportModalOpen(true)}
                        className="bg-white hover:bg-slate-50 text-[#001741] border border-slate-200 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-sm active:scale-95"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Exportar
                    </button>
                    <SalesActions />
                </div>
            </header>

            {/* Divisor Sutil */}
            <hr className="border-gray-200 my-6" />

            {/* DYNAMIC KPI CARDS */}
            <div className="flex flex-wrap gap-3">
                {statusStats.map(stat => (
                    <div
                        key={stat.id}
                        className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm transition-all hover:shadow-md border-b-4 w-[180px]"
                        style={{ borderBottomColor: stat.color_hex }}
                    >
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[12px] font-black text-gray-500 uppercase tracking-wider truncate mr-2" title={stat.name}>
                                {stat.name}
                            </span>
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stat.color_hex }} />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <p className="text-3xl font-black text-[#072D44] leading-none">{stat.count}</p>
                            <span className="text-[11px] font-bold text-gray-400 uppercase">
                                Unidades
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <ChartBarIcon className="w-5 h-5 text-[#072D44]" />
                    <h2 className="text-sm font-black text-[#072D44] uppercase tracking-tighter">Panel Maestro de Operaciones</h2>
                </div>
                <RealTimeTable
                    data={sales}
                    statuses={statuses}
                    campaigns={campaigns}
                    onUpdate={handleUpdate}
                    onDelete={handleDelete}
                />
            </div>

            {/* CONTROLES DE PAGINACIÓN PREMIUM (ESTILO SALES HISTORY) */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 px-6 py-6 bg-white rounded-2xl border border-gray-200 shadow-sm">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                        <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Filas:</span>
                        <select
                            value={pageSize}
                            onChange={e => {
                                setPageSize(Number(e.target.value));
                                setPageIndex(0); // Reset a primera página al cambiar tamaño
                            }}
                            className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-[11px] font-black text-blue-700 outline-none focus:border-blue-500 transition-all cursor-pointer shadow-sm appearance-none min-w-[60px] text-center"
                        >
                            {[10, 20, 50, 100].map(size => (
                                <option key={size} value={size}>
                                    {size}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="h-8 w-px bg-gray-100" />
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                        Mostrando <span className="text-gray-900">{sales.length}</span> de <span className="text-gray-900">{totalRecords}</span> registros activos
                    </span>
                </div>

                <div className="flex items-center gap-4">
                    <button
                        className="p-2.5 border border-gray-200 rounded-xl bg-white hover:bg-blue-50 text-gray-500 hover:text-blue-600 disabled:opacity-20 disabled:cursor-not-allowed transition-all shadow-sm"
                        onClick={() => setPageIndex(prev => Math.max(0, prev - 1))}
                        disabled={pageIndex === 0}
                    >
                        <ChevronUpIcon className="w-5 h-5 -rotate-90" />
                    </button>

                    <div className="flex items-center gap-3">
                        <span className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-100">
                            {pageIndex + 1}
                        </span>
                        <span className="text-[11px] font-black text-gray-300 uppercase letter-widest">
                            de {Math.ceil(totalRecords / pageSize) || 1}
                        </span>
                    </div>

                    <button
                        className="p-2.5 border border-gray-200 rounded-xl bg-white hover:bg-blue-50 text-gray-500 hover:text-blue-600 disabled:opacity-20 disabled:cursor-not-allowed transition-all shadow-sm"
                        onClick={() => setPageIndex(prev => prev + 1)}
                        disabled={(pageIndex + 1) >= Math.ceil(totalRecords / pageSize)}
                    >
                        <ChevronUpIcon className="w-5 h-5 rotate-90" />
                    </button>
                </div>
            </div>

            <SalesExportModal
                isOpen={isExportModalOpen}
                onClose={() => setIsExportModalOpen(false)}
                scope="active"
            />

            <footer className="pt-10 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4 text-gray-400 text-center md:text-left">
                <p className="text-[10px] font-bold uppercase tracking-widest">Nexus OS v2 • Business Intelligence Unit</p>
                <div className="flex items-center gap-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest">© 2025 AI-SAAS PLATFORM</p>
                </div>
            </footer>
        </div>
    );
}
