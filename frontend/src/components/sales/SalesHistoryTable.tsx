'use client';

import { useState, useEffect, useMemo } from 'react';
import {
    ShoppingBagIcon,
    ArrowPathIcon,
    MagnifyingGlassIcon,
    DocumentTextIcon,
    ChevronUpIcon,
    ChartBarIcon,
    EyeIcon,
    EyeSlashIcon,
    FunnelIcon,
    XMarkIcon,
    AdjustmentsHorizontalIcon,
    ArchiveBoxXMarkIcon
} from '@heroicons/react/24/outline';
import { fetchFromAPI } from '@/lib/api';
import RealTimeTable, { Sale } from '@/components/dashboard/RealTimeTable';
import SalesExportModal from './SalesExportModal';
import {
    SalesByStatusChart,
    SalesTrendChart,
    TopCampaignsChart,
    TopAgentsChart
} from '../charts';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { AdvancedFilters, FilterCriteria, applyFilters, extractUniqueAgents, extractUniqueProducts } from '../filters';
import LoadingState from '@/components/ui/LoadingState';
import { usePermission } from '@/hooks/usePermission';
import { LockClosedIcon } from '@heroicons/react/24/outline';

export default function SalesHistoryTable() {
    const { toast } = useToast();
    const [sales, setSales] = useState<Sale[]>([]);
    const [statuses, setStatuses] = useState<any[]>([]);
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [totalRecords, setTotalRecords] = useState(0);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [pageIndex, setPageIndex] = useState(0);
    const [pageSize, setPageSize] = useState(20);
    const [isTrashView, setIsTrashView] = useState(false);

    // Charts visibility state with localStorage persistence
    const [showCharts, setShowCharts] = useState<boolean>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('history-show-charts');
            return saved !== null ? JSON.parse(saved) : true; // Default: visible
        }
        return true;
    });

    // ... (filters state)

    // Reload when changing view mode
    useEffect(() => {
        setPageIndex(0);
        loadData();
    }, [isTrashView]);

    // ... 

    const loadData = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: (pageIndex + 1).toString(),
                size: pageSize.toString(),
                scope: 'history', // FORCE HISTORY SCOPE
                sort_by: '-created_at'
            });

            if (isTrashView) params.append('trashed', 'true');

            const [salesData, statusesData, campaignsData, supervisorsData] = await Promise.all([
                fetchFromAPI(`/api/v1/sales/?${params.toString()}`),
                fetchFromAPI("/api/v1/selectors/statuses"),
                fetchFromAPI("/api/v1/selectors/campaigns"),
                fetchFromAPI("/api/v1/selectors/supervisors")
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
            setStatuses(statusesData?.items || (Array.isArray(statusesData) ? statusesData : []));
            setCampaigns(campaignsData?.items || (Array.isArray(campaignsData) ? campaignsData : []));
            setSupervisors(supervisorsData?.items || (Array.isArray(supervisorsData) ? supervisorsData : []));
        } catch (err) {
            console.error("Error loading history data:", err);
        } finally {
            setLoading(false);
        }
    };

    const { can, isLoading: permsLoading } = usePermission();

    useEffect(() => {
        if (permsLoading) return;
        // CRASH PROTECTION: Safe Check
        const hasAccess = can ? can('history', 'view') : false;
        if (!hasAccess) return;

        loadData();
    }, [pageIndex, pageSize, permsLoading, can]);

    if (!permsLoading) {
        // CRASH PROTECTION: Safe Check
        const hasAccess = can ? can('history', 'view') : false;
        if (!hasAccess) {
            return (
                <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400 space-y-4">
                    <div className="p-4 bg-slate-100 rounded-full">
                        <LockClosedIcon className="w-12 h-12 opacity-20" />
                    </div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-[#072D44]">Bóveda de Historial Bloqueada</h3>
                    <p className="text-[10px] font-bold uppercase tracking-wider max-w-xs text-center line-height-relaxed opacity-60">
                        Tu perfil actual no posee permisos para consultar el Historial Maestro. Contacta a un administrador para habilitar 'history:view'.
                    </p>
                </div>
            );
        }
    }

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

    const handleDelete = (id: string) => {
        toast({
            title: "¿Confirmar Eliminación?",
            description: "Esta acción eliminará el registro de forma permanente del historial.",
            variant: "destructive",
            duration: Infinity,
            action: (
                <ToastAction
                    altText="ELIMINAR"
                    onClick={async () => {
                        try {
                            await fetchFromAPI(`/api/v1/sales/${id}`, { method: 'DELETE' });
                            toast({ title: "Registro Eliminado", description: "El historial ha sido actualizado." });
                            loadData();
                        } catch (err: any) {
                            toast({ title: "Error", description: err.message, variant: "destructive" });
                        }
                    }}
                >
                    ELIMINAR
                </ToastAction>
            )
        });
    };

    const handlePurge = (id: string) => {
        toast({
            title: "☠️ ¿PURGAR VENTA?",
            description: "Esta acción DESTRUIRÁ el registro y toda su trazabilidad. NO SE PUEDE DESHACER.",
            variant: "destructive",
            duration: Infinity,
            action: (
                <ToastAction
                    altText="PURGAR"
                    onClick={async () => {
                        try {
                            await fetchFromAPI(`/api/v1/sales/${id}?force=true`, { method: 'DELETE' });
                            toast({ title: "Venta Purgada", description: "Registro eliminado definitivamente." });
                            loadData();
                        } catch (err: any) {
                            toast({ title: "Error al purgar", description: err.message, variant: "destructive" });
                        }
                    }}
                    className="bg-black text-white hover:bg-gray-900 border-none"
                >
                    DESTRUIR
                </ToastAction>
            )
        });
    };

    // Drill-down handlers
    const handleStatusClick = (statusId: string, statusName: string) => {
        setActiveFilter({
            type: 'status',
            value: statusId,
            label: `Estado: ${statusName}`
        });
    };

    const handleCampaignClick = (campaignId: string, campaignName: string) => {
        setActiveFilter({
            type: 'campaign',
            value: campaignId,
            label: `Campaña: ${campaignName}`
        });
    };

    const handleAgentClick = (agent: string) => {
        setActiveFilter({
            type: 'agent',
            value: agent,
            label: `Agente: ${agent.includes('@') ? agent.split('@')[0] : agent}`
        });
    };

    const handleDateClick = (date: string) => {
        setActiveFilter({
            type: 'date',
            value: date,
            label: `Fecha: ${date}`
        });
    };

    const clearFilter = () => {
        setActiveFilter(null);
    };

    // Extract unique values for advanced filters
    const uniqueAgents = useMemo(() => extractUniqueAgents(sales), [sales]);
    const uniqueProducts = useMemo(() => extractUniqueProducts(sales), [sales]);

    // Advanced filter handlers
    const handleFilterChange = (filters: FilterCriteria) => {
        setActiveFilters(filters);
    };

    const handleClearFilters = () => {
        setActiveFilters({});
    };

    // Count active filters
    const activeFilterCount = Object.keys(activeFilters).filter(key => {
        const value = activeFilters[key as keyof FilterCriteria];
        if (Array.isArray(value)) return value.length > 0;
        return value !== undefined && value !== '';
    }).length;

    // Combined filtering: Apply both drill-down filter and advanced filters
    const filteredSales = useMemo(() => {
        let result = sales;

        // First apply drill-down filter from charts
        if (activeFilter) {
            result = result.filter(sale => {
                switch (activeFilter.type) {
                    case 'status':
                        return sale.status === activeFilter.value || sale.status === statuses.find(s => s.id === activeFilter.value)?.name;
                    case 'campaign':
                        return sale.campaign_id === activeFilter.value || sale.campaign === activeFilter.value;
                    case 'agent':
                        return sale.agent === activeFilter.value || sale.assigned_to === activeFilter.value;
                    case 'date':
                        return sale.date === activeFilter.value;
                    default:
                        return true;
                }
            });
        }

        // Then apply advanced filters
        result = applyFilters(result, activeFilters);

        return result;
    }, [sales, activeFilter, activeFilters, statuses]);

    return (
        <div className="w-full max-w-[1600px] mx-auto p-6 space-y-6 animate-fade-in">
            <header className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight uppercase">Historial Maestro</h1>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">
                        Bóveda de Transacciones & Auditoría
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-slate-900 text-white px-4 py-1.5 rounded-full shadow-lg">
                        <span className="text-[9px] font-black uppercase tracking-widest opacity-60">Registros</span>
                        <span className="text-sm font-black">{totalRecords.toLocaleString()}</span>
                    </div>

                    {can('history', 'export') && (
                        <button
                            onClick={() => setIsExportModalOpen(true)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 h-10 rounded-xl shadow-lg shadow-emerald-100 transition-all group flex items-center gap-2 active:scale-95"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="text-[10px] font-black uppercase tracking-widest">Exportar</span>
                        </button>
                    )}

                    <button
                        onClick={() => loadData()}
                        className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500 rounded-xl text-slate-400 hover:text-blue-600 transition-all shadow-sm active:scale-95"
                        title="Sincronizar Datos"
                    >
                        <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <div className="border-l border-slate-700 h-6 mx-2" />

                    {/* Trash Toggle */}
                    {can('history', 'delete') && (
                        <button
                            onClick={() => setIsTrashView(!isTrashView)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase tracking-widest transition-all ${isTrashView
                                ? 'bg-red-500 text-white shadow-lg shadow-red-500/50'
                                : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                                }`}
                            title={isTrashView ? "Volver a Historial" : "Ver Papelera de Ventas"}
                        >
                            {isTrashView ? (
                                <>
                                    <ArrowPathIcon className="w-3.5 h-3.5" />
                                    <span>Activos</span>
                                </>
                            ) : (
                                <>
                                    <ArchiveBoxXMarkIcon className="w-3.5 h-3.5" />
                                    <span>Papelera</span>
                                </>
                            )}
                        </button>
                    )}
                </div>
            </header>

            {/* Content Toolbar - Consistent with other modules */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-4">
                    {/* Toggle Charts */}
                    {can('history', 'charts') && (
                        <button
                            onClick={() => setShowCharts(!showCharts)}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-sm active:scale-95 border
                                ${showCharts ? 'bg-slate-900 text-white border-slate-900' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-400'}`}
                        >
                            <ChartBarIcon className="w-4 h-4" />
                            {showCharts ? "Ocultar Análisis" : "Ver Análisis"}
                        </button>
                    )}

                    <div className="h-6 w-px bg-slate-200 dark:bg-slate-800" />

                    {/* Toggle Filters */}
                    {can('history', 'filters') && (
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-sm active:scale-95 border
                                ${showFilters ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-blue-400'}`}
                        >
                            <FunnelIcon className="w-4 h-4" />
                            Búsqueda Avanzada
                            {activeFilterCount > 0 && (
                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${showFilters ? 'bg-white text-blue-600' : 'bg-blue-600 text-white'}`}>
                                    {activeFilterCount}
                                </span>
                            )}
                        </button>
                    )}
                </div>

                <div className="flex-1 flex justify-end">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Auditoría de Ventas Nexus
                    </p>
                </div>
            </div>

            {/* ADVANCED FILTERS SECTION */}
            {showFilters && can('history', 'filters') && (
                <AdvancedFilters
                    statuses={statuses}
                    campaigns={campaigns}
                    agents={uniqueAgents}
                    products={uniqueProducts}
                    supervisors={supervisors}
                    onFilterChange={handleFilterChange}
                    initialFilters={activeFilters}
                />
            )}

            {/* ACTIVE FILTERS INDICATOR (from Advanced Filters) */}
            {activeFilterCount > 0 && can('history', 'filters') && (
                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3 flex-wrap">
                        <FunnelIcon className="w-5 h-5 text-blue-600 flex-shrink-0" />
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-black text-blue-900 uppercase tracking-wider">
                                {activeFilterCount} filtro{activeFilterCount > 1 ? 's' : ''} activo{activeFilterCount > 1 ? 's' : ''}:
                            </span>
                            <span className="text-xs font-bold text-blue-700">
                                {filteredSales.length} de {sales.length} registros
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={handleClearFilters}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white border-2 border-blue-200 rounded-lg text-xs font-black text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition-all active:scale-95 uppercase tracking-wider"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Limpiar
                    </button>
                </div>
            )}

            {/* ACTIVE FILTER INDICATOR (from Chart Drill-Down) */}
            {activeFilter && can('history', 'charts') && (
                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                        <FunnelIcon className="w-5 h-5 text-blue-600" />
                        <div>
                            <p className="text-xs font-black text-blue-900 uppercase tracking-wider">Filtro Activo</p>
                            <p className="text-sm font-bold text-blue-700 mt-0.5">{activeFilter.label}</p>
                        </div>
                    </div>
                    <button
                        onClick={clearFilter}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white border-2 border-blue-200 rounded-lg text-xs font-black text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition-all active:scale-95 uppercase tracking-wider"
                    >
                        <XMarkIcon className="w-4 h-4" />
                        Limpiar Filtro
                    </button>
                </div>
            )}

            {/* INTERACTIVE CHARTS SECTION */}
            {showCharts && can('history', 'charts') && (
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <ChartBarIcon className="w-5 h-5 text-[#072D44]" />
                        <h2 className="text-sm font-black text-[#072D44] uppercase tracking-tighter">Análisis Visual</h2>
                        <span className="text-xs text-gray-400 font-medium">Click en cualquier gráfico para filtrar</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <SalesByStatusChart
                            statuses={statuses}
                            sales={filteredSales}
                            onSegmentClick={handleStatusClick}
                        />
                        <SalesTrendChart
                            sales={filteredSales}
                            onPointClick={handleDateClick}
                        />
                        <TopCampaignsChart
                            campaigns={campaigns}
                            sales={filteredSales}
                            onBarClick={handleCampaignClick}
                            limit={5}
                        />
                        <TopAgentsChart
                            sales={filteredSales}
                            onBarClick={handleAgentClick}
                            limit={5}
                        />
                    </div>
                </div>
            )}

            {/* TABLA REUTILIZADA (MISMA CALIDAD) */}
            <div className="relative">
                {loading && <LoadingState message="Sincronizando Historial..." />}

                <RealTimeTable
                    data={filteredSales}
                    statuses={statuses}
                    campaigns={campaigns}
                    onUpdate={handleUpdate}
                    onDelete={handleDelete}
                    isTrashView={isTrashView}
                    onPurge={handlePurge}
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
