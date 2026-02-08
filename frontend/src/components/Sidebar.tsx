'use client';

import { useAuth } from '@/context/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import { usePathname } from 'next/navigation';
import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import {
    ArrowRightOnRectangleIcon,
    CpuChipIcon,
    BuildingOffice2Icon,
    ChevronDownIcon,
    ChevronRightIcon,
    ChartBarIcon,
    CurrencyDollarIcon,
    Cog6ToothIcon
} from '@heroicons/react/24/outline';
import { Trophy, ShieldCheck, Users, Activity, FileText } from 'lucide-react';

interface SidebarProps {
    isCollapsed: boolean;
    onToggle: () => void;
}

export default function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
    const pathname = usePathname();
    const { user, signOut, permissions } = useAuth();
    const { can } = usePermission();

    // Session Memory for Collapsible Sections (Vertical)
    const [sectionCollapsed, setSectionCollapsed] = useState<Record<string, boolean>>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('sidebar_section_state');
            return saved ? JSON.parse(saved) : {};
        }
        return {};
    });

    const toggleSection = (section: string) => {
        const newState = { ...sectionCollapsed, [section]: !sectionCollapsed[section] };
        setSectionCollapsed(newState);
        localStorage.setItem('sidebar_section_state', JSON.stringify(newState));
    };

    const displayName = useMemo(() => {
        if (!user) return "Verificando...";
        if (user.user_metadata?.full_name) return user.user_metadata.full_name;
        if (user.first_name && user.last_name) return `${user.first_name} ${user.last_name}`;
        const email = user.email || user.user?.email;
        if (email) return email.split('@')[0];
        return "USUARIO";
    }, [user]);

    const displayRole = useMemo(() => {
        if (!user) return "...";
        return user.role || user.app_metadata?.role || user.user_metadata?.role || "AGENTE";
    }, [user]);

    const handleLogout = async () => {
        try {
            await signOut();
            window.location.href = '/login';
        } catch (error) {
            console.error("Error al salir:", error);
            window.location.href = '/login';
        }
    };

    // --- STRUCTURE DEFINITION ---
    const structure = useMemo(() => [
        {
            title: 'OPERACIONES',
            key: 'ops',
            items: [
                {
                    name: 'Dashboard Real-Time',
                    href: '/',
                    icon: <Activity className="w-5 h-5" />,
                    show: can('dashboard', 'sales', 'read')
                },
                {
                    name: 'Historial Ventas',
                    href: '/sales',
                    icon: <ChartBarIcon className="w-5 h-5" />,
                    show: can('history', 'sales', 'read')
                },
                {
                    name: 'Calculadora',
                    href: '/calculator',
                    icon: <CurrencyDollarIcon className="w-5 h-5" />,
                    show: can('dashboard', 'calculator', 'access')
                }
            ]
        },
        {
            title: 'COMPETICIÓN',
            key: 'comp',
            items: [
                {
                    name: 'Torneos',
                    href: '/admin/tournaments',
                    icon: <Trophy className="w-5 h-5" />,
                    show: can('tournaments', 'tournaments', 'read')
                },
                {
                    name: 'Carrera en Vivo',
                    href: '/admin/tournaments/track',
                    icon: <Activity className="w-5 h-5" />,
                    show: can('tournaments', 'track', 'view')
                }
            ]
        },
        {
            title: 'RESULTADOS',
            key: 'results',
            items: [
                {
                    name: 'Gestión Desempeño',
                    href: '/analytics',
                    icon: <ChartBarIcon className="w-5 h-5" />,
                    show: can('perf', 'stats', 'read')
                },
                {
                    name: 'Finanzas',
                    href: '/analytics/financial',
                    icon: <CurrencyDollarIcon className="w-5 h-5" />,
                    show: can('finance', 'results', 'view')
                }
            ]
        },
        {
            title: 'ADMINISTRACIÓN',
            key: 'admin',
            items: [
                {
                    name: 'Gestión Usuarios',
                    href: '/admin/users',
                    icon: <Users className="w-5 h-5" />,
                    show: can('users', 'action', 'read')
                },
                {
                    name: 'Catálogos/Config',
                    href: '/config',
                    icon: <Cog6ToothIcon className="w-5 h-5" />,
                    show: can('config', 'hub', 'access')
                }
            ]
        },
        {
            title: 'SISTEMA',
            key: 'system',
            items: [
                {
                    name: 'Matriz Permisos',
                    href: '/admin/permissions',
                    icon: <ShieldCheck className="w-5 h-5" />,
                    show: can('system', 'matrix', 'read')
                },
                {
                    name: 'Organizaciones',
                    href: '/admin/organizations',
                    icon: <BuildingOffice2Icon className="w-5 h-5" />,
                    show: can('system', 'orgs', 'read')
                },
                {
                    name: 'Logs Auditoría',
                    href: '/admin/audit',
                    icon: <FileText className="w-5 h-5" />,
                    show: can('system', 'audit', 'read')
                }
            ]
        }
    ], [can]);

    return (
        <aside className={`fixed left-0 top-0 bottom-0 ${isCollapsed ? 'w-20' : 'w-60'} bg-white dark:bg-slate-900 border-r border-gray-300 dark:border-slate-800 z-[100] flex flex-col transition-all duration-300`}>
            {/* HEADER */}
            <div className={`flex items-center ${isCollapsed ? 'justify-center p-4' : 'px-6 py-6'} border-b border-gray-100/50 dark:border-slate-800/50 mb-2 transition-all`}>
                <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-4'} relative`}>
                    <div className="bg-blue-600 w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20 shrink-0">
                        <CpuChipIcon className="w-6 h-6 text-white" />
                    </div>
                    {!isCollapsed && (
                        <div className="flex flex-col justify-center animate-in fade-in duration-300">
                            <h1 className="text-xl font-extrabold text-gray-900 dark:text-white leading-none tracking-tight">NEXUS OS</h1>
                            <p className="text-[9px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-[0.15em] mt-1 relative">
                                SISTEMA ATÓMICO
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* TOGGLE BUTTON */}
            <button
                onClick={onToggle}
                className="absolute -right-3 top-20 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-full p-1 shadow-md hover:bg-gray-50 focus:outline-none z-50 text-gray-500"
            >
                {isCollapsed ? <ChevronRightIcon className="w-3 h-3" /> : <ChevronRightIcon className="w-3 h-3 rotate-180" />}
            </button>


            {/* SCROLLABLE NAV */}
            <div className={`flex-1 flex flex-col min-h-0 overflow-y-auto ${isCollapsed ? 'px-2' : 'px-3'} py-2 space-y-4`}>
                {structure.map((section) => {
                    const visibleItems = section.items.filter(i => i.show);
                    if (visibleItems.length === 0) return null;

                    const isSectionCollapsed = sectionCollapsed[section.key];

                    return (
                        <div key={section.key} className="space-y-1">
                            {/* SECTION HEADER */}
                            {!isCollapsed && (
                                <button
                                    onClick={() => toggleSection(section.key)}
                                    className="w-full flex items-center justify-between px-2 py-1 group focus:outline-none"
                                >
                                    <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest group-hover:text-blue-600 transition-colors">
                                        {section.title}
                                    </p>
                                    {isSectionCollapsed ? (
                                        <ChevronRightIcon className="w-3 h-3 text-gray-400" />
                                    ) : (
                                        <ChevronDownIcon className="w-3 h-3 text-gray-400" />
                                    )}
                                </button>
                            )}

                            {/* ITEMS */}
                            {(!isSectionCollapsed || isCollapsed) && (
                                <div className="space-y-0.5 animate-in slide-in-from-top-1 duration-200">
                                    {visibleItems.map((item) => {
                                        const isActive = pathname === item.href;
                                        return (
                                            <Link
                                                key={item.href}
                                                href={item.href}
                                                className={`
                                                    flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2 rounded-lg text-[12px] font-semibold transition-all group
                                                    ${isActive
                                                        ? 'bg-blue-50 text-blue-700 dark:bg-slate-800 dark:text-white shadow-sm border border-blue-100 dark:border-slate-700'
                                                        : 'text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white border border-transparent'}
                                                `}
                                                title={isCollapsed ? item.name : ''}
                                            >
                                                <span className={`${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-slate-500 group-hover:text-gray-600 dark:group-hover:text-slate-300'} transition-colors`}>
                                                    {item.icon}
                                                </span>
                                                {!isCollapsed && <span>{item.name}</span>}
                                            </Link>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* USER FOOTER */}
            <div className={`p-3 border-t border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50`}>
                <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2.5 bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all cursor-default`}>
                    <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-inner shrink-0">
                        {displayName.charAt(0)}
                    </div>
                    {!isCollapsed && (
                        <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-bold text-gray-900 dark:text-white truncate uppercase">
                                {displayName}
                            </p>
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-gray-100 text-gray-600 uppercase border border-gray-200">
                                {displayRole}
                            </span>
                        </div>
                    )}
                    {!isCollapsed && (
                        <button
                            onClick={handleLogout}
                            title="Cerrar Sesión"
                            className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-md transition-all"
                        >
                            <ArrowRightOnRectangleIcon className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>
        </aside>
    );
}
