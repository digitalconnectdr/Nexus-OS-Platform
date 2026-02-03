'use client';

import { useState } from 'react';
import AgentScorecardTable from './analytics/AgentScorecardTable';
import AnalyticsExportModal from './analytics/AnalyticsExportModal';
import OperationalEfficiency from './analytics/OperationalEfficiency';
import BackofficeScorecard from './analytics/BackofficeScorecard';
import { useDashboardFilters } from '@/hooks/useDashboardFilters';
import { usePermission } from '@/hooks/usePermission';
import { LockClosedIcon, UserGroupIcon, FunnelIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { fetchFromAPI } from '@/lib/api';
import { useEffect, useCallback } from 'react';

type Tab = 'scorecard' | 'backoffice' | 'efficiency';

export default function AnalyticsDashboard() {
    const {
        startDate,
        endDate,
        searchTerm,
        activeTab: urlTab,
        setStartDate,
        setEndDate,
        setSearchTerm,
        setActiveTab
    } = useDashboardFilters();

    const { can, isLoading: permsLoading } = usePermission();

    // Filter allowed tabs
    const allowedTabs = [
        { id: 'scorecard', label: 'Scorecard Agentes', perm: 'performance:scorecard' },
        { id: 'backoffice', label: 'Digitación & Backoffice', perm: 'performance:backoffice' },
        { id: 'efficiency', label: 'Eficiencia Operativa', perm: 'performance:efficiency' }
    ].filter(tab => can('performance', tab.perm.split(':')[1]));

    const activeTab = (urlTab || (allowedTabs[0]?.id || 'scorecard')) as Tab;
    const [subTab, setSubTab] = useState<'hierarchy' | 'campaign'>('hierarchy');
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);

    // Filter States
    const [supervisorId, setSupervisorId] = useState('');
    const [campaignId, setCampaignId] = useState('');
    const [supervisors, setSupervisors] = useState<any[]>([]);
    const [campaigns, setCampaigns] = useState<any[]>([]);

    const loadFilters = useCallback(async () => {
        try {
            const [supervisorsRes, campaignsRes] = await Promise.all([
                fetchFromAPI('/api/v1/selectors/supervisors'),
                fetchFromAPI('/api/v1/selectors/campaigns')
            ]);
            setSupervisors(Array.isArray(supervisorsRes) ? supervisorsRes : []);
            setCampaigns(Array.isArray(campaignsRes) ? campaignsRes : []);
        } catch (err) {
            console.error("Error loading analytics master filters:", err);
        }
    }, []);

    useEffect(() => {
        loadFilters();
    }, [loadFilters]);

    // Extraemos el mes actual de la fecha de inicio para el componente de resultados
    const currentMonth = startDate.substring(0, 7); // Formato YYYY-MM

    const getExportLabel = () => {
        if (activeTab === 'efficiency') {
            return subTab === 'hierarchy' ? 'Eficiencia' : 'Campañas';
        }
        switch (activeTab) {
            case 'scorecard': return 'Ventas';
            case 'backoffice': return 'Backoffice';
            default: return 'Reporte';
        }
    };

    const exportMode = (activeTab === 'efficiency' && subTab === 'campaign')
        ? 'campaign-perf'
        : activeTab;

    return (
        <div className="space-y-6 max-w-[1600px] mx-auto animate-fade-in">
            <header className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight uppercase">Gestión del Desempeño</h1>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">
                        Analítica Avanzada & Control de KPIs
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    {/* Global Date Range */}
                    <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-2 px-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
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
                    {can('performance', 'reports') && (
                        <button
                            onClick={() => setIsExportModalOpen(true)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 h-10 rounded-xl shadow-lg shadow-emerald-100 dark:shadow-none transition-all group flex items-center gap-2 active:scale-95"
                            title={`Exportar Reporte de ${getExportLabel()}`}
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            <span className="text-[10px] font-black uppercase tracking-widest">Reporte {getExportLabel()}</span>
                        </button>
                    )}
                </div>
            </header>

            <AnalyticsExportModal
                isOpen={isExportModalOpen}
                onClose={() => setIsExportModalOpen(false)}
                currentStartDate={startDate}
                currentEndDate={endDate}
                mode={exportMode as any}
            />

            <div className="flex border-b border-slate-200 dark:border-slate-800 gap-1 overflow-x-auto no-scrollbar">
                {allowedTabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as Tab)}
                        className={`px-8 py-3 text-[11px] font-bold uppercase tracking-widest transition-all relative
                            ${activeTab === tab.id
                                ? 'text-blue-600 animate-in fade-in duration-300'
                                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                    >
                        {tab.label}

                        {activeTab === tab.id && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 animate-in slide-in-from-left-full duration-300" />
                        )}
                    </button>
                ))}
            </div>

            {/* Content Toolbar - Moved from Header */}
            <div className="bg-slate-50/50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1">
                    {/* Search Bar */}
                    <div className="relative group flex-none">
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Buscar agente o registro..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-[320px] pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/20 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-700 text-slate-900 dark:text-white"
                        />
                    </div>

                    <div className="h-6 w-px bg-slate-200 dark:bg-slate-800" />

                    {/* Master Filters (Supervisor / Campaign) */}
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Supervisor:</span>
                            <select
                                value={supervisorId}
                                onChange={(e) => setSupervisorId(e.target.value)}
                                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-[10px] font-bold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-blue-500/20 uppercase cursor-pointer"
                            >
                                <option value="">Todos los Líderes</option>
                                {supervisors.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Campaña:</span>
                            <select
                                value={campaignId}
                                onChange={(e) => setCampaignId(e.target.value)}
                                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-[10px] font-bold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-blue-500/20 uppercase cursor-pointer"
                            >
                                <option value="">Todas las Campañas</option>
                                {campaigns.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Filtros Activos: {(supervisorId || campaignId || searchTerm) ? 'SÍ' : 'NO'}
                    </span>
                </div>
            </div>

            {/* Tab Content */}
            <div className="mt-6">
                {activeTab === 'scorecard' && (
                    <AgentScorecardTable
                        startDate={startDate}
                        endDate={endDate}
                        searchTerm={searchTerm}
                        supervisorId={supervisorId}
                        campaignId={campaignId}
                    />
                )}
                {activeTab === 'backoffice' && (
                    <BackofficeScorecard
                        startDate={startDate}
                        endDate={endDate}
                    />
                )}
                {activeTab === 'efficiency' && (
                    <OperationalEfficiency
                        startDate={startDate}
                        endDate={endDate}
                        searchTerm={searchTerm}
                        subTab={subTab}
                        setSubTab={setSubTab}
                        supervisorId={supervisorId}
                        campaignId={campaignId}
                    />
                )}
            </div>
        </div>
    );
}
