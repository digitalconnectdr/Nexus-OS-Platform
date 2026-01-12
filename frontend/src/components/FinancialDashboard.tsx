'use client';

import { useState } from 'react';
import FinancialResults from './analytics/FinancialResults';
import AnalyticsExportModal from './analytics/AnalyticsExportModal';
import { useDashboardFilters } from '@/hooks/useDashboardFilters';

type Tab = 'financial' | 'managerial';

export default function FinancialDashboard() {
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

    return (
        <div className="space-y-6 max-w-[1600px] mx-auto animate-fade-in">
            <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div className="flex-1">
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Gestión Financiera</h1>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-1 flex items-center gap-2">
                        <span className="w-2 h-2 bg-emerald-600 rounded-full animate-pulse" />
                        Revenue, Utilidad & Visión Gerencial
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
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
                        title="Exportar Reporte Financiero"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        <span className="text-[10px] font-black uppercase tracking-widest pr-1 hidden sm:inline">Reporte Financiero</span>
                    </button>
                </div>
            </header>

            <AnalyticsExportModal
                isOpen={isExportModalOpen}
                onClose={() => setIsExportModalOpen(false)}
                currentStartDate={startDate}
                currentEndDate={endDate}
                mode="financial"
            />

            {/* Tab Navigation */}
            <div className="flex border-b border-slate-200 gap-1 overflow-x-auto no-scrollbar">
                {(['financial', 'managerial'] as Tab[]).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-8 py-3 text-[11px] font-bold uppercase tracking-widest transition-all relative
                            ${activeTab === tab
                                ? 'text-emerald-600'
                                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                    >
                        {tab === 'financial' ? 'Resultados Financieros' : 'Visión Gerencial'}

                        {activeTab === tab && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 animate-in slide-in-from-left-full duration-300" />
                        )}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="mt-6">
                {activeTab === 'financial' && (
                    <FinancialResults
                        startDate={startDate}
                        endDate={endDate}
                    />
                )}
                {activeTab === 'managerial' && (
                    <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl shadow-sm">
                        <div className="bg-slate-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
                            <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                        </div>
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Visión Gerencial</h3>
                        <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-widest">Módulo en Desarrollo</p>
                    </div>
                )}
            </div>
        </div>
    );
}
