'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Sidebar from "@/components/Sidebar";
import TenantSwitcher from "@/components/TenantSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from '@/context/AuthContext';

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { user, session, isLoading, hasPermission } = useAuth();
    const [isOffline, setIsOffline] = useState(false);

    const isPublicRoute = pathname === '/login';

    // Route Protection logic (centralized)
    useEffect(() => {
        if (isLoading) return;

        if (!session && !isPublicRoute) {
            router.push('/login');
            return;
        }

        if (session) {
            if (isPublicRoute) {
                router.push('/');
                return;
            }

            // --- PERMISSION-BASED ROUTE PROTECTION ---
            if (pathname.startsWith('/admin/users') && !hasPermission('users_manager', 'users', 'read')) {
                console.warn("🚫 Access denied to /admin/users");
                router.push('/');
            }
            else if (pathname.startsWith('/admin/organizations') && !hasPermission('organizations', 'organizations', 'read')) {
                console.warn("🚫 Access denied to /admin/organizations");
                router.push('/');
            }
            else if (pathname.startsWith('/admin/permissions') && !hasPermission('permissions', 'permissions', 'view_tab')) {
                console.warn("🚫 Access denied to /admin/permissions");
                router.push('/');
            }
            else if (pathname.startsWith('/analytics/financial') && !hasPermission('finance', 'finance', 'read')) {
                console.warn("🚫 Access denied to /analytics/financial");
                router.push('/');
            }
            else if (pathname.startsWith('/config') && !hasPermission('config_campaigns', 'campaigns', 'view_tab') && !hasPermission('config_products', 'products', 'view_tab')) {
                console.warn("🚫 Access denied to /config");
                router.push('/');
            }
            else if (pathname.startsWith('/sales/history') && !hasPermission('history', 'sales', 'read')) {
                console.warn("🚫 Access denied to /sales/history");
                router.push('/');
            }
            else if (pathname.startsWith('/calculator') && !hasPermission('dashboard', 'calculator', 'access')) {
                console.warn("🚫 Access denied to /calculator");
                router.push('/');
            }
        }
    }, [pathname, session, isLoading, router, hasPermission]);

    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const showSidebar = !!session && !isPublicRoute;

    // Persist sidebar state
    useEffect(() => {
        const saved = localStorage.getItem('sidebar_collapsed_mode');
        if (saved) setIsSidebarCollapsed(JSON.parse(saved));
    }, []);

    const toggleSidebar = () => {
        const newVal = !isSidebarCollapsed;
        setIsSidebarCollapsed(newVal);
        localStorage.setItem('sidebar_collapsed_mode', JSON.stringify(newVal));
    };

    return (
        <>
            {showSidebar && <Sidebar isCollapsed={isSidebarCollapsed} onToggle={toggleSidebar} />}

            <div className={`${showSidebar ? (isSidebarCollapsed ? 'pl-20' : 'pl-60') : ''} min-h-screen flex flex-col transition-all duration-300`}>
                {showSidebar && (
                    <header className="h-16 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between px-8 sticky top-0 z-[90] shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-[0.2em]">NEXUS Core Console</span>
                                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            {hasPermission('organizations', 'organizations', 'switch_context') && <TenantSwitcher />}

                            <div className="h-6 w-[1px] bg-gray-200 mx-2"></div>

                            <div className="flex items-center gap-3">
                                <ThemeToggle />
                                <div className="h-6 w-[1px] bg-gray-200 dark:bg-slate-800 mx-1"></div>
                                <button className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/40 rounded-lg transition-all">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                    </svg>
                                </button>
                                <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 flex items-center justify-center text-[10px] font-bold text-gray-500 dark:text-slate-400">
                                    {user?.email?.[0].toUpperCase() || 'U'}
                                </div>
                            </div>
                        </div>
                    </header>
                )}

                <main className="flex-1 w-full bg-gray-50/50 dark:bg-slate-950/50">
                    <div className="p-0">
                        {(isPublicRoute || !!session) ? children : null}
                    </div>
                </main>
            </div>

            {isOffline && (
                <div className="fixed inset-0 z-[9999] bg-white/40 backdrop-blur-md flex items-center justify-center cursor-not-allowed animate-fade-in px-4">
                    <div className="bg-white p-8 rounded-2xl shadow-2xl border border-red-100 text-center max-w-sm w-full transform transition-all animate-scale-in">
                        <div className="mb-6 flex justify-center">
                            <div className="p-4 bg-red-50 rounded-full animate-pulse">
                                <svg className="w-12 h-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
                                </svg>
                            </div>
                        </div>
                        <h3 className="text-xl font-black text-gray-900 mb-2 uppercase tracking-tight">Conexión Interrumpida</h3>
                        <p className="text-[11px] font-bold text-gray-500 mb-6 uppercase leading-relaxed opacity-70 tracking-wide">
                            Hemos pausado la interfaz para proteger la integridad operacional. El sistema se reactivará automáticamente al detectar señal.
                        </p>

                        <button
                            onClick={() => window.location.href = '/login'}
                            className="text-[10px] font-black text-red-600 hover:text-red-700 uppercase tracking-[0.2em] cursor-pointer pointer-events-auto transition-colors border-b border-red-100 pb-1"
                        >
                            Salir del sistema
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
