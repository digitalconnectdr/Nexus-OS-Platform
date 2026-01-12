'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Sidebar from "@/components/Sidebar";
import { useAuth } from '@/context/AuthContext';

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { user, session, isLoading } = useAuth();
    const [isOffline, setIsOffline] = useState(false);

    const isPublicRoute = pathname === '/login';

    useEffect(() => {
        // --- GLOBAL OFFLINE LISTENER ---
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Check initial state
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            setIsOffline(true);
        }

        // Navigation control based on auth state
        if (!isLoading) {
            if (!session && !isPublicRoute) {
                router.push('/login');
            } else if (session && isPublicRoute) {
                router.push('/dashboard');
            }
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [pathname, isPublicRoute, router, session, isLoading]);

    // --- RENDER LOCKDOWN (SPLASH SCREEN) ---
    if (isLoading && !isPublicRoute) {
        return (
            <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white">
                {/* Logo / Icon Container */}
                <div className="relative mb-8">
                    <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-500/40 animate-pulse">
                        <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 00-2 2z" />
                        </svg>
                    </div>
                    {/* Spinning Ring */}
                    <div className="absolute -inset-4 border-2 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                </div>

                <div className="text-center space-y-2">
                    <h2 className="text-2xl font-black text-gray-900 tracking-tighter uppercase">NEXUS OS</h2>
                    <div className="flex flex-col items-center gap-1">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] opacity-80">Sincronizando Perfil Operativo</p>
                        <div className="flex gap-1">
                            <div className="w-1 h-1 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                            <div className="w-1 h-1 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                            <div className="w-1 h-1 bg-blue-600 rounded-full animate-bounce"></div>
                        </div>
                    </div>
                </div>

                <div className="absolute bottom-12 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                    Enterprise Cloud Stack • v2.0.4
                </div>
            </div>
        );
    }

    const showSidebar = !!session && !isPublicRoute;

    return (
        <>
            {showSidebar && <Sidebar />}
            <main className={`${showSidebar ? 'pl-56' : ''} min-h-screen`}>
                <div className="w-full">
                    {(isPublicRoute || !!session) ? children : null}
                </div>
            </main>

            {/* INTERACTION LOCKDOWN (UI FREEZE) */}
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
