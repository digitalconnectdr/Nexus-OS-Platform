'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchFromAPI } from '@/lib/api';
import FinancialResults from './analytics/FinancialResults';
import PayrollTable from './analytics/PayrollTable';
import ManagerialVisionTab from './analytics/ManagerialVisionTab';
import AnalyticsExportModal from './analytics/AnalyticsExportModal';
import { useDashboardFilters } from '@/hooks/useDashboardFilters';
import { usePermission } from '@/hooks/usePermission';
import { FilterIcon, LayoutDashboardIcon } from 'lucide-react';

type Tab = 'financial' | 'payroll' | 'managerial';

export default function FinancialDashboard() {
    const { can } = usePermission();
    const {
        startDate,
        endDate,
        activeTab: urlTab,
        setStartDate,
        setEndDate,
        setActiveTab
    } = useDashboardFilters();

    const activeTab = (urlTab || 'financial') as Tab;
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);

    // Global Filters State
    const [selectedStatus, setSelectedStatus] = useState<string>("All");
    const [selectedCampaign, setSelectedCampaign] = useState<string>("All");

    // Dropdown Data
    const [statuses, setStatuses] = useState<any[]>([]);
    const [campaigns, setCampaigns] = useState<any[]>([]);

    const loadFilterData = useCallback(async () => {
        const canReadStatuses = can('config_statuses', 'statuses', 'read');
        const canReadCampaigns = can('config_campaigns', 'campaigns', 'read');

        try {
            const fetchPromises = [];

            // Statuses
            if (canReadStatuses) {
                fetchPromises.push(fetchFromAPI('/api/v1/statuses/'));
            } else {
                fetchPromises.push(Promise.resolve([]));
            }

            // Campaigns
            if (canReadCampaigns) {
                fetchPromises.push(fetchFromAPI('/api/v1/campaigns/'));
            } else {
                fetchPromises.push(Promise.resolve([]));
            }

            const [statusRes, campRes] = await Promise.all(fetchPromises);
            setStatuses(statusRes || []);
            setCampaigns(campRes || []);
        } catch (err) {
            console.error("Error loading filters:", err);
        }
    }, [can]);

    useEffect(() => {
        loadFilterData();
    }, [loadFilterData]);

    const activeFiltersCount = useMemo(() => {
        let count = 0;
        if (selectedStatus !== "All") count++;
        if (selectedCampaign !== "All") count++;
        return count;
    }, [selectedStatus, selectedCampaign]);

    // Permission flags for UI
    const canReadStatuses = can('config_statuses', 'statuses', 'read');
    const canReadCampaigns = can('config_campaigns', 'campaigns', 'read');

    return (
        <div className="space-y-6 max-w-[1600px] mx-auto animate-fade-in">
            <header className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight uppercase">Gestión Financiera</h1>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">
                        Revenue & Utilidad
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    {/* Global Date Range */}
                    <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-2 px-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:border-emerald-200 dark:hover:border-emerald-900">
                        <div className="flex items-center gap-3">
                            <div className="flex flex-col">
                                <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mb-1">Desde</span>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="text-[10px] font-bold text-slate-900 dark:text-slate-100 bg-transparent border-none p-0 focus:ring-0 cursor-pointer uppercase"
                                />
                            </div>
                        </div>
                        <div className="w-px h-8 bg-slate-100 dark:bg-slate-800 mx-1" />
                        <div className="flex items-center gap-3">
                            <div className="flex flex-col">
                                <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mb-1">Hasta</span>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="text-[10px] font-bold text-slate-900 dark:text-slate-100 bg-transparent border-none p-0 focus:ring-0 cursor-pointer uppercase"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Export Trigger */}
                    {can('finance', 'finance', 'export') && (
                        <button
                            onClick={() => setIsExportModalOpen(true)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 h-10 rounded-xl shadow-lg shadow-emerald-100 transition-all group flex items-center gap-2 active:scale-95"
                            title="Exportar Reporte Financiero"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            <span className="text-[10px] font-black uppercase tracking-widest">Repo. Financiero</span>
                        </button>
                    )}
                </div>
            </header>

            <AnalyticsExportModal
                isOpen={isExportModalOpen}
                onClose={() => setIsExportModalOpen(false)}
                currentStartDate={startDate}
                currentEndDate={endDate}
                mode="financial"
            />

            <div className="flex border-b border-slate-200 dark:border-slate-800 gap-1 overflow-x-auto no-scrollbar">
                {(['financial', 'payroll', 'managerial'] as Tab[]).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-8 py-3 text-[11px] font-bold uppercase tracking-widest transition-all relative
                            ${activeTab === tab
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                    >
                        {tab === 'financial' ? 'Resultados Financieros' :
                            tab === 'payroll' ? 'Nómina de Comisiones' : 'Visión Gerencial'}

                        {activeTab === tab && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 dark:bg-emerald-400 animate-in slide-in-from-left-full duration-300" />
                        )}
                    </button>
                ))}
            </div>

            {/* Content Toolbar - Moved from Header for consistency */}
            <div className="bg-slate-50/50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-6 flex-1">
                    {/* Indicator Summary */}
                    <div className="flex items-center gap-3 pr-6 border-r border-slate-200 dark:border-slate-800">
                        {activeFiltersCount === 0 ? (
                            <div className="flex items-center gap-2">
                                <LayoutDashboardIcon className="w-3 h-3 text-slate-400" />
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vista General</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-lg border border-emerald-100 dark:border-emerald-900 animate-in zoom-in-95 duration-300">
                                <FilterIcon className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">{activeFiltersCount} Seleccionados</span>
                            </div>
                        )}
                    </div>

                    {/* Master Filters (Status / Campaign) */}
                    <div className="flex items-center gap-6">
                        {canReadStatuses && (
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estatus:</span>
                                <select
                                    value={selectedStatus}
                                    onChange={(e) => setSelectedStatus(e.target.value)}
                                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-[10px] font-bold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-emerald-500/20 uppercase cursor-pointer"
                                >
                                    <option value="All">Todos los Estatus</option>
                                    {statuses.map(s => (
                                        <option key={s.id} value={s.name}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {canReadCampaigns && (
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Campaña:</span>
                                <select
                                    value={selectedCampaign}
                                    onChange={(e) => setSelectedCampaign(e.target.value)}
                                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-[10px] font-bold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-emerald-500/20 uppercase cursor-pointer"
                                >
                                    <option value="All">Todas las Campañas</option>
                                    {campaigns.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Analítica Financiera NEXUS
                    </span>
                </div>
            </div>

            {/* Tab Content */}
            <div className="mt-6">
                {activeTab === 'financial' && (
                    <FinancialResults
                        startDate={startDate}
                        endDate={endDate}
                        status={selectedStatus}
                        campaignId={selectedCampaign}
                    />
                )}
                {activeTab === 'payroll' && (
                    <PayrollTable
                        startDate={startDate}
                        endDate={endDate}
                        status={selectedStatus}
                        campaignId={selectedCampaign}
                    />
                )}
                {activeTab === 'managerial' && (
                    <ManagerialVisionTab
                        startDate={startDate}
                        endDate={endDate}
                        status={selectedStatus}
                        campaignId={selectedCampaign}
                    />
                )}
            </div>
        </div>
    );
}
