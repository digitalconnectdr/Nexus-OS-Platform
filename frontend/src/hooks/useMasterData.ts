'use client';

import { useState, useEffect } from 'react';
import { fetchFromAPI } from '@/lib/api';

export function useMasterData() {
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [statuses, setStatuses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadAll() {
            try {
                const [c, p, u, s] = await Promise.all([
                    fetchFromAPI('/api/v1/campaigns/', { cache: 'no-store' }),
                    fetchFromAPI('/api/v1/products/', { cache: 'no-store' }),
                    fetchFromAPI('/api/v1/users/', { cache: 'no-store' }),
                    fetchFromAPI('/api/v1/statuses/', { cache: 'no-store' }),
                ]);
                setCampaigns(c);
                setProducts(p);
                setUsers(u);
                setStatuses(s);
            } catch (err) {
                console.error("Failed to load master data", err);
            } finally {
                setLoading(false);
            }
        }
        loadAll();
    }, []);

    return { campaigns, products, users, statuses, loading };
}
