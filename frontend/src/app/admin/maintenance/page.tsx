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
    ArchiveBoxIcon
} from '@heroicons/react/24/outline';
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
    const [isGlobalLocked, setIsGlobalLocked] = useState(false);

    // Batch Delete States
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [deleteYear, setDeleteYear] = useState(new Date().getFullYear().toString());
    const [deleteMonth, setDeleteMonth] = useState((new Date().getMonth() + 1).toString());
    const [deleteConfirmation, setDeleteConfirmation] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    // Lock States
    const [showLockDialog, setShowLockDialog] = useState(false);
    const [isTogglingLock, setIsTogglingLock] = useState(false);

    // Backup & Sockets
    const [isBackingUp, setIsBackingUp] = useState(false);
    const [isPurging, setIsPurging] = useState(false);

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const lockStatus = await fetchFromAPI('/api/v1/maintenance/lock-status');
                setIsGlobalLocked(lockStatus.locked);
            } catch (error) {
                console.error("Lock Status Check Failed:", error);
            } finally {
                setLoading(false);
            }
        };

        if (session) {
            checkStatus();
        }
    }, [session]);

    const handleBatchDelete = async () => {
        if (deleteConfirmation.toUpperCase() !== 'BORRAR') {
            toast.error("Debes escribir 'BORRAR' para confirmar.");
            return;
        }

        setIsDeleting(true);
        try {
            await fetchFromAPI('/api/v1/maintenance/batch-delete', {
                method: 'POST',
                body: JSON.stringify({
                    tenant_id: user?.tenant_id,
                    year: parseInt(deleteYear),
                    month: parseInt(deleteMonth),
                    confirmation_word: deleteConfirmation
                })
            });
            toast.success("Tarea de borrado iniciada en segundo plano.");
            setShowDeleteDialog(false);
            setDeleteConfirmation('');
        } catch (error: any) {
            toast.error(error.message || "Error al iniciar borrado.");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleToggleLock = async () => {
        setIsTogglingLock(true);
        try {
            const newState = !isGlobalLocked;
            const res = await fetchFromAPI('/api/v1/maintenance/lock', {
                method: 'POST',
                body: JSON.stringify({ enabled: newState })
            });
            setIsGlobalLocked(res.mode === 'LOCKED');
            toast.success(newState ? "Sistema bloqueado globalmente." : "Bloqueo global desactivado.");
            setShowLockDialog(false);
        } catch (error: any) {
            toast.error(error.message || "Error al cambiar estado de bloqueo.");
        } finally {
            setIsTogglingLock(false);
        }
    };

    const handleBackup = async () => {
        setIsBackingUp(true);
        try {
            await fetchFromAPI('/api/v1/maintenance/backup', { method: 'POST' });
            toast.message("Respaldo iniciado", {
                description: "Se está generando el archivo JSON en el servidor."
            });
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsBackingUp(false);
        }
    };

    const handlePurgeSockets = async () => {
        setIsPurging(true);
        try {
            await fetchFromAPI('/api/v1/maintenance/purge-sockets', { method: 'POST' });
            toast.success("Conexiones inactivas purgadas.");
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsPurging(false);
        }
    };

    if (!hasPermission('system', 'maint', 'access')) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
                    <WrenchScrewdriverIcon className="w-8 h-8 text-red-500" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Acceso Restringido</h2>
                <p className="text-sm text-gray-500 mt-2">No tienes permisos para la Consola de Mantenimiento.</p>
            </div>
        );
    }

    if (loading) return <LoadingState message="Configurando Consola..." />;

    return (
        <div className="p-6 space-y-6 bg-slate-50/50 min-h-screen">
            <Toaster position="top-right" richColors />

            {/* HEADER */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
                        <WrenchScrewdriverIcon className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Mantenimiento de Datos</h1>
                        <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Herramientas de Consolidación y Resguardo</p>
                    </div>
                </div>

                {/* STATUS BADGE */}
                <div className={`px-4 py-2 rounded-lg border flex items-center gap-3 transition-colors ${isGlobalLocked ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
                    {isGlobalLocked ? <LockClosedIcon className="w-4 h-4" /> : <LockOpenIcon className="w-4 h-4" />}
                    <span className="text-xs font-black uppercase tracking-widest">
                        Estado: {isGlobalLocked ? 'Bloqueo Global Activo' : 'Operación Normal'}
                    </span>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* BATCH DELETE SECTION */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-fit">
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
                        <TrashIcon className="w-5 h-5 text-red-500" />
                        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Borrado por Lotes</h2>
                    </div>
                    <div className="p-6 space-y-4">
                        <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                            Elimina registros históricos (Ventas) de forma quirúrgica. El proceso es asíncrono y se ejecuta en lotes de 250 para evitar sobrecarga.
                        </p>
                        <div className="flex gap-4">
                            <div className="flex-1 space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Año</label>
                                <Select value={deleteYear} onValueChange={setDeleteYear}>
                                    <SelectTrigger className="text-xs h-9">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="2024">2024</SelectItem>
                                        <SelectItem value="2025">2025</SelectItem>
                                        <SelectItem value="2026">2026</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex-1 space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mes</label>
                                <Select value={deleteMonth} onValueChange={setDeleteMonth}>
                                    <SelectTrigger className="text-xs h-9">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="1">Enero</SelectItem>
                                        <SelectItem value="2">Febrero</SelectItem>
                                        <SelectItem value="3">Marzo</SelectItem>
                                        {/* ... abbreviated ... */}
                                        <SelectItem value="12">Diciembre</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <Button
                            disabled={!hasPermission('system', 'maint', 'delete')}
                            variant="destructive"
                            className="w-full h-10 font-black uppercase tracking-widest text-[10px] bg-red-600 hover:bg-red-700 mt-2"
                            onClick={() => setShowDeleteDialog(true)}
                        >
                            <TrashIcon className="w-4 h-4 mr-2" />
                            Iniciar Purgado de Datos
                        </Button>
                    </div>
                </div>

                {/* SYSTEM CONSOLE - TABS/LOCKS */}
                <div className="space-y-6">
                    {/* GLOBAL LOCK SWITCH */}
                    <div className={`rounded-xl border p-6 transition-all ${isGlobalLocked ? 'bg-red-50/50 border-red-200' : 'bg-white border-slate-200 shadow-sm'}`}>
                        <div className="flex items-start justify-between">
                            <div className="flex gap-4">
                                <div className={`p-3 rounded-xl ${isGlobalLocked ? 'bg-red-100 text-red-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                    {isGlobalLocked ? <LockClosedIcon className="w-6 h-6" /> : <LockOpenIcon className="w-6 h-6" />}
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-slate-900 uppercase">Bloqueo Global del Sistema</h3>
                                    <p className="text-[11px] text-slate-500 mt-1 max-w-xs leading-relaxed">
                                        Si se activa, solo los Super Administradores podrán acceder a la plataforma. Ideal para migraciones críticas.
                                    </p>
                                </div>
                            </div>
                            <Button
                                variant={isGlobalLocked ? "outline" : "default"}
                                className={`font-bold uppercase tracking-widest text-[10px] h-9 ${!isGlobalLocked ? 'bg-slate-900 hover:bg-slate-800' : ''}`}
                                onClick={() => setShowLockDialog(true)}
                                disabled={!hasPermission('system', 'maint', 'lock')}
                            >
                                {isGlobalLocked ? 'Desactivar' : 'Activar Lock'}
                            </Button>
                        </div>
                    </div>

                    {/* QUICK TOOLS */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Herramientas de Optimización</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <Button
                                variant="outline"
                                className="flex flex-col h-auto py-4 px-4 gap-2 hover:bg-indigo-50 hover:border-indigo-200 transition-all border-slate-200"
                                onClick={handleBackup}
                                disabled={isBackingUp || !hasPermission('system', 'maint', 'backup')}
                            >
                                {isBackingUp ? <ArrowPathIcon className="w-5 h-5 animate-spin text-indigo-600" /> : <ArchiveBoxIcon className="w-5 h-5 text-indigo-600" />}
                                <span className="text-[10px] font-bold uppercase tracking-wide">Backup JSON</span>
                            </Button>
                            <Button
                                variant="outline"
                                className="flex flex-col h-auto py-4 px-4 gap-2 hover:bg-amber-50 hover:border-amber-200 transition-all border-slate-200"
                                onClick={handlePurgeSockets}
                                disabled={isPurging || !hasPermission('system', 'maint', 'sockets')}
                            >
                                {isPurging ? <ArrowPathIcon className="w-5 h-5 animate-spin text-amber-600" /> : <ServerIcon className="w-5 h-5 text-amber-600" />}
                                <span className="text-[10px] font-bold uppercase tracking-wide">Purgar Sockets</span>
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
                            Se eliminarán TODOS los registros de ventas para el período {deleteMonth}/{deleteYear}. Esta acción es irreversible.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="p-3 bg-red-50 border border-red-100 rounded text-[10px] text-red-800">
                            Para evitar errores, escribe la palabra: <span className="font-black">BORRAR</span>
                        </div>
                        <Input
                            value={deleteConfirmation}
                            onChange={(e) => setDeleteConfirmation(e.target.value)}
                            className="uppercase font-mono text-xs tracking-wider"
                            placeholder="ESCRIBE AQUÍ"
                        />
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDeleteDialog(false)} className="text-xs font-bold uppercase tracking-widest">Cancelar</Button>
                        <Button
                            variant="destructive"
                            onClick={handleBatchDelete}
                            disabled={isDeleting || deleteConfirmation.toUpperCase() !== 'BORRAR'}
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
                            {isGlobalLocked ? 'Desactivar Bloqueo de Sistema' : 'Activar Bloqueo de Sistema'}
                        </DialogTitle>
                        <DialogDescription className="text-slate-600 text-xs font-medium">
                            {isGlobalLocked
                                ? 'El sistema volverá a estar disponible para todos los usuarios autorizados.'
                                : 'ADVERTENCIA: Todos los usuarios (excepto Super Admins) verán una pantalla de mantenimiento y no podrán operar.'}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowLockDialog(false)} className="text-xs font-bold uppercase tracking-widest">Atrás</Button>
                        <Button
                            className={`text-xs font-bold uppercase tracking-widest ${!isGlobalLocked ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}`}
                            onClick={handleToggleLock}
                            disabled={isTogglingLock}
                        >
                            {isTogglingLock ? 'Cambiando...' : (isGlobalLocked ? 'Restaurar Sistema' : 'Confirmar Bloqueo')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}
