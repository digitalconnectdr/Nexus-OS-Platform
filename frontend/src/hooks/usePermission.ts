'use client';

import { useAuth } from '@/context/AuthContext';
import { useCallback } from 'react';

/**
 * Hook to check if the current user has a specific permission.
 * Usage: 
 * const { can } = usePermission();
 * if (can('sales', 'read')) { ... }
 */
export function usePermission() {
    const { hasPermission, isLoading, user } = useAuth(); // Added user to check role

    const can = useCallback((module: string, resource: string, action: string) => {
        // 1. Super Admin Bypass (Already in hasPermission, but double-checked here if desired, 
        // implies we trust hasPermission for the raw check)

        // 2. Direct Check
        if (hasPermission(module, resource, action)) return true;

        // 3. Smart Fallback: if requesting 'read', try 'view_tab'
        if (action === 'read') {
            if (hasPermission(module, resource, 'view_tab')) return true;
        }

        // 4. Smart Fallback: if requesting 'view_tab', try 'read' (reciprocity)
        if (action === 'view_tab') {
            if (hasPermission(module, resource, 'read')) return true;
        }

        return false;
    }, [hasPermission]);

    return {
        can,
        isLoading
    };
}
