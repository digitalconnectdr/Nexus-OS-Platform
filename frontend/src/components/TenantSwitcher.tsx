'use client';

import { useState, useEffect } from 'react';
import { fetchFromAPI } from '@/lib/api';
import { BuildingOfficeIcon, ChevronDownIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

interface Organization {
    id: string;
    name: string;
}

export default function TenantSwitcher() {
    const [orgs, setOrgs] = useState<Organization[]>([]);
    const [currentOverride, setCurrentOverride] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem('x-tenant-override');
        setCurrentOverride(stored);
        fetchOrgs();
    }, []);

    const fetchOrgs = async () => {
        try {
            const data = await fetchFromAPI('/api/v1/organizations/');
            setOrgs(data);
        } catch (error) {
            console.error("Error fetching organizations for switcher:", error);
        }
    };

    const handleSwitch = (tenantId: string | null) => {
        if (!tenantId) {
            localStorage.removeItem('x-tenant-override');
        } else {
            localStorage.setItem('x-tenant-override', tenantId);
        }
        setIsOpen(false);
        // Force complete redirect to ensure clean axios headers and state
        window.location.href = '/dashboard';
    };

    const currentOrgName = orgs.find(o => o.id === currentOverride)?.name || 'Organización Real';

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-[11px] font-bold uppercase tracking-tight
                    ${currentOverride
                        ? 'bg-amber-50 border-amber-200 text-amber-700 shadow-sm'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'}
                `}
            >
                <div className={`p-1 rounded-md ${currentOverride ? 'bg-amber-100' : 'bg-gray-100'}`}>
                    <BuildingOfficeIcon className="w-3.5 h-3.5" />
                </div>
                <div className="flex flex-col items-start leading-none gap-0.5">
                    <span className="opacity-50 text-[8px]">Contexto:</span>
                    <span>{currentOrgName}</span>
                </div>
                <ChevronDownIcon className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    ></div>
                    <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in">
                        <div className="p-3 bg-gray-50 border-b border-gray-100 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                            Seleccionar Organización (Contexto Admin)
                        </div>
                        <div className="max-h-60 overflow-y-auto">
                            {/* Option: Default (Real) */}
                            <button
                                onClick={() => handleSwitch(null)}
                                className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors flex items-center justify-between group"
                            >
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold text-gray-700">Mi Organización Real</span>
                                    <span className="text-[10px] text-gray-400">Restablecer contexto original</span>
                                </div>
                                {!currentOverride && <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>}
                            </button>

                            {orgs.map((org) => (
                                <button
                                    key={org.id}
                                    onClick={() => handleSwitch(org.id)}
                                    className="w-full text-left px-4 py-3 hover:bg-amber-50 transition-colors border-t border-gray-50 flex items-center justify-between group"
                                >
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-gray-800">{org.name}</span>
                                        <span className="text-[9px] font-mono text-gray-400">{org.id.split('-')[0]}...</span>
                                    </div>
                                    {currentOverride === org.id && <div className="w-1.5 h-1.5 bg-amber-500 rounded-full"></div>}
                                </button>
                            ))}
                        </div>
                        {currentOverride && (
                            <div className="p-4 bg-amber-100 border-t border-amber-200">
                                <div className="flex items-center gap-2 text-amber-800 mb-1">
                                    <span className="text-sm">👁️</span>
                                    <span className="text-[11px] font-black uppercase tracking-tight">Modo Auditoría</span>
                                </div>
                                <p className="text-[11px] font-bold text-amber-700 leading-tight">
                                    Estás visualizando los datos de: <br />
                                    <span className="text-amber-900 border-b border-amber-300">{currentOrgName}</span>
                                </p>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
