import { supabase } from './supabase';
import { toast } from '@/hooks/use-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
console.log("🚀 Frontend API Configured URL:", API_URL);

// --- SELECTOR CACHE ---
const selectorCache: Record<string, { data: any, timestamp: number }> = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function fetchFromAPI(endpoint: string, options: any = {}, retries = 3) {
    let lastError: any;

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    // --- CHECK CACHE ---
    if (endpoint.includes('/selectors/') && options.method === 'GET' || !options.method) {
        const cached = selectorCache[endpoint];
        if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
            return cached.data;
        }
    }

    for (let i = 0; i < retries; i++) {
        try {
            const isFormData = options.isFormData === true;

            // --- TENANT OVERRIDE (Super Admin Context) ---
            let tenantOverride = null;
            if (typeof window !== 'undefined') {
                tenantOverride = localStorage.getItem('x-tenant-override');
            }

            const headers: any = {
                ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                ...(tenantOverride ? { 'x-tenant-id': tenantOverride } : {}),
                ...options.headers,
            };

            if (!isFormData) {
                headers['Content-Type'] = 'application/json';
            }

            const fetchOptions = { ...options };
            delete fetchOptions.isFormData;

            const response = await fetch(`${API_URL}${endpoint}`, {
                ...fetchOptions,
                headers,
            });

            // --- GRACEFUL EMPTY STATES ---
            if (response.status === 204 || response.status === 404) {
                console.warn(`[API Info] Endpoint ${endpoint} returned no content (Status: ${response.status})`);
                return [];
            }

            if (!response.ok) {
                // --- SECURITY KILL SWITCH (401: Unauthenticated ONLY) ---
                if (response.status === 401) {
                    console.error("⛔ SESIÓN EXPIRADA. Ejecutando protocolo de salida.");
                    if (typeof window !== 'undefined') {
                        localStorage.clear();
                        sessionStorage.setItem('logout-reason', 'session_expired');
                        window.location.href = '/login?reason=session_expired';
                    }
                    throw new Error('SESSION_KILLED');
                }

                let errorMessage = `API error: ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.detail || errorData.message || errorMessage;
                } catch (e) {
                    // Fallback to statusText if json extraction fails
                }

                if (response.status !== 403) {
                    console.error(`[API Error] ${endpoint} status: ${response.status}`, errorMessage);
                }

                // --- GLOBAL ERROR NOTIFICATION ---
                if (response.status >= 500 || response.status === 403) {
                    toast({
                        title: response.status === 403 ? "Acceso Denegado" : "Error de Servidor",
                        description: errorMessage || "Hubo un problema procesando su solicitud.",
                        variant: "destructive",
                        duration: 8000
                    });
                }

                const error = new Error(errorMessage);
                (error as any).status = response.status;
                throw error;
            }

            const result = await response.json();

            // --- SAVE TO CACHE ---
            if (endpoint.includes('/selectors/')) {
                selectorCache[endpoint] = { data: result, timestamp: Date.now() };
            }

            return result;
        } catch (e: any) {
            lastError = e;
            if (i < retries - 1) {
                // Wait before retrying (exponential backoff or simple delay)
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            }
        }
    }

    // If all retries fail, throw a friendly message if it's a fetch error
    if (lastError.name === 'TypeError' && lastError.message.includes('fetch')) {
        toast({
            title: "Falla de Conexión",
            description: "No se pudo establecer contacto con el backend. Verifique su conexión.",
            variant: "destructive",
            duration: 10000
        });
        throw new Error('Conectando con el servidor... (Error de red)');
    }

    throw lastError;
}
export const api = {
    getOperationalResults: async (month: string, view: string) => {
        return fetchFromAPI(`/api/v1/results/?month=${month}&view=${view}`);
    },
};
