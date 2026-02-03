import React, { useState, useEffect } from 'react';
import { fetchFromAPI } from '@/lib/api';
import { usePermission } from '@/hooks/usePermission';
import {
    UserMinusIcon,
    FlagIcon,
    InformationCircleIcon,
    ChevronRightIcon,
    FireIcon
} from '@heroicons/react/24/solid';
import { Trophy } from 'lucide-react';
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface LeaderboardEntry {
    rank: number;
    user_id: string;
    full_name: string;
    points: number;
    sales_count: number;
    is_disqualified: boolean;
    disqualification_reason?: string;
}

interface LeaderboardData {
    tournament_id: string;
    tournament_name: string;
    entries: LeaderboardEntry[];
}

export const TournamentLeaderboard = () => {
    const [data, setData] = useState<LeaderboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTournamentId, setActiveTournamentId] = useState<string | null>(null);
    const { user } = useAuth();
    const { can, isLoading: permsLoading } = usePermission();
    const { toast } = useToast();

    // HARD GUARD: Only render if user is authenticated and not loading permissions
    if (!user || permsLoading) return null;

    const canManageTournaments = can?.('tournaments', 'manage');

    const loadTournaments = async () => {
        try {
            const list = await fetchFromAPI('/api/v1/tournaments/');
            if (list && list.length > 0) {
                setActiveTournamentId(list[0].id);
            } else {
                setLoading(false);
            }
        } catch (error) {
            console.error("Error loading tournaments:", error);
            setLoading(false);
        }
    };

    const loadLeaderboard = async () => {
        if (!activeTournamentId) return;
        setLoading(true);
        try {
            const lb = await fetchFromAPI(`/api/v1/tournaments/${activeTournamentId}/leaderboard`);
            setData(lb);
        } catch (error) {
            console.error("Error loading leaderboard:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDisqualify = async (userId: string, name: string) => {
        const reason = window.prompt(`Razón de descalificación para ${name}:`);
        if (!reason) return;

        try {
            await fetchFromAPI(`/api/v1/tournaments/${activeTournamentId}/disqualify/${userId}`, {
                method: 'POST',
                body: JSON.stringify({ reason })
            });
            toast({
                title: "Agente descalificado",
                description: `${name} ha sido retirado de la competencia.`,
            });
            loadLeaderboard();
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Error",
                description: error.message || "No se pudo descalificar al agente.",
            });
        }
    };

    useEffect(() => {
        loadTournaments();
    }, []);

    useEffect(() => {
        if (activeTournamentId) {
            loadLeaderboard();
        }
    }, [activeTournamentId]);

    if (!user || permsLoading) return null;
    if (!activeTournamentId && !loading) return null;

    if (loading) {
        return (
            <Card className="border-0 shadow-lg bg-slate-50 overflow-hidden">
                <CardHeader className="bg-indigo-600 p-4">
                    <Skeleton className="h-6 w-1/3 bg-indigo-500/50" />
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </CardContent>
            </Card>
        );
    }

    const podium = data?.entries.filter(e => !e.is_disqualified).slice(0, 3) || [];
    const rest = data?.entries.slice(3) || [];

    return (
        <Card className="border-0 shadow-2xl bg-white overflow-hidden rounded-3xl">
            <CardHeader className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-blue-600 p-5 text-white flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
                        <Trophy className="h-6 w-6 text-yellow-300" />
                    </div>
                    <div>
                        <CardTitle className="text-xl font-black tracking-tighter uppercase leading-none">
                            {data?.tournament_name || 'Torneo Activo'}
                        </CardTitle>
                        <span className="text-[10px] font-bold opacity-80 uppercase tracking-widest">Live Leaderboard</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Badge className="bg-green-500 hover:bg-green-500 text-white border-0 font-bold px-2 py-0">En Curso</Badge>
                </div>
            </CardHeader>

            <CardContent className="p-0">
                {/* Podium Visualization */}
                <div className="grid grid-cols-3 gap-2 px-4 pb-6 pt-10 bg-gradient-to-b from-indigo-50 to-white items-end text-center">
                    {/* Rank 2 */}
                    {podium[1] && (
                        <div className="flex flex-col items-center">
                            <div className="relative group">
                                <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-gray-400 font-black text-2xl group-hover:scale-110 transition-transform">2</div>
                                <div className="h-16 w-16 bg-slate-200 rounded-full border-2 border-slate-300 mb-3 flex items-center justify-center font-black text-slate-500 overflow-hidden shadow-md">
                                    {podium[1].full_name.substring(0, 2).toUpperCase()}
                                </div>
                            </div>
                            <span className="text-[10px] font-bold text-slate-700 truncate w-full px-1">{podium[1].full_name}</span>
                            <span className="text-xs font-black text-slate-900">{podium[1].points} pts</span>
                            <div className="h-16 w-full bg-slate-200 rounded-t-xl mt-2 border-x border-t border-slate-300 shadow-sm"></div>
                        </div>
                    )}

                    {/* Rank 1 */}
                    {podium[0] && (
                        <div className="flex flex-col items-center">
                            <div className="relative group">
                                <div className="absolute -top-10 left-1/2 -translate-x-1/2 group-hover:scale-110 transition-transform">
                                    <FireIcon className="h-10 w-10 text-orange-500 animate-pulse" />
                                </div>
                                <div className="h-20 w-20 bg-yellow-400 rounded-full border-4 border-yellow-200 mb-3 flex items-center justify-center font-black text-white text-xl overflow-hidden shadow-xl ring-4 ring-yellow-400/20">
                                    {podium[0].full_name.substring(0, 2).toUpperCase()}
                                </div>
                            </div>
                            <span className="text-xs font-black text-slate-900 truncate w-full px-1">{podium[0].full_name}</span>
                            <div className="flex items-center gap-1">
                                <span className="text-sm font-black text-indigo-600">{podium[0].points} pts</span>
                            </div>
                            <div className="h-24 w-full bg-yellow-400 rounded-t-xl mt-2 border-x border-t border-yellow-300 shadow-lg relative overflow-hidden">
                                <div className="absolute inset-0 bg-white/10 skew-x-12 translate-x-10"></div>
                            </div>
                        </div>
                    )}

                    {/* Rank 3 */}
                    {podium[2] && (
                        <div className="flex flex-col items-center">
                            <div className="relative group">
                                <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-orange-500 font-black text-2xl group-hover:scale-110 transition-transform">3</div>
                                <div className="h-14 w-14 bg-orange-100 rounded-full border-2 border-orange-200 mb-3 flex items-center justify-center font-black text-orange-600 overflow-hidden shadow-md">
                                    {podium[2].full_name.substring(0, 2).toUpperCase()}
                                </div>
                            </div>
                            <span className="text-[10px] font-bold text-slate-700 truncate w-full px-1">{podium[2].full_name}</span>
                            <span className="text-xs font-black text-slate-900">{podium[2].points} pts</span>
                            <div className="h-12 w-full bg-orange-100 rounded-t-xl mt-2 border-x border-t border-orange-200 shadow-sm"></div>
                        </div>
                    )}
                </div>

                {/* List View */}
                <div className="divide-y divide-slate-100">
                    {data?.entries.map((entry, idx) => (
                        <div
                            key={entry.user_id}
                            className={`flex items-center justify-between p-4 transition-colors ${entry.is_disqualified ? 'bg-slate-50' : 'hover:bg-slate-50 cursor-pointer group'}`}
                        >
                            <div className="flex items-center gap-4 flex-1">
                                <div className={`w-6 text-center font-black text-sm ${idx < 3 ? 'text-indigo-600' : 'text-slate-400'}`}>
                                    {entry.is_disqualified ? '—' : `#${entry.rank}`}
                                </div>
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-xs ${entry.is_disqualified ? 'bg-slate-200 text-slate-400 grayscale' : 'bg-indigo-100 text-indigo-600'}`}>
                                    {entry.full_name.substring(0, 2).toUpperCase()}
                                </div>
                                <div className="flex flex-col overflow-hidden">
                                    <h4 className={`text-xs font-black tracking-tight flex items-center gap-2 ${entry.is_disqualified ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                                        {entry.full_name}
                                        {entry.is_disqualified && (
                                            <Badge variant="outline" className="text-[8px] font-black uppercase text-red-500 border-red-500 px-1 py-0 h-4 min-w-[100px]">FUERA DE COMPETENCIA</Badge>
                                        )}
                                    </h4>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                        {entry.sales_count} Ventas • {entry.points} Puntos Totales
                                    </p>
                                    {entry.is_disqualified && entry.disqualification_reason && (
                                        <p className="text-[9px] text-red-400 italic font-medium mt-0.5 max-w-[200px] truncate">
                                            Motivo: {entry.disqualification_reason}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {!entry.is_disqualified && (
                                    <div className="text-right mr-4 hidden sm:block">
                                        <div className="text-sm font-black text-slate-900">{entry.points}</div>
                                        <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">PTS</div>
                                    </div>
                                )}

                                {canManageTournaments && !entry.is_disqualified && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-full"
                                        onClick={() => handleDisqualify(entry.user_id, entry.full_name)}
                                    >
                                        <UserMinusIcon className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-100">
                    <div className="flex items-start gap-2">
                        <InformationCircleIcon className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                        <p className="text-[9px] text-slate-500 font-medium leading-relaxed italic">
                            Los puntos se calculan automáticamente basados en productos específicos con estatus <b>COMPLETADA</b> o <b>INSTALADA</b>. El Admin se reserva el derecho de descalificación por faltas a la ética.
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
