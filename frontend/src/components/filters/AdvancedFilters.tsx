"use client";

import React, { useState, useEffect } from 'react';
import { XMarkIcon, CalendarIcon, FunnelIcon } from '@heroicons/react/24/outline';

export interface FilterCriteria {
    dateFrom?: string;
    dateTo?: string;
    status?: string;
    campaigns?: string[];  // Multi-select
    agents?: string[];     // Multi-select
    products?: string[];   // Multi-select
    supervisors?: string[]; // Multi-select
    amountFrom?: number;
    amountTo?: number;
}

interface StatusOption {
    id: string;
    name: string;
}

interface CampaignOption {
    id: string;
    name: string;
}

interface SupervisorOption {
    id: string;
    name: string;
}

interface AdvancedFiltersProps {
    statuses: StatusOption[];
    campaigns: CampaignOption[];
    agents: string[];  // Lista de agentes únicos
    products: string[]; // Lista de productos únicos
    supervisors: SupervisorOption[]; // Lista de supervisores desde User Admin
    onFilterChange: (filters: FilterCriteria) => void;
    initialFilters?: FilterCriteria;
}

const datePresets = [
    { label: 'Hoy', days: 0 },
    { label: 'Última semana', days: 7 },
    { label: 'Último mes', days: 30 },
    { label: 'Último trimestre', days: 90 }
];

