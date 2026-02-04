'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Modal from '@/components/Modal';
import ProductManager from '@/components/ProductManager';
import StatusFlowTable from '@/components/dashboard/StatusFlowTable';
import { fetchFromAPI } from '@/lib/api';
import { TagIcon, PencilIcon, ArrowPathIcon, Cog6ToothIcon, PlusIcon } from '@heroicons/react/24/outline';
import CampaignsTable from './CampaignsTable';
import GoalsTable from './GoalsTable';
import UsersTable from './UsersTable';
import RolePoliciesTable from './RolePoliciesTable';
import Pagination from '@/components/ui/Pagination';
import LoadingState from '@/components/ui/LoadingState';
import { usePermission } from '@/hooks/usePermission';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';

type Tab = 'campaigns' | 'products' | 'goals' | 'statuses' | 'users' | 'policies';

export default function ConfigManager() {
    const { can, isLoading: permsLoading } = usePermission();
    const { toast } = useToast();

    // Mapping of tabs to their functional permissions
    const allowedTabs = useMemo(() => {
        const tabs: { id: Tab, label: string }[] = [];
        if (can('config_campaigns', 'campaigns', 'view_tab')) tabs.push({ id: 'campaigns', label: 'Campañas' });
        if (can('config_products', 'products', 'view_tab')) tabs.push({ id: 'products', label: 'Productos' });
        if (can('config_goals', 'goals', 'view_tab')) tabs.push({ id: 'goals', label: 'Objetivos' });
        if (can('config_statuses', 'statuses', 'view_tab')) tabs.push({ id: 'statuses', label: 'Estatus' });
        if (can('config_users', 'config_users', 'view_tab')) tabs.push({ id: 'users', label: 'Usuarios' });
        if (can('config_policies', 'policies', 'view_tab')) tabs.push({ id: 'policies', label: 'Políticas' });
        return tabs;
    }, [can]);

    const [activeTab, setActiveTab] = useState<Tab>('campaigns');

    // Effect to ensure activeTab is always one of the allowed ones
    useEffect(() => {
        if (!permsLoading && allowedTabs.length > 0) {
            const isAllowed = allowedTabs.some(t => t.id === activeTab);
            if (!isAllowed) {
                setActiveTab(allowedTabs[0].id);
            }
        }
    }, [allowedTabs, activeTab, permsLoading]);

    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [total, setTotal] = useState(0);
    const [isTrashView, setIsTrashView] = useState(false);

    // Datos Auxiliares
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [statuses, setStatuses] = useState<any[]>([]);
    const [supervisors, setSupervisors] = useState<any[]>([]);
    const [allAgents, setAllAgents] = useState<any[]>([]);

    // --- FUNCIÓN DE CARGA BLINDADA (EL FIX PRINCIPAL) ---
    const loadTabData = useCallback(async () => {
        setData([]); // CRITICAL: Clear previous data to avoid "Ghost Data"
        setLoading(true);
        setError(null);

        try {
            // 1. Manejo especial para Productos (Componente independiente)
            if (activeTab === 'products') {
                setLoading(false);
                return;
            }

            let endpoint = '';
            switch (activeTab) {
                case 'users': endpoint = 'users/'; break;
                case 'campaigns': endpoint = 'campaigns/'; break;
                case 'statuses': endpoint = 'statuses/'; break;
                case 'goals': endpoint = 'goals/'; break;
                case 'policies': endpoint = 'policies/'; break;
            }

            // 2. Intentar cargar datos principales
            let mainResp: any = [];
            try {
                const params = new URLSearchParams({
                    page: page.toString(),
                    size: pageSize.toString()
                });
                if (searchQuery) params.append('search', searchQuery);
                if (isTrashView) params.append('trashed', 'true');

                // Si falla el endpoint principal (ej: 500 en goals), no rompemos todo
                mainResp = await fetchFromAPI(`/api/v1/${endpoint}?${params.toString()}`);
            } catch (e) {
                console.warn(`⚠️ El endpoint ${endpoint} falló (posible tabla inexistente). Usando lista vacía.`);
                mainResp = [];
            }

            // BLINDAJE: Extraer .items si viene paginado
            const mainList = mainResp?.items || (Array.isArray(mainResp) ? mainResp : []);
            setData(mainList);
            setTotal(mainResp?.total || (Array.isArray(mainResp) ? mainResp.length : 0));

            // 3. Cargar datos auxiliares SOLO si es necesario
            if (activeTab === 'goals' || activeTab === 'users' || activeTab === 'campaigns') {
                try {
                    // Cargamos campañas, usuarios y estatus en paralelo, pero con catch individual
                    const campaignsResp = await fetchFromAPI('/api/v1/campaigns/').catch(() => []);
                    const usersResp = await fetchFromAPI('/api/v1/users/').catch(() => []);
                    const statusesResp = await fetchFromAPI('/api/v1/statuses/').catch(() => []);

                    // BLINDAJE AUXILIAR
                    const safeCampaigns = campaignsResp?.items || (Array.isArray(campaignsResp) ? campaignsResp : []);
                    const safeUsers = usersResp?.items || (Array.isArray(usersResp) ? usersResp : []);
                    const safeStatuses = statusesResp?.items || (Array.isArray(statusesResp) ? statusesResp : []);

                    setCampaigns(safeCampaigns);
                    setStatuses(safeStatuses);

                    // Filtros de usuarios
                    // NEW LOGIC: We don't filter by role name strings here.
                    // Instead, we just pass all users to the components and let them handle display.
                    // If we MUST distinguish, we should do it based on backend-provided categories or permissions.
                    setSupervisors(safeUsers);
                    setAllAgents(safeUsers);
                } catch (auxError) {
                    console.error("Error cargando auxiliares:", auxError);
                }
            }

        } catch (err: any) {
            console.error("❌ Error crítico en ConfigManager:", err);

            // Si el error es de sesión (401), no activamos modo offline
            if (err.status === 401 || err.status === 403 || err.message === 'SESSION_KILLED') {
                return;
            }

            setError("Error de conexión. Trabajando en modo offline.");
            setData([]); // Fallback final
        } finally {
            // Interface unlocked
            setLoading(false);
        }
    }, [activeTab, page, pageSize, searchQuery, isTrashView]);

    useEffect(() => {
        // Synchronous cleanup to avoid state bleed
        setData([]);
        setLoading(true);
        // NO RESET PAGE HERE, it will be handled by tab change
    }, [activeTab, searchQuery]);

    useEffect(() => {
        // Reset page on tab or search change or trash view
        setPage(1);
    }, [activeTab, searchQuery, isTrashView]);

    useEffect(() => {
        loadTabData();
    }, [loadTabData]);

    // --- MANEJO DE MODALES Y GUARDADO ---
    const handleEdit = (item: any) => {
        setEditingItem(item);
        setIsEditing(true);
        setIsModalOpen(true);
    };

    const handleOpenModal = () => {

        if (activeTab === 'products') {
            window.dispatchEvent(new Event('open-product-modal'));
        }
        else if (activeTab === 'goals') {
            window.dispatchEvent(new Event('open-goal-modal'));
        }
        else if (activeTab === 'users') {
            window.dispatchEvent(new Event('open-user-modal'));
        }
        else if (activeTab === 'campaigns' || activeTab === 'statuses') {
            setEditingItem(null);
            setIsEditing(false);
            setIsModalOpen(true);
        }
    };

    const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setActionLoading(true);
        const formData = new FormData(e.currentTarget);

        try {
            // Obtener tenant dummy o real
            let tenantId = 'default-tenant';
            try {
                const orgData = await fetchFromAPI('/api/v1/organizations/me');
                tenantId = orgData.id;
            } catch (e) { /* Using tenant fallback */ }

            let payload: any = { tenant_id: tenantId };
            let method = isEditing ? 'PUT' : 'POST';
            let url = `/api/v1/${activeTab}/`;

            if (activeTab === 'campaigns') {
                payload.name = String(formData.get('name')).toUpperCase();
                payload.campaign_code = String(formData.get('campaign_code')).toUpperCase();
                payload.is_active = formData.get('is_active') === 'on';
                payload.default_status_id = formData.get('default_status_id') || null;
            } else if (activeTab === 'statuses') {
                payload.name = String(formData.get('name')).toUpperCase();
                payload.color_hex = formData.get('color_hex');
                payload.is_active = formData.get('is_active') === 'on';
                payload.is_default = formData.get('is_default') === 'on';
                payload.is_active_work = formData.get('is_active_work') === 'on';
                payload.is_productive = formData.get('is_productive') === 'on';
            }

            if (editingItem) url += editingItem.id;

            await fetchFromAPI(url, {
                method,
                body: JSON.stringify(payload)
            });

            setIsModalOpen(false);
            setEditingItem(null);
            setIsEditing(false);
            toast({
                title: "✅ Cambios Guardados",
                description: `El registro de ${activeTab === 'campaigns' ? 'campaña' : 'estatus'} se procesó correctamente.`,
            });
            loadTabData(); // Recargar datos
        } catch (err: any) {
            toast({
                title: "Error al guardar",
                description: err.message,
                variant: "destructive",
                duration: 8000
            });
        } finally {
            setActionLoading(false);
        }
    };

    const handleDeleteUnified = (id: string) => {
        toast({
            title: "¿Confirmar Eliminación?",
            description: `Se eliminará este registro de ${activeTab}.`,
            variant: "destructive",
            duration: Infinity,
            action: (
                <ToastAction
                    altText="ELIMINAR"
                    onClick={async () => {
                        // Optimistic update
                        const prevData = [...data];
                        setData(prev => prev.filter(item => item.id !== id));

                        try {
                            await fetchFromAPI(`/api/v1/${activeTab}/${id}`, { method: 'DELETE' });
                            toast({ title: "Registro Eliminado", description: "La base de datos ha sido actualizada." });
                        } catch (err: any) {
                            toast({ title: "Error", description: "No se pudo eliminar el registro.", variant: "destructive" });
                            setData(prevData); // Rollback
                        }
                    }}
                >
                    ELIMINAR
                </ToastAction>
            )
        });
    };

    const handlePurgeUnified = (id: string) => {
        toast({
            title: "☠️ ¿PURGAR REGISTRO?",
            description: `Esta acción ELIMINARÁ DEFINITIVAMENTE el registro de ${activeTab}. NO HAY VUELTA ATRÁS.`,
            variant: "destructive",
            duration: Infinity,
            action: (
                <ToastAction
                    altText="PURGAR"
                    onClick={async () => {
                        // Optimistic update
                        const prevData = [...data];
                        setData(prev => prev.filter(item => item.id !== id));

                        try {
                            // Usar ?force=true para purgar
                            await fetchFromAPI(`/api/v1/${activeTab}/${id}?force=true`, { method: 'DELETE' });
                            toast({ title: "Registro Purgado", description: "Eliminación definitiva completada." });

                            // FORCE REFRESH TO SYNC FRONTEND
                            loadTabData();

                        } catch (err: any) {
                            toast({ title: "Error", description: err.message, variant: "destructive" });
                            setData(prevData); // Rollback
                        }
                    }}
                    className="bg-black text-white hover:bg-gray-900 border-none"
                >
                    DESTRUIR
                </ToastAction>
            )
        });
    };

    // --- RENDERIZADO ---
    return (
        <div className="space-y-4 font-sans max-w-[1600px] mx-auto">
            <header className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight uppercase flex items-center gap-2">
                        <Cog6ToothIcon className="w-8 h-8 text-blue-600" />
                        Configuración de Sistemas
                    </h1>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">
                        Gestión Maestros y Parámetros Operativos
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    {/* Trash View Toggle */}
                    {(activeTab === 'campaigns' || activeTab === 'goals' || activeTab === 'users' || activeTab === 'products') && (
                        <button
                            onClick={() => setIsTrashView(!isTrashView)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg font-bold text-xs uppercase tracking-widest transition-all ${isTrashView
                                ? 'bg-red-100 text-red-700 border border-red-200 shadow-inner'
                                : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-200'
                                }`}
                        >
                            <Cog6ToothIcon className={`w-4 h-4 ${isTrashView ? 'text-red-500' : 'text-gray-400'}`} />
                            {isTrashView ? 'Viendo Papelera' : 'Papelera'}
                        </button>
                    )}

                    {activeTab !== 'users' && activeTab !== 'policies' && (
                        <button
                            onClick={handleOpenModal}
                            disabled={isTrashView} // Disable creation in trash view
                            className={`px-6 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 shadow-lg transition-all uppercase tracking-tighter ${isTrashView
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'
                                : 'bg-blue-700 hover:bg-blue-800 text-white shadow-blue-200'
                                }`}
                        >
                            <PlusIcon className="w-5 h-5" />
                            {activeTab === 'campaigns' ? 'Nueva Campaña' :
                                activeTab === 'products' ? 'Nuevo Producto' :
                                    activeTab === 'goals' ? 'Nuevo Objetivo' : 'Nuevo Registro'}
                        </button>
                    )}
                </div>
            </header>

            {/* BARRA DE BÚSQUEDA / ACCIONES */}
            <div className="bg-slate-50/50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4 w-full">
                    <div className="relative w-full max-w-xl">
                        <input
                            type="text"
                            placeholder={
                                activeTab === 'products' ? "BUSCAR EN CATÁLOGO..." :
                                    activeTab === 'goals' ? "BUSCAR POR CAMPAÑA O AGENTE..." :
                                        activeTab === 'statuses' ? "BUSCAR ESTATUS..." :
                                            activeTab === 'campaigns' ? "BUSCAR CAMPAÑA..." :
                                                activeTab === 'users' ? "BUSCAR USUARIO..." :
                                                    "BUSCAR REGISTROS..."
                            }
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/20 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-700 text-slate-900 dark:text-white uppercase"
                        />
                        <svg className="w-4 h-4 absolute left-3.5 top-2.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 hidden md:block" />
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden md:block">
                            Búsqueda Contextual Habilitada
                        </span>
                    </div>
                </div>
            </div>

            {/* TABS HEADER */}
            <div className="flex border-b border-gray-300 dark:border-slate-800 gap-1 overflow-x-auto no-scrollbar pt-2">
                {allowedTabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-6 py-2 text-[11px] font-bold uppercase tracking-widest transition-all rounded-t-md border-t border-x -mb-[1px]
                            ${activeTab === tab.id
                                ? 'bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-800 border-b-white dark:border-b-slate-900 text-gray-900 dark:text-slate-100 shadow-[0_-2px_5px_rgba(0,0,0,0.02)]'
                                : 'bg-gray-100 dark:bg-slate-800/50 border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-slate-300 hover:bg-gray-200/50 dark:hover:bg-slate-800'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* CONTENIDO PRINCIPAL */}
            {activeTab === 'products' ? (
                <ProductManager searchTerm={searchQuery} />
            ) : (
                <div className="">

                    {/* Área de Contenido */}
                    {loading ? (
                        <LoadingState message="Sincronizando datos operativos..." />
                    ) : (
                        <div className="animate-fade-in">
                            {activeTab === 'statuses' && (
                                <StatusFlowTable data={data.filter(i => (i.name || '').toUpperCase().includes(searchQuery.toUpperCase()))} onSave={(newData) => setData(newData)} />
                            )}
                            {activeTab === 'campaigns' && (
                                <CampaignsTable
                                    data={data.filter(i => (i.name || '').toUpperCase().includes(searchQuery.toUpperCase()) || (i.campaign_code || '').toUpperCase().includes(searchQuery.toUpperCase()))}
                                    onEdit={handleEdit}
                                    onDelete={handleDeleteUnified}
                                    isTrashView={isTrashView}
                                    onPurge={handlePurgeUnified}
                                />
                            )}
                            {activeTab === 'goals' && (
                                <GoalsTable
                                    data={data}
                                    allAgents={allAgents}
                                    supervisors={supervisors}
                                    onRefresh={loadTabData}
                                    isTrashView={isTrashView}
                                    onPurge={handlePurgeUnified}
                                />
                            )}
                            {activeTab === 'users' && (
                                <UsersTable
                                    data={data}
                                    supervisors={supervisors}
                                    campaigns={campaigns}
                                    onRefresh={loadTabData}
                                />
                            )}

                            {/* PAGINACIÓN PARA TABS COMPATIBLES */}
                            {(activeTab === 'goals' || activeTab === 'users') && (
                                <Pagination
                                    currentPage={page}
                                    totalRecords={total}
                                    pageSize={pageSize}
                                    onPageChange={setPage}
                                    onPageSizeChange={setPageSize}
                                />
                            )}
                            {activeTab === 'policies' && (
                                <RolePoliciesTable />
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* MODAL GENÉRICO (Para Campañas y Estatus) */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-white/10 rounded-lg backdrop-blur-md border border-white/20">
                            <TagIcon className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-white tracking-tight uppercase leading-tight">
                                {isEditing ? 'Actualizar' : 'Registrar'} {activeTab === 'campaigns' ? 'Campaña' : 'Estatus'}
                            </h3>
                            <p className="text-[10px] text-blue-200/60 font-medium uppercase tracking-widest mt-0.5">Gestión de Catálogo Maestro</p>
                        </div>
                    </div>
                }
                maxWidth="max-w-2xl"
            >
                <form onSubmit={handleSave} className="-m-6 flex flex-col max-h-[calc(95vh-3.5rem)] bg-white dark:bg-slate-900">
                    <div className="flex-1 overflow-y-auto p-8 space-y-6">
                        <div className="grid grid-cols-12 gap-5">
                            {activeTab === 'campaigns' && (
                                <>
                                    <div className="col-span-12 space-y-1.5">
                                        <label className="block text-[12px] font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider pl-1 font-black">Nombre de Campaña</label>
                                        <input
                                            required
                                            name="name"
                                            defaultValue={editingItem?.name}
                                            onChange={(e) => e.target.value = e.target.value.toUpperCase()}
                                            className="w-full border border-gray-300 dark:border-slate-700 rounded-md p-3 text-xs font-bold text-gray-900 dark:text-slate-100 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/20 outline-none transition-all uppercase bg-white dark:bg-slate-800 placeholder:text-gray-300"
                                            placeholder="EJE: VENTAS CLARO"
                                        />
                                    </div>
                                    <div className="col-span-12 space-y-1.5">
                                        <label className="block text-[12px] font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider pl-1 font-black">Código Interno</label>
                                        <input
                                            name="campaign_code"
                                            defaultValue={editingItem?.campaign_code}
                                            onChange={(e) => e.target.value = e.target.value.toUpperCase()}
                                            className="w-full border border-gray-300 dark:border-slate-700 rounded-md p-3 text-xs font-bold text-gray-900 dark:text-slate-100 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/20 outline-none transition-all uppercase bg-white dark:bg-slate-800 placeholder:text-gray-300"
                                            placeholder="EJE: CMP-001"
                                        />
                                    </div>
                                    <div className="col-span-12 space-y-1.5 pt-2">
                                        <label className="block text-[12px] font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider pl-1 font-black underline decoration-blue-500 underline-offset-4" title="Define el flujo inicial exclusivo para esta campaña. Si se deja vacío, el sistema usará la configuración global.">Estatus Inicial de Venta</label>
                                        <select
                                            name="default_status_id"
                                            defaultValue={editingItem?.default_status_id || ""}
                                            className="w-full border border-gray-300 dark:border-slate-700 rounded-md p-3 text-xs font-bold text-gray-900 dark:text-slate-100 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/20 outline-none transition-all uppercase bg-white dark:bg-slate-800 cursor-pointer"
                                        >
                                            <option value="" className="dark:bg-slate-800">USAR CONFIGURACIÓN GLOBAL (⭐)</option>
                                            {statuses.filter(s => s.is_active).map(status => (
                                                <option key={status.id} value={status.id} className="dark:bg-slate-800">
                                                    {status.name}
                                                </option>
                                            ))}
                                        </select>
                                        <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider pl-1">Define el flujo inicial exclusivo para esta campaña</p>
                                    </div>
                                </>
                            )}
                            {activeTab === 'statuses' && (
                                <>
                                    <div className="col-span-12 space-y-1.5">
                                        <label className="block text-[12px] font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider pl-1 font-black">Nombre del Estado</label>
                                        <input
                                            required
                                            name="name"
                                            defaultValue={editingItem?.name}
                                            onChange={(e) => e.target.value = e.target.value.toUpperCase()}
                                            className="w-full border border-gray-300 dark:border-slate-700 rounded-md p-3 text-xs font-bold text-gray-900 dark:text-slate-100 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/20 outline-none transition-all uppercase bg-white dark:bg-slate-800"
                                        />
                                    </div>
                                    <div className="col-span-12 space-y-1.5">
                                        <label className="block text-[12px] font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider pl-1 font-black">Identificador de Color</label>
                                        <div className="flex gap-4 items-center">
                                            <input type="color" name="color_hex" defaultValue={editingItem?.color_hex || '#000000'} className="w-14 h-12 border-none p-1 bg-transparent cursor-pointer" />
                                            <div className="flex-1 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-800 rounded-md px-4 h-12 flex items-center text-xs font-mono font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest">
                                                {editingItem?.color_hex || '#000000'}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="col-span-12 pt-1 border-b border-gray-100 dark:border-slate-800 pb-4">
                                        <label className="flex items-center gap-3 cursor-pointer select-none group bg-indigo-50/50 dark:bg-indigo-900/10 p-2 rounded-md border border-indigo-100 dark:border-indigo-900/30 shadow-sm">
                                            <div className="relative">
                                                <input type="checkbox" name="is_active_work" defaultChecked={editingItem?.is_active_work ?? true} className="peer hidden" />
                                                <div className="w-10 h-5 bg-gray-200 dark:bg-slate-700 rounded-full border border-gray-300 dark:border-slate-600 peer-checked:bg-indigo-600 peer-checked:border-indigo-700 transition-all" />
                                                <div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full peer-checked:translate-x-5 transition-all shadow-sm" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[12px] font-black text-gray-900 dark:text-slate-100 uppercase tracking-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">¿Mostrar en Dashboard Operativo?</span>
                                                <span className="text-[9px] text-indigo-500 font-bold uppercase tracking-wider">Define si las ventas en este estado requieren acción inmediata</span>
                                            </div>
                                        </label>
                                    </div>

                                    <div className="col-span-12 pt-1 border-b border-gray-100 dark:border-slate-800 pb-4">
                                        <label className="flex items-center gap-3 cursor-pointer select-none group bg-orange-50/50 dark:bg-orange-900/10 p-2 rounded-md border border-orange-100 dark:border-orange-900/30 shadow-sm">
                                            <div className="relative">
                                                <input type="checkbox" name="is_default" defaultChecked={editingItem?.is_default ?? false} className="peer hidden" />
                                                <div className="w-10 h-5 bg-gray-200 dark:bg-slate-700 rounded-full border border-gray-300 dark:border-slate-600 peer-checked:bg-orange-600 peer-checked:border-orange-700 transition-all" />
                                                <div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full peer-checked:translate-x-5 transition-all shadow-sm" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[12px] font-black text-gray-900 dark:text-slate-100 uppercase tracking-tight group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">Estatus Inicial de Sistema</span>
                                                <span className="text-[9px] text-orange-500 font-bold uppercase tracking-wider">Asignación automática a nuevas ventas si no hay config de campaña</span>
                                            </div>
                                        </label>
                                    </div>

                                    <div className="col-span-12 pt-1 border-b border-gray-100 dark:border-slate-800 pb-4">
                                        <label className="flex items-center gap-3 cursor-pointer select-none group bg-green-50/50 dark:bg-green-900/10 p-2 rounded-md border border-green-100 dark:border-green-900/30 shadow-sm">
                                            <div className="relative">
                                                <input type="checkbox" name="is_productive" defaultChecked={editingItem?.is_productive ?? false} className="peer hidden" />
                                                <div className="w-10 h-5 bg-gray-200 dark:bg-slate-700 rounded-full border border-gray-300 dark:border-slate-600 peer-checked:bg-green-600 peer-checked:border-green-700 transition-all" />
                                                <div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full peer-checked:translate-x-5 transition-all shadow-sm" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[12px] font-black text-gray-900 dark:text-slate-100 uppercase tracking-tight group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">¿Es Venta Productiva? (Suma a KPIs)</span>
                                                <span className="text-[9px] text-green-500 font-bold uppercase tracking-wider">Los registros en este estado contarán como ventas logradas en reportes</span>
                                            </div>
                                        </label>
                                    </div>
                                </>
                            )}

                            <div className="col-span-12 pt-2">
                                <label className="flex items-center gap-3 cursor-pointer select-none group">
                                    <div className="relative">
                                        <input type="checkbox" name="is_active" defaultChecked={editingItem?.is_active ?? true} className="peer hidden" />
                                        <div className="w-10 h-5 bg-gray-200 dark:bg-slate-700 rounded-full border border-gray-300 dark:border-slate-600 peer-checked:bg-green-500 peer-checked:border-green-600 transition-all" />
                                        <div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full peer-checked:translate-x-5 transition-all shadow-sm" />
                                    </div>
                                    <span className="text-[13px] font-bold text-gray-900 dark:text-slate-100 uppercase tracking-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">Registro Habilitado</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-4 p-6 bg-gray-50 dark:bg-slate-800/50 border-t border-gray-200 dark:border-slate-800 px-8">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 h-10 text-xs font-bold text-gray-400 dark:text-slate-500 uppercase hover:text-gray-900 dark:hover:text-slate-300 transition-all">Cancelar</button>
                        <button disabled={actionLoading} className="bg-gray-900 dark:bg-slate-700 text-white px-10 h-10 rounded-md text-xs font-bold uppercase tracking-widest transition-all hover:bg-black dark:hover:bg-slate-600 shadow-lg shadow-gray-200 dark:shadow-none active:scale-95 disabled:opacity-50">
                            {actionLoading ? 'Guardando...' : 'Confirmar Registro'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}