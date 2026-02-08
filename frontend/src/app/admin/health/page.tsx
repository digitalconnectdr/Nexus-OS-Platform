'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { fetchFromAPI } from '@/lib/api';
import LoadingState from '@/components/ui/LoadingState';
import LatencyChart from '@/components/admin/health/LatencyChart';
import {
    ServerIcon,
    CircleStackIcon,
    SignalIcon,
    BoltIcon, // Using Bolt for "Health/Status"
    ArchiveBoxIcon, // Using ArchiveBox for storage/disk
    CpuChipIcon, // Using CpuChip for memory/processing
    InformationCircleIcon,
    UserGroupIcon
} from '@heroicons/react/24/outline';
import {
    AlertTriangle,
    CheckCircle2,
    Database,
    Activity,
    Lock,
    Skull,
    Info
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster, toast } from 'sonner';

interface SystemHealth {
    status: string;
    timestamp: string;
    organization: {
        tracking_id: string;
    };
    database: {
        status: string;
        latency_ms: number;
        active_connections: number;
        active_agents: number;
    };
    system: {
        memory_usage_mb: number;
        disk_usage_percent: number;
        cpu_percent: number;
    };
}

export default function HealthPage() {
    const { session, hasPermission, user } = useAuth();
    const [health, setHealth] = useState<SystemHealth | null>(null);
    const [loading, setLoading] = useState(true);
    const [coldStartDetected, setColdStartDetected] = useState(false);
    const [initialLoadTime, setInitialLoadTime] = useState(0);

    // Kill Switch State
    const [showKillSwitch, setShowKillSwitch] = useState(false);
    const [confirmTrackingId, setConfirmTrackingId] = useState('');
    const [isKilling, setIsKilling] = useState(false);

    useEffect(() => {
        const checkHealth = async () => {
            const start = performance.now();
            try {
                const data = await fetchFromAPI('/api/v1/health/system');
                setHealth(data);
            } catch (error) {
                console.error("Health Check Failed:", error);
            } finally {
                const end = performance.now();
                const duration = end - start;
                setInitialLoadTime(duration);
                if (duration > 5000) {
                    setColdStartDetected(true);
                }
                setLoading(false);
            }
        };

        if (session) {
            checkHealth();
        }
    }, [session]);

    const handleKillSwitch = async () => {
        if (!health?.organization.tracking_id) {
            toast.error("Error validando ID de organización.");
            return;
        }

        if (confirmTrackingId.trim() !== health.organization.tracking_id.trim()) {
            toast.error("El ID de Rastreo no coincide.");
            return;
        }

        setIsKilling(true);
        try {
            const response = await fetchFromAPI('/api/v1/health/kill-switch', {
                method: 'POST',
                body: JSON.stringify({ confirmation_id: confirmTrackingId })
            });

            if (response.status === 'success') {
                toast.success(response.message);
                setShowKillSwitch(false);
                setConfirmTrackingId('');
                // Refresh metrics
                const data = await fetchFromAPI('/api/v1/health/system');
                setHealth(data);
            } else {
                toast.error("Error desconocido al ejecutar Kill Switch.");
            }
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Fallo crítico en Kill Switch.");
        } finally {
            setIsKilling(false);
        }
    };

    if (!hasPermission('system', 'health', 'read')) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
                    <LockClosedIcon className="w-8 h-8 text-red-500" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Acceso Restringido</h2>
                <p className="text-sm text-gray-500 mt-2">No tienes permisos para visualizar la telemetría del sistema.</p>
            </div>
        );
    }

    if (loading) return <LoadingState message="Escaneando Signos Vitales..." />;

    return (
        <div className="p-6 space-y-6 bg-slate-50/50 min-h-screen">
            <Toaster position="top-right" richColors />

            {/* HEADER */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
                        <Activity className="w-6 h-6 text-rose-500" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Centro de Salud Nexus</h1>
                        <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Diagnóstico Técnico y Telemetría en Tiempo Real</p>
                    </div>
                </div>

                {/* COLD START ALERT */}
                {coldStartDetected && (
                    <div className="flex items-center gap-3 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg animate-in slide-in-from-top-2">
                        <div className="relative">
                            <div className="absolute inset-0 bg-amber-400 rounded-full animate-ping opacity-20"></div>
                            <AlertTriangle className="w-5 h-5 text-amber-600 relative z-10" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">Cold Start Detectado</p>
                            <p className="text-[10px] text-amber-600 font-medium">Tiempo de respuesta inicial: {(initialLoadTime / 1000).toFixed(2)}s</p>
                        </div>
                    </div>
                )}
            </header>

            {/* METRIC CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* DB STATUS */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between h-32">
                    <div className="flex justify-between items-start">
                        <div className="p-2 bg-indigo-50 rounded-lg">
                            <Database className="w-5 h-5 text-indigo-600" />
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${health?.database.status === 'connected' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                            {health?.database.status === 'connected' ? 'Online' : 'Error'}
                        </span>
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Base de Datos</p>
                        <p className="text-2xl font-black text-slate-900 mt-0.5">Supabase PG</p>
                    </div>
                </div>

                {/* ACTIVE CONNECTIONS - WITH TOOLTIP */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between h-32 relative group">
                    <div className="absolute top-2 right-2">
                        <div className="relative group/tooltip">
                            <InformationCircleIcon className="w-4 h-4 text-slate-300 hover:text-blue-500 cursor-help transition-colors" />
                            <div className="absolute top-full right-0 mt-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded-lg shadow-xl opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-50 font-medium">
                                Representa el uso actual de sockets en el Pooler de Supabase.
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-between items-start">
                        <div className="p-2 bg-blue-50 rounded-lg">
                            <SignalIcon className="w-5 h-5 text-blue-600" />
                        </div>
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Conexiones Activas</p>
                        <div className="flex items-end gap-2">
                            <p className="text-3xl font-black text-slate-900 leading-none">{health?.database.active_connections ?? '-'}</p>
                            <p className="text-[10px] text-slate-400 font-medium mb-1">sockets</p>
                        </div>
                    </div>
                </div>

                {/* ACTIVE AGENTS (NEW KILL SWITCH METRIC) */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between h-32">
                    <div className="flex justify-between items-start">
                        <div className="p-2 bg-rose-50 rounded-lg">
                            <UserGroupIcon className="w-5 h-5 text-rose-600" />
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="relative flex h-2 w-2">
                                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${health?.database.active_agents && health.database.active_agents > 0 ? 'bg-green-400' : 'bg-gray-400'} opacity-75`}></span>
                                <span className={`relative inline-flex rounded-full h-2 w-2 ${health?.database.active_agents && health.database.active_agents > 0 ? 'bg-green-500' : 'bg-gray-500'}`}></span>
                            </span>
                        </div>
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Agentes Online ({user?.tenant_code})</p>
                        <div className="flex items-end gap-2">
                            <p className="text-3xl font-black text-slate-900 leading-none">{health?.database.active_agents ?? 0}</p>
                            <p className="text-[10px] text-slate-400 font-medium mb-1">sesiones</p>
                        </div>
                    </div>
                </div>

                {/* DISK USAGE */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between h-32 relative overflow-hidden">
                    <div className="absolute bottom-0 left-0 h-1 bg-slate-100 w-full">
                        <div
                            className={`h-full transition-all duration-1000 ${health && health.system.disk_usage_percent > 80 ? 'bg-red-500' : 'bg-emerald-500'}`}
                            style={{ width: `${health?.system.disk_usage_percent}%` }}
                        ></div>
                    </div>
                    <div className="flex justify-between items-start">
                        <div className="p-2 bg-emerald-50 rounded-lg">
                            <ArchiveBoxIcon className="w-5 h-5 text-emerald-600" />
                        </div>
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Espacio en Disco</p>
                        <div className="flex items-end gap-2">
                            <p className="text-3xl font-black text-slate-900 leading-none">{health?.system.disk_usage_percent}%</p>
                            <p className="text-[10px] text-slate-400 font-medium mb-1">usado</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* LATENCY CHART */}
            <div className="grid grid-cols-1 gap-6">
                <LatencyChart />
            </div>

            {/* DANGER ZONE */}
            {hasPermission('system', 'security', 'killswitch') && (
                <div className="mt-8 border border-red-200 rounded-xl bg-red-50/30 overflow-hidden">
                    <div className="px-6 py-4 border-b border-red-100 bg-red-50/50 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-red-100 rounded-lg">
                                <Skull className="w-5 h-5 text-red-600" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-red-900 uppercase tracking-wide">Zona de Mantenimiento Crítico</h3>
                                <p className="text-[10px] text-red-700 mt-0.5">Acciones destructivas irreversibles para la organización: <span className="font-black">{user?.tenant_name}</span></p>
                            </div>
                        </div>
                    </div>
                    <div className="p-6 flex items-center justify-between">
                        <div>
                            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-widest">Kill Switch (Expulsión Masiva)</h4>
                            <p className="text-[11px] text-slate-500 mt-1 max-w-md">
                                Revoca inmediatamente todas las sesiones activas de los usuarios de esta organización.
                                Útil en caso de compromiso de seguridad o mantenimiento mayor.
                                <br />
                                <span className="font-bold text-red-600 mt-1 block">Nota: El Super Admin que ejecuta la acción NO será expulsado.</span>
                            </p>
                        </div>
                        <Button
                            variant="destructive"
                            className="bg-red-600 hover:bg-red-700 text-white font-bold uppercase tracking-widest text-[10px]"
                            onClick={() => setShowKillSwitch(true)}
                        >
                            Ejecutar Kill Switch
                        </Button>
                    </div>
                </div>
            )}

            {/* FOOTER INFO */}
            <div className="flex justify-between items-center pt-8 border-t border-slate-200/50">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${health?.status === 'online' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    Sistema: {health?.status === 'online' ? 'OPERATIVO' : 'CRÍTICO'}
                </div>
                <div className="text-[10px] font-mono text-slate-300">
                    ID: {session?.user.id.slice(0, 8)}...
                </div>
            </div>

            {/* CONFIRMATION DIALOG */}
            <Dialog open={showKillSwitch} onOpenChange={setShowKillSwitch}>
                <DialogContent className="sm:max-w-md bg-white rounded-[2.5rem] border-0 shadow-2xl p-8">
                    <DialogHeader>
                        <DialogTitle className="text-red-600 font-black uppercase tracking-tight flex items-center gap-2 text-xl">
                            <AlertTriangle className="w-6 h-6" /> Confirmar Expulsión Masiva
                        </DialogTitle>
                        <DialogDescription className="text-slate-600 font-medium pt-2 text-sm leading-relaxed">
                            Esta acción cerrará la sesión de <span className="font-bold">{health?.database.active_agents} agentes</span>.
                            Deberán volver a ingresar sus credenciales.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-xs text-red-800 break-all">
                            Para confirmar, copie el exacto <span className="font-bold">ID de Rastreo</span> de la organización:
                            <br />
                            <code className="block mt-2 bg-white px-3 py-2 rounded-lg border border-red-200 font-mono text-sm font-bold select-all cursor-text text-red-900 tracking-wider text-center">
                                {health?.organization.tracking_id}
                            </code>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Pegar ID de Confirmación</label>
                            <Input
                                value={confirmTrackingId}
                                onChange={(e) => setConfirmTrackingId(e.target.value)}
                                className="font-mono text-sm tracking-wider h-12 rounded-xl border-slate-200 focus:ring-red-500/20 focus:border-red-500 text-center font-bold"
                                placeholder="aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setShowKillSwitch(false)} className="rounded-xl px-6 font-bold text-xs uppercase tracking-widest border-slate-200 h-12">Cancelar</Button>
                        <Button
                            variant="destructive"
                            onClick={handleKillSwitch}
                            disabled={isKilling || confirmTrackingId.trim() !== health?.organization.tracking_id.trim()}
                            className="bg-red-600 hover:bg-red-700 text-white rounded-xl px-6 font-bold text-xs uppercase tracking-widest h-12 shadow-lg shadow-red-500/20"
                        >
                            {isKilling ? 'Ejecutando...' : 'Confirmar Expulsión'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}

// Icon helper
function LockClosedIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
            <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
        </svg>
    );
}
