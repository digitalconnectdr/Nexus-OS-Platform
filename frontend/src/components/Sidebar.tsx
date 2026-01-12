'use client';

import { useAuth } from '@/context/AuthContext';
import { usePathname, useRouter } from 'next/navigation';
import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowRightOnRectangleIcon, CpuChipIcon } from '@heroicons/react/24/solid';
// import { fetchFromAPI } from '@/lib/api'; // Ya no usamos esto en loadProfile para evitar bloqueos

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const { user, signOut } = useAuth();

    const displayName = useMemo(() => {
        if (!user) return "Verificando...";

        // 1. Prioridad: Nombre completo en metadata (Supabase standard)
        if (user.user_metadata?.full_name) return user.user_metadata.full_name;

        // 2. Prioridad: Nombre y Apellido en root (Backend custom)
        if (user.first_name && user.last_name) return `${user.first_name} ${user.last_name}`;

        // 3. Prioridad: Email (limpio)
        const email = user.email || user.user?.email;
        if (email) return email.split('@')[0];

        return "USUARIO"; // Fallback final
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

    const menuItems = [
        {
            name: 'Dashboard Real-Time',
            href: '/',
            icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            )
        },
        {
            name: 'Historial Ventas',
            href: '/sales',
            icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            )
        },
        {
            name: 'Gestión Desempeño',
            href: '/analytics',
            icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
            )
        },
        {
            name: 'Gestión Financiera',
            href: '/analytics/financial',
            icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            )
        },
        {
            name: 'Configuración',
            href: '/config',
            icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
            )
        }
    ];

    return (
        <aside className="fixed left-0 top-0 bottom-0 w-56 bg-white border-r border-gray-300 z-[100] flex flex-col">
            <div className="p-6 border-b border-gray-100/50 mb-2">
                <div className="flex items-center gap-4">
                    <div className="bg-blue-600 w-12 h-12 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20 shrink-0">
                        <CpuChipIcon className="w-7 h-7 text-white" />
                    </div>
                    <div className="flex flex-col justify-center">
                        <h1 className="text-xl font-extrabold text-gray-900 leading-none tracking-tight">NEXUS OS</h1>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em] mt-1">SISTEMA OPERATIVO</p>
                    </div>
                </div>
            </div>

            <nav className="flex-1 p-2 space-y-1 mt-2">
                <p className="px-3 text-[10px] font-bold text-gray-900 uppercase tracking-widest mb-2">OPERACIONES</p>
                {menuItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`
                                flex items-center gap-3 px-3 py-2 rounded-sm text-[11px] font-bold uppercase tracking-wider transition-all group
                                ${isActive
                                    ? 'bg-gray-800 text-white shadow-sm'
                                    : 'text-gray-900 hover:text-white hover:bg-gray-700'}
                            `}
                        >
                            <span className={`${isActive ? 'text-white' : 'text-gray-600 group-hover:text-white'} transition-colors`}>
                                {item.icon}
                            </span>
                            {item.name}
                        </Link>
                    );
                })}
            </nav>

            <nav className="p-2 space-y-1">
                <p className="px-3 text-[10px] font-bold text-gray-900 uppercase tracking-widest mb-2">ADMINISTRACIÓN</p>
                <Link
                    href="/admin/users"
                    className={`
                        flex items-center gap-3 px-3 py-2 rounded-sm text-[11px] font-bold uppercase tracking-wider transition-all group
                        ${pathname === '/admin/users'
                            ? 'bg-gray-800 text-white shadow-sm'
                            : 'text-gray-900 hover:text-white hover:bg-gray-700'}
                    `}
                >
                    <span className={`${pathname === '/admin/users' ? 'text-white' : 'text-gray-600 group-hover:text-white'} transition-colors`}>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                    </span>
                    Gestión Usuarios
                </Link>
                <Link
                    href="/admin/permissions"
                    className={`
                        flex items-center gap-3 px-3 py-2 rounded-sm text-[11px] font-bold uppercase tracking-wider transition-all group
                        ${pathname === '/admin/permissions'
                            ? 'bg-gray-800 text-white shadow-sm'
                            : 'text-gray-900 hover:text-white hover:bg-gray-700'}
                    `}
                >
                    <span className={`${pathname === '/admin/permissions' ? 'text-white' : 'text-gray-600 group-hover:text-white'} transition-colors`}>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                    </span>
                    Matriz Permisos
                </Link>
            </nav>

            <div className="p-2 border-t border-gray-300 bg-gray-50">
                <div className="flex items-center gap-2 px-2 py-2 bg-white rounded-sm border border-gray-300 shadow-sm border-l-2 border-l-blue-600">
                    <div className="w-8 h-8 bg-gray-100 border border-gray-200 rounded-full flex items-center justify-center text-gray-400">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-gray-900 truncate uppercase">
                            {user ? displayName : '...'}
                        </p>
                        <p className="text-[9px] font-bold text-gray-900 truncate uppercase opacity-60">
                            {user ? displayRole : '...'}
                        </p>
                    </div>
                    <button
                        onClick={handleLogout}
                        title="Cerrar Sesión"
                        className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-sm transition-all border border-transparent hover:border-red-100"
                    >
                        <ArrowRightOnRectangleIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </aside>
    );
}
