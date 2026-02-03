'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface AuthContextType {
    user: any;
    session: any;
    permissions: Record<string, boolean>;
    isLoading: boolean;
    signOut: () => Promise<void>;
    hasPermission: (arg1: string, arg2: string, arg3?: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [authState, setAuthState] = useState<{
        user: any;
        session: any;
        permissions: Record<string, boolean>;
        isLoading: boolean;
    }>({
        user: null,
        session: null,
        permissions: {},
        isLoading: true
    });

    const loadBootstrap = async (currentSession: any) => {
        if (!currentSession) {
            setAuthState({
                user: null,
                session: null,
                permissions: {},
                isLoading: false
            });
            return;
        }

        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL;
            if (!API_URL) {
                console.warn('⚠️ [AUTH] NEXT_PUBLIC_API_URL no definida. Abortando bootstrap.');
                setAuthState(prev => ({ ...prev, isLoading: false }));
                return;
            }

            console.log(`🚀 [AUTH] Sincronizando Perfil en: ${API_URL}/api/v1/auth/bootstrap`);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

            const response = await fetch(`${API_URL}/api/v1/auth/bootstrap`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${currentSession.access_token}`
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                const userData = {
                    ...data.user,
                    user_metadata: currentSession.user?.user_metadata,
                    app_metadata: currentSession.user?.app_metadata,
                    tenant: data.tenant
                };

                console.log('✅ [AUTH] Sincronización completa.', { email: userData.email, role: userData.role });
                setAuthState({
                    session: currentSession,
                    user: userData,
                    permissions: data.permissions || {},
                    isLoading: false
                });
            } else {
                console.error("❌ Failed to bootstrap:", response.status);
                // Fallback to basic session info to avoid hard lock
                setAuthState({
                    session: currentSession,
                    user: {
                        email: currentSession.user?.email,
                        ...currentSession.user?.user_metadata
                    },
                    permissions: {},
                    isLoading: false
                });
            }
        } catch (error: any) {
            if (error.name === 'AbortError') return; // Silent abort for React re-renders/timeouts

            console.error("❌ Auth Bootstrap Error:", error);
            // Guaranteed finish: ensure isLoading is false
            setAuthState(prev => ({
                ...prev,
                isLoading: false,
                user: prev.user || { email: currentSession.user?.email, ...currentSession.user?.user_metadata }
            }));
        }
    };

    const hasPermission = React.useCallback((arg1: string, arg2: string, arg3?: string): boolean => {
        if (!authState.user) return false;
        if (authState.user.role === 'Super Admin') return true;

        // Tri-factor lookup: module:resource:action
        if (arg3) {
            return !!authState.permissions[`${arg1}:${arg2}:${arg3}`];
        }

        // Legacy fallback: resource:action
        return !!authState.permissions[`${arg1}:${arg2}`];
    }, [authState.user, authState.permissions]);

    const bootstrapInProgress = React.useRef(false);
    const lastToken = React.useRef<string | null>(null);

    useEffect(() => {
        // --- SINGLE SOURCE OF TRUTH FOR AUTH ---
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
            const newToken = currentSession?.access_token || null;

            // THE GOLDEN RULE: If tokens are equal, DO NOTHING.
            if (lastToken.current === newToken && event !== 'SIGNED_OUT') {
                return;
            }

            lastToken.current = newToken;
            console.log(`🔌 [AUTH EVENT] ${event}`);

            if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
                // Update session state immediately
                setAuthState(prev => ({
                    ...prev,
                    session: currentSession,
                    isLoading: !prev.user && !!currentSession
                }));

                if (currentSession && !bootstrapInProgress.current) {
                    bootstrapInProgress.current = true;
                    try {
                        await loadBootstrap(currentSession);
                    } finally {
                        bootstrapInProgress.current = false;
                    }
                }
            } else if (event === 'SIGNED_OUT') {
                setAuthState({
                    user: null,
                    session: null,
                    permissions: {},
                    isLoading: false
                });
                bootstrapInProgress.current = false;
                lastToken.current = null;
            } else if (event === 'TOKEN_REFRESHED') {
                setAuthState(prev => ({ ...prev, session: currentSession }));
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const signOut = async () => {
        await supabase.auth.signOut();
        setAuthState({
            user: null,
            session: null,
            permissions: {},
            isLoading: false
        });
    };

    return (
        <AuthContext.Provider value={{
            user: authState.user,
            session: authState.session,
            permissions: authState.permissions,
            isLoading: authState.isLoading,
            signOut,
            hasPermission
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
