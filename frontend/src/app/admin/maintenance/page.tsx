'use client';

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
    CloudArrowDownIcon,
    ExclamationTriangleIcon,
    ArrowPathIcon,
    ArchiveBoxIcon,
    CpuChipIcon,
    ClipboardDocumentListIcon
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Toaster, toast } from 'sonner';

export default function MaintenancePage() {
    const { session, hasPermission, user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [health, setHealth] = useState<any>(null);
    const [initialLoadTime, setInitialLoadTime] = useState<number>(0);
    const [coldStartDetected, setColdStartDetected] = useState(false);

    // System Lock State
    const [isSystemLocked, setIsSystemLocked] = useState(false);
    const [isTogglingLock, setIsTogglingLock] = useState(false);
    const [showLockDialog, setShowLockDialog] = useState(false); // Legacy dialog state

    // Batch Delete States
    const [showDeleteDialog, setShowDeleteDialog] = useState(false); // Legacy dialog state
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
    const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString());
    const [deleteConfirmWord, setDeleteConfirmWord] = useState('');
    const [confirmDelete, setConfirmDelete] = useState(false); // Inline confirm state
    const [isDeleting, setIsDeleting] = useState(false);

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
            const start = performance.now();
            try {
                // Parallel fetch for orgs if super admin
                const [healthData, orgsData] = await Promise.all([
                    fetchFromAPI('/api/v1/health/system'),
                    hasPermission('system', 'maint', 'override_tenant') ? fetchFromAPI('/api/v1/organizations/') : Promise.resolve([])
                ]);

                setHealth(healthData);
                setIsSystemLocked(healthData.locked); // Set system lock status from health data
                if (Array.isArray(orgsData)) {
                    setOrgs(orgsData);
                }
            } catch (error) {
                console.error("Health/Orgs Check Failed:", error);
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
    }, [session, hasPermission]); // Added hasPermission to dependency array

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
                setConfirmDelete(false);
                setDeleteConfirmWord('');
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

    const handleToggleLock = async (checked: boolean) => {
        setIsTogglingLock(true);
        try {
            const response = await fetchFromAPI('/api/v1/maintenance/lock', {
                method: 'POST',
                body: JSON.stringify({ enabled: checked })
            });
            setIsSystemLocked(response.mode === 'LOCKED');
            if (response.mode === 'LOCKED') toast.warning("SISTEMA BLOQUEADO A NIVEL GLOBAL");
            else toast.success("SISTEMA DESBLOQUEADO");
        } catch (error: any) { toast.error("Error al cambiar lock."); }
        finally { setIsTogglingLock(false); }
    };

    if (!hasPermission('system', 'maint', 'access')) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
                <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mb-4">
                    <LockClosedIcon className="w-8 h-8 text-amber-500" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Acceso Restringido</h2>
                <p className="text-sm text-gray-500 mt-2">Solo personal autorizado del Cuarto de Máquinas.</p>
            </div>
        );
    }

    if (loading) return <LoadingState message="Cargando Consola..." />;

    return (
        <div className="p-6 space-y-8 bg-slate-50/50 min-h-screen">
            <Toaster position="top-right" richColors />

            {/* HEADER */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
                        <WrenchScrewdriverIcon className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Mantenimiento de Datos</h1>
                        <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Herramientas de Consolidación y Resguardo</p>
                    </div>
                </div>
                <div className={`px-4 py-2 rounded-lg border flex items-center gap-2 ${isSystemLocked ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
                    <div className={`w-2 h-2 rounded-full ${isSystemLocked ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div>
                    <span className="text-[10px] font-bold uppercase tracking-widest">{isSystemLocked ? 'SISTEMA BLOQUEADO' : 'OPERACIÓN NORMAL'}</span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* COLUMN 1: BATCH OPERATIONS */}
                <div className="space-y-6">
                    {/* BATCH DELETE */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
                            <TrashIcon className="w-5 h-5 text-rose-500" />
                            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest">Borrado por Lotes</h3>
                        </div>
                        <div className="p-6 space-y-6">
                            <p className="text-xs text-slate-500 leading-relaxed">
                                Elimina registros históricos (Ventas) de forma quirúrgica. El proceso es asíncrono y se ejecuta en lotes de 250 para evitar sobrecarga.
                            </p>

                            {/* Phase 8: Global Selector */}
                            {hasPermission('system', 'maint', 'override_tenant') && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Organización Objetivo (Opcional)</label>
                                    <select
                                        className="w-full text-xs font-medium p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                                        value={selectedTenant}
                                        onChange={(e) => setSelectedTenant(e.target.value)}
                                    >
                                        <option value="">-- Usar Organización Actual ({user?.tenant_code}) --</option>
                                        {orgs.map(org => (
                                            <option key={org.id} value={org.id}>{org.name} ({org.slug})</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Año</label>
                                    <select
                                        className="w-full p-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-700"
                                        value={selectedYear}
                                        onChange={(e) => setSelectedYear(e.target.value)}
                                    >
                                        <option value="2024">2024</option>
                                        <option value="2025">2025</option>
                                        <option value="2026">2026</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mes</label>
                                    <select
                                        className="w-full p-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-700"
                                        value={selectedMonth}
                                        onChange={(e) => setSelectedMonth(e.target.value)}
                                    >
                                        {Array.from({ length: 12 }, (_, i) => (
                                            <option key={i + 1} value={(i + 1).toString()}>
                                                {new Date(0, i).toLocaleString('es-ES', { month: 'long' }).charAt(0).toUpperCase() + new Date(0, i).toLocaleString('es-ES', { month: 'long' }).slice(1)}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {confirmDelete ? (
                                <div className="animate-in fade-in slide-in-from-top-2 space-y-4 pt-4 border-t border-slate-100">
                                    <div className="p-3 bg-red-50 border border-red-100 rounded text-[10px] text-red-800 font-medium flex items-start gap-2">
                                        <ExclamationTriangleIcon className="w-4 h-4 text-red-600 shrink-0" />
                                        Esta acción es irreversible. Escribe "BORRAR" para confirmar.
                                    </div>
                                    <Input
                                        value={deleteConfirmWord}
                                        onChange={(e) => setDeleteConfirmWord(e.target.value)}
                                        placeholder="Escribe BORRAR"
                                        className="text-xs uppercase font-bold tracking-widest border-red-200 focus:border-red-500 focus:ring-red-200"
                                    />
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)} className="w-full text-[10px] font-bold uppercase">Cancelar</Button>
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={handleBatchDelete}
                                            disabled={isDeleting || deleteConfirmWord.toUpperCase() !== 'BORRAR' || !hasPermission('system', 'maint', 'delete')}
                                            className="w-full bg-red-600 hover:bg-red-700 text-[10px] font-bold uppercase"
                                        >
                                            {isDeleting ? 'Borrando...' : 'Confirmar Borrado'}
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <Button
                                    variant="destructive"
                                    className="w-full bg-red-600 hover:bg-red-700 font-bold uppercase tracking-wider text-[10px]"
                                    onClick={() => setConfirmDelete(true)}
                                    disabled={!hasPermission('system', 'maint', 'delete')}
                                >
                                    <TrashIcon className="w-4 h-4 mr-2" />
                                    Iniciar Purgado de Datos
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Phase 8: AUDIT LOG PURGE */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
                            <ClipboardDocumentListIcon className="w-5 h-5 text-amber-500" />
                            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest">Limpieza de Logs de Auditoría</h3>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex gap-3 items-start">
                                <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-[11px] font-bold text-amber-800 uppercase tracking-wide">⚠️ ADVERTENCIA CRÍTICA</p>
                                    <p className="text-[10px] text-amber-700 mt-1">
                                        Asegúrese de haber descargado sus reportes trimestrales antes de proceder. Esta acción es irreversible y eliminará la evidencia histórica de operaciones.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Antigüedad a Conservar</label>
                                <select
                                    className="w-full text-xs font-medium p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                                    value={auditRetention}
                                    onChange={(e) => setAuditRetention(e.target.value)}
                                    disabled={!hasPermission('system', 'maint', 'purge_audit')}
                                >
                                    <option value="3m">Borrar anteriores a 3 Meses</option>
                                    <option value="6m">Borrar anteriores a 6 Meses</option>
                                    <option value="1y">Borrar anteriores a 1 Año</option>
                                </select>
                            </div>

                            <Button
                                variant="outline"
                                className="w-full border-amber-200 text-amber-700 hover:bg-amber-50 font-bold uppercase tracking-wider text-[10px]"
                                onClick={() => setShowPurgeConfirm(true)}
                                disabled={isPurgingAudit || !hasPermission('system', 'maint', 'purge_audit')}
                            >
                                {isPurgingAudit ? 'Limpiando...' : 'Iniciar Limpieza de Auditoría'}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* COLUMN 2: SYSTEM LOCK & TOOLS */}
                <div className="space-y-6">
                    {/* GLOBAL LOCK */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-xl ${isSystemLocked ? 'bg-red-100' : 'bg-slate-100'}`}>
                                <LockClosedIcon className={`w-6 h-6 ${isSystemLocked ? 'text-red-600' : 'text-slate-400'}`} />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Bloqueo Global del Sistema</h3>
                                <p className="text-[10px] text-slate-500 mt-1 max-w-xs">
                                    Si se activa, solo los Super Administradores podrán acceder a la plataforma. Ideal para migraciones críticas.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Switch
                                checked={isSystemLocked}
                                onCheckedChange={handleToggleLock}
                                disabled={isTogglingLock || !hasPermission('system', 'maint', 'lock')}
                                className={isSystemLocked ? "data-[state=checked]:bg-red-600" : ""}
                            />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                {isSystemLocked ? 'ACTIVO' : 'INACTIVO'}
                            </span>
                        </div>
                    </div>

                    {/* OPTIMIZATION TOOLS */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest">Herramientas de Optimización</h3>
                        </div>
                        <div className="p-6 grid grid-cols-2 gap-4">
                            <Button
                                variant="outline"
                                className="h-20 flex flex-col gap-2 border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all"
                                onClick={handleBackup}
                                disabled={isBackingUp || !hasPermission('system', 'maint', 'backup')}
                            >
                                <ArchiveBoxIcon className="w-6 h-6 text-indigo-500" />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Backup JSON</span>
                            </Button>

                            <Button
                                variant="outline"
                                className="h-20 flex flex-col gap-2 border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all"
                                onClick={handlePurgeSockets}
                            >
                                <ServerIcon className="w-6 h-6 text-amber-500" />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Purgar Sockets</span>
                            </Button>

                            {/* Phase 8: TURBO BUTTON */}
                            <Button
                                variant="outline"
                                className="h-20 flex flex-col gap-2 border-slate-200 hover:bg-emerald-50 hover:border-emerald-300 transition-all col-span-2"
                                onClick={handleReindex}
                                disabled={isReindexing || !hasPermission('system', 'maint', 'reindex')}
                            >
                                <CpuChipIcon className={`w-6 h-6 text-emerald-500 ${isReindexing ? 'animate-spin' : ''}`} />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">
                                    {isReindexing ? 'Optimizando...' : 'Optimizar Índices (Turbo)'}
                                </span>
                            </Button>
                        </div>
                    </div>
                </div>

            </div>

            {/* DELETE CONFIRMATION DIALOG */}
            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-red-600 font-black uppercase tracking-tight flex items-center gap-2">
                            <ExclamationTriangleIcon className="w-5 h-5" /> Confirmar Borrado de Datos
                        </DialogTitle>
                        <DialogDescription className="text-slate-600 text-xs font-medium">
                            Se eliminarán TODOS los registros de ventas para el período {selectedMonth}/{selectedYear}. Esta acción es irreversible.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="p-3 bg-red-50 border border-red-100 rounded text-[10px] text-red-800">
                            Para evitar errores, escribe la palabra: <span className="font-black">BORRAR</span>
                        </div>
                        <Input
                            value={deleteConfirmWord}
                            onChange={(e) => setDeleteConfirmWord(e.target.value)}
                            className="uppercase font-mono text-xs tracking-wider"
                            placeholder="ESCRIBE AQUÍ"
                        />
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDeleteDialog(false)} className="text-xs font-bold uppercase tracking-widest">Cancelar</Button>
                        <Button
                            variant="destructive"
                            onClick={handleBatchDelete}
                            disabled={isDeleting || deleteConfirmWord.toUpperCase() !== 'BORRAR'}
                            className="bg-red-600 hover:bg-red-700 text-xs font-bold uppercase tracking-widest"
                        >
                            {isDeleting ? 'Procesando...' : 'Confirmar Borrado'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* LOCK CONFIRMATION DIALOG */}
            <Dialog open={showLockDialog} onOpenChange={setShowLockDialog}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="font-black uppercase tracking-tight">
                            {isSystemLocked ? 'Desactivar Bloqueo de Sistema' : 'Activar Bloqueo de Sistema'}
                        </DialogTitle>
                        <DialogDescription className="text-slate-600 text-xs font-medium">
                            {isSystemLocked
                                ? 'El sistema volverá a estar disponible para todos los usuarios autorizados.'
                                : 'ADVERTENCIA: Todos los usuarios (excepto Super Admins) verán una pantalla de mantenimiento y no podrán operar.'}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowLockDialog(false)} className="text-xs font-bold uppercase tracking-widest">Atrás</Button>
                        <Button
                            className={`text-xs font-bold uppercase tracking-widest ${!isSystemLocked ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}`}
                            onClick={() => handleToggleLock(!isSystemLocked)}
                            disabled={isTogglingLock}
                        >
                            {isTogglingLock ? 'Cambiando...' : (isSystemLocked ? 'Restaurar Sistema' : 'Confirmar Bloqueo')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}
