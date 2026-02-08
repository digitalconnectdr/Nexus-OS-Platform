'use client';
// Force Sync V3

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { fetchFromAPI } from '@/lib/api';
import LoadingState from '@/components/ui/LoadingState';
import {
    WrenchScrewdriverIcon,
    TrashIcon,
    LockClosedIcon,
    LockOpenIcon,
    ServerIcon,
    ExclamationTriangleIcon,
    CpuChipIcon,
    ClipboardDocumentListIcon,
    ShieldCheckIcon,
    ClockIcon,
    CheckCircleIcon
} from '@heroicons/react/24/outline';
import { Switch } from "@/components/ui/switch";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster, toast } from 'sonner';

export default function MaintenancePage() {
    const { session, hasPermission, user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [health, setHealth] = useState<any>(null);

    // System Lock State
    const [isSystemLocked, setIsSystemLocked] = useState(false);
    const [isTogglingLock, setIsTogglingLock] = useState(false);
    const [showLockDialog, setShowLockDialog] = useState(false);

    // Batch Delete States
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
    const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString());
    const [deleteConfirmWord, setDeleteConfirmWord] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [recordCount, setRecordCount] = useState<number | null>(null);
    const [isCounting, setIsCounting] = useState(false);

    // Backup & Sockets
    const [isBackingUp, setIsBackingUp] = useState(false);

    // Phase 8: Data Management
    const [orgs, setOrgs] = useState<any[]>([]);
    const [selectedTenant, setSelectedTenant] = useState<string>(''); // For Override
    const [isReindexing, setIsReindexing] = useState(false);

    // Audit Purge State
    const [auditRetention, setAuditRetention] = useState('3m');
    const [isPurgingAudit, setIsPurgingAudit] = useState(false);
    const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);

    useEffect(() => {
        const checkHealth = async () => {
            try {
                // Parallel fetch for orgs if super admin
                const [healthData, orgsData] = await Promise.all([
                    fetchFromAPI('/api/v1/health/system'),
                    hasPermission('system', 'maint', 'override_tenant') ? fetchFromAPI('/api/v1/organizations/') : Promise.resolve([])
                ]);

                setHealth(healthData);
                setIsSystemLocked(healthData.locked);
                if (Array.isArray(orgsData)) {
                    setOrgs(orgsData);
                }
            } catch (error) {
                console.error("Health/Orgs Check Failed:", error);
            } finally {
                setLoading(false);
            }
        };

        if (session) {
            checkHealth();
        }
    }, [session, hasPermission]);

    // NEW: Auto-Count Records when filters change
    useEffect(() => {
        const countRecords = async () => {
            // Only count if we have permission to avoid 403 spam
            if (!hasPermission('system', 'maint', 'delete')) return;

            setIsCounting(true);
            try {
                const target = selectedTenant || user?.tenant_id;
                // Use the new fast endpoint
                const query = new URLSearchParams({
                    tenant_id: target,
                    year: selectedYear,
                    month: selectedMonth
                });

                const response = await fetchFromAPI(`/api/v1/maintenance/count-records?${query.toString()}`);
                setRecordCount(response.count);
            } catch (error) {
                console.warn("Count failed", error);
                setRecordCount(null);
            } finally {
                setIsCounting(false);
            }
        };

        const timeoutId = setTimeout(() => {
            if (!loading) countRecords();
        }, 500); // Debounce

        return () => clearTimeout(timeoutId);

    }, [selectedYear, selectedMonth, selectedTenant, loading, user?.tenant_id, hasPermission]);


    const handleBatchDelete = async () => {
        if (deleteConfirmWord.toUpperCase() !== 'BORRAR') {
            toast.error("Debes escribir 'BORRAR' para confirmar.");
            return;
        }

        setIsDeleting(true);
        try {
            const response = await fetchFromAPI('/api/v1/maintenance/batch-delete', {
                method: 'POST',
                body: JSON.stringify({
                    tenant_id: user?.tenant_id,
                    target_tenant_id: selectedTenant || undefined, // Phase 8: Override
                    year: parseInt(selectedYear),
                    month: parseInt(selectedMonth),
                    confirmation_word: deleteConfirmWord
                })
            });

            if (response.status === 'queued') {
                toast.success(response.message || "Tarea de borrado iniciada en segundo plano.");
                setDeleteConfirmWord('');
                // Reset count logically (although async puts it in queue, UI update will lag)
                setRecordCount(0);
            }
        } catch (error: any) {
            toast.error(error.message || "Error al iniciar borrado.");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleAuditPurge = async () => {
        setIsPurgingAudit(true);
        try {
            const response = await fetchFromAPI('/api/v1/maintenance/purge-audit', {
                method: 'POST',
                body: JSON.stringify({ retention_period: auditRetention })
            });

            if (response.status === 'queued') {
                toast.success("🧹 Limpieza de Auditoría iniciada en segundo plano.");
                setShowPurgeConfirm(false);
            }
        } catch (error: any) {
            toast.error(error.message || "Fallo en purga de auditoría.");
        } finally {
            setIsPurgingAudit(false);
        }
    };

    const handleReindex = async () => {
        setIsReindexing(true);
        toast.info("⚡ Iniciando optimización Turbo...");
        try {
            const response = await fetchFromAPI('/api/v1/maintenance/reindex', {
                method: 'POST'
            });

            if (response.status === 'queued') {
                toast.success("🚀 ¡Índices Reconstruidos! El sistema ahora es más veloz.");
            }
        } catch (error: any) {
            toast.error("Fallo en reindexación.");
        } finally {
            setIsReindexing(false);
        }
    };

    const handleBackup = async () => {
        setIsBackingUp(true);
        try {
            const response = await fetchFromAPI('/api/v1/maintenance/backup', { method: 'POST' });
            if (response.status === 'queued') toast.success("Backup flash iniciado.");
        } catch (error: any) { toast.error("Error en backup."); }
        finally { setIsBackingUp(false); }
    };

    const handlePurgeSockets = async () => {
        try {
            await fetchFromAPI('/api/v1/maintenance/purge-sockets', { method: 'POST' });
            toast.success("Conexiones inactivas purgadas.");
        } catch (error: any) {
            toast.error(error.message);
        }
    };

    const handleToggleLock = async () => {
        // Toggle logic within dialog confirm
        setIsTogglingLock(true);
        try {
            const response = await fetchFromAPI('/api/v1/maintenance/lock', {
                method: 'POST',
                body: JSON.stringify({ enabled: !isSystemLocked })
            });
            setIsSystemLocked(response.mode === 'LOCKED');
            if (response.mode === 'LOCKED') toast.warning("SISTEMA BLOQUEADO A NIVEL GLOBAL");
            else toast.success("SISTEMA DESBLOQUEADO");
            setShowLockDialog(false);
        } catch (error: any) { toast.error("Error al cambiar lock."); }
        finally { setIsTogglingLock(false); }
    };

    if (!hasPermission('system', 'maint', 'access')) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
                <div className="w-24 h-24 bg-slate-900 rounded-3xl flex items-center justify-center mb-6 shadow-2xl">
                    <LockClosedIcon className="w-10 h-10 text-slate-400" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">ACCESO DENEGADO</h2>
                <p className="text-sm text-slate-500 mt-2 font-medium">Esta área es exclusiva para Operaciones de Nivel 5.</p>
            </div>
        );
    }

    if (loading) return <LoadingState message="Inicializando Command Center..." />;

    return (
        <div className="p-8 space-y-8 bg-slate-50 min-h-screen font-sans">
            <Toaster position="top-right" richColors />

            {/* HEADER V3 */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-5">
                    <div className="p-4 bg-slate-900 rounded-2xl shadow-xl shadow-slate-200/50">
                        <WrenchScrewdriverIcon className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Command Center</h1>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-[0.2em] mt-1">Mantenimiento & Estabilidad</p>
                    </div>
                </div>

                {/* GLOBAL LOCK STATUS PILL */}
                <div className={`px-6 py-3 rounded-full border flex items-center gap-3 shadow-sm transition-colors ${isSystemLocked ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
                    <div className="relative">
                        <div className={`w-3 h-3 rounded-full ${isSystemLocked ? 'bg-red-500' : 'bg-emerald-500'}`}></div>
                        {isSystemLocked && <div className="absolute top-0 left-0 w-3 h-3 rounded-full bg-red-500 animate-ping"></div>}
                    </div>
                    <div className="flex flex-col">
                        <span className={`text-[10px] font-black uppercase tracking-widest ${isSystemLocked ? 'text-red-700' : 'text-emerald-700'}`}>
                            {isSystemLocked ? 'LOCKDOWN ACTIVO' : 'SISTEMA OPERATIVO'}
                        </span>
                        {isSystemLocked && <span className="text-[9px] text-red-500 font-bold">SOLO SUPER-ADMIN</span>}
                    </div>
                    <Switch
                        checked={isSystemLocked}
                        onCheckedChange={() => setShowLockDialog(true)}
                        disabled={!hasPermission('system', 'maint', 'lock')}
                        className="ml-2 data-[state=checked]:bg-red-600"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

                {/* COL 1: DATA PURGE (ATOMIC RED) */}
                <div className="xl:col-span-2 space-y-8">
                    <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/40 border border-slate-100 overflow-hidden relative group">
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-rose-500 via-red-500 to-orange-500"></div>
                        <div className="p-8">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-red-50 rounded-xl">
                                    <TrashIcon className="w-6 h-6 text-red-600" />
                                </div>
                                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Purgado de Ventas</h3>
                            </div>

                            <p className="text-sm text-slate-500 font-medium leading-relaxed mb-8 max-w-2xl">
                                Herramienta de alta precisión para eliminar registros históricos.
                                <span className="text-red-600 font-bold"> Acción irreversible.</span> Utilizar con extrema precaución.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
                                {/* Global Selector */}
                                <div className="space-y-3">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Organización</label>
                                    <select
                                        className="w-full text-xs font-bold p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white shadow-sm"
                                        value={selectedTenant}
                                        onChange={(e) => setSelectedTenant(e.target.value)}
                                        disabled={!hasPermission('system', 'maint', 'override_tenant')}
                                    >
                                        <option value="">Mi Organización ({user?.tenant_code})</option>
                                        {orgs.map(org => (
                                            <option key={org.id} value={org.id}>{org.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Período</label>
                                    <div className="flex gap-2">
                                        <select
                                            className="w-1/3 p-3 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-sm bg-white"
                                            value={selectedYear}
                                            onChange={(e) => setSelectedYear(e.target.value)}
                                        >
                                            <option value="2024">2024</option>
                                            <option value="2025">2025</option>
                                            <option value="2026">2026</option>
                                        </select>
                                        <select
                                            className="w-2/3 p-3 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-sm bg-white"
                                            value={selectedMonth}
                                            onChange={(e) => setSelectedMonth(e.target.value)}
                                        >
                                            {Array.from({ length: 12 }, (_, i) => (
                                                <option key={i + 1} value={(i + 1).toString()}>
                                                    {new Date(0, i).toLocaleString('es-ES', { month: 'long' }).toUpperCase()}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* RECORD PREVIEW */}
                                <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl shadow-sm h-full">
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Registros Detectados</span>
                                        <div className="flex items-center gap-2 mt-1">
                                            {isCounting ? (
                                                <div className="h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                            ) : (
                                                <span className={`text-xl font-black tracking-tight ${recordCount === 0 ? 'text-slate-300' : 'text-slate-800'}`}>
                                                    {recordCount !== null ? recordCount.toLocaleString() : '-'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className={`w-2 h-2 rounded-full ${recordCount && recordCount > 0 ? 'bg-green-500' : 'bg-slate-300'}`}></div>
                                </div>
                            </div>

                            {/* Confirmation Area */}
                            <div className="mt-8 pt-8 border-t border-slate-100">
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-4">Confirmación de Seguridad</p>
                                <div className="flex gap-4">
                                    <Input
                                        value={deleteConfirmWord}
                                        onChange={(e) => setDeleteConfirmWord(e.target.value)}
                                        placeholder="ESCRIBE 'BORRAR'"
                                        className="uppercase font-black tracking-widest border-2 border-red-100 focus:border-red-500 focus:ring-red-200 bg-red-50/30 h-12 text-center rounded-xl max-w-xs"
                                    />
                                    <Button
                                        variant="destructive"
                                        onClick={handleBatchDelete}
                                        disabled={isDeleting || deleteConfirmWord.toUpperCase() !== 'BORRAR' || (recordCount === 0)}
                                        className="h-12 px-8 bg-red-600 hover:bg-red-700 font-bold uppercase tracking-widest rounded-xl shadow-lg shadow-red-500/30 flex-1 transition-all"
                                    >
                                        {isDeleting ? 'Eliminando...' : 'Ejecutar Borrado'}
                                    </Button>
                                </div>
                                {recordCount === 0 && (
                                    <p className="text-[10px] text-center mt-3 text-slate-400 font-medium">No hay registros para borrar en este período.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* COL 2: TOOLS & AUDIT */}
                <div className="space-y-8">

                    {/* TURBO OPTIMIZER (EMERALD) */}
                    <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/40 border border-slate-100 overflow-hidden p-8 relative">
                        <div className="absolute top-0 left-0 w-full h-1.5 bg-emerald-500"></div>
                        <div className="flex justify-between items-start mb-6">
                            <div className="p-2 bg-emerald-50 rounded-xl">
                                <CpuChipIcon className="w-6 h-6 text-emerald-600" />
                            </div>
                            {isReindexing && <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full animate-pulse">EN PROCESO</span>}
                        </div>
                        <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-2">Turbo Optimizer</h3>
                        <p className="text-xs text-slate-500 font-medium mb-6">Reconstruye índices b-tree corruptos para acelerar consultas.</p>

                        <Button
                            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold uppercase tracking-widest rounded-xl shadow-lg shadow-emerald-500/30 h-12"
                            onClick={handleReindex}
                            disabled={isReindexing}
                        >
                            {isReindexing ? 'Optimizando...' : 'Iniciar Reindex'}
                        </Button>
                    </div>

                    {/* SOCKET PURGE (AMBER) */}
                    <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/40 border border-slate-100 overflow-hidden p-8 relative">
                        <div className="absolute top-0 left-0 w-full h-1.5 bg-amber-500"></div>
                        <div className="flex justify-between items-start mb-6">
                            <div className="p-2 bg-amber-50 rounded-xl">
                                <ServerIcon className="w-6 h-6 text-amber-600" />
                            </div>
                        </div>
                        <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-2">Conexiones Fantasma</h3>
                        <p className="text-xs text-slate-500 font-medium mb-6">Elimina sockets 'idle' que saturan el pool de Supabase.</p>

                        <Button
                            variant="outline"
                            className="w-full border-amber-200 text-amber-700 hover:bg-amber-50 font-bold uppercase tracking-widest rounded-xl h-12"
                            onClick={handlePurgeSockets}
                        >
                            Purgar Sockets
                        </Button>
                    </div>

                    {/* AUDIT LOG (INDIGO) */}
                    <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/40 border border-slate-100 overflow-hidden p-8 relative">
                        <div className="absolute top-0 left-0 w-full h-1.5 bg-indigo-500"></div>
                        <div className="flex justify-between items-start mb-6">
                            <div className="p-2 bg-indigo-50 rounded-xl">
                                <ClipboardDocumentListIcon className="w-6 h-6 text-indigo-600" />
                            </div>
                        </div>
                        <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-2">Auditoría</h3>
                        <div className="flex items-center gap-2 mb-6">
                            <select
                                className="w-full text-xs font-bold p-2 border border-slate-200 rounded-lg text-slate-600 outline-none"
                                value={auditRetention}
                                onChange={(e) => setAuditRetention(e.target.value)}
                            >
                                <option value="3m">3 Meses</option>
                                <option value="6m">6 Meses</option>
                                <option value="1y">1 Año</option>
                            </select>
                            <Button
                                size="sm"
                                variant="outline"
                                className="border-indigo-200 text-indigo-600 hover:bg-indigo-50 font-bold"
                                onClick={() => setShowPurgeConfirm(true)}
                            >
                                Limpiar
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* AUDIT WARNING MODAL */}
            <Dialog open={showPurgeConfirm} onOpenChange={setShowPurgeConfirm}>
                <DialogContent className="sm:max-w-md bg-white rounded-3xl border-0 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-amber-600 font-black uppercase tracking-tight flex items-center gap-2 text-xl">
                            <ExclamationTriangleIcon className="w-8 h-8" /> Atención Requerida
                        </DialogTitle>
                        <DialogDescription className="text-slate-600 font-medium pt-2 text-sm leading-relaxed">
                            Está a punto de eliminar logs de auditoría.
                            <br /><br />
                            <span className="font-bold text-slate-900 block mb-1">⚠️ Asegúrese de haber descargado sus reportes trimestrales antes de proceder.</span>
                            La evidencia de operaciones antiguas será eliminada permanentemente.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-6 gap-2">
                        <Button variant="outline" onClick={() => setShowPurgeConfirm(false)} className="rounded-xl px-6 font-bold text-xs uppercase tracking-widest border-slate-200">
                            Cancelar
                        </Button>
                        <Button
                            className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl px-6 font-bold text-xs uppercase tracking-widest shadow-lg shadow-amber-500/20"
                            onClick={handleAuditPurge}
                            disabled={isPurgingAudit}
                        >
                            {isPurgingAudit ? 'Procesando...' : 'Entendido, Eliminar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* LOCK DIALOG */}
            <Dialog open={showLockDialog} onOpenChange={setShowLockDialog}>
                <DialogContent className="sm:max-w-md bg-white rounded-3xl border-0 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className={`font-black uppercase tracking-tight flex items-center gap-2 text-xl ${isSystemLocked ? 'text-emerald-600' : 'text-red-600'}`}>
                            {isSystemLocked ? <LockOpenIcon className="w-6 h-6" /> : <LockClosedIcon className="w-6 h-6" />}
                            {isSystemLocked ? 'Restaurar Acceso' : 'Bloqueo Total'}
                        </DialogTitle>
                        <DialogDescription className="text-slate-600 font-medium pt-2 text-sm leading-relaxed">
                            {isSystemLocked
                                ? 'El sistema volverá a estar disponible para todos los usuarios. ¿Confirmar apertura?'
                                : 'Se bloqueará el acceso a TODOS los usuarios excepto Super Admins. Use esto solo en emergencias.'}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-6 gap-2">
                        <Button variant="outline" onClick={() => setShowLockDialog(false)} className="rounded-xl px-6 font-bold text-xs uppercase tracking-widest border-slate-200">
                            Cancelar
                        </Button>
                        <Button
                            className={`rounded-xl px-6 font-bold text-xs uppercase tracking-widest shadow-lg ${isSystemLocked ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20' : 'bg-red-600 hover:bg-red-700 shadow-red-500/20'}`}
                            onClick={handleToggleLock}
                            disabled={isTogglingLock}
                        >
                            {isTogglingLock ? 'Procesando...' : 'Confirmar Acción'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}
