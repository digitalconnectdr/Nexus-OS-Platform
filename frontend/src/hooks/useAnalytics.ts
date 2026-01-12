import useSWR from 'swr';
import { useSearchParams } from 'next/navigation';
import { DashboardDataSchema, type DashboardData } from '@/types/analytics';
import { supabase } from '@/lib/supabase';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Fetcher que obtiene el token dinámicamente
const fetcherWithAuth = async (url: string) => {
    // 1. Obtener la sesión actual usando el singleton unificado
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        throw new Error("No hay sesión activa");
    }

    // 2. Inyectar el Token en el Header
    const res = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
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
        console.error("Data contract violation", parsedData.error);
        throw new Error("Error de integridad de datos");
    }

    return parsedData.data;
};

export function useAnalytics() {
    const searchParams = useSearchParams();
    const startDate = searchParams.get('start_date') || '2026-01-01';
    const endDate = searchParams.get('end_date') || '2026-01-31';

    const { data, error, isLoading } = useSWR<DashboardData>(
        `${API_URL}/api/v1/analytics/dashboard?start_date=${startDate}&end_date=${endDate}`,
        fetcherWithAuth // Usamos el nuevo fetcher seguro
    );

    return {
        metrics: data,
        isLoading,
        isError: error,
        filters: { startDate, endDate }
    };
}
