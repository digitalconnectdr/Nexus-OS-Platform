'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useMemo } from 'react';

export function useDashboardFilters() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // Default dates: Start of current month to today
    const defaultFrom = useMemo(() => {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
    }, []);

    const defaultTo = useMemo(() => {
        return new Date().toISOString().slice(0, 10);
    }, []);

    const filters = useMemo(() => ({
        from: searchParams.get('from') || defaultFrom,
        to: searchParams.get('to') || defaultTo,
        q: searchParams.get('q') || '',
        tab: searchParams.get('tab') || ''
    }), [searchParams, defaultFrom, defaultTo]);

    const updateFilters = useCallback((newFilters: { from?: string; to?: string; q?: string; tab?: string }) => {
        const params = new URLSearchParams(searchParams.toString());

        if (newFilters.from) params.set('from', newFilters.from);
        if (newFilters.to) params.set('to', newFilters.to);
        if (newFilters.q !== undefined) {
            if (newFilters.q) params.set('q', newFilters.q);
            else params.delete('q');
        }
        if (newFilters.tab) params.set('tab', newFilters.tab);

        router.push(`${pathname}?${params.toString()}`, { scroll: false });
    }, [pathname, router, searchParams]);

    return {
        startDate: filters.from,
        endDate: filters.to,
        searchTerm: filters.q,
        activeTab: filters.tab,
        setStartDate: (val: string) => updateFilters({ from: val }),
        setEndDate: (val: string) => updateFilters({ to: val }),
        setSearchTerm: (val: string) => updateFilters({ q: val }),
        setActiveTab: (val: string) => updateFilters({ tab: val })
    };
}
