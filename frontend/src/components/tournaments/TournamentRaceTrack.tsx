import { motion } from 'framer-motion';
import { Flag, Crown, Target } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';

interface Participant {
    id: string | number;
    name: string;
    full_name?: string;
    points: number;
    rank?: number;
    campaign?: string;
}

const DEMO_PARTICIPANTS: Participant[] = [
    { id: 'demo-1', name: "Ana Líder", points: 85, rank: 1, campaign: "Nexus Strategy Alpha" },
    { id: 'demo-2', name: "Carlos Hunter", points: 60, rank: 2, campaign: "Nexus Strategy Alpha" },
    { id: 'demo-3', name: "Pedro Rookie", points: 25, rank: 3, campaign: "Nexus Strategy Alpha" }
];

const getInitials = (name: string) => {
    return name.split(' ')
        .map(n => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase();
};

export const TournamentRaceTrack = ({
    tournamentName = "Competencia Activa",
    participants = [],
    targetPoints = 100
}: {
    tournamentName?: string,
    participants?: Participant[],
    targetPoints?: number
}) => {
    // Inject demo data if no participants are provided
    const displayParticipants = [...participants].sort((a, b) => b.points - a.points);

    const leaderProgress = displayParticipants.length > 0
        ? Math.min((displayParticipants[0].points / targetPoints) * 100, 100)
        : 0;

    // Traffic Light Logic for Compliance
    const getComplianceColor = (percent: number) => {
        if (percent < 50) return 'text-red-600';
        if (percent < 90) return 'text-amber-600';
        return 'text-emerald-600';
    };

    return (
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-3 hover:shadow-md transition-all group">
            {/* Header: Tournament Title + Mini-Scoreboard (Unified) */}
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-1 h-4 bg-indigo-500 rounded-full" />
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-tight">{tournamentName}</h3>
                </div>

                {/* Mini-Scoreboard Dashboard Style */}
                <div className="flex items-center gap-2">
                    {/* Meta Badge style pill */}
                    <div className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-[9px] font-medium border border-slate-200 flex items-center gap-1.5">
                        <Target size={10} className="text-slate-400" />
                        <span>META: {targetPoints} PTS</span>
                    </div>

                    {/* Compliance Indicator (Semáforo) */}
                    <div className="px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5">
                        <span className="text-slate-400 font-bold">CUMPLIMIENTO:</span>
                        <span className={getComplianceColor(leaderProgress)}>
                            {Math.round(leaderProgress)}%
                        </span>
                    </div>
                </div>
            </div>

            {/* The Speedway (Single Track Dynamics) */}
            <div className="relative h-12 flex items-center px-4">
                {/* Start Line */}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-slate-200 rounded-full z-0" />

                {/* Track Base */}
                <div className="absolute left-0 right-0 h-4 bg-slate-100 rounded-full border border-slate-200/50 shadow-inner overflow-hidden">
                    {/* Active Progress Filler (Dynamic Filler behind agents) */}
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${leaderProgress}%` }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                        className="h-full bg-gradient-to-r from-blue-400 to-cyan-400 opacity-20 shadow-[0_0_15px_rgba(56,189,248,0.2)]"
                    />
                </div>

                {/* Finish Zone Indicator (Meta clara + Golden Trophy) */}
                <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center h-10">
                    {/* Dashed line boundary */}
                    <div className="h-full border-l-2 border-dashed border-slate-300 mr-3 opacity-40" />
                    <Flag className="text-amber-500 fill-amber-500 drop-shadow-md filter brightness-110" size={28} strokeWidth={2} />
                </div>

                {/* Agent Badges (Overlap logic) */}
                <div className="relative w-full h-full">
                    {displayParticipants.map((agent, index) => {
                        const progress = Math.min((agent.points / targetPoints) * 100, 100);
                        const isLeader = index === 0 && agent.points > 0;
                        const name = agent.full_name || agent.name;
                        const initials = getInitials(name);

                        return (
                            <motion.div
                                key={agent.id}
                                initial={{ left: 0 }}
                                animate={{ left: `${progress}%` }}
                                transition={{ duration: 1.5, ease: "easeOut" }}
                                style={{ zIndex: isLeader ? 50 : 10 + (displayParticipants.length - index) }}
                                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
                            >
                                <Tooltip
                                    content={
                                        <div className="flex flex-col gap-1.5 p-2 text-left min-w-[140px] bg-white border border-slate-200 shadow-xl rounded-lg">
                                            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 mb-1.5">
                                                <span className="font-black text-[12px] uppercase tracking-tighter text-slate-900">{name}</span>
                                                {isLeader && <Crown size={14} className="text-amber-500 fill-amber-500" />}
                                            </div>
                                            <div className="flex justify-between items-center gap-4">
                                                <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Puntos</span>
                                                <span className="text-slate-900 font-black text-[11px]">{agent.points} PTS</span>
                                            </div>
                                            {agent.campaign && (
                                                <div className="flex justify-between items-center gap-4">
                                                    <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Campaña</span>
                                                    <span className="text-slate-900 font-bold text-[10px] truncate max-w-[100px]">{agent.campaign}</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between items-center gap-4">
                                                <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Posición</span>
                                                <span className={`font-black text-[11px] ${isLeader ? 'text-amber-600' : 'text-slate-900'}`}>#{index + 1}</span>
                                            </div>
                                        </div>
                                    }
                                >
                                    <div className={`
                                        w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-md transition-all hover:scale-110 hover:shadow-xl cursor-help border-2
                                        ${isLeader ? 'border-amber-400 ring-2 ring-amber-400/10' : 'border-blue-500'}
                                    `}>
                                        <span className={`text-[11px] font-black ${isLeader ? 'text-amber-600' : 'text-blue-600'} tracking-tighter`}>
                                            {initials}
                                        </span>
                                    </div>
                                </Tooltip>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
