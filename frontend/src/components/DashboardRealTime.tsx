"use client";

import { useState, useEffect, useMemo } from 'react';
import { fetchFromAPI } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import RealTimeTable, { Sale, StatusOption, CampaignOption } from './dashboard/RealTimeTable';
import SalesExportModal from './sales/SalesExportModal';
import SalesActions from '@/components/SalesActions';
import { AdvancedFilters, FilterCriteria, applyFilters, extractUniqueAgents, extractUniqueProducts } from './filters';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import {
    BanknotesIcon,
    ArrowTrendingUpIcon,
    CheckCircleIcon,
    XCircleIcon,
    ClockIcon,
    ChartBarIcon,
    ChevronUpIcon,
    ArrowPathIcon,
    PlusIcon,
    FunnelIcon,
    AdjustmentsHorizontalIcon
} from '@heroicons/react/24/outline';
import LoadingState from '@/components/ui/LoadingState';
import { CommissionAssistant } from './analytics/CommissionAssistant';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CurrencyDollarIcon } from '@heroicons/react/24/solid';
import { Trophy } from 'lucide-react';
import { TournamentRaceTrack } from './tournaments/TournamentRaceTrack';

export default function DashboardRealTime() {
    const { toast } = useToast();
    const [sales, setSales] = useState<Sale[]>([]);
    const [statuses, setStatuses] = useState<StatusOption[]>([]);
    const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [totalRecords, setTotalRecords] = useState(0);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [isCommissionOpen, setIsCommissionOpen] = useState(false);
    const [showRaceTrack, setShowRaceTrack] = useState(false);
    const [tournamentsData, setTournamentsData] = useState<any[]>([]);

    // Pagination states
    const [pageIndex, setPageIndex] = useState(0);
    const [pageSize, setPageSize] = useState(20);

    // Filter states with localStorage persistence
    const [showFilters, setShowFilters] = useState<boolean>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('dashboard-show-filters');
            return saved !== null ? JSON.parse(saved) : false; // Default: hidden
        }
        return false;
    });

    const [activeFilters, setActiveFilters] = useState<FilterCriteria>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('dashboard-active-filters');
            return saved ? JSON.parse(saved) : {};
        }
        return {};
    });

    const [supervisors, setSupervisors] = useState<any[]>([]);

    // Save filter preferences
    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('dashboard-show-filters', JSON.stringify(showFilters));
        }
    }, [showFilters]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('dashboard-active-filters', JSON.stringify(activeFilters));
        }
    }, [activeFilters]);

    const loadData = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                scope: 'active',
                page: (pageIndex + 1).toString(),
                size: pageSize.toString()
            });

            const requests = [
                fetchFromAPI(`/api/v1/sales/?${params.toString()}`),
                fetchFromAPI("/api/v1/selectors/statuses"),
                fetchFromAPI("/api/v1/selectors/campaigns"),
                fetchFromAPI("/api/v1/selectors/supervisors"),
            ];

            const results = await Promise.allSettled(requests);

            const salesData = results[0].status === 'fulfilled' ? results[0].value : null;
            const statusesData = results[1].status === 'fulfilled' ? results[1].value : null;
            const campaignsData = results[2].status === 'fulfilled' ? results[2].value : null;
            const supervisorsData = results[3].status === 'fulfilled' ? results[3].value : null;

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
            setSupervisors(supervisorsData?.items || (Array.isArray(supervisorsData) ? supervisorsData : []));

        } catch (err) {
            console.error("Error loading dashboard data:", err);
        } finally {
            setLoading(false);
        }
    };

    const loadTournaments = async () => {
        if (!can?.('tournaments', 'tournaments', 'view_race_track')) return;

        try {
            const tourns = await fetchFromAPI("/api/v1/tournaments/");
            if (tourns && Array.isArray(tourns)) {
                // Limit to top 5 active/current tournaments
                const activeList = tourns.slice(0, 5);
                const dataWithLB = await Promise.all(activeList.map(async (t: any) => {
                    try {
                        const lb = await fetchFromAPI(`/api/v1/tournaments/${t.id}/leaderboard`);
                        return {
                            tournament: t,
                            leaderboard: lb?.entries || []
                        };
                    } catch (lbErr) {
                        return { tournament: t, leaderboard: [] };
                    }
                }));
                setTournamentsData(dataWithLB);
            }
        } catch (tErr) {
            console.error("Error loading tournament data for dashboard:", tErr);
        }
    };

    const { user } = useAuth();
    const { can, isLoading: permsLoading } = usePermission();

    useEffect(() => {
        if (permsLoading) return;

        // --- CONDITIONAL FETCHING ---
        // Access restricted by functional matrix
        if (!can?.('dashboard', 'dashboard', 'access')) {
            setLoading(false);
            return;
        }

        loadData();
        loadTournaments(); // Non-blocking load

        const handleRefresh = () => {
            loadData();
            loadTournaments();
        };
        window.addEventListener('refresh-sales', handleRefresh);
        return () => window.removeEventListener('refresh-sales', handleRefresh);
    }, [pageIndex, pageSize, permsLoading, can]);

    // --- GRACEFUL FALLBACK ---
    if (!permsLoading && !can?.('dashboard', 'dashboard', 'access')) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400 space-y-4">
                <div className="p-4 bg-slate-100 rounded-full">
                    <BanknotesIcon className="w-12 h-12 opacity-20" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-widest">Bienvenido a NEXUS OS</h3>
                <p className="text-[10px] font-bold uppercase tracking-wider max-w-xs text-center line-height-relaxed opacity-60">
                    Tu perfil actual no posee permisos para visualizar el Dashboard Real-Time. Contacta a tu administrador para habilitar 'dashboard:access'.
                </p>
            </div>
        );
    }

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
                    // Logic: If we changed status, it's safer to check the scope
                    const statusObj = statuses.find(s => s.id === value);
                    if (statusObj && statusObj.scope === 'ARCHIVE') {
                        setSales(prev => prev.filter(s => s.id !== id));
                        return;
                    }
                }

                setSales(prev => prev.map(s => {
                    if (s.id === id) {
                        const updated = {
                            ...s,
                            [field]: value,
                            auditor: user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : "Sistema",
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
        } catch (err: any) {
            console.error("Payload attempt:", { id, field, value, auditor: user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : "Sistema" });
            setSales(oldSales);
            toast({
                title: "Error de Actualización",
                description: err.message || "No se pudo sincronizar el cambio con el servidor.",
                variant: "destructive"
            });
        }
    };

    const handleDelete = (id: string) => {
        toast({
            title: "¿Eliminar Registro?",
            description: "Se eliminará permanentemente de la vista operativa y del historial.",
            variant: "destructive",
            duration: Infinity,
            action: (
                <ToastAction
                    altText="ELIMINAR"
                    onClick={async () => {
                        try {
                            await fetchFromAPI(`/api/v1/sales/${id}`, { method: 'DELETE' });
                            toast({ title: "Eliminado", description: "El registro ya no está disponible." });
                            setSales(prev => prev.filter(s => s.id !== id));
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

    // Extract unique values for filters
    const uniqueAgents = useMemo(() => extractUniqueAgents(sales), [sales]);
    const uniqueProducts = useMemo(() => extractUniqueProducts(sales), [sales]);

    // Apply filters
    const filteredSales = useMemo(() => {
        return applyFilters(sales, activeFilters);
    }, [sales, activeFilters]);

    // --- DYNAMIC ANALYTICS ---
    const totalRevenue = filteredSales.reduce((acc, s) => acc + (Number(s.price) || 0), 0);

    // Handler for filter changes
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

    // Status-based counts + Total Productive
    const statusStats = useMemo(() => {
        const stats = statuses.map(status => {
            const count = filteredSales.filter(s =>
                String(s.status || "").toUpperCase() === String(status.name || "").toUpperCase()
            ).length;
            return { ...status, count };
        });

        // Add a "Total" summary if there are productive sales
        const productiveStatuses = statuses.filter(s => s.is_productive).map(s => s.name.toUpperCase());
        const totalProductive = filteredSales.filter(s =>
            productiveStatuses.includes(String(s.status || "").toUpperCase())
        ).length;

        if (totalProductive > 0) {
            stats.unshift({
                id: 'total-productive',
                name: 'Ventas Totales',
                color_hex: '#072D44',
                count: totalProductive,
                scope: 'DASHBOARD',
                is_productive: true
            } as any);
        }

        return stats;
    }, [statuses, filteredSales]);

    if (loading) return <LoadingState message="Sincronizando Sistema de Ventas..." />;

    return (
        <div className="w-full max-w-[1600px] mx-auto p-6 space-y-6 animate-fade-in transition-colors duration-300">
            <header className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight uppercase">Dashboard de Ventas</h1>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">
                        Métricas en Tiempo Real & KPIs
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5 text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-xl border border-emerald-100 dark:border-emerald-900/30 uppercase tracking-widest">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        Sistema Online
                    </span>

                    {can('dashboard', 'sales', 'export') && (
                        <button
                            onClick={() => setIsExportModalOpen(true)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 h-10 rounded-xl shadow-lg shadow-emerald-100 dark:shadow-none transition-all group flex items-center gap-2 active:scale-95"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="text-[10px] font-black uppercase tracking-widest text-white">Exportar</span>
                        </button>
                    )}
                    {can('dashboard', 'finance', 'view_calculator') && (
                        <button
                            onClick={() => setIsCommissionOpen(true)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 h-10 rounded-xl shadow-lg shadow-indigo-100 dark:shadow-none transition-all group flex items-center gap-2 active:scale-95 border border-indigo-500/30"
                        >
                            <CurrencyDollarIcon className="w-5 h-5 text-yellow-300" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-white">Simular Ganancia</span>
                        </button>
                    )}
                    <SalesActions />
                </div>
            </header>

            {/* Dashboard Controls (Race Track Toggle) */}
            {can('tournaments', 'tournaments', 'view_race_track') && (
                <div className="flex justify-end">
                    <button
                        onClick={() => setShowRaceTrack(!showRaceTrack)}
                        className={`
                            px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg active:scale-95 border-2
                            ${showRaceTrack
                                ? 'bg-amber-500 text-white border-amber-600 shadow-amber-500/20'
                                : 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-500 border-amber-500/30 hover:bg-amber-50 dark:hover:bg-amber-900/10'}
                        `}
                    >
                        <Trophy className={`w-4 h-4 ${showRaceTrack ? 'animate-bounce' : ''}`} />
                        {showRaceTrack ? 'Ocultar Carrera' : '🏆 Ver Carrera'}
                    </button>
                </div>
            )}

            {/* Content Toolbar - Consistent with other modules */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-4">
                    {can('dashboard', 'dashboard', 'access') && (
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-sm active:scale-95 border
                                ${showFilters ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-blue-400'}`}
                        >
                            <FunnelIcon className="w-4 h-4" />
                            Filtros Avanzados
                            {activeFilterCount > 0 && (
                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${showFilters ? 'bg-white text-blue-600' : 'bg-blue-600 text-white'}`}>
                                    {activeFilterCount}
                                </span>
                            )}
                        </button>
                    )}
                    <div className="h-6 w-px bg-slate-200 dark:bg-slate-800" />
                    <button
                        onClick={loadData}
                        className="p-2 text-slate-400 hover:text-blue-600 transition-all active:scale-95"
                        title="Recargar Datos"
                    >
                        <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Operaciones en Tiempo Real Nexus
                    </span>
                </div>
            </div>


            {/* ADVANCED FILTERS SECTION */}
            {showFilters && can('dashboard', 'dashboard', 'access') && (
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

            {/* ACTIVE FILTERS INDICATOR */}
            {activeFilterCount > 0 && can('dashboard', 'dashboard', 'access') && (
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

            {/* KPI CARDS SECTION */}
            <div className="flex flex-wrap gap-3">
                {statusStats.map(stat => (
                    <div
                        key={stat.id}
                        className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-gray-200 dark:border-white/5 shadow-sm transition-all hover:shadow-md border-b-4 w-[180px] group"
                        style={{ borderBottomColor: stat.color_hex }}
                    >
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[12px] font-black text-gray-500 dark:text-slate-400 uppercase tracking-wider truncate mr-2 group-hover:text-gray-700 dark:group-hover:text-slate-200 transition-colors" title={stat.name}>
                                {stat.name}
                            </span>
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stat.color_hex }} />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <p className="text-3xl font-black text-[#072D44] dark:text-white leading-none">{stat.count}</p>
                            <span className="text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase">
                                Unidades
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Dashboard Content: Horizontal Race Track + Full Width Table */}
            <div className="space-y-6">
                {/* Race Track Section (Multi-Tournament) */}
                {can?.('tournaments', 'tournaments', 'view_race_track') && showRaceTrack && tournamentsData.length > 0 && (
                    <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                        {tournamentsData.map((tData) => (
                            <TournamentRaceTrack
                                key={tData.tournament.id}
                                tournamentName={tData.tournament.name}
                                participants={tData.leaderboard}
                                targetPoints={tData.tournament.target_points}
                            />
                        ))}
                    </div>
                )}

                {/* Main Operations Panel (Full 12 columns) */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <ChartBarIcon className="w-5 h-5 text-[#072D44] dark:text-slate-100" />
                        <h2 className="text-sm font-black text-[#072D44] dark:text-slate-100 uppercase tracking-tighter">Panel Maestro de Operaciones</h2>
                    </div>
                    <RealTimeTable
                        data={filteredSales}
                        statuses={statuses}
                        campaigns={campaigns}
                        onUpdate={handleUpdate}
                        onDelete={handleDelete}
                    />
                </div>
            </div>

            {/* COMMISSION BOOSTER MODAL (CENTERED & COMPACT) */}
            <Dialog open={isCommissionOpen} onOpenChange={setIsCommissionOpen}>
                <DialogContent className="max-w-4xl p-0 bg-white border-0 shadow-2xl rounded-3xl overflow-hidden max-h-[90vh] flex flex-col text-white">
                    <div className="bg-[#072D44] px-6 py-4 text-white flex justify-between items-center">
                        <DialogHeader className="space-y-0 text-left">
                            <DialogTitle className="text-lg font-black tracking-tighter flex items-center gap-3 text-white uppercase">
                                <div className="bg-indigo-500/30 p-2 rounded-lg backdrop-blur-md">
                                    <CurrencyDollarIcon className="w-5 h-5 text-yellow-300" />
                                </div>
                                Meta Booster
                            </DialogTitle>
                        </DialogHeader>
                    </div>
                    <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                        <CommissionAssistant />
                    </div>
                </DialogContent>
            </Dialog>

            {/* CONTROLES DE PAGINACIÓN PREMIUM (ESTILO SALES HISTORY) */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 px-6 py-6 bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm transition-colors">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                        <span className="text-[11px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Filas:</span>
                        <select
                            value={pageSize}
                            onChange={e => {
                                setPageSize(Number(e.target.value));
                                setPageIndex(0); // Reset a primera página al cambiar tamaño
                            }}
                            className="bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-[11px] font-black text-blue-700 dark:text-blue-400 outline-none focus:border-blue-500 transition-all cursor-pointer shadow-sm appearance-none min-w-[60px] text-center"
                        >
                            {[10, 20, 50, 100].map(size => (
                                <option key={size} value={size}>
                                    {size}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="h-8 w-px bg-gray-100 dark:bg-slate-800" />
                    <span className="text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">
                        Mostrando <span className="text-gray-900 dark:text-slate-100">{sales.length}</span> de <span className="text-gray-900 dark:text-slate-100">{totalRecords}</span> registros activos
                    </span>
                </div>

                <div className="flex items-center gap-4">
                    <button
                        className="p-2.5 border border-gray-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-20 disabled:cursor-not-allowed transition-all shadow-sm"
                        onClick={() => setPageIndex(prev => Math.max(0, prev - 1))}
                        disabled={pageIndex === 0}
                    >
                        <svg className="w-5 h-5 -rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                        </svg>
                    </button>

                    <div className="flex items-center gap-3">
                        <span className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-100 dark:shadow-none">
                            {pageIndex + 1}
                        </span>
                        <span className="text-[11px] font-black text-gray-300 dark:text-slate-700 uppercase letter-widest">
                            de {Math.ceil(totalRecords / pageSize) || 1}
                        </span>
                    </div>

                    <button
                        className="p-2.5 border border-gray-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-20 disabled:cursor-not-allowed transition-all shadow-sm"
                        onClick={() => setPageIndex(prev => prev + 1)}
                        disabled={(pageIndex + 1) >= Math.ceil(totalRecords / pageSize)}
                    >
                        <svg className="w-5 h-5 rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                        </svg>
                    </button>
                </div>
            </div>

            <SalesExportModal
                isOpen={isExportModalOpen}
                onClose={() => setIsExportModalOpen(false)}
                scope="active"
            />

            <footer className="pt-10 border-t border-gray-100 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4 text-gray-400 dark:text-slate-600 text-center md:text-left">
                <p className="text-[10px] font-bold uppercase tracking-widest">Nexus OS v2 • Business Intelligence Unit</p>
                <div className="flex items-center gap-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest">© 2025 AI-SAAS PLATFORM</p>
                </div>
            </footer>
        </div>
    );
}
