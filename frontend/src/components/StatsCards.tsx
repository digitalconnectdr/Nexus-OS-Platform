'use client';

import { useState, useEffect } from 'react';
import { fetchFromAPI } from '@/lib/api';

interface Stats {
    total_revenue: number;
    total_sales: number;
    average_ticket: number;
}

export default function StatsCards() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const data = await fetchFromAPI('/api/v1/analytics/stats', { cache: 'no-store' });
                setStats(data);
            } catch (error) {
                console.error('Error fetching stats:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    if (loading) return <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
        {[1, 2, 3].map(i => <div key={i} className="h-32 bg-slate-800 rounded-xl border border-slate-700"></div>)}
    </div>;

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm transition-all hover:shadow-md">
                <p className="text-gray-500 text-sm font-semibold uppercase tracking-wider">Ingresos Totales</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                    ${stats?.total_revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm transition-all hover:shadow-md">
                <p className="text-gray-500 text-sm font-semibold uppercase tracking-wider">Ventas Realizadas</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats?.total_sales}</p>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm transition-all hover:shadow-md">
                <p className="text-gray-500 text-sm font-semibold uppercase tracking-wider">Ticket Promedio</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                    ${stats?.average_ticket.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
            </div>
        </div>
    );
}
