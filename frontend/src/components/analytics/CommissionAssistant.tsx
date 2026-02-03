import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
    TrendingUp,
    Award,
    Target,
    Zap,
    Trophy,
    Star,
    Crown,
    Medal
} from 'lucide-react';
import { fetchFromAPI } from '@/lib/api';

interface CommissionTier {
    name: string;
    min_sales: number;
    commission_rate: number;
    is_current: boolean;
}

interface ProjectionScenario {
    additional_sales: number;
    projected_total_sales: number;
    projected_commission_amount: number;
    incremental_earnings: number;
    new_tier_name: string;
}

interface CommissionProjectionResponse {
    current_sales_count: number;
    current_sales_value: number;
    current_commission_amount: number;
    current_tier: CommissionTier;
    next_tier: CommissionTier | null;
    sales_to_next_tier: number;
    scenarios: ProjectionScenario[];
}

export const CommissionAssistant = () => {
    const [data, setData] = useState<CommissionProjectionResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedScenario, setSelectedScenario] = useState<number>(3); // Default +3

    useEffect(() => {
        const loadProjection = async () => {
            try {
                const res = await fetchFromAPI('/api/v1/analytics/commission-projection');
                setData(res);
            } catch (error) {
                console.error("Error loading commission projection:", error);
            } finally {
                setLoading(false);
            }
        };
        loadProjection();
    }, []);

    if (loading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-48 w-full rounded-2xl" />
            </div>
        );
    }

    if (!data) return null;

    const activeScenario = data.scenarios.find(s => s.additional_sales === selectedScenario);
    const currentCount = data.current_sales_count;
    const nextGoal = data.next_tier?.min_sales || currentCount;
    const progressPercent = Math.min((currentCount / nextGoal) * 100, 100);

    const getTierConfig = (tierName: string) => {
        const name = tierName.toLowerCase();
        if (name.includes('oro') || name.includes('gold')) {
            return {
                icon: <Crown className="h-5 w-5 text-yellow-400" />,
                bg: "from-yellow-500/10 to-amber-600/5",
                text: "text-yellow-600",
                border: "border-yellow-200"
            };
        }
        if (name.includes('plata') || name.includes('silver')) {
            return {
                icon: <Medal className="h-5 w-5 text-slate-400" />,
                bg: "from-slate-200/50 to-slate-300/20",
                text: "text-slate-600",
                border: "border-slate-200"
            };
        }
        return { // Bronze
            icon: <Award className="h-5 w-5 text-orange-400" />,
            bg: "from-orange-100 to-orange-50",
            text: "text-orange-600",
            border: "border-orange-200"
        };
    };

    const currentTierCfg = getTierConfig(data.current_tier.name);

    return (
        <div className="flex flex-col h-full gap-5">
            {/* Header Gamificado - Ultra Compacto */}
            <div className={`px-4 py-3 rounded-xl border ${currentTierCfg.border} bg-gradient-to-br ${currentTierCfg.bg} relative overflow-hidden`}>
                <div className="relative z-10 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-white shadow-sm flex items-center justify-center">
                            {currentTierCfg.icon}
                        </div>
                        <div>
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Rango Actual</h3>
                            <p className={`text-lg font-black uppercase tracking-tighter leading-none ${currentTierCfg.text}`}>
                                {data.current_tier.name}
                            </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-[9px] font-black text-slate-400 uppercase">Comisión</p>
                        <span className="text-lg font-black text-slate-700">
                            {(data.current_tier.commission_rate * 100).toFixed(0)}%
                        </span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 flex-1">
                {/* Progress Card */}
                <Card className="bg-slate-50/50 border-slate-100 shadow-sm rounded-xl overflow-hidden flex flex-col">
                    <CardContent className="p-5 flex-1 flex flex-col justify-center space-y-4">
                        <div className="flex justify-between items-center text-center">
                            <div className="space-y-0.5 flex-1">
                                <p className="text-[9px] font-black text-slate-400 uppercase">Ventas Logradas</p>
                                <p className="text-4xl font-black text-[#072D44] tabular-nums leading-none">{currentCount}</p>
                            </div>
                            {data.next_tier && (
                                <div className="flex-1 border-l border-slate-200 py-1 space-y-0.5">
                                    <p className="text-[9px] font-black text-slate-400 uppercase">Siguiente Meta</p>
                                    <p className="text-lg font-black text-indigo-600 uppercase tracking-tighter leading-none">{data.next_tier.name}</p>
                                    <p className="text-[10px] font-bold text-slate-400">{data.next_tier.min_sales} VENTAS</p>
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Progress value={progressPercent} className="h-2.5 bg-slate-200 rounded-full" indicatorClassName="bg-indigo-600" />
                            {data.next_tier && (
                                <p className="text-[10px] font-bold text-center text-slate-500 uppercase tracking-widest">
                                    🚀 Faltan <span className="text-indigo-600 font-black">{data.sales_to_next_tier} ventas</span>
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Simulation Section */}
                <Card className="bg-slate-900 border-0 shadow-xl rounded-xl overflow-hidden flex flex-col">
                    <CardContent className="p-5 flex-1 flex flex-col space-y-4">
                        <div className="flex gap-1 justify-between">
                            {[1, 3, 5, 7, 10].map((num) => (
                                <button
                                    key={num}
                                    onClick={() => setSelectedScenario(num)}
                                    className={`flex-1 py-2 rounded-lg text-[11px] font-bold transition-all border-2 active:scale-95 ${selectedScenario === num
                                        ? "bg-emerald-400 border-emerald-400 text-slate-950 shadow-[0_0_15px_rgba(52,211,153,0.5)]"
                                        : "bg-slate-800 border-slate-700 text-white hover:border-slate-500"
                                        }`}
                                >
                                    +{num}
                                </button>
                            ))}
                        </div>

                        {activeScenario && (
                            <div className="flex-1 flex flex-col items-center justify-center text-center">
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Ganancia Extra Proyectada</p>
                                <div className="text-5xl font-black text-[#22c55e] flex items-center justify-center tracking-tighter leading-none mb-3">
                                    +${activeScenario.incremental_earnings.toLocaleString()}
                                </div>

                                <div className={`px-4 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border ${activeScenario.new_tier_name !== data.current_tier.name
                                    ? 'bg-yellow-500 text-white border-yellow-400 shadow-lg shadow-yellow-500/20'
                                    : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                                    {activeScenario.new_tier_name !== data.current_tier.name ? (
                                        <><Trophy className="h-3 w-3" /> UPGRADE: {activeScenario.new_tier_name}</>
                                    ) : (
                                        "🎯 MANTENER EL RITMO"
                                    )}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Strategy Footer */}
            <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100 flex items-center justify-center mt-6">
                <p className="text-xs text-slate-600 text-center leading-tight">
                    💡 <span className="font-bold text-slate-800 uppercase text-[10px]">Estrategia Pro:</span> Tu promedio actual es de <span className="font-black text-blue-600">${data.current_sales_count > 0 ? (data.current_sales_value / data.current_sales_count).toFixed(0) : "0"}</span>. ¡Estás a solo una venta de activar tu próximo nivel de bonos! Cada cierre hoy no es solo una venta, es dinero directo a tu bolsillo. ¡Ve por ello!
                </p>
            </div>
        </div>
    );
};
