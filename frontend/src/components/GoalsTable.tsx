import { useState, useEffect, useMemo } from 'react';
import Modal from '@/components/Modal';
import { UserIcon, GlobeAmericasIcon, TagIcon, CalendarIcon, PencilIcon, TrashIcon, ChartBarIcon, CalculatorIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { supabase } from '@/lib/supabase';
import LoadingState from '@/components/ui/LoadingState';
import { usePermission } from '@/hooks/usePermission';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';

import { fetchFromAPI } from '@/lib/api';

// No longer using hardcoded API_URL if we use fetchFromAPI

// Estilos base
const inputStyle = "w-full border border-gray-300 rounded-md py-1.5 px-2 text-xs bg-white text-gray-700 font-medium outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all uppercase placeholder-gray-400";

interface GoalsTableProps {
    data: any[];
    allAgents: any[];
    supervisors: any[];
    onRefresh: () => void;
    isTrashView?: boolean;
    onPurge?: (id: string) => void;
}

export default function GoalsTable({ data, allAgents, supervisors, onRefresh, isTrashView = false, onPurge }: GoalsTableProps) {
    const { can } = usePermission();
    const { toast } = useToast();

    const handlePurge = (id: string) => {
        toast({
            title: "☠️ ¿Destruir Objetivo?",
            description: "Esta acción ELIMINARÁ PERMANENTEMENTE el objetivo. Irreversible.",
            variant: "destructive",
            duration: Infinity,
            action: (
                <ToastAction
                    altText="PURGAR"
                    onClick={() => onPurge && onPurge(id)}
                    className="bg-red-900 text-white hover:bg-black border-none px-4 font-black"
                >
                    DESTRUIR
                </ToastAction>
            ),
        });
    };
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loadingStatus, setLoadingStatus] = useState<'idle' | 'loading' | 'error' | 'success'>('idle');
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [editingGoalId, setEditingGoalId] = useState<string | null>(null);

    const [productsCatalog, setProductsCatalog] = useState<any[]>([]); // Se mantiene para compatibilidad si es necesario, pero se usará menos
    const [campaignsList, setCampaignsList] = useState<any[]>([]);
    const [availableFamiliesList, setAvailableFamiliesList] = useState<string[]>([]);
    const [availableProductsList, setAvailableProductsList] = useState<any[]>([]);

    const [selectedCampaign, setSelectedCampaign] = useState<string>('');
    const [selectedFamily, setSelectedFamily] = useState<string>('');
    const [selectedProduct, setSelectedProduct] = useState<string>('');
    const [assignmentType, setAssignmentType] = useState<'total' | 'individual' | 'team'>('individual');
    const [selectedAgentId, setSelectedAgentId] = useState<string>('');
    const [selectedSupervisorId, setSelectedSupervisorId] = useState<string>('');

    const [metrics, setMetrics] = useState({
        month_target: '',
        target_amount: 0, target_units: 0,
        target_daily_amount: 0, target_daily_count: 0, is_manual_daily: false
    });

    // --- CARGA ---
    const loadMasterData = async () => {
        setLoadingStatus('loading');
        try {
            const [resProds, resCamps] = await Promise.all([
                fetchFromAPI('/api/v1/products/'),
                fetchFromAPI('/api/v1/campaigns/')
            ]);

            setProductsCatalog(resProds?.items || (Array.isArray(resProds) ? resProds : []));
            setCampaignsList(resCamps?.items || (Array.isArray(resCamps) ? resCamps : []));
            setLoadingStatus('success');
        } catch (err) {
            console.error("Master Data Load Error:", err);
            setLoadingStatus('error');
        }
    };

    useEffect(() => {
        const handleOpenModal = () => { openNewModal(); };
        if (typeof window !== 'undefined') window.addEventListener('open-goal-modal', handleOpenModal);
        loadMasterData();
        return () => { if (typeof window !== 'undefined') window.removeEventListener('open-goal-modal', handleOpenModal); };
    }, []);

    const openNewModal = () => {
        setEditingGoalId(null);
        resetForm();
        setIsModalOpen(true);
        loadMasterData();
    };

    const handleEdit = (goal: any) => {
        setEditingGoalId(goal.id);
        setSelectedCampaign(goal.campaign_id || '');

        // Carga de Familia y Producto (Priorizando el dato guardado en el objetivo)
        const familyToSet = (goal.product_family || goal.product?.family_name || 'GENERAL').trim().toUpperCase();
        setSelectedFamily(familyToSet);
        setSelectedProduct(goal.product?.id || '');

        setAssignmentType(goal.user_id ? 'individual' : 'total');
        setSelectedAgentId(goal.user_id || '');

        setMetrics({
            month_target: goal.month ? goal.month.substring(0, 7) : '',
            target_amount: goal.target_amount || 0,
            target_units: goal.target_units || 0,
            target_daily_amount: goal.target_daily_amount || 0,
            target_daily_count: goal.target_daily_count || 0,
            is_manual_daily: goal.is_manual_daily || false
        });
        setIsModalOpen(true);
        loadMasterData(); // Ensure masters are loaded for editing too
    };

    const handleDelete = (id: string) => {
        toast({
            title: "¿Confirmar eliminación?",
            description: "Esta acción eliminará el objetivo permanentemente.",
            variant: "destructive",
            duration: Infinity,
            action: (
                <ToastAction
                    altText="Confirmar eliminación"
                    onClick={async () => {
                        try {
                            await fetchFromAPI(`/api/v1/goals/${id}`, {
                                method: 'DELETE'
                            });
                            toast({
                                title: "Objetivo Eliminado",
                                description: "El registro ha sido removido correctamente.",
                            });
                            onRefresh();
                        } catch (e) {
                            toast({
                                title: "Error al eliminar",
                                description: "No se pudo completar la operación.",
                                variant: "destructive",
                                duration: 8000
                            });
                        }
                    }}
                    className="bg-red-600 text-white hover:bg-red-700 border-none px-4"
                >
                    ELIMINAR
                </ToastAction>
            ),
        });
    };

    const resetForm = () => {
        setSelectedCampaign(''); setSelectedFamily(''); setSelectedProduct('');
        setAssignmentType('individual'); setSelectedAgentId(''); setSelectedSupervisorId('');
        const today = new Date();
        const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        setMetrics({ month_target: currentMonth, target_amount: 0, target_units: 0, target_daily_amount: 0, target_daily_count: 0, is_manual_daily: false });
    };

    // --- FILTROS UNICOS CON NORMALIZACIÓN ESTRICTA ---
    const uniqueCampaigns = useMemo(() => {
        const map = new Map();
        campaignsList.forEach(c => { if (c.name && !map.has(c.name.trim().toUpperCase())) map.set(c.name.trim().toUpperCase(), c); });
        return Array.from(map.values());
    }, [campaignsList]);

    // --- CARGA DINÁMICA DE CASCADA ---
    useEffect(() => {
        const loadFamilies = async () => {
            if (!selectedCampaign) {
                setAvailableFamiliesList([]);
                return;
            }
            const data = await fetchFromAPI(`/api/v1/products/families?campaign_id=${selectedCampaign}`);
            setAvailableFamiliesList(data);
        };
        loadFamilies();
    }, [selectedCampaign]);

    useEffect(() => {
        const loadProducts = async () => {
            if (!selectedCampaign) {
                setAvailableProductsList([]);
                return;
            }
            try {
                let url = `/api/v1/products/plans?campaign_id=${selectedCampaign}`;
                if (selectedFamily) url += `&family_name=${encodeURIComponent(selectedFamily)}`;

                const data = await fetchFromAPI(url);
                setAvailableProductsList(data);
            } catch (err) { console.error("Error cargando productos", err); }
        };
        loadProducts();
    }, [selectedCampaign, selectedFamily]);


    const teamAgents = useMemo(() => {
        if (!selectedSupervisorId) return [];
        return allAgents.filter(a => a.supervisor_id === selectedSupervisorId);
    }, [selectedSupervisorId, allAgents]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);
        setErrorMessage('');
        try {
            const { data: { session } } = await supabase.auth.getSession();
            let tenantId = null;
            try {
                const user = await fetchFromAPI('/api/v1/users/me');
                tenantId = user.tenant_id || user.organization_id;
            } catch (e) { }

            const formattedDate = metrics.month_target.length === 7 ? `${metrics.month_target}-01` : metrics.month_target;
            const basePayload: any = {
                tenant_id: tenantId, campaign_id: selectedCampaign, month: formattedDate,
                target_amount: Number(metrics.target_amount), target_units: Number(metrics.target_units),
                target_daily_amount: Number(metrics.target_daily_amount), target_daily_count: Number(metrics.target_daily_count),
                is_manual_daily: metrics.is_manual_daily, is_active: true,
                product_id: (selectedProduct && selectedProduct !== 'all') ? selectedProduct : null,
                product_family: selectedFamily || 'GENERAL'
            };

            let endpoint = `/api/v1/goals/`;
            let method = 'POST';

            if (editingGoalId) {
                endpoint = `/api/v1/goals/${editingGoalId}`;
                method = 'PUT';
                basePayload.user_id = selectedAgentId || null;
            } else {
                if (assignmentType === 'individual') {
                    if (!selectedAgentId) throw new Error("Seleccione un Agente.");
                    basePayload.user_id = selectedAgentId;
                } else if (assignmentType === 'team') {
                    if (!selectedSupervisorId) throw new Error("Seleccione un Supervisor.");
                    endpoint = `/api/v1/goals/bulk`;
                    const bulkPayload = { items: teamAgents.map(agent => ({ ...basePayload, user_id: agent.id })) };
                    if (!editingGoalId) {
                        await fetchFromAPI(endpoint, {
                            method: 'POST',
                            body: JSON.stringify(bulkPayload)
                        });
                        toast({
                            title: "✅ Equipo asignado!",
                            description: "Los objetivos se han distribuido correctamente entre el equipo.",
                        });
                        setIsModalOpen(false); onRefresh(); return;
                    }
                } else { basePayload.user_id = null; }
            }

            await fetchFromAPI(endpoint, {
                method: method,
                body: JSON.stringify(basePayload)
            });
            toast({
                title: `✅ Objetivo ${editingGoalId ? 'actualizado' : 'creado'}`,
                description: `El registro se ha guardado correctamente en el mes de ${metrics.month_target}.`,
            });
            setIsModalOpen(false); onRefresh();
        } catch (error: any) { setErrorMessage(error.message); } finally { setIsSubmitting(false); }
    };

    return (
        <div>
            {/* TABLA PRINCIPAL */}
            <div className="overflow-hidden border border-gray-200 dark:border-slate-800 rounded-lg shadow-sm bg-white dark:bg-slate-900 transition-colors">
                <table className="w-full text-left text-sm text-gray-700 dark:text-slate-300">
                    <thead className="bg-gray-50 dark:bg-slate-800/50 uppercase font-bold text-[14px] text-gray-500 dark:text-slate-400 border-b border-gray-200 dark:border-slate-800">
                        <tr className="border-b dark:border-slate-800">
                            <th className="px-4 py-3">Campaña</th>
                            <th className="px-4 py-3">Familia</th>
                            <th className="px-4 py-3">Producto</th>
                            <th className="px-4 py-3">Asignado A</th>
                            <th className="px-4 py-3">Mes</th>
                            <th className="px-4 py-3 text-right">Meta ($)</th>
                            <th className="px-4 py-3 text-right">Meta (#)</th>
                            <th className="px-4 py-3 text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                        {data.length === 0 ? (
                            <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400 dark:text-slate-500 font-medium text-[12px] uppercase tracking-widest">No hay objetivos definidos</td></tr>
                        ) : (
                            data.map((goal: any) => (
                                <tr key={goal.id} className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors group">
                                    <td className="px-4 py-3 font-bold text-gray-800 dark:text-slate-200 text-[12px] uppercase">{goal.campaign?.name || '---'}</td>
                                    <td className="px-4 py-3 text-[12px] text-gray-500 dark:text-slate-400 font-medium uppercase">{goal.product_family || goal.product?.family_name || 'GENERAL'}</td>
                                    <td className="px-4 py-3 text-[12px] text-gray-600 dark:text-slate-300 uppercase font-semibold">{goal.product?.name || 'TODO EL PORTAFOLIO'}</td>
                                    <td className="px-4 py-3">
                                        {goal.user_id
                                            ? <span className="flex items-center gap-1.5 text-[12px] font-semibold text-gray-700 dark:text-slate-300">
                                                <UserIcon className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500" />
                                                {(goal.agent?.first_name || goal.user?.first_name || 'Agente') + ' ' + (goal.agent?.last_name || goal.user?.last_name || '')}
                                            </span>
                                            : <span className="flex items-center gap-1.5 text-xs font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full w-fit border border-blue-100 dark:border-blue-900/30"><GlobeAmericasIcon className="w-3.5 h-3.5" /> GLOBAL</span>
                                        }
                                    </td>
                                    <td className="px-4 py-3 text-[12px] font-mono dark:text-slate-400">{goal.month || goal.month_target}</td>
                                    <td className="px-4 py-3 text-right text-[12px] font-bold text-gray-900 dark:text-slate-100 tabular-nums">
                                        ${Number(goal.target_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-4 py-3 text-right text-[12px] font-bold text-blue-800 dark:text-blue-400 bg-blue-50/30 dark:bg-blue-900/10 rounded-sm tabular-nums">
                                        {Number(goal.target_units || 0).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-center flex justify-center gap-2">
                                        {isTrashView ? (
                                            can('config_goals', 'goals', 'purge') && (
                                                <button onClick={() => handlePurge(goal.id)} className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors" title="Purgar"><TrashIcon className="w-4 h-4" /></button>
                                            )
                                        ) : (
                                            can('config_goals', 'goals', 'manage') && (
                                                <>
                                                    <button onClick={() => handleEdit(goal)} className="p-1 text-gray-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors" title="Editar"><PencilIcon className="w-4 h-4" /></button>
                                                    <button onClick={() => handleDelete(goal.id)} className="p-1 text-gray-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-colors" title="Eliminar"><TrashIcon className="w-4 h-4" /></button>
                                                </>
                                            )
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* MODAL REDISEÑADO FINAL */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-white/10 rounded-lg backdrop-blur-md border border-white/20">
                            <ChartBarIcon className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-white tracking-tight uppercase leading-tight">
                                {editingGoalId ? "Configurar Meta" : "Asignación de Objetivos"}
                            </h3>
                            <p className="text-[10px] text-blue-200/60 font-medium uppercase tracking-widest mt-0.5">Planeamiento de Metas Mensuales</p>
                        </div>
                    </div>
                }
                maxWidth="max-w-5xl"
            >
                <form onSubmit={handleSubmit} className="p-0 text-gray-800 dark:text-slate-200 font-sans">
                    <div className="flex flex-col lg:flex-row h-auto bg-white dark:bg-slate-900 transition-colors">

                        {/* COLUMNA IZQUIERDA: CONTEXTO */}
                        <div className="w-full lg:w-7/12 bg-white dark:bg-slate-900 p-4 border-r border-gray-100 dark:border-slate-800 h-auto">
                            {loadingStatus === 'loading' && <LoadingState message="Cargando catálogos..." />}
                            {loadingStatus === 'error' && <div className="text-red-500 dark:text-red-400 text-xs mb-4 p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-100 dark:border-red-900/30">Error de conexión con maestros.</div>}
                            <h4 className="flex items-center gap-2 text-[12px] font-bold text-gray-400 dark:text-slate-500 uppercase mb-2 tracking-widest border-b border-gray-50 dark:border-slate-800 pb-2"><TagIcon className="w-4 h-4 text-gray-300 dark:text-slate-600" /> Contexto Operativo</h4>

                            <div className="grid grid-cols-12 gap-3">
                                <div className="col-span-12">
                                    <label className="block text-[12px] font-semibold text-gray-600 dark:text-slate-400 mb-0.5 uppercase tracking-tight">Campaña Asignada</label>
                                    <select required value={selectedCampaign} onChange={(e) => { setSelectedCampaign(e.target.value); setSelectedFamily(''); setSelectedProduct(''); }} className="w-full border border-gray-300 dark:border-slate-700 rounded-md py-1.5 px-2 text-xs bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 font-medium outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/20 transition-all uppercase placeholder-gray-400" disabled={!!editingGoalId}>
                                        <option value="" className="dark:bg-slate-800">-- Seleccionar Campaña --</option> {uniqueCampaigns.map((c: any) => <option key={c.id} value={c.id} className="dark:bg-slate-800">{c.name}</option>)}
                                    </select>
                                </div>
                                {!editingGoalId && (
                                    <div className="col-span-12">
                                        <label className="block text-[12px] font-semibold text-gray-600 dark:text-slate-400 mb-0.5 uppercase tracking-tight">Nivel de Asignación</label>
                                        <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-lg items-center border border-gray-200 dark:border-slate-700">
                                            {['individual', 'team', 'total'].map((type) => (
                                                <button key={type} type="button" onClick={() => setAssignmentType(type as any)} className={`flex-1 py-1.5 text-[11px] font-bold uppercase rounded-md transition-all leading-none ${assignmentType === type ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-400 shadow-sm ring-1 ring-black/5 dark:ring-white/10' : 'text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-750'}`}>{type === 'individual' ? 'Agente' : type === 'team' ? 'Equipo' : 'Global'}</button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {(assignmentType === 'individual' || editingGoalId) && (
                                    <div className="col-span-12 animate-fade-in">
                                        <label className="block text-[12px] font-semibold text-gray-600 dark:text-slate-400 mb-0.5 uppercase tracking-tight">Agente Responsable</label>
                                        <select value={selectedAgentId} onChange={(e) => setSelectedAgentId(e.target.value)} className="w-full border border-gray-300 dark:border-slate-700 rounded-md py-1.5 px-2 text-xs bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 font-medium outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/20 transition-all uppercase placeholder-gray-400" disabled={!!editingGoalId}>
                                            <option value="" className="dark:bg-slate-800">-- Buscar Agente --</option> {allAgents.map(a => <option key={a.id} value={a.id} className="dark:bg-slate-800">{a.first_name} {a.last_name}</option>)}
                                        </select>
                                    </div>
                                )}
                                {assignmentType === 'team' && !editingGoalId && (
                                    <div className="col-span-12 animate-fade-in">
                                        <label className="block text-[12px] font-semibold text-gray-600 dark:text-slate-400 mb-0.5 uppercase tracking-tight">Supervisor de Equipo</label>
                                        <select value={selectedSupervisorId} onChange={(e) => setSelectedSupervisorId(e.target.value)} className="w-full border border-gray-300 dark:border-slate-700 rounded-md py-1.5 px-2 text-xs bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 font-medium outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/20 transition-all uppercase placeholder-gray-400">
                                            <option value="" className="dark:bg-slate-800">-- Buscar Supervisor --</option> {supervisors.map(s => <option key={s.id} value={s.id} className="dark:bg-slate-800">{s.first_name} {s.last_name}</option>)}
                                        </select>
                                    </div>
                                )}
                                <div className="col-span-6"><label className="block text-[12px] font-semibold text-gray-600 dark:text-slate-400 mb-0.5 uppercase tracking-tight">Familia</label><select value={selectedFamily} onChange={(e) => setSelectedFamily(e.target.value)} className="w-full border border-gray-300 dark:border-slate-700 rounded-md py-1.5 px-2 text-xs bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 font-medium outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/20 transition-all uppercase placeholder-gray-400"><option value="" className="dark:bg-slate-800">-- Todas --</option>{availableFamiliesList.map(f => <option key={f} value={f} className="dark:bg-slate-800">{f}</option>)}</select></div>
                                <div className="col-span-6"><label className="block text-[12px] font-semibold text-gray-600 dark:text-slate-400 mb-0.5 uppercase tracking-tight">Producto</label><select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)} className="w-full border border-gray-300 dark:border-slate-700 rounded-md py-1.5 px-2 text-xs bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 font-medium outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/20 transition-all uppercase placeholder-gray-400"><option value="" className="dark:bg-slate-800">-- Todos --</option>{availableProductsList.map(p => <option key={p.id} value={p.id} className="dark:bg-slate-800">{p.name} - {p.plan_name}</option>)}</select></div>
                            </div>
                        </div>

                        {/* COLUMNA DERECHA: METAS */}
                        <div className="w-full lg:w-5/12 bg-gray-50/40 dark:bg-slate-950 p-4 border-l border-gray-100 dark:border-slate-800">
                            <h4 className="flex items-center gap-2 text-[12px] font-bold text-gray-400 dark:text-slate-500 uppercase mb-2 tracking-widest border-b border-gray-200 dark:border-slate-800 pb-2"><ChartBarIcon className="w-4 h-4 text-gray-300 dark:text-slate-600" /> Definición de Metas</h4>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[12px] font-semibold text-gray-600 dark:text-slate-400 mb-1 uppercase tracking-tight">Periodo</label>
                                    <div className="relative">
                                        <CalendarIcon className="absolute left-3 top-2.5 w-4 h-4 text-gray-400 dark:text-slate-500" />
                                        <input type="month" value={metrics.month_target} onChange={(e) => setMetrics({ ...metrics, month_target: e.target.value })} className="w-full border border-gray-300 dark:border-slate-700 rounded-md py-1.5 px-2 text-xs bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 font-medium outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/20 transition-all uppercase placeholder-gray-400 pl-10" />
                                    </div>
                                </div>

                                {/* TARJETAS AMPLIADAS */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm relative overflow-hidden flex flex-col justify-center min-h-[100px] group hover:border-[#001741] dark:hover:border-blue-500 transition-all">
                                        <div className="absolute top-0 left-0 w-1.5 h-full bg-[#001741] dark:bg-blue-600"></div>
                                        <h5 className="text-[12px] font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-2 pl-1">Objetivo Mensual</h5>
                                        <div className="space-y-2 pl-1">
                                            <div>
                                                <label className="text-[12px] text-gray-400 dark:text-slate-500 font-bold uppercase block mb-0.5">Monto ($)</label>
                                                <input
                                                    type="number"
                                                    value={Number.isNaN(metrics.target_amount) || metrics.target_amount === 0 ? '' : metrics.target_amount}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setMetrics({ ...metrics, target_amount: val === '' ? 0 : parseFloat(val) });
                                                    }}
                                                    className="w-full border-b border-gray-100 dark:border-slate-800 pb-0.5 text-base font-black text-[#001741] dark:text-blue-400 focus:border-blue-600 outline-none bg-transparent"
                                                    placeholder="0"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[12px] text-gray-400 dark:text-slate-500 font-bold uppercase block mb-0.5">Unidades (#)</label>
                                                <input
                                                    type="number"
                                                    value={Number.isNaN(metrics.target_units) || metrics.target_units === 0 ? '' : metrics.target_units}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setMetrics({ ...metrics, target_units: val === '' ? 0 : parseFloat(val) });
                                                    }}
                                                    className="w-full border-b border-gray-100 dark:border-slate-800 pb-0.5 text-base font-black text-[#001741] dark:text-blue-400 focus:border-blue-600 outline-none bg-transparent"
                                                    placeholder="0"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-[#001741]/5 dark:bg-blue-900/10 p-3 rounded-xl border border-blue-100 dark:border-blue-900/40 shadow-sm relative overflow-hidden flex flex-col justify-center min-h-[100px] group hover:border-blue-300 dark:hover:border-blue-500 transition-all">
                                        <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-400"></div>
                                        <h5 className="text-[12px] font-bold text-blue-900 dark:text-blue-400 uppercase tracking-wider mb-2 pl-1 flex items-center gap-1"><CalculatorIcon className="w-3.5 h-3.5" /> Objetivo Diario</h5>
                                        <div className="space-y-2 pl-1">
                                            <div>
                                                <label className="text-[12px] text-blue-400 dark:text-blue-500 font-bold uppercase block mb-0.5">Monto ($)</label>
                                                <input
                                                    type="number"
                                                    value={Number.isNaN(metrics.target_daily_amount) || metrics.target_daily_amount === 0 ? '' : metrics.target_daily_amount}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setMetrics({ ...metrics, target_daily_amount: val === '' ? 0 : parseFloat(val) });
                                                    }}
                                                    className="w-full border-b border-blue-200 dark:border-slate-800 pb-0.5 text-base font-black text-blue-900 dark:text-blue-400 focus:border-blue-400 outline-none bg-transparent"
                                                    placeholder="0"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[12px] text-blue-400 dark:text-blue-500 font-bold uppercase block mb-0.5">Unidades (#)</label>
                                                <input
                                                    type="number"
                                                    value={Number.isNaN(metrics.target_daily_count) || metrics.target_daily_count === 0 ? '' : metrics.target_daily_count}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setMetrics({ ...metrics, target_daily_count: val === '' ? 0 : parseFloat(val) });
                                                    }}
                                                    className="w-full border-b border-blue-200 dark:border-slate-800 pb-0.5 text-base font-black text-blue-900 dark:text-blue-400 focus:border-blue-400 outline-none bg-transparent"
                                                    placeholder="0"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-between items-center px-6 py-4 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800">
                        <div className="text-red-500 dark:text-red-400 text-xs font-semibold truncate max-w-[50%] tracking-tight uppercase">{errorMessage}</div>
                        <div className="flex gap-4">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 text-xs font-bold text-gray-500 dark:text-slate-500 hover:text-gray-800 dark:hover:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-md transition-colors uppercase tracking-wider">Cancelar</button>
                            <button type="submit" disabled={isSubmitting} className="bg-gray-900 dark:bg-slate-700 text-white px-8 py-2.5 rounded-md text-xs font-bold uppercase tracking-wider hover:bg-black dark:hover:bg-slate-600 shadow-lg shadow-gray-900/10 dark:shadow-none transform active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2">
                                {isSubmitting && <ArrowPathIcon className="w-4 h-4 animate-spin" />}
                                {isSubmitting ? 'Procesando...' : (editingGoalId ? 'Guardar Cambios' : 'Crear Objetivo')}
                            </button>
                        </div>
                    </div>
                </form>
            </Modal>
        </div>
    );
}