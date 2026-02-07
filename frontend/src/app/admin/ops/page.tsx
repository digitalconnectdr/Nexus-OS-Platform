'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
    Activity,
    Database,
    Cpu,
    HardDrive,
    Trash2,
    RefreshCw,
    Clock,
    Zap,
    ShieldCheck,
    AlertTriangle,
    Download,
    FileJson,
    Trash,
    Eraser,
    Server,
    Mail,
    BrainCircuit
} from "lucide-react";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area
} from 'recharts';
import { fetchFromAPI } from '@/lib/api';

export default function OpsDashboard() {
    const { toast } = useToast();
    const [telemetry, setTelemetry] = useState<any>(null);
    const [backups, setBackups] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [purging, setPurging] = useState(false);
    const [backingUp, setBackingUp] = useState(false);
    const [clearingCache, setClearingCache] = useState(false);
    const [purgeData, setPurgeData] = useState({ tenant_id: '', year: new Date().getFullYear(), month: new Date().getMonth() + 1 });
    const [latencyHistory, setLatencyHistory] = useState<any[]>([]);
    const [confirmDeleteText, setConfirmDeleteText] = useState("");

    const fetchTelemetry = useCallback(async () => {
        const start = performance.now();
        try {
            const data = await fetchFromAPI('/api/v1/ops/telemetry');
            const end = performance.now();
            const currentLatency = Math.round(end - start);
            setTelemetry(data);
            setLatencyHistory(prev => {
                const newHistory = [...prev, { time: new Date().toLocaleTimeString(), latency: currentLatency }];
                return newHistory.slice(-20); // Keep last 20 points
            });
            setLoading(false);
        } catch (error) {
            console.error("Error fetching telemetry", error);
        }
    }, []);

    const fetchBackups = useCallback(async () => {
        try {
            const data = await fetchFromAPI('/api/v1/ops/backups/recent');
            setBackups(data);
        } catch (error) {
            console.error("Error fetching backups", error);
        }
    }, []);

    useEffect(() => {
        fetchTelemetry();
        fetchBackups();
    }, [fetchTelemetry, fetchBackups]);

    const handlePurge = async () => {
        if (!purgeData.tenant_id) {
            toast({ title: "Error", description: "ID de Tenant es requerido", variant: "destructive" });
            return;
        }

        if (confirmDeleteText !== "BORRAR") {
            toast({ title: "Confirmación Requerida", description: "Por favor escriba 'BORRAR' para confirmar la purga física.", variant: "destructive" });
            return;
        }

        setPurging(true);
        try {
            const data = await fetchFromAPI(`/api/v1/ops/maintenance?tenant_id=${purgeData.tenant_id}&year=${purgeData.year}&month=${purgeData.month}`, {
                method: 'DELETE'
            });
            toast({ title: "Iniciado", description: data.message });
            setConfirmDeleteText("");
        } catch (error: any) {
            toast({ title: "Error", description: error.message || "Error desconocido", variant: "destructive" });
        } finally {
            setPurging(false);
        }
    };

    const handleBackup = async () => {
        if (!purgeData.tenant_id) {
            toast({ title: "Error", description: "Debe proveer un ID de Tenant para el respaldo.", variant: "destructive" });
            return;
        }

        setBackingUp(true);
        try {
            const data = await fetchFromAPI(`/api/v1/ops/backup?org_id=${purgeData.tenant_id}`, {
                method: 'POST'
            });
            toast({ title: "Backup en Proceso", description: data.message });
        } catch (error: any) {
            toast({ title: "Error", description: error.message || "Error al iniciar backup", variant: "destructive" });
        } finally {
            setBackingUp(false);
            setTimeout(fetchBackups, 2000);
        }
    };

    const handleClearCache = async () => {
        setClearingCache(true);
        try {
            const data = await fetchFromAPI('/api/v1/ops/clear-cache', { method: 'POST' });
            toast({ title: "Éxito", description: data.message });
        } catch (error: any) {
            toast({ title: "Error", description: error.message || "Error al limpiar caché", variant: "destructive" });
        } finally {
            setClearingCache(false);
        }
    };

    if (loading && !telemetry) {
        return <div className="p-8 flex items-center justify-center h-screen"><Activity className="animate-spin text-blue-500 mr-2" /> Cargando Infraestructura...</div>;
    }

    const health = telemetry?.health_checks || {};

    return (
        <div className="w-full max-w-[1600px] mx-auto p-6 space-y-6 animate-fade-in">
            <header className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight uppercase flex items-center gap-2">
                        <Activity className="w-8 h-8 text-blue-600" />
                        Suite de Operaciones
                    </h1>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">
                        Gestión Maestros y Parámetros Operativos
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <div className={`px-4 py-2 rounded-xl border flex items-center gap-2 font-mono text-sm shadow-sm transition-all
                        ${latencyHistory[latencyHistory.length - 1]?.latency < 50
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-900'
                            : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:border-amber-900'
                        }`}>
                        <div className={`w-2 h-2 rounded-full ${latencyHistory[latencyHistory.length - 1]?.latency < 50 ? 'bg-emerald-500' : 'bg-amber-500'} animate-pulse`} />
                        <span className="text-[10px] font-black uppercase tracking-widest">API Latency:</span>
                        <span className="font-bold">{latencyHistory[latencyHistory.length - 1]?.latency || 0}ms</span>
                    </div>
                </div>
            </header>

            {/* Health Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className={`border shadow-sm border-l-4 ${health.supabase ? 'border-l-green-500' : 'border-l-red-500'}`}>
                    <CardContent className="pt-4 flex items-center gap-4">
                        <Server className={health.supabase ? 'text-green-500' : 'text-red-500'} />
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Supabase Core</p>
                            <p className="font-bold text-slate-700">{health.supabase ? 'Conectado' : 'Fallo de Enlace'}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className={`border shadow-sm border-l-4 ${health.email ? 'border-l-green-500' : 'border-l-red-500'}`}>
                    <CardContent className="pt-4 flex items-center gap-4">
                        <Mail className={health.email ? 'text-green-500' : 'text-red-500'} />
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Email Service (SMTP)</p>
                            <p className="font-bold text-slate-700">{health.email ? 'Operativo' : 'Sin Servicio'}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className={`border shadow-sm border-l-4 ${health.ai ? 'border-l-green-500' : 'border-l-red-500'}`}>
                    <CardContent className="pt-4 flex items-center gap-4">
                        <BrainCircuit className={health.ai ? 'text-green-500' : 'text-red-500'} />
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">AI Service Endpoint</p>
                            <p className="font-bold text-slate-700">{health.ai ? 'Optimizado' : 'Inestable'}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-none shadow-sm bg-white border-t-2 border-t-blue-500">
                    <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-2 uppercase text-[10px] font-bold"><Cpu className="h-4 w-4" /> CPU Load</CardDescription>
                        <CardTitle className="text-2xl">{telemetry?.server?.cpu_usage_percent}%</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div
                                className="bg-blue-500 h-full transition-all duration-1000"
                                style={{ width: `${telemetry?.server?.cpu_usage_percent}%` }}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-white border-t-2 border-t-indigo-500">
                    <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-2 uppercase text-[10px] font-bold"><HardDrive className="h-4 w-4" /> RAM Used</CardDescription>
                        <CardTitle className="text-2xl">{telemetry?.server?.memory_usage_mb} MB</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-[10px] text-slate-400 font-bold">DISPONIBLE: {telemetry?.server?.memory_total_mb} MB</p>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-white border-t-2 border-t-emerald-500">
                    <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-2 uppercase text-[10px] font-bold"><Database className="h-4 w-4" /> DB Conns</CardDescription>
                        <CardTitle className="text-2xl">{telemetry?.db?.active_connections}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-[10px] text-green-600 font-black uppercase flex items-center gap-1">Healthy Pool</div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-white border-t-2 border-t-rose-500">
                    <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-2 uppercase text-[10px] font-bold text-rose-600"><AlertTriangle className="h-4 w-4" /> Server Errors (1h)</CardDescription>
                        <CardTitle className={`text-2xl ${telemetry?.errors?.count_500 > 0 ? 'text-rose-600' : 'text-slate-900'}`}>{telemetry?.errors?.count_500 || 0}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Respuestas HTTP 500</p>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="monitor" className="w-full">
                <TabsList className="bg-slate-200 p-1 mb-4 h-12">
                    <TabsTrigger value="monitor" className="h-10 data-[state=active]:bg-white data-[state=active]:shadow-sm px-8 font-bold text-xs uppercase tracking-widest">Rendimiento</TabsTrigger>
                    <TabsTrigger value="maintenance" className="h-10 data-[state=active]:bg-white data-[state=active]:shadow-sm px-8 font-bold text-xs uppercase tracking-widest">Mantenimiento</TabsTrigger>
                    <TabsTrigger value="backups" className="h-10 data-[state=active]:bg-white data-[state=active]:shadow-sm px-8 font-bold text-xs uppercase tracking-widest">Respaldos</TabsTrigger>
                </TabsList>

                <TabsContent value="monitor" className="space-y-4">
                    <Card className="border-none shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-sm font-black uppercase tracking-widest">Historial de Latencia del API</CardTitle>
                            <CardDescription>Validación local de tokens JWT. Refleja la salud de la red y el tiempo de proceso.</CardDescription>
                        </CardHeader>
                        <CardContent className="h-[350px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={latencyHistory} margin={{ left: 10, right: 10, top: 10, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorLatency" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="time" hide />
                                    <YAxis
                                        unit="ms"
                                        width={60}
                                        fontSize={10}
                                        tickLine={false}
                                        axisLine={false}
                                        tick={{ fill: '#94a3b8', fontWeight: 'bold' }}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#fff', border: 'none', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Area type="monotone" dataKey="latency" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorLatency)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="maintenance" className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="border shadow-md">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-rose-600 uppercase text-xs font-black"><Trash2 className="h-5 w-5" /> Zona de Peligro: Purga Masiva</CardTitle>
                            <CardDescription>Eliminación física de registros antiguos. Utiliza Batch Processing con 0.2s de intervalo.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-tighter text-slate-500">ID del Organization (Tenant)</label>
                                <Input
                                    placeholder="UUID de la organización..."
                                    value={purgeData.tenant_id}
                                    className="font-mono text-xs"
                                    onChange={e => setPurgeData(prev => ({ ...prev, tenant_id: e.target.value }))}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-tighter text-slate-500">Año</label>
                                    <Input
                                        type="number"
                                        value={purgeData.year}
                                        onChange={e => setPurgeData(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-tighter text-slate-500">Mes</label>
                                    <Input
                                        type="number"
                                        min="1" max="12"
                                        value={purgeData.month}
                                        onChange={e => setPurgeData(prev => ({ ...prev, month: parseInt(e.target.value) }))}
                                    />
                                </div>
                            </div>

                            <div className="p-4 bg-rose-50 border border-rose-100 rounded-lg space-y-3">
                                <p className="text-[10px] text-rose-700 font-black uppercase flex items-center gap-1">
                                    <Activity className="w-3 h-3" /> Requiere Confirmación Crítica
                                </p>
                                <Input
                                    placeholder="Escriba 'BORRAR' para confirmar"
                                    value={confirmDeleteText}
                                    onChange={(e) => setConfirmDeleteText(e.target.value)}
                                    className="bg-white border-rose-200"
                                />
                            </div>

                            <Button
                                variant="destructive"
                                className="w-full h-12 text-xs font-black uppercase tracking-widest"
                                onClick={handlePurge}
                                disabled={purging || confirmDeleteText !== "BORRAR"}
                            >
                                {purging ? <RefreshCw className="animate-spin mr-2 h-4 w-4" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                {purging ? 'Procesando en Segundo Plano...' : 'Ejecutar Purga de Datos'}
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="border shadow-md">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-indigo-600 uppercase text-xs font-black"><ShieldCheck className="h-5 w-5" /> Utilidades del Sistema</CardTitle>
                            <CardDescription>Gestión de memoria y caché operativa.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="p-4 border border-dashed rounded-lg border-indigo-200 space-y-3">
                                <div>
                                    <h4 className="text-[11px] font-black uppercase text-slate-700">Limpieza de Caché In-Memory</h4>
                                    <p className="text-[10px] text-slate-500">Invalida todas las variables temporales y estados de sesión cacheados en el backend.</p>
                                </div>
                                <Button
                                    variant="outline"
                                    className="w-full border-indigo-600 text-indigo-600 hover:bg-indigo-50 font-bold text-xs uppercase"
                                    onClick={handleClearCache}
                                    disabled={clearingCache}
                                >
                                    <Eraser className="w-4 h-4 mr-2" />
                                    {clearingCache ? 'Limpiando...' : 'Vaciar Caché del Sistema'}
                                </Button>
                            </div>

                            <div className="p-4 border border-dashed rounded-lg border-emerald-200 space-y-3">
                                <div>
                                    <h4 className="text-[11px] font-black uppercase text-slate-700">Generar Respaldo de Organización</h4>
                                    <p className="text-[10px] text-slate-500 font-medium">Exporta todas las ventas y metadatos del tenant seleccionado a un archivo JSON seguro.</p>
                                </div>
                                <Button
                                    variant="outline"
                                    className="w-full border-emerald-600 text-emerald-600 hover:bg-emerald-50 font-bold text-xs uppercase"
                                    onClick={handleBackup}
                                    disabled={backingUp}
                                >
                                    <FileJson className="w-4 h-4 mr-2" />
                                    {backingUp ? 'Solicitando...' : 'Iniciar Respaldo (Backup)'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="backups">
                    <Card className="border shadow-md">
                        <CardHeader>
                            <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-800">Historial de Respaldos Recientes</CardTitle>
                            <CardDescription>Archivos generados en las últimas 24 horas. Los nombres de archivo están ofuscados por seguridad.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-hidden border rounded-lg">
                                <table className="w-full text-xs">
                                    <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-black tracking-widest">
                                        <tr>
                                            <th className="px-4 py-3 text-left">Organización</th>
                                            <th className="px-4 py-3 text-left">Fecha de Creación</th>
                                            <th className="px-4 py-3 text-left">Tamaño</th>
                                            <th className="px-4 py-3 text-right">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {backups.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="px-4 py-10 text-center text-slate-400 font-medium">No se han generado respaldos recientemente.</td>
                                            </tr>
                                        ) : (
                                            backups.map((b, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-4 py-3 font-bold text-slate-700">{b.org_name}</td>
                                                    <td className="px-4 py-3 text-slate-500">{new Date(b.created_at).toLocaleString()}</td>
                                                    <td className="px-4 py-3 text-slate-500 font-mono">{b.size_kb} KB</td>
                                                    <td className="px-4 py-3 text-right">
                                                        <a href={b.url} download>
                                                            <Button size="sm" variant="ghost" className="text-blue-600 hover:text-blue-700 font-black text-[10px] uppercase gap-1">
                                                                <Download className="w-3.5 h-3.5" /> Descargar
                                                            </Button>
                                                        </a>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <p className="mt-4 text-[10px] text-slate-400 italic font-medium tracking-tight">
                                * Nota: Los archivos se eliminan automáticamente del servidor cada 48 horas como política de seguridad.
                            </p>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
