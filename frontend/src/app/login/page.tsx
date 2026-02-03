'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { CpuChipIcon } from '@heroicons/react/24/solid';
import { EnvelopeIcon, LockClosedIcon } from '@heroicons/react/24/outline';
import { useToast } from '@/hooks/use-toast';

export default function LoginPage() {
    const router = useRouter();
    const { toast } = useToast();
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
                // Successful redirection using Next.js router
                router.push('/dashboard');
            }
        } catch (err: any) {
            setError('Ocurrió un error inesperado al intentar iniciar sesión.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-white to-slate-200 px-4 md:px-0">
            {/* Technical Background Texture - Softer */}
            <div className="absolute inset-0 z-0 opacity-[0.3] pointer-events-none"
                style={{ backgroundImage: 'radial-gradient(#cbd5e1 1.5px, transparent 0)', backgroundSize: '32px 32px' }}>
            </div>
            <div className="absolute inset-0 z-0 opacity-[0.1] pointer-events-none"
                style={{ backgroundImage: 'linear-gradient(#e2e8f0 1px, transparent 0), linear-gradient(90deg, #e2e8f0 1px, transparent 0)', backgroundSize: '100px 100px' }}>
            </div>

            <div className="relative z-10 w-full max-w-md">
                <div className="bg-white rounded-2xl shadow-xl shadow-blue-900/5 border border-slate-100 overflow-hidden transform transition-all">
                    {/* Header Section */}
                    <div className="p-10 pb-4 text-center">
                        <div className="flex justify-center mb-6">
                            <div className="bg-blue-600 p-4 rounded-2xl shadow-lg shadow-blue-200 ring-4 ring-blue-50">
                                <CpuChipIcon className="h-10 w-10 text-white" />
                            </div>
                        </div>
                        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
                            Bienvenido
                        </h1>
                        <p className="mt-2 text-sm text-slate-500 font-medium">
                            Ingresa a Nexus OS Enterprise para continuar
                        </p>
                    </div>

                    {/* Form Section */}
                    <div className="p-10 pt-4">
                        <form className="space-y-6" onSubmit={handleLogin}>
                            {error && (
                                <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-xs font-semibold flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                                    <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse shrink-0"></span>
                                    {error}
                                </div>
                            )}

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label htmlFor="email" className="text-xs font-bold text-slate-500 ml-1 uppercase tracking-wider">
                                        Email
                                    </label>
                                    <div className="relative group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors">
                                            <EnvelopeIcon className="h-5 w-5" />
                                        </div>
                                        <input
                                            id="email"
                                            name="email"
                                            type="email"
                                            autoComplete="email"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="w-full h-13 bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-600/5 outline-none transition-all font-medium"
                                            placeholder="nombre@empresa.com"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between ml-1">
                                        <label htmlFor="password" className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                            Contraseña
                                        </label>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                toast({
                                                    title: "Acción Requerida",
                                                    description: "Por seguridad, contacte al Departamento de IT o a su Administrador para restablecer sus credenciales.",
                                                });
                                            }}
                                            className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline transition-colors cursor-pointer"
                                        >
                                            ¿Olvidaste tu contraseña?
                                        </button>
                                    </div>
                                    <div className="relative group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors">
                                            <LockClosedIcon className="h-5 w-5" />
                                        </div>
                                        <input
                                            id="password"
                                            name="password"
                                            type="password"
                                            autoComplete="current-password"
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full h-13 bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-600/5 outline-none transition-all font-medium"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className={`w-full h-13 flex items-center justify-center gap-2 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] transition-all shadow-xl shadow-blue-600/20 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                                {loading ? (
                                    <>
                                        <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Verificando...
                                    </>
                                ) : (
                                    'Iniciar Sesión'
                                )}
                            </button>
                        </form>
                    </div>

                    {/* Footer Inside Card */}
                    <div className="bg-slate-50/50 p-6 text-center border-t border-slate-100">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">
                            Nexus OS Enterprise System
                        </p>
                    </div>
                </div>

                {/* External Footer */}
                <div className="mt-10 text-center">
                    <p className="text-sm text-slate-500 font-medium tracking-tight">
                        © 2026 Powered by <span className="font-bold text-slate-900">JPRS Digital Connect</span>
                    </p>
                </div>
            </div>
        </div>
    );
}