export const AdvancedFilters: React.FC<AdvancedFiltersProps> = ({
    statuses,
    campaigns,
    agents,
    products,
    supervisors,
    onFilterChange,
    initialFilters = {}
}) => {
    const [filters, setFilters] = useState<FilterCriteria>(initialFilters);

    const applyDatePreset = (days: number) => {
        const today = new Date();
        const pastDate = new Date(today.getTime() - days * 24 * 60 * 60 * 1000);

        setFilters(prev => ({
            ...prev,
            dateFrom: days === 0 ? today.toISOString().split('T')[0] : pastDate.toISOString().split('T')[0],
            dateTo: today.toISOString().split('T')[0]
        }));
    };

    const handleApply = () => {
        onFilterChange(filters);
    };

    const handleClear = () => {
        setFilters({});
        onFilterChange({});
    };

    const toggleMultiSelect = (field: 'campaigns' | 'agents' | 'products' | 'supervisors', value: string) => {
        setFilters(prev => {
            const current = prev[field] || [];
            const updated = current.includes(value)
                ? current.filter(v => v !== value)
                : [...current, value];

            return {
                ...prev,
                [field]: updated.length > 0 ? updated : undefined
            };
        });
    };

    return (
        <div className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-lg space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 pb-4">
                <div className="flex items-center gap-2">
                    <FunnelIcon className="w-5 h-5 text-[#072D44]" />
                    <h3 className="text-sm font-black text-[#072D44] uppercase tracking-wider">Filtros Avanzados</h3>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleClear}
                        className="px-3 py-1.5 text-xs font-black text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all active:scale-95 uppercase tracking-wider"
                    >
                        Limpiar
                    </button>
                    <button
                        onClick={handleApply}
                        className="px-4 py-1.5 text-xs font-black text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-all active:scale-95 uppercase tracking-wider shadow-md"
                    >
                        Aplicar Filtros
                    </button>
                </div>
            </div>

            {/* Rango de Fechas */}
            <div className="space-y-3">
                <label className="text-xs font-black text-gray-700 uppercase tracking-wider flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4" />
                    Rango de Fechas
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Desde</label>
                        <input
                            type="date"
                            value={filters.dateFrom || ''}
                            onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Hasta</label>
                        <input
                            type="date"
                            value={filters.dateTo || ''}
                            onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Presets</label>
                        <div className="flex gap-1">
                            {datePresets.map(preset => (
                                <button
                                    key={preset.label}
                                    onClick={() => applyDatePreset(preset.days)}
                                    className="flex-1 px-2 py-2 text-[9px] font-black text-gray-600 bg-gray-100 rounded-lg hover:bg-blue-100 hover:text-blue-700 transition-all active:scale-95 uppercase"
                                    title={preset.label}
                                >
                                    {preset.label.split(' ')[preset.label.split(' ').length - 1]}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Estado y Monto */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Estado */}
                <div>
                    <label className="text-xs font-black text-gray-700 uppercase tracking-wider mb-2 block">Estado</label>
                    <select
                        value={filters.status || 'all'}
                        onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value === 'all' ? undefined : e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                        <option value="all">Todos los estados</option>
                        {statuses.map(status => (
                            <option key={status.id} value={status.id}>{status.name}</option>
                        ))}
                    </select>
                </div>

                {/* Rango de Monto */}
                <div>
                    <label className="text-xs font-black text-gray-700 uppercase tracking-wider mb-2 block">Monto (DOP)</label>
                    <div className="grid grid-cols-2 gap-2">
                        <input
                            type="number"
                            placeholder="Desde"
                            value={filters.amountFrom || ''}
                            onChange={(e) => setFilters(prev => ({ ...prev, amountFrom: e.target.value ? Number(e.target.value) : undefined }))}
                            className="px-3 py-2 border border-gray-200 rounded-lg text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <input
                            type="number"
                            placeholder="Hasta"
                            value={filters.amountTo || ''}
                            onChange={(e) => setFilters(prev => ({ ...prev, amountTo: e.target.value ? Number(e.target.value) : undefined }))}
                            className="px-3 py-2 border border-gray-200 rounded-lg text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                </div>
            </div>

            {/* Multi-Select: Campañas */}
            <div>
                <label className="text-xs font-black text-gray-700 uppercase tracking-wider mb-2 block">
                    Campañas {filters.campaigns && filters.campaigns.length > 0 && (
                        <span className="ml-2 bg-blue-600 text-white text-[9px] px-2 py-0.5 rounded-full">
                            {filters.campaigns.length}
                        </span>
                    )}
                </label>
                <div className="border border-gray-200 rounded-lg p-3 max-h-40 overflow-y-auto space-y-1">
                    {campaigns.map(campaign => (
                        <label
                            key={campaign.id}
                            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                            <input
                                type="checkbox"
                                checked={filters.campaigns?.includes(campaign.id) || false}
                                onChange={() => toggleMultiSelect('campaigns', campaign.id)}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="text-xs font-bold text-gray-700">{campaign.name}</span>
                        </label>
                    ))}
                </div>
            </div>

            {/* Multi-Select: Agentes */}
            <div>
                <label className="text-xs font-black text-gray-700 uppercase tracking-wider mb-2 block">
                    Agentes {filters.agents && filters.agents.length > 0 && (
                        <span className="ml-2 bg-blue-600 text-white text-[9px] px-2 py-0.5 rounded-full">
                            {filters.agents.length}
                        </span>
                    )}
                </label>
                <div className="border border-gray-200 rounded-lg p-3 max-h-40 overflow-y-auto space-y-1">
                    {agents.map(agent => (
                        <label
                            key={agent}
                            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                            <input
                                type="checkbox"
                                checked={filters.agents?.includes(agent) || false}
                                onChange={() => toggleMultiSelect('agents', agent)}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="text-xs font-bold text-gray-700">{agent}</span>
                        </label>
                    ))}
                </div>
            </div>

            {/* Multi-Select: Productos */}
            <div>
                <label className="text-xs font-black text-gray-700 uppercase tracking-wider mb-2 block">
                    Productos {filters.products && filters.products.length > 0 && (
                        <span className="ml-2 bg-blue-600 text-white text-[9px] px-2 py-0.5 rounded-full">
                            {filters.products.length}
                        </span>
                    )}
                </label>
                <div className="border border-gray-200 rounded-lg p-3 max-h-40 overflow-y-auto space-y-1">
                    {products.map(product => (
                        <label
                            key={product}
                            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                            <input
                                type="checkbox"
                                checked={filters.products?.includes(product) || false}
                                onChange={() => toggleMultiSelect('products', product)}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="text-xs font-bold text-gray-700">{product}</span>
                        </label>
                    ))}
                </div>
            </div>

            {/* Multi-Select: Supervisores */}
            <div>
                <label className="text-xs font-black text-gray-700 uppercase tracking-wider mb-2 block">
                    Supervisores {filters.supervisors && filters.supervisors.length > 0 && (
                        <span className="ml-2 bg-blue-600 text-white text-[9px] px-2 py-0.5 rounded-full">
                            {filters.supervisors.length}
                        </span>
                    )}
                </label>
                <div className="border border-gray-200 rounded-lg p-3 max-h-40 overflow-y-auto space-y-1">
                    {supervisors.length > 0 ? (
                        supervisors.map(supervisor => (
                            <label
                                key={supervisor.id}
                                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                            >
                                <input
                                    type="checkbox"
                                    checked={filters.supervisors?.includes(supervisor.id) || false}
                                    onChange={() => toggleMultiSelect('supervisors', supervisor.id)}
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                                />
                                <span className="text-xs font-bold text-gray-700">
                                    {supervisor.name}
                                </span>
                            </label>
                        ))
                    ) : (
                        <p className="text-xs text-gray-400 italic text-center py-2">
                            No hay supervisores disponibles
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdvancedFilters;
