import { useState, useEffect, useMemo } from 'react';
import Modal from '@/components/Modal';
import { UserIcon, GlobeAmericasIcon, TagIcon, CalendarIcon, PencilIcon, TrashIcon, ChartBarIcon, CalculatorIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { supabase } from '@/lib/supabase';

const API_URL = 'http://localhost:8000/api/v1';

// Estilos base
const inputStyle = "w-full border border-gray-300 rounded-md py-1.5 px-2 text-xs bg-white text-gray-700 font-medium outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all uppercase placeholder-gray-400";

interface GoalsTableProps {
    data: any[];
    allAgents: any[];
    supervisors: any[];
    onRefresh: () => void;
}

export default function GoalsTable({ data, allAgents, supervisors, onRefresh }: GoalsTableProps) {
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
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) return;
            const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
            const [resProds, resCamps] = await Promise.all([
                fetch(`${API_URL}/products/`, { headers }),
                fetch(`${API_URL}/campaigns/`, { headers })
            ]);
            if (resProds.ok && resCamps.ok) {
                setProductsCatalog(await resProds.json() || []);
                setCampaignsList(await resCamps.json() || []);
                setLoadingStatus('success');
            }
        } catch (err) { setLoadingStatus('error'); }
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
    };

    const handleDelete = async (id: string) => {
        if (!confirm("¿Estás seguro de ELIMINAR este objetivo?")) return;
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const response = await fetch(`${API_URL}/goals/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${session?.access_token}` }
            });
            if (!response.ok) throw new Error("Error al eliminar");
            onRefresh();
        } catch (e) { alert("Error al eliminar"); }
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
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const token = session?.access_token;
                const response = await fetch(`${API_URL}/products/families?campaign_id=${selectedCampaign}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    setAvailableFamiliesList(await response.json());
                }
            } catch (err) { console.error("Error cargando familias", err); }
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
                const { data: { session } } = await supabase.auth.getSession();
                const token = session?.access_token;
                let url = `${API_URL}/products/plans?campaign_id=${selectedCampaign}`;
                if (selectedFamily) url += `&family_name=${encodeURIComponent(selectedFamily)}`;

                const response = await fetch(url, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    setAvailableProductsList(await response.json());
                }
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
            const token = session?.access_token;
            let tenantId = null;
            try {
                const resUser = await fetch(`${API_URL}/users/me`, { headers: { 'Authorization': `Bearer ${token}` } });
                if (resUser.ok) {
                    const user = await resUser.json();
                    tenantId = user.tenant_id || user.organization_id;
                }
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

            let endpoint = `${API_URL}/goals/`;
            let method = 'POST';

            if (editingGoalId) {
                endpoint = `${API_URL}/goals/${editingGoalId}`;
                method = 'PUT';
                basePayload.user_id = selectedAgentId || null;
            } else {
                if (assignmentType === 'individual') {
                    if (!selectedAgentId) throw new Error("Seleccione un Agente.");
                    basePayload.user_id = selectedAgentId;
                } else if (assignmentType === 'team') {
                    if (!selectedSupervisorId) throw new Error("Seleccione un Supervisor.");
                    endpoint = `${API_URL}/goals/bulk`;
                    const bulkPayload = { items: teamAgents.map(agent => ({ ...basePayload, user_id: agent.id })) };
                    if (!editingGoalId) {
                        const response = await fetch(endpoint, {
                            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                            body: JSON.stringify(bulkPayload)
                        });
                        if (!response.ok) throw new Error("Error en carga masiva");
                        alert("✅ Equipo asignado correctamente!");
                        setIsModalOpen(false); onRefresh(); return;
                    }
                } else { basePayload.user_id = null; }
            }

            const response = await fetch(endpoint, {
                method: method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(basePayload)
            });

            if (!response.ok) throw new Error("Error al guardar");
            alert(`✅ Objetivo ${editingGoalId ? 'actualizado' : 'creado'} correctamente!`);
            setIsModalOpen(false); onRefresh();
        } catch (error: any) { setErrorMessage(error.message); } finally { setIsSubmitting(false); }
    };

    return (
        <div>
            {/* TABLA PRINCIPAL */}
            <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm bg-white">
                <table className="w-full text-left text-sm text-gray-700">
                    <thead className="bg-gray-50 uppercase font-bold text-[14px] text-gray-500 border-b border-gray-200">
                        <tr>
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
                    <tbody className="divide-y divide-gray-100">
                        {data.length === 0 ? (
                            <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400 font-medium text-[12px] uppercase tracking-widest">No hay objetivos definidos</td></tr>
                        ) : (
                            data.map((goal: any) => (
                                <tr key={goal.id} className="hover:bg-blue-50/30 transition-colors group">
                                    <td className="px-4 py-3 font-bold text-gray-800 text-[12px] uppercase">{goal.campaign?.name || '---'}</td>
                                    <td className="px-4 py-3 text-[12px] text-gray-500 font-medium uppercase">{goal.product_family || goal.product?.family_name || 'GENERAL'}</td>
                                    <td className="px-4 py-3 text-[12px] text-gray-600 uppercase font-semibold">{goal.product?.name || 'TODO EL PORTAFOLIO'}</td>
                                    <td className="px-4 py-3">
                                        {goal.user_id
                                            ? <span className="flex items-center gap-1.5 text-[12px] font-semibold text-gray-700">
                                                <UserIcon className="w-3.5 h-3.5 text-gray-400" />
                                                {(goal.agent?.first_name || goal.user?.first_name || 'Agente') + ' ' + (goal.agent?.last_name || goal.user?.last_name || '')}
                                            </span>
                                            : <span className="flex items-center gap-1.5 text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full w-fit"><GlobeAmericasIcon className="w-3.5 h-3.5" /> GLOBAL</span>
                                        }
                                    </td>
                                    <td className="px-4 py-3 text-[12px] font-mono">{goal.month || goal.month_target}</td>
                                    <td className="px-4 py-3 text-right text-[12px] font-bold text-gray-900 tabular-nums">
                                        ${Number(goal.target_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-4 py-3 text-right text-[12px] font-bold text-blue-800 bg-blue-50/30 rounded-sm tabular-nums">
                                        {Number(goal.target_units || 0).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-center flex justify-center gap-2">
                                        <button onClick={() => handleEdit(goal)} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Editar"><PencilIcon className="w-4 h-4" /></button>
                                        <button onClick={() => handleDelete(goal.id)} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded transition-colors" title="Eliminar"><TrashIcon className="w-4 h-4" /></button>
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
                <form onSubmit={handleSubmit} className="p-0 text-gray-800 font-sans">
                    <div className="flex flex-col lg:flex-row h-auto bg-white">

                        {/* COLUMNA IZQUIERDA: CONTEXTO */}
                        <div className="w-full lg:w-7/12 bg-white p-4 border-r border-gray-100 h-auto">
                            {loadingStatus === 'error' && <div className="text-red-500 text-xs mb-4 p-2 bg-red-50 rounded border border-red-100">Error de conexión con maestros.</div>}
                            <h4 className="flex items-center gap-2 text-[12px] font-bold text-gray-400 uppercase mb-2 tracking-widest border-b border-gray-50 pb-2"><TagIcon className="w-4 h-4 text-gray-300" /> Contexto Operativo</h4>

                            <div className="grid grid-cols-12 gap-3">
                                <div className="col-span-12">
                                    <label className="block text-[12px] font-semibold text-gray-600 mb-0.5 uppercase tracking-tight">Campaña Asignada</label>
                                    <select required value={selectedCampaign} onChange={(e) => { setSelectedCampaign(e.target.value); setSelectedFamily(''); setSelectedProduct(''); }} className={inputStyle} disabled={!!editingGoalId}>
                                        <option value="">-- Seleccionar Campaña --</option> {uniqueCampaigns.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                {!editingGoalId && (
                                    <div className="col-span-12">
                                        <label className="block text-[12px] font-semibold text-gray-600 mb-0.5 uppercase tracking-tight">Nivel de Asignación</label>
                                        <div className="flex bg-gray-100 p-1 rounded-lg items-center">
                                            {['individual', 'team', 'total'].map((type) => (
                                                <button key={type} type="button" onClick={() => setAssignmentType(type as any)} className={`flex-1 py-1.5 text-[11px] font-bold uppercase rounded-md transition-all leading-none ${assignmentType === type ? 'bg-white text-blue-700 shadow-sm ring-1 ring-black/5' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}>{type === 'individual' ? 'Agente' : type === 'team' ? 'Equipo' : 'Global'}</button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {(assignmentType === 'individual' || editingGoalId) && (
                                    <div className="col-span-12 animate-fade-in">
                                        <label className="block text-[12px] font-semibold text-gray-600 mb-0.5 uppercase tracking-tight">Agente Responsable</label>
                                        <select value={selectedAgentId} onChange={(e) => setSelectedAgentId(e.target.value)} className={inputStyle} disabled={!!editingGoalId}>
                                            <option value="">-- Buscar Agente --</option> {allAgents.map(a => <option key={a.id} value={a.id}>{a.first_name} {a.last_name}</option>)}
                                        </select>
                                    </div>
                                )}
                                {assignmentType === 'team' && !editingGoalId && (
                                    <div className="col-span-12 animate-fade-in">
                                        <label className="block text-[12px] font-semibold text-gray-600 mb-0.5 uppercase tracking-tight">Supervisor de Equipo</label>
                                        <select value={selectedSupervisorId} onChange={(e) => setSelectedSupervisorId(e.target.value)} className={inputStyle}>
                                            <option value="">-- Buscar Supervisor --</option> {supervisors.map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
                                        </select>
                                    </div>
                                )}
                                <div className="col-span-6"><label className="block text-[12px] font-semibold text-gray-600 mb-0.5 uppercase tracking-tight">Familia</label><select value={selectedFamily} onChange={(e) => setSelectedFamily(e.target.value)} className={inputStyle}><option value="">-- Todas --</option>{availableFamiliesList.map(f => <option key={f} value={f}>{f}</option>)}</select></div>
                                <div className="col-span-6"><label className="block text-[12px] font-semibold text-gray-600 mb-0.5 uppercase tracking-tight">Producto</label><select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)} className={inputStyle}><option value="">-- Todos --</option>{availableProductsList.map(p => <option key={p.id} value={p.id}>{p.name} - {p.plan_name}</option>)}</select></div>
                            </div>
                        </div>

                        {/* COLUMNA DERECHA: METAS */}
                        <div className="w-full lg:w-5/12 bg-gray-50/40 p-4">
                            <h4 className="flex items-center gap-2 text-[12px] font-bold text-gray-400 uppercase mb-2 tracking-widest border-b border-gray-200 pb-2"><ChartBarIcon className="w-4 h-4 text-gray-300" /> Definición de Metas</h4>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[12px] font-semibold text-gray-600 mb-1 uppercase tracking-tight">Periodo</label>
                                    <div className="relative">
                                        <CalendarIcon className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                        <input type="month" value={metrics.month_target} onChange={(e) => setMetrics({ ...metrics, month_target: e.target.value })} className={`${inputStyle} pl-10`} />
                                    </div>
                                </div>

                                {/* TARJETAS AMPLIADAS */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden flex flex-col justify-center min-h-[100px] group hover:border-[#001741] transition-all">
                                        <div className="absolute top-0 left-0 w-1.5 h-full bg-[#001741]"></div>
                                        <h5 className="text-[12px] font-bold text-gray-700 uppercase tracking-wider mb-2 pl-1">Objetivo Mensual</h5>
                                        <div className="space-y-2 pl-1">
                                            <div>
                                                <label className="text-[12px] text-gray-400 font-bold uppercase block mb-0.5">Monto ($)</label>
                                                <input
                                                    type="number"
                                                    value={Number.isNaN(metrics.target_amount) || metrics.target_amount === 0 ? '' : metrics.target_amount}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setMetrics({ ...metrics, target_amount: val === '' ? 0 : parseFloat(val) });
                                                    }}
                                                    className="w-full border-b border-gray-100 pb-0.5 text-base font-black text-[#001741] focus:border-blue-600 outline-none bg-transparent"
                                                    placeholder="0"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[12px] text-gray-400 font-bold uppercase block mb-0.5">Unidades (#)</label>
                                                <input
                                                    type="number"
                                                    value={Number.isNaN(metrics.target_units) || metrics.target_units === 0 ? '' : metrics.target_units}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setMetrics({ ...metrics, target_units: val === '' ? 0 : parseFloat(val) });
                                                    }}
                                                    className="w-full border-b border-gray-100 pb-0.5 text-base font-black text-[#001741] focus:border-blue-600 outline-none bg-transparent"
                                                    placeholder="0"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-[#001741]/5 p-3 rounded-xl border border-blue-100 shadow-sm relative overflow-hidden flex flex-col justify-center min-h-[100px] group hover:border-blue-300 transition-all">
                                        <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-400"></div>
                                        <h5 className="text-[12px] font-bold text-blue-900 uppercase tracking-wider mb-2 pl-1 flex items-center gap-1"><CalculatorIcon className="w-3.5 h-3.5" /> Objetivo Diario</h5>
                                        <div className="space-y-2 pl-1">
                                            <div>
                                                <label className="text-[12px] text-blue-400 font-bold uppercase block mb-0.5">Monto ($)</label>
                                                <input
                                                    type="number"
                                                    value={Number.isNaN(metrics.target_daily_amount) || metrics.target_daily_amount === 0 ? '' : metrics.target_daily_amount}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setMetrics({ ...metrics, target_daily_amount: val === '' ? 0 : parseFloat(val) });
                                                    }}
                                                    className="w-full border-b border-blue-200 pb-0.5 text-base font-black text-blue-900 focus:border-blue-400 outline-none bg-transparent"
                                                    placeholder="0"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[12px] text-blue-400 font-bold uppercase block mb-0.5">Unidades (#)</label>
                                                <input
                                                    type="number"
                                                    value={Number.isNaN(metrics.target_daily_count) || metrics.target_daily_count === 0 ? '' : metrics.target_daily_count}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setMetrics({ ...metrics, target_daily_count: val === '' ? 0 : parseFloat(val) });
                                                    }}
                                                    className="w-full border-b border-blue-200 pb-0.5 text-base font-black text-blue-900 focus:border-blue-400 outline-none bg-transparent"
                                                    placeholder="0"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-between items-center px-6 py-4 bg-white border-t border-gray-100">
                        <div className="text-red-500 text-xs font-semibold truncate max-w-[50%] tracking-tight uppercase">{errorMessage}</div>
                        <div className="flex gap-4">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 text-xs font-bold text-gray-500 hover:text-gray-800 hover:bg-gray-50 rounded-md transition-colors uppercase tracking-wider">Cancelar</button>
                            <button type="submit" disabled={isSubmitting} className="bg-gray-900 text-white px-8 py-2.5 rounded-md text-xs font-bold uppercase tracking-wider hover:bg-black shadow-lg shadow-gray-900/10 transform active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2">
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