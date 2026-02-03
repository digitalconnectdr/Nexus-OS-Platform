'use client';

import { useAuth } from '@/context/AuthContext';

/**
 * Hook to check if the current user has a specific permission.
 * Usage: 
 * const { can } = usePermission();
 * if (can('sales', 'read')) { ... }
 */
export function usePermission() {
    const { hasPermission, isLoading } = useAuth();

    return {
        can: hasPermission,
        isLoading
    };
}
