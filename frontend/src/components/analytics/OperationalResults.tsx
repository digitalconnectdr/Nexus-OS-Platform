import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Users, Layers, TrendingUp, AlertCircle } from 'lucide-react';

export default function OperationalResults({ month }: { month: string }) {
    const [view, setView] = useState<'supervisor' | 'campaign'>('supervisor');
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Función de carga blindada
    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            // Llamada directa al nuevo endpoint
            const res = await api.getOperationalResults(month, view);
            setData(res);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, [month, view]);

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-20 space-y-4 animate-pulse">
            <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-blue-500" />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Calculando Resultados Operacionales V2...</p>
        </div>
    );

    if (error) return (
        <div className="p-10 bg-rose-50 border border-rose-100 rounded-[32px] flex flex-col items-center text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-rose-600" />
            <h3 className="text-rose-900 font-black uppercase text-xs tracking-widest">Error en Procesamiento</h3>
            <p className="text-rose-600 font-bold text-[11px] max-w-xs">{error}</p>
        </div>
    );

    const list = view === 'supervisor' ? data?.supervisors : data?.campaigns_view;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* HEADER & TABS */}
            <div className="flex justify-between items-center bg-white p-4 rounded-[28px] shadow-sm border border-slate-200">
                <div className="flex space-x-2 bg-slate-100/50 p-1.5 rounded-2xl">
                    <button
                        onClick={() => setView('supervisor')}
                        className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${view === 'supervisor' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <Users className="w-4 h-4" /> Supervisores
                    </button>
                    <button
                        onClick={() => setView('campaign')}
                        className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${view === 'campaign' ? 'bg-white shadow-sm text-purple-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <Layers className="w-4 h-4" /> Campañas
                    </button>
                </div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-4">
                    {list?.length || 0} registros encontrados
                </div>
            </div>

            {/* TABLA DE RESULTADOS */}
            <div className="bg-white rounded-[32px] shadow-sm overflow-hidden border border-slate-200">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50/50 text-slate-400 font-black text-[10px] uppercase tracking-widest border-b border-slate-100">
                        <tr>
                            <th className="px-8 py-5">{view === 'supervisor' ? 'Agente / Supervisor' : 'Campaña'}</th>
                            <th className="px-8 py-5 text-right">Meta ($)</th>
                            <th className="px-8 py-5 text-right">Venta Real ($)</th>
                            <th className="px-8 py-5 text-right">Cumplimiento</th>
                            <th className="px-8 py-5 text-center">Estatus</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {list?.map((item: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                                <td className="px-8 py-5">
                                    <div className="flex items-center gap-3">
                                        {view === 'supervisor' && item.avatar_url && (
                                            <img src={item.avatar_url} alt="" className="w-8 h-8 rounded-full border-2 border-slate-100" />
                                        )}
                                        <span className="font-black text-slate-900 uppercase tracking-tight">
                                            {view === 'supervisor'
                                                ? `${item.first_name} ${item.last_name}`
                                                : item.campaign_name}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-8 py-5 text-right font-bold text-slate-400 tabular-nums">${(item.target_amount || 0).toLocaleString()}</td>
                                <td className="px-8 py-5 text-right font-black text-blue-600 tabular-nums">${(item.sold_amount || 0).toLocaleString()}</td>
                                <td className="px-8 py-5 text-right">
                                    <div className="flex items-center justify-end gap-3">
                                        <span className="font-black text-slate-900 tabular-nums">{item.compliance_amount}%</span>
                                        <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden flex-shrink-0">
                                            <div
                                                className={`h-full transition-all duration-1000 ${item.pilar_color === 'green' ? 'bg-emerald-500' :
                                                        item.pilar_color === 'yellow' ? 'bg-amber-400' : 'bg-rose-500'
                                                    }`}
                                                style={{ width: `${Math.min(item.compliance_amount, 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                </td>
                                <td className="px-8 py-5 text-center">
                                    <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${item.pilar_color === 'green' ? 'bg-emerald-50 text-emerald-600' :
                                            item.pilar_color === 'yellow' ? 'bg-amber-50 text-amber-600' :
                                                'bg-rose-50 text-rose-600'
                                        }`}>
                                        {item.pilar_color === 'green' ? 'Objetivo Logrado' : 'En Riesgo'}
                                    </span>
                                </td>
                            </tr>
                        ))}
                        {(!list || list.length === 0) && (
                            <tr>
                                <td colSpan={5} className="p-20 text-center">
                                    <div className="flex flex-col items-center space-y-3 opacity-30">
                                        <AlertCircle className="w-8 h-8 text-slate-400" />
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sin datos operativos</span>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
