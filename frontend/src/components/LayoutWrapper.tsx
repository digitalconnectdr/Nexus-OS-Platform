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
    const [isSystemLocked, setIsSystemLocked] = useState(false);

    const isSuperAdmin = user?.role?.toLowerCase() === 'super_admin' || user?.is_super_admin;

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

    // --- GLOBAL MAINTENANCE LOCK POLLING ---
    useEffect(() => {
        if (!session || isPublicRoute) return;

        const checkLockStatus = async () => {
            try {
                const response = await fetch('/api/v1/maintenance/lock-status');
                if (response.ok) {
                    const data = await response.json();
                    setIsSystemLocked(data.locked);
                }
            } catch (error) {
                console.error("Lock status polling failed:", error);
            }
        };

        checkLockStatus();
        const interval = setInterval(checkLockStatus, 60000); // Check every minute
        return () => clearInterval(interval);
    }, [session, isPublicRoute]);

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
                    {/* ... offline content ... */}
                </div>
            )}

            {/* GLOBAL MAINTENANCE LOCK OVERLAY */}
            {isSystemLocked && !isSuperAdmin && !isPublicRoute && (
                <div className="fixed inset-0 z-[99999] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center px-4 overflow-hidden">
                    <div className="max-w-md w-full text-center space-y-8 animate-in fade-in zoom-in duration-500">
                        <div className="relative inline-block">
                            <div className="absolute inset-0 bg-amber-500 rounded-full blur-3xl opacity-20 animate-pulse"></div>
                            <div className="relative p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl">
                                <svg className="w-16 h-16 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <h2 className="text-3xl font-black text-white uppercase tracking-tight">Sistema en Mantenimiento</h2>
                            <p className="text-slate-400 text-sm font-medium leading-relaxed">
                                Estamos realizando una consolidación técnica de datos. <br />
                                <span className="text-amber-500/80 font-bold uppercase tracking-widest text-[10px] mt-2 block">Cierre de operaciones temporal</span>
                            </p>
                        </div>

                        <div className="pt-4 border-t border-slate-800/50">
                            <button
                                onClick={() => window.location.href = '/login'}
                                className="px-6 py-2 rounded-full bg-slate-800 text-slate-400 text-[10px] font-bold uppercase tracking-widest hover:bg-slate-700 hover:text-white transition-all"
                            >
                                Salir del Sistema
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
