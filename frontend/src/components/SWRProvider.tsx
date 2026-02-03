'use client';

import { SWRConfig } from 'swr';
import { supabase } from '@/lib/supabase';

export const SWRProvider = ({ children }: { children: React.ReactNode }) => {
    return (
        <SWRConfig
            value={{
                revalidateOnFocus: false,
                revalidateOnReconnect: false,
                refreshInterval: 0,
                shouldRetryOnError: false,
                provider: () => new Map(), // CRÍTICO: Caché estable
                fetcher: async (url: string) => {
                    const { data: { session } } = await supabase.auth.getSession();
                    let tenantOverride = null;
                    if (typeof window !== 'undefined') {
                        tenantOverride = localStorage.getItem('x-tenant-override');
                    }

                    const res = await fetch(url, {
                        headers: {
                            ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
                            'Content-Type': 'application/json',
                            ...(tenantOverride ? { 'x-tenant-id': tenantOverride } : {})
                        }
                    });

                    if (!res.ok) {
                        const error = await res.json().catch(() => ({}));
                        throw new Error(error.detail || 'Error fetching data');
                    }
                    return res.json();
                }
            }}
        >
            {children}
        </SWRConfig>
    );
};
