'use client';

import React, { useState, useEffect } from 'react';
import { fetchFromAPI } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import LoadingState from '@/components/ui/LoadingState';
import {
    Trophy,
    Plus,
    Target,
    Calendar,
    Trash2,
    CheckCircle2,
    AlertCircle,
    Save,
    Filter,
    BarChart3,
    UserCircle,
    Layers,
    ShieldAlert,
    Medal,
    Gavel,
    ChevronRight,
    Search,
    Shield,
    Edit2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import { TournamentRaceTrack } from '@/components/tournaments/TournamentRaceTrack';

interface Tournament {
    id: string;
    name: string;
    description: string;
    start_date: string;
    end_date: string;
    target_points: number;
    points_config: Record<string, number>;
    campaign_id?: string;
    product_family?: string;
    supervisor_id?: string;
    is_active: boolean;
    winner_id?: string;
    winner_name?: string;
    winner_team?: string;
}

interface Campaign {
    id: string;
    name: string;
}

interface User {
    id: string;
    first_name: string;
    last_name: string;
    role: string;
    email: string;
}

interface LeaderboardEntry {
    rank: number;
    user_id: string;
    full_name: string;
    points: number;
    sales_count: number;
    is_disqualified: boolean;
    disqualification_reason?: string;
    is_winner: boolean;
    award_details?: any;
}

const FAMILIES = ['Fibra', 'ADSL', 'Móvil', 'TV', 'Streaming'];

const DEMO_PARTICIPANTS: LeaderboardEntry[] = [
    { rank: 1, user_id: 'demo-1', full_name: "Ana Líder", points: 85, sales_count: 12, is_disqualified: false, is_winner: false },
    { rank: 2, user_id: 'demo-2', full_name: "Carlos Hunter", points: 60, sales_count: 8, is_disqualified: false, is_winner: false },
    { rank: 3, user_id: 'demo-3', full_name: "Pedro Rookie", points: 25, sales_count: 4, is_disqualified: false, is_winner: false }
];

export default function TournamentManagementPage() {
    const { user } = useAuth();
    const { can, isLoading: permsLoading } = usePermission();
    const { toast } = useToast();
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [supervisors, setSupervisors] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [tournamentToEdit, setTournamentToEdit] = useState<Tournament | null>(null);
    const [tournamentToDelete, setTournamentToDelete] = useState<Tournament | null>(null);
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

    // Navigation state
    const [activeTab, setActiveTab] = useState<'active' | 'history' | 'positions'>('active');
    const [tournamentsData, setTournamentsData] = useState<any[]>([]);
    const [loadingPositions, setLoadingPositions] = useState(false);

    // Arbitration state
    const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [isArbitrating, setIsArbitrating] = useState(false);
    const [loadingLB, setLoadingLB] = useState(false);

    // Form states
    const [newName, setNewName] = useState('');
    const [newTarget, setNewTarget] = useState(100);
    const [newStartDate, setNewStartDate] = useState('');
    const [newEndDate, setNewEndDate] = useState('');
    const [selCampaign, setSelCampaign] = useState('');
    const [selSupervisor, setSelSupervisor] = useState('');
    const [selFamily, setSelFamily] = useState('');
    const [pointsConfig, setPointsConfig] = useState<Record<string, number>>({});
    const [campaignFamilies, setCampaignFamilies] = useState<string[]>([]);

    useEffect(() => { loadData(); }, []);

    useEffect(() => {
        if (activeTab === 'positions') {
            loadTournamentsData();
            const interval = setInterval(loadTournamentsData, 30000); // 30s refresh
            return () => clearInterval(interval);
        }
    }, [activeTab]);

    const loadTournamentsData = async () => {
        if (tournaments.length === 0) return;
        setLoadingPositions(true);
        try {
            const activeTourns = tournaments.filter(t => t.is_active);
            const dataWithLB = await Promise.all(activeTourns.map(async (t) => {
                try {
                    const lb = await fetchFromAPI(`/api/v1/tournaments/${t.id}/leaderboard`);
                    return {
                        tournament: t,
                        leaderboard: lb?.entries || []
                    };
                } catch (lbErr) {
                    return { tournament: t, leaderboard: [] };
                }
            }));
            setTournamentsData(dataWithLB);
        } catch (err) {
            console.error("Error loading tournament positions:", err);
        } finally {
            setLoadingPositions(false);
        }
    };

    const loadData = async () => {
        try {
            const [tData, cData, uData] = await Promise.all([
                fetchFromAPI('/api/v1/tournaments/'),
                fetchFromAPI('/api/v1/campaigns/'),
                fetchFromAPI('/api/v1/users/?role=supervisor&size=100')
            ]);
            setTournaments(tData || []);
            setCampaigns(cData || []);
            setSupervisors(uData?.items || []);
        } catch (err) {
            console.error("Error loading tournament center data:", err);
        } finally {
            setLoading(false);
        }
    };

    const loadCampaignProducts = async (campaignId: string) => {
        try {
            const families = await fetchFromAPI(`/api/v1/products/families?campaign_id=${campaignId}`);
            setCampaignFamilies(families || []);
            const initialPoints: Record<string, number> = {};
            families?.forEach((f: string) => initialPoints[f] = 10);
            setPointsConfig(initialPoints);
        } catch (err) {
            console.error("Error loading campaign families:", err);
        }
    };

    const loadLeaderboard = async (t: Tournament) => {
        setLoadingLB(true);
        try {
            const data = await fetchFromAPI(`/api/v1/tournaments/${t.id}/leaderboard`);
            const entries = data.entries || [];
            setLeaderboard(entries);

            setSelectedTournament(t);
            setIsArbitrating(true);
        } catch (err) {
            // No fallback in production if error
            toast({
                title: "Error",
                description: "No se pudieron cargar los datos reales del torneo.",
                variant: "destructive"
            });
        } finally {
            setLoadingLB(false);
        }
    };

    const handleAction = async (type: 'award' | 'disqualify', agentId: string) => {
        if (!selectedTournament) return;

        const endpoint = type === 'award'
            ? `/api/v1/tournaments/${selectedTournament.id}/award/${agentId}?award_name=CAMPEÓN&award_value=0`
            : `/api/v1/tournaments/${selectedTournament.id}/disqualify/${agentId}?reason=Incumplimiento de Calidad`;

        try {
            await fetchFromAPI(endpoint, { method: 'POST' });

            if (type === 'award') {
                toast({
                    title: "🏆 Torneo Finalizado",
                    description: "La competencia se ha cerrado oficialmente y se ha movido al historial."
                });
                setIsArbitrating(false);
                loadData(); // Refrescar lista completa para mover a historial
            } else {
                toast({
                    title: "Agente Descalificado",
                    description: "El estado del agente ha sido actualizado en tiempo real."
                });
                loadLeaderboard(selectedTournament);
            }
        } catch (err) {
            toast({
                title: "Error de Arbitraje",
                description: "No se pudo procesar la acción. Verifica tus permisos o la conexión.",
                variant: "destructive"
            });
        }
    };

    const resetForm = () => {
        setNewName('');
        setNewTarget(100);
        setNewStartDate('');
        setNewEndDate('');
        setSelCampaign('');
        setSelSupervisor('');
        setSelFamily('');
        setPointsConfig({});
        setIsCreating(false);
        setIsEditing(false);
        setTournamentToEdit(null);
    };

    const openEdit = (t: Tournament) => {
        setTournamentToEdit(t);
        setNewName(t.name);
        setNewTarget(t.target_points);
        setNewStartDate(new Date(t.start_date).toISOString().slice(0, 16));
        setNewEndDate(new Date(t.end_date).toISOString().slice(0, 16));
        setSelCampaign(t.campaign_id || '');
        setSelSupervisor(t.supervisor_id || '');
        setSelFamily(t.product_family || '');
        setPointsConfig(t.points_config || {});
        setIsEditing(true);
    };

    const handleDelete = async () => {
        if (!tournamentToDelete) return;
        try {
            await fetchFromAPI(`/api/v1/tournaments/${tournamentToDelete.id}`, { method: 'DELETE' });
            toast({ title: "Torneo Eliminado", description: "La competencia ha sido removida permanentemente." });
            loadData();
            setIsConfirmingDelete(false);
            setTournamentToDelete(null);
        } catch (err) {
            toast({ title: "Error", description: "No tienes permisos para eliminar torneos.", variant: "destructive" });
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                name: newName,
                start_date: newStartDate,
                end_date: newEndDate,
                target_points: newTarget,
                campaign_id: selCampaign || null,
                supervisor_id: selSupervisor || null,
                product_family: selFamily || null,
                points_config: pointsConfig,
                is_active: true
            };

            const method = isEditing ? 'PUT' : 'POST';
            const url = isEditing ? `/api/v1/tournaments/${tournamentToEdit?.id}` : '/api/v1/tournaments/';

            await fetchFromAPI(url, {
                method,
                body: JSON.stringify(payload)
            });
            toast({
                title: isEditing ? "Torneo Actualizado" : "Torneo Lanzado",
                description: isEditing ? "Los cambios se han guardado exitosamente." : "La batalla ha comenzado."
            });
            resetForm();
            loadData();
        } catch (err) {
            toast({ title: "Error", description: `No se pudo ${isEditing ? 'actualizar' : 'crear'} el torneo.`, variant: "destructive" });
        }
    };

    const updatePoints = (family: string, val: string) => {
        setPointsConfig(prev => ({ ...prev, [family]: parseInt(val) || 0 }));
    };

    if (permsLoading || loading) return <LoadingState message="Configurando Módulo Nexus..." />;
    if (!can('tournaments', 'tournaments', 'view_module')) return <div className="p-20 text-center font-black text-slate-400 uppercase tracking-widest">No tienes permiso para visualizar este módulo. RECURSO: tournaments:view_module</div>;

    return (
        <div className="max-w-[1600px] mx-auto p-4 md:p-8 space-y-8 animate-fade-in">
            {/* Master Synchronization Header - Access Management Style */}
            <header className="flex justify-between items-center mb-10 pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex flex-col">
                    <h1 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight uppercase leading-none">ADMINISTRACIÓN DE COMPETENCIAS</h1>
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1.5">
                        Gestión Centralizada de Batallas y Arbitraje
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    {/* Compact Tab Toggle */}
                    <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl border border-slate-200 dark:border-slate-700/50 mr-4">
                        <button
                            onClick={() => setActiveTab('active')}
                            className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'active' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm border border-slate-200 dark:border-slate-600' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            Activos
                        </button>
                        {can('tournaments', 'tournaments', 'live_positions') && (
                            <button
                                onClick={() => setActiveTab('positions')}
                                className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'positions' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm border border-slate-200 dark:border-slate-600' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                Posiciones
                            </button>
                        )}
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'history' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm border border-slate-200 dark:border-slate-600' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            Historial
                        </button>
                    </div>

                    {can('tournaments', 'tournaments', 'create_battle') && (
                        <Button
                            onClick={() => setIsCreating(true)}
                            className="bg-blue-600 hover:bg-blue-700 text-white h-11 px-8 rounded-xl shadow-lg shadow-blue-500/20 font-black uppercase text-[10px] tracking-widest flex items-center gap-2 transition-all active:scale-95"
                        >
                            <Plus className="w-4 h-4" />
                            NUEVO REGISTRO
                        </Button>
                    )}
                </div>
            </header>

            {/* Compact Create/Edit Modal - Master Rectification */}
            <Dialog open={isCreating || isEditing} onOpenChange={(open) => !open && resetForm()}>
                <DialogContent className="max-w-[800px] max-h-[80vh] overflow-hidden rounded-[1.25rem] p-0 border-[0.5px] border-slate-200 bg-white/95 backdrop-blur-md shadow-2xl animate-in zoom-in-95 duration-300">
                    <DialogHeader className="bg-slate-50/50 py-4 px-8 border-b border-slate-100 shrink-0">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-5">
                                <div className="w-10 h-10 bg-indigo-500/10 rounded-lg flex items-center justify-center border border-indigo-500/20 shadow-inner">
                                    <Target className="w-5 h-5 text-indigo-600" />
                                </div>
                                <div>
                                    <DialogTitle className="text-slate-900 text-xl font-black uppercase tracking-tighter leading-none">
                                        {isEditing ? 'Configuración de Batalla' : 'Lanzar Nueva Batalla'}
                                    </DialogTitle>
                                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.3em] mt-1.5 flex items-center gap-2">
                                        <span className="w-1 h-1 rounded-full bg-indigo-500/50 animate-pulse" />
                                        Nexus Strategy OS · Phase Alpha Protocol
                                    </p>
                                </div>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <CardContent className="py-6 px-8 bg-transparent">
                            <form onSubmit={handleCreate} className="space-y-6">
                                <div className="grid grid-cols-2 gap-8">
                                    {/* Left Section: Core Rules */}
                                    <div className="space-y-6">
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-2 mb-1">
                                                <div className="h-3 w-1 bg-indigo-500 rounded-full" />
                                                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Identificadores Operativos</h3>
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1 ml-0.5">
                                                    Nombre de la Competencia
                                                </label>
                                                <input value={newName} onChange={e => setNewName(e.target.value)} className="w-full bg-white border border-slate-300 rounded-lg h-10 px-4 text-slate-900 font-bold outline-none focus:border-indigo-500/50 transition-all text-xs" required />
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1 ml-0.5">Meta Objetivos (PTS)</label>
                                                    <input type="number" value={newTarget} onChange={e => setNewTarget(parseInt(e.target.value))} className="w-full bg-white border border-slate-300 rounded-lg h-10 px-4 text-slate-900 font-bold outline-none focus:border-indigo-500/50 transition-all text-xs" required />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1 ml-0.5">Campaña Asignada</label>
                                                    <div className="relative">
                                                        <select value={selCampaign} onChange={e => setSelCampaign(e.target.value)} className="w-full h-10 bg-white border border-slate-300 rounded-lg px-4 text-slate-900 font-bold outline-none text-[10px] uppercase appearance-none cursor-pointer focus:border-indigo-500/50 transition-all">
                                                            <option value="">Todas</option>
                                                            {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                        </select>
                                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                                            <ChevronRight className="w-3.5 h-3.5 rotate-90" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1 ml-0.5">Fecha inicio</label>
                                                    <input type="datetime-local" value={newStartDate} onChange={e => setNewStartDate(e.target.value)} className="w-full bg-white border border-slate-300 rounded-lg h-10 px-4 text-slate-900 font-bold outline-none focus:border-indigo-500/50 transition-all text-[10px]" required />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1 ml-0.5">Fecha cierre</label>
                                                    <input type="datetime-local" value={newEndDate} onChange={e => setNewEndDate(e.target.value)} className="w-full bg-white border border-slate-300 rounded-lg h-10 px-4 text-slate-900 font-bold outline-none focus:border-indigo-500/50 transition-all text-[10px]" required />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Section: Alpha Matrix */}
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="h-3 w-1 bg-amber-500 rounded-full" />
                                            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Matriz de Distribución de puntos</h3>
                                        </div>

                                        <div className="grid grid-cols-1 gap-2 max-h-[350px] overflow-y-auto custom-scrollbar pr-1">
                                            {campaignFamilies.length > 0 ? (
                                                <>
                                                    {campaignFamilies.map(f => (
                                                        <div key={f} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200 hover:border-slate-300 transition-all group">
                                                            <div className="flex items-center gap-2.5">
                                                                <div className="w-1 h-1 rounded-full bg-amber-500/30 group-hover:bg-amber-500 transition-colors" />
                                                                <span className="text-[10px] font-bold uppercase tracking-tight text-slate-600 group-hover:text-slate-900 transition-colors">{f}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <input type="number" value={pointsConfig[f] || 0} onChange={e => updatePoints(f, e.target.value)} className="bg-white border border-slate-300 rounded outline-none font-bold text-[11px] text-slate-900 w-10 h-8 text-center focus:border-amber-500/50 transition-all" />
                                                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">PTS</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </>
                                            ) : (
                                                <div className="py-16 text-center border border-dashed border-slate-200 rounded-lg">
                                                    <Layers className="w-5 h-5 text-slate-300 mx-auto mb-3" />
                                                    <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">Mapeo de Campaña Requerido</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                                    <Button type="button" variant="ghost" onClick={resetForm} className="h-9 px-4 rounded-lg font-bold uppercase text-[10px] tracking-widest transition-all hover:bg-slate-50 text-slate-500">Cancelar</Button>
                                    <Button className="bg-indigo-600 hover:bg-indigo-700 h-9 px-6 rounded-lg font-bold uppercase text-[10px] tracking-widest text-white shadow-lg shadow-indigo-500/20 active:scale-95 transition-all outline-none">
                                        {isEditing ? 'Guardar cambios' : 'Lanzar Batalla'}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Conditional Views: Active vs History */}
            <AnimatePresence mode="wait">
                {activeTab === 'active' ? (
                    <motion.div
                        key="active-list"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="space-y-6"
                    >
                        <div className="flex justify-between items-end">
                            <h3 className="text-base font-medium text-slate-900 dark:text-white uppercase tracking-tighter flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                                Competencias de Alto Rendimiento
                            </h3>
                        </div>

                        <div className="flex flex-col gap-5">
                            {tournaments.filter(t => t.is_active).map(t => {
                                const now = new Date();
                                const startDate = new Date(t.start_date);
                                const endDate = new Date(t.end_date);
                                const isActive = now >= startDate && now <= endDate;

                                return (
                                    <div key={t.id} className="group bg-white dark:bg-slate-900 rounded-[1.25rem] p-5 px-8 border border-slate-100 dark:border-slate-800/50 shadow-[inset_0_1px_2px_rgba(255,255,255,0.8),0_10px_50px_rgba(0,0,0,0.03)] hover:shadow-[0_20px_70px_rgba(0,0,0,0.08),0_0_0_1px_rgba(59,130,246,0.1)] hover:-translate-y-1.5 transition-all duration-500 flex items-center justify-between relative overflow-hidden">
                                        <div className="flex items-center gap-10 flex-1 relative z-10 pl-2">
                                            <div className="w-14 h-14 bg-indigo-50/30 dark:bg-indigo-500/5 rounded-2xl flex items-center justify-center border border-indigo-100/50 dark:border-indigo-500/10 shadow-inner group-hover:scale-110 transition-transform duration-500">
                                                <Trophy className="w-7 h-7 text-indigo-500/80" />
                                            </div>
                                            <div className="flex flex-col gap-3">
                                                <div className="flex items-center justify-between border-b border-slate-50 dark:border-slate-800/50 pb-2 mb-1">
                                                    <div className="flex items-center gap-3">
                                                        <h4 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight leading-none">{t.name}</h4>
                                                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-50 dark:bg-slate-800/40 rounded-full border border-slate-100 dark:border-slate-700/50">
                                                            <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-300'}`} />
                                                            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{isActive ? 'En Curso' : 'Programado'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-start gap-8">
                                                    <div className="flex flex-col">
                                                        <span className="text-[12px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 leading-none flex items-center gap-2">
                                                            <Target className="w-4 h-4 text-indigo-400" />
                                                            Puntos Objetivo
                                                        </span>
                                                        <div className="w-fit px-3 py-1.5 bg-indigo-50/50 dark:bg-indigo-500/5 rounded-xl border border-indigo-100/50 dark:border-indigo-500/10">
                                                            <span className="text-base font-black text-indigo-600 dark:text-indigo-400 leading-none">{t.target_points} PTS</span>
                                                        </div>
                                                    </div>
                                                    <div className="w-px h-10 bg-gradient-to-b from-transparent via-slate-100 dark:via-slate-800 to-transparent self-center" />
                                                    <div className="flex flex-col">
                                                        <span className="text-[12px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 leading-none flex items-center gap-2">
                                                            <Calendar className="w-4 h-4 text-indigo-400" />
                                                            Cronograma
                                                        </span>
                                                        <div className="flex flex-col gap-1.5">
                                                            <div className="flex items-center gap-4 text-xs text-slate-400 dark:text-slate-500 leading-none">
                                                                <span className="w-32 font-medium">Fecha inicio:</span>
                                                                <span className="text-slate-900 dark:text-slate-200">{new Date(t.start_date).toLocaleDateString()}</span>
                                                            </div>
                                                            <div className="flex items-center gap-4 text-xs text-slate-400 dark:text-slate-500 leading-none">
                                                                <span className="w-32 font-medium">Fecha finalización:</span>
                                                                <span className="text-slate-900 dark:text-slate-200">{new Date(t.end_date).toLocaleDateString()}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {t.product_family && (
                                                        <>
                                                            <div className="w-px h-10 bg-gradient-to-b from-transparent via-slate-100 dark:via-slate-800 to-transparent self-center" />
                                                            <div className="flex flex-col">
                                                                <span className="text-[12px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 leading-none flex items-center gap-2">
                                                                    <Layers className="w-4 h-4 text-indigo-400" />
                                                                    Segmento Operativo
                                                                </span>
                                                                <div className="w-fit px-3 py-1.5 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl border border-slate-100/50 dark:border-slate-700/50">
                                                                    <span className="text-sm font-black text-slate-800 dark:text-slate-200 leading-none">{t.product_family}</span>
                                                                </div>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-6 relative z-10 pr-2">
                                            {can('tournaments', 'tournaments', 'arbitration_panel') && (
                                                <Button
                                                    onClick={() => loadLeaderboard(t)}
                                                    className="h-10 px-6 bg-gradient-to-br from-sky-400 to-sky-500 hover:from-sky-500 hover:to-sky-600 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all group shadow-lg shadow-sky-400/20 border border-white/10 ring-1 ring-inset ring-white/10 active:scale-95 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)]"
                                                >
                                                    <Gavel className="w-3.5 h-3.5 mr-2 text-white group-hover:rotate-12 transition-transform drop-shadow-[0_1px_2px_rgba(0,0,0,0.1)]" />
                                                    Arbitraje
                                                </Button>
                                            )}

                                            <div className="flex items-center gap-1 border-l border-slate-100 dark:border-slate-800/50 pl-4 ml-2">
                                                {can('tournaments', 'tournaments', 'edit') && (
                                                    <button
                                                        title="Editar"
                                                        onClick={() => openEdit(t)}
                                                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-all"
                                                    >
                                                        <Edit2 className="w-5 h-5" />
                                                    </button>
                                                )}
                                                {can('tournaments', 'tournaments', 'delete') && (
                                                    <button
                                                        title="Eliminar"
                                                        onClick={() => {
                                                            setTournamentToDelete(t);
                                                            setIsConfirmingDelete(true);
                                                        }}
                                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all"
                                                    >
                                                        <Trash2 className="w-5 h-5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>
                ) : activeTab === 'positions' ? (
                    <motion.div
                        key="positions-list"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="space-y-6"
                    >
                        {loadingPositions && tournamentsData.length === 0 ? (
                            <div className="py-20 flex flex-col items-center justify-center gap-4">
                                <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sincronizando Marcadores...</p>
                            </div>
                        ) : tournamentsData.length > 0 ? (
                            <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-8 pb-20">
                                {tournamentsData.map((tData) => (
                                    <div key={tData.tournament.id} className="animate-in fade-in zoom-in-95 duration-500">
                                        <TournamentRaceTrack
                                            tournamentName={tData.tournament.name}
                                            participants={tData.leaderboard}
                                            targetPoints={tData.tournament.target_points}
                                        />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-24 text-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-[2rem] bg-slate-50/30 dark:bg-slate-900/10">
                                <Trophy className="w-12 h-12 text-slate-200 dark:text-slate-800 mx-auto mb-4" />
                                <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.3em]">No hay competencias activas en curso</h3>
                            </div>
                        )}
                    </motion.div>
                ) : (
                    <motion.div
                        key="history-list"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm pt-2"
                    >
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-50 dark:border-slate-800/50">
                                    <th className="py-5 px-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha Cierre</th>
                                    <th className="py-5 px-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Competencia</th>
                                    <th className="py-5 px-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">🎖️ Ganador</th>
                                    <th className="py-5 px-8 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Puntos Totales</th>
                                    <th className="py-5 px-8 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                {tournaments.filter(t => !t.is_active).length > 0 ? (
                                    tournaments.filter(t => !t.is_active).map(t => (
                                        <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all">
                                            <td className="py-4 px-8 text-[11px] font-bold text-slate-500 uppercase">
                                                {new Date(t.end_date).toLocaleDateString()}
                                            </td>
                                            <td className="py-4 px-8">
                                                <span className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">{t.name}</span>
                                            </td>
                                            <td className="py-4 px-8">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 flex items-center justify-center">
                                                        <Trophy className="w-4 h-4 text-amber-500" />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[11px] font-black text-slate-900 dark:text-white uppercase">{t.winner_name || "Ana Líder"}</span>
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{t.winner_team || "Nexus Team Elite"}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-4 px-8 text-right font-black text-indigo-600 dark:text-indigo-400 text-sm">
                                                {t.target_points} PTS
                                            </td>
                                            <td className="py-4 px-8 text-right">
                                                <Badge variant="outline" className="bg-slate-50 dark:bg-slate-800 text-slate-400 border-slate-100 dark:border-slate-700 text-[9px] font-black uppercase tracking-widest py-1 px-3">
                                                    Finalizado
                                                </Badge>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="py-20 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                                            No hay registros históricos disponibles
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Delete Confirmation Dialog */}
            <Dialog open={isConfirmingDelete} onOpenChange={setIsConfirmingDelete}>
                <DialogContent className="max-w-md p-0 border-0 bg-white dark:bg-slate-930 rounded-[2rem] overflow-hidden shadow-4xl">
                    <div className="p-8 space-y-6">
                        <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center border border-red-500/20 mx-auto">
                            <Trash2 className="w-8 h-8 text-red-500" />
                        </div>
                        <div className="text-center space-y-2">
                            <DialogTitle className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                                Confirmar Eliminación
                            </DialogTitle>
                            <p className="text-sm text-slate-500 font-bold leading-relaxed uppercase tracking-wide">
                                ¿Estás seguro de que deseas eliminar <span className="text-red-500">"{tournamentToDelete?.name}"</span>?
                            </p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed mt-4">
                                Esta acción es irreversible y eliminará todos los registros de participación y puntos asociados a esta competencia.
                            </p>
                        </div>
                    </div>
                    <div className="p-6 bg-slate-50 dark:bg-slate-950/50 flex gap-4">
                        <Button
                            variant="ghost"
                            className="flex-1 h-12 rounded-xl font-black uppercase text-[10px] tracking-widest text-slate-500"
                            onClick={() => setIsConfirmingDelete(false)}
                        >
                            Cancelar Protocolo
                        </Button>
                        <Button
                            className="flex-1 h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black uppercase text-[10px] tracking-widest shadow-xl shadow-red-500/20"
                            onClick={handleDelete}
                        >
                            Sí, Eliminar Torneo
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Arbitration Dialog - Nexus Elite Redesign */}
            <Dialog open={isArbitrating} onOpenChange={setIsArbitrating}>
                <DialogContent className="max-w-[850px] p-0 border-[0.5px] border-slate-200 bg-white/95 backdrop-blur-md rounded-[1.5rem] overflow-hidden shadow-4xl animate-in zoom-in-95 duration-300">
                    <DialogHeader className="bg-slate-50/50 p-6 px-8 flex flex-row items-center justify-between border-b border-slate-100 shrink-0">
                        <div className="flex items-center gap-5">
                            <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center border border-indigo-500/20 shadow-inner">
                                <Gavel className="w-6 h-6 text-indigo-600" />
                            </div>
                            <div>
                                <DialogTitle className="text-slate-900 text-xl font-black uppercase tracking-tighter leading-none">Arbitraje por competencia</DialogTitle>
                                <p className="text-slate-500 text-[9px] font-bold uppercase tracking-[0.3em] mt-1.5 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                                    Competencia: <span className="text-indigo-600">{selectedTournament?.name}</span>
                                </p>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-100 shadow-sm">
                                <tr>
                                    <th className="py-3.5 px-8 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Agente</th>
                                    <th className="py-3.5 px-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Desempeño</th>
                                    <th className="py-3.5 px-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Estado</th>
                                    <th className="py-3.5 px-8 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {leaderboard.map(entry => {
                                    const progress = Math.min((entry.points / (selectedTournament?.target_points || 100)) * 100, 100);
                                    return (
                                        <tr key={entry.user_id} className="group hover:bg-slate-50 transition-all duration-200">
                                            <td className="py-4 px-8">
                                                <div className="flex items-center gap-3.5">
                                                    <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center font-black text-xs text-indigo-600 border border-slate-200 shadow-sm group-hover:scale-105 transition-transform overflow-hidden relative">
                                                        {entry.full_name.substring(0, 2).toUpperCase()}
                                                        <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 to-transparent pointer-events-none" />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-bold text-slate-900 uppercase tracking-tight">{entry.full_name}</span>
                                                        <span className="text-[9px] font-medium text-slate-400 uppercase tracking-tighter mt-0.5">Operativo Alpha</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-4 px-6">
                                                <div className="w-full max-w-[180px]">
                                                    <div className="flex justify-between items-end mb-1.5">
                                                        <span className="text-[10px] font-bold text-indigo-600 tracking-tighter">{entry.points} PTS</span>
                                                        <span className="text-[9px] font-medium text-slate-400 uppercase">{Math.round(progress)}%</span>
                                                    </div>
                                                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden p-0">
                                                        <motion.div
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${progress}%` }}
                                                            className={`h-full rounded-full ${entry.is_disqualified ? 'bg-slate-300' : 'bg-indigo-500'} transition-all`}
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-4 px-6">
                                                {entry.is_disqualified ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-50 border border-orange-100 text-orange-600 text-[9px] font-bold uppercase tracking-widest">
                                                        <AlertCircle className="w-3 h-3" />
                                                        Sancionado
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600 text-[9px] font-bold uppercase tracking-widest">
                                                        <CheckCircle2 className="w-3 h-3" />
                                                        Activo
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-4 px-8 text-right">
                                                <div className="flex justify-end gap-2.5">
                                                    {!entry.is_disqualified ? (
                                                        <>
                                                            <Button
                                                                onClick={() => handleAction('award', entry.user_id)}
                                                                className="h-8 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[9px] uppercase tracking-widest rounded-lg transition-all shadow-sm flex items-center gap-2"
                                                            >
                                                                <Trophy className="w-3 h-3" />
                                                                Premiar
                                                            </Button>
                                                            <Button
                                                                onClick={() => handleAction('disqualify', entry.user_id)}
                                                                className="h-8 px-3.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[9px] uppercase tracking-widest rounded-lg transition-all shadow-sm flex items-center gap-2"
                                                            >
                                                                <AlertCircle className="w-3 h-3" />
                                                                Sancionar
                                                            </Button>
                                                        </>
                                                    ) : (
                                                        <span className="text-slate-300 font-bold text-[9px] uppercase tracking-widest px-2 py-1">Sin acciones</span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </DialogContent>
            </Dialog>
        </div >
    );
}
