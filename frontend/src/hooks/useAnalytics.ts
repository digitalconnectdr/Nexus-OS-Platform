import useSWR from 'swr';
import { useSearchParams } from 'next/navigation';
import { DashboardDataSchema, type DashboardData } from '@/types/analytics';
import { supabase } from '@/lib/supabase';
import { usePermission } from '@/hooks/usePermission';

const API_URL = process.env.NEXT_PUBLIC_API_URL;
if (!API_URL) console.warn("⚠️ NEXT_PUBLIC_API_URL no configurada.");

// Fetcher que obtiene el token dinámicamente
const fetcherWithAuth = async (url: string) => {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        throw new Error("No hay sesión activa");
    }

    let tenantOverride = null;
    if (typeof window !== 'undefined') {
        tenantOverride = localStorage.getItem('x-tenant-override');
    }

    const res = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            ...(tenantOverride ? { 'x-tenant-id': tenantOverride } : {})
        }
    });

    if (!res.ok) {
        if (res.status === 401) throw new Error("Sesión expirada. Por favor recarga.");
        const error = await res.json();
        throw new Error(error.detail || 'Error fetching data');
    }

    const data = await res.json();
    const parsedData = DashboardDataSchema.safeParse(data);

    if (!parsedData.success) {
        console.warn("⚠️ Data contract violation (Analytics Dashboard):", parsedData.error);
        // Returning raw data as fallback to avoid hard crash/loading-hang
        return data as DashboardData;
    }

    return parsedData.data;
};

export function useAnalytics() {
    const searchParams = useSearchParams();
    const { can, isLoading: permsLoading } = usePermission();

    const startDate = searchParams.get('start_date') || '2026-01-01';
    const endDate = searchParams.get('end_date') || '2026-01-31';

    // --- CONDITIONAL FETCHING ---
    // Access criteria aligned with dashboard:access matrix
    const shouldFetch = !permsLoading && (
        can('dashboard', 'dashboard', 'access') ||
        can('operational', 'operational', 'read') ||
        can('analytics', 'analytics', 'read')
    );

    const { data, error, isLoading } = useSWR<DashboardData>(
        shouldFetch ? `${API_URL}/api/v1/analytics/dashboard?start_date=${startDate}&end_date=${endDate}` : null,
        fetcherWithAuth,
        {
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
            keepPreviousData: true
        }
    );

    return {
        metrics: data,
        isLoading: shouldFetch ? isLoading : false,
        isError: error,
        filters: { startDate, endDate }
    };
}
