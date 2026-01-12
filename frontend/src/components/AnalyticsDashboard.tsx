'use client';

import { useState } from 'react';
import AgentScorecardTable from './analytics/AgentScorecardTable';
import AnalyticsExportModal from './analytics/AnalyticsExportModal';
import OperationalEfficiency from './analytics/OperationalEfficiency';
import BackofficeScorecard from './analytics/BackofficeScorecard';
import { useDashboardFilters } from '@/hooks/useDashboardFilters';

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

    const activeTab = (urlTab || 'scorecard') as Tab;
    const [subTab, setSubTab] = useState<'hierarchy' | 'campaign'>('hierarchy');
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);

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
            <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div className="flex-1">
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Gestión del Desempeño</h1>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-1 flex items-center gap-2">
                        <span className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
                        Analítica Avanzada & Control de KPIs
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    {/* Search Bar */}
                    <div className="relative group">
                        <input
                            type="text"
                            placeholder="Buscar agente, campaña o supervisor..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-white border border-slate-200 rounded-xl px-11 py-2.5 text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all w-[300px] shadow-sm outline-none placeholder:text-slate-300"
                        />
                        <svg className="w-4 h-4 text-slate-400 absolute left-4 top-3.5 group-focus-within:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>

                    {/* Range Picker */}
                    <div className="flex items-center gap-4 bg-white p-3 px-4 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-3 border-r border-slate-100 pr-4">
                            <div>
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Desde</p>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="text-[10px] font-bold text-slate-900 bg-transparent border-none p-0 focus:ring-0 cursor-pointer uppercase"
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div>
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Hasta</p>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="text-[10px] font-bold text-slate-900 bg-transparent border-none p-0 focus:ring-0 cursor-pointer uppercase"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Export Trigger */}
                    <button
                        onClick={() => setIsExportModalOpen(true)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white p-3 rounded-xl shadow-lg shadow-emerald-100 transition-all group flex items-center gap-2 active:scale-95"
                        title={`Exportar Reporte de ${getExportLabel()}`}
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        <span className="text-[10px] font-black uppercase tracking-widest pr-1 hidden sm:inline">Reporte {getExportLabel()}</span>
                    </button>
                </div>
            </header>

            <AnalyticsExportModal
                isOpen={isExportModalOpen}
                onClose={() => setIsExportModalOpen(false)}
                currentStartDate={startDate}
                currentEndDate={endDate}
                mode={exportMode as any}
            />

            <div className="flex border-b border-slate-200 gap-1 overflow-x-auto no-scrollbar">
                {(['scorecard', 'backoffice', 'efficiency'] as Tab[]).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-8 py-3 text-[11px] font-bold uppercase tracking-widest transition-all relative
                            ${activeTab === tab
                                ? 'text-blue-600'
                                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                    >
                        {tab === 'scorecard' ? 'Scorecard Agentes' :
                            tab === 'backoffice' ? 'Digitación & Backoffice' : 'Eficiencia Operativa'}

                        {activeTab === tab && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 animate-in slide-in-from-left-full duration-300" />
                        )}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="mt-6">
                {activeTab === 'scorecard' && (
                    <AgentScorecardTable
                        startDate={startDate}
                        endDate={endDate}
                        searchTerm={searchTerm}
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
                    />
                )}
            </div>
        </div>
    );
}
