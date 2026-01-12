'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface AuthContextType {
    user: any;
    session: any;
    isLoading: boolean;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<any>(null);
    const [session, setSession] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    const loadProfile = async (currentSession: any) => {
        if (!currentSession) {
            setUser(null);
            setIsLoading(false);
            return;
        }

        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
            const response = await fetch(`${API_URL}/api/v1/users/me`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${currentSession.access_token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setUser({
                    ...data,
                    user_metadata: currentSession.user?.user_metadata,
                    app_metadata: currentSession.user?.app_metadata
                });
            } else {
                console.error("Failed to load profile from backend:", response.status);
                // Fallback basic data if backend fails but we have session
                setUser({
                    email: currentSession.user?.email,
                    ...currentSession.user?.user_metadata
                });
            }
        } catch (error) {
            console.error("Error loading profile:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const initializeAuth = async () => {
            setIsLoading(true);
            const { data: { session: initialSession } } = await supabase.auth.getSession();
            setSession(initialSession);
            await loadProfile(initialSession);
        };

        initializeAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
            setSession(currentSession);
            if (currentSession) {
                await loadProfile(currentSession);
            } else {
                setUser(null);
                setIsLoading(false);
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const signOut = async () => {
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, session, isLoading, signOut }}>
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
