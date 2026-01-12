'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { CpuChipIcon } from '@heroicons/react/24/solid';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (authError) {
                setError(authError.message);
            } else {
                // Successful redirection
                window.location.href = '/dashboard';
            }
        } catch (err: any) {
            setError('Ocurrió un error inesperado al intentar iniciar sesión.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="max-w-md w-full space-y-8 bg-white p-10 shadow-xl border border-gray-100">
                <div className="text-center">
                    <div className="flex justify-center">
                        <CpuChipIcon className="h-12 w-12 text-blue-600" />
                    </div>
                    <h2 className="mt-4 text-2xl font-bold text-gray-900 tracking-tight uppercase">
                        NEXUS OS
                    </h2>
                    <p className="mt-1 text-xs font-bold text-gray-500 uppercase tracking-widest">
                        SISTEMA OPERATIVO EMPRESARIAL
                    </p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleLogin}>
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-sm text-xs font-bold uppercase italic">
                            Error de acceso: {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-500 uppercase">Email Institucional</label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full h-12 border border-gray-300 px-4 py-2 text-sm focus:border-blue-800 outline-none transition-all font-semibold"
                                placeholder="usuario@empresa.com"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-500 uppercase">Contraseña</label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full h-12 border border-gray-300 px-4 py-2 text-sm focus:border-blue-800 outline-none transition-all"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full flex justify-center py-4 px-4 border border-transparent text-[11px] font-bold uppercase tracking-widest text-white bg-blue-800 hover:bg-blue-900 focus:outline-none transition-all shadow-lg active:scale-95 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {loading ? 'Verificando...' : 'Iniciar Sesión'}
                        </button>
                    </div>
                </form>

                <div className="text-center pt-4">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">
                        NEXUS OS © 2026 Powered by JPRS DIGITAL CONNECT.
                    </p>
                </div>
            </div>
        </div>
    );
}
