'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Modal from '@/components/Modal';
import ProductManager from '@/components/ProductManager';
import StatusFlowTable from '@/components/dashboard/StatusFlowTable';
import { fetchFromAPI } from '@/lib/api';
import { TagIcon, PencilIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import CampaignsTable from './CampaignsTable';
import GoalsTable from './GoalsTable';
import UsersTable from './UsersTable';
import RolePoliciesTable from './RolePoliciesTable';
import Pagination from '@/components/ui/Pagination';

type Tab = 'campaigns' | 'products' | 'goals' | 'statuses' | 'users' | 'policies';

export default function ConfigManager() {
    const [activeTab, setActiveTab] = useState<Tab>('campaigns');
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
                    if (safeUsers.length > 0) {
                        const sups = safeUsers.filter((u: any) =>
                            u.role?.toUpperCase().includes('SUPERVISOR')
                        );
                        setSupervisors(sups);

                        const agents = safeUsers.filter((u: any) =>
                            u.role?.toUpperCase() === 'REPRESENTANTE' ||
                            u.role?.toUpperCase() === 'AGENTE' ||
                            u.role?.toUpperCase() === 'USER' // Incluimos USER por si acaso
                        );
                        setAllAgents(agents);
                    }
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
    }, [activeTab, page, pageSize, searchQuery]);

    useEffect(() => {
        // Synchronous cleanup to avoid state bleed
        setData([]);
        setLoading(true);
        // NO RESET PAGE HERE, it will be handled by tab change
    }, [activeTab, searchQuery]);

    useEffect(() => {
        // Reset page on tab or search change
        setPage(1);
    }, [activeTab, searchQuery]);

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
            loadTabData(); // Recargar datos
        } catch (err: any) {
            alert("Error al guardar: " + err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleDeleteUnified = async (id: string) => {
        if (!confirm(`¿Eliminar este registro?`)) return;

        // Optimistic update
        const prevData = [...data];
        setData(prev => prev.filter(item => item.id !== id));

        try {
            await fetchFromAPI(`/api/v1/${activeTab}/${id}`, { method: 'DELETE' });
        } catch (err) {
            alert("Error al eliminar");
            setData(prevData); // Rollback
        }
    };

    // --- RENDERIZADO ---
    return (
        <div className="space-y-4 font-sans max-w-[1600px] mx-auto">
            <header className="flex justify-between items-center mb-2">
                <div>
                    <h2 className="text-lg font-bold text-gray-900 uppercase tracking-tight">Configuración de Sistemas</h2>
                    <p className="text-[11px] text-gray-900 font-bold uppercase tracking-wider">Gestión maestros y parámetros operativos</p>
                </div>
            </header>

            {/* BARRA DE BÚSQUEDA / ACCIONES */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="relative flex-1 md:w-80">
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
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-10 h-10 text-xs font-bold text-gray-900 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-50 outline-none transition-all uppercase"
                        />
                        <svg className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {activeTab !== 'users' && activeTab !== 'policies' && (
                        <button
                            onClick={handleOpenModal}
                            className="bg-gray-900 text-white px-6 h-10 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all hover:bg-black shadow-lg shadow-gray-200 flex items-center gap-2 active:scale-95"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                            </svg>
                            {activeTab === 'campaigns' ? 'Nueva Campaña' :
                                activeTab === 'products' ? 'Nuevo Producto' :
                                    activeTab === 'goals' ? 'Nuevo Objetivo' : 'Nuevo Registro'}
                        </button>
                    )}
                </div>
            </div>

            {/* TABS HEADER */}
            <div className="flex border-b border-gray-300 gap-1 overflow-x-auto no-scrollbar pt-2">
                {(['campaigns', 'products', 'goals', 'statuses', 'users', 'policies'] as Tab[]).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-6 py-2 text-[11px] font-bold uppercase tracking-widest transition-all rounded-t-md border-t border-x -mb-[1px]
                            ${activeTab === tab
                                ? 'bg-white border-gray-300 border-b-white text-gray-900 shadow-[0_-2px_5px_rgba(0,0,0,0.05)]'
                                : 'bg-gray-100 border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}`}
                    >
                        {tab === 'campaigns' ? 'Campañas' :
                            tab === 'products' ? 'Productos' :
                                tab === 'goals' ? 'Objetivos' :
                                    tab === 'statuses' ? 'Estatus' :
                                        tab === 'users' ? 'Usuarios' : 'Políticas de Rol'}
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
                        <div className="p-12 text-center bg-white border border-gray-200 rounded-md shadow-sm">
                            <p className="text-sm font-bold text-gray-400 animate-pulse uppercase">Sincronizando datos operativos...</p>
                        </div>
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
                                />
                            )}
                            {activeTab === 'goals' && (
                                <GoalsTable
                                    data={data}
                                    allAgents={allAgents}
                                    supervisors={supervisors}
                                    onRefresh={loadTabData}
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
                <form onSubmit={handleSave} className="-m-6 flex flex-col max-h-[calc(95vh-3.5rem)] bg-white">
                    <div className="flex-1 overflow-y-auto p-8 space-y-6">
                        <div className="grid grid-cols-12 gap-5">
                            {activeTab === 'campaigns' && (
                                <>
                                    <div className="col-span-12 space-y-1.5">
                                        <label className="block text-[12px] font-bold text-gray-700 uppercase tracking-wider pl-1 font-black">Nombre de Campaña</label>
                                        <input
                                            required
                                            name="name"
                                            defaultValue={editingItem?.name}
                                            onChange={(e) => e.target.value = e.target.value.toUpperCase()}
                                            className="w-full border border-gray-300 rounded-md p-3 text-xs font-bold text-gray-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all uppercase bg-white placeholder:text-gray-300"
                                            placeholder="EJE: VENTAS CLARO"
                                        />
                                    </div>
                                    <div className="col-span-12 space-y-1.5">
                                        <label className="block text-[12px] font-bold text-gray-700 uppercase tracking-wider pl-1 font-black">Código Interno</label>
                                        <input
                                            name="campaign_code"
                                            defaultValue={editingItem?.campaign_code}
                                            onChange={(e) => e.target.value = e.target.value.toUpperCase()}
                                            className="w-full border border-gray-300 rounded-md p-3 text-xs font-bold text-gray-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all uppercase bg-white placeholder:text-gray-300"
                                            placeholder="EJE: CMP-001"
                                        />
                                    </div>
                                    <div className="col-span-12 space-y-1.5 pt-2">
                                        <label className="block text-[12px] font-bold text-gray-700 uppercase tracking-wider pl-1 font-black underline decoration-blue-500 underline-offset-4" title="Define el flujo inicial exclusivo para esta campaña. Si se deja vacío, el sistema usará la configuración global.">Estatus Inicial de Venta</label>
                                        <select
                                            name="default_status_id"
                                            defaultValue={editingItem?.default_status_id || ""}
                                            className="w-full border border-gray-300 rounded-md p-3 text-xs font-bold text-gray-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all uppercase bg-white cursor-pointer"
                                        >
                                            <option value="">USAR CONFIGURACIÓN GLOBAL (⭐)</option>
                                            {statuses.filter(s => s.is_active).map(status => (
                                                <option key={status.id} value={status.id}>
                                                    {status.name}
                                                </option>
                                            ))}
                                        </select>
                                        <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wider pl-1">Define el flujo inicial exclusivo para esta campaña</p>
                                    </div>
                                </>
                            )}
                            {activeTab === 'statuses' && (
                                <>
                                    <div className="col-span-12 space-y-1.5">
                                        <label className="block text-[12px] font-bold text-gray-700 uppercase tracking-wider pl-1 font-black">Nombre del Estado</label>
                                        <input
                                            required
                                            name="name"
                                            defaultValue={editingItem?.name}
                                            onChange={(e) => e.target.value = e.target.value.toUpperCase()}
                                            className="w-full border border-gray-300 rounded-md p-3 text-xs font-bold text-gray-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all uppercase bg-white"
                                        />
                                    </div>
                                    <div className="col-span-12 space-y-1.5">
                                        <label className="block text-[12px] font-bold text-gray-700 uppercase tracking-wider pl-1 font-black">Identificador de Color</label>
                                        <div className="flex gap-4 items-center">
                                            <input type="color" name="color_hex" defaultValue={editingItem?.color_hex || '#000000'} className="w-14 h-12 border-none p-1 bg-transparent cursor-pointer" />
                                            <div className="flex-1 bg-gray-50 border border-gray-200 rounded-md px-4 h-12 flex items-center text-xs font-mono font-bold text-gray-500 uppercase tracking-widest">
                                                {editingItem?.color_hex || '#000000'}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="col-span-12 pt-1 border-b border-gray-100 pb-4">
                                        <label className="flex items-center gap-3 cursor-pointer select-none group bg-indigo-50/50 p-2 rounded-md border border-indigo-100 shadow-sm">
                                            <div className="relative">
                                                <input type="checkbox" name="is_active_work" defaultChecked={editingItem?.is_active_work ?? true} className="peer hidden" />
                                                <div className="w-10 h-5 bg-gray-200 rounded-full border border-gray-300 peer-checked:bg-indigo-600 peer-checked:border-indigo-700 transition-all" />
                                                <div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full peer-checked:translate-x-5 transition-all shadow-sm" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[12px] font-black text-gray-900 uppercase tracking-tight group-hover:text-indigo-600 transition-colors">¿Mostrar en Dashboard Operativo?</span>
                                                <span className="text-[9px] text-indigo-500 font-bold uppercase tracking-wider">Define si las ventas en este estado requieren acción inmediata</span>
                                            </div>
                                        </label>
                                    </div>

                                    <div className="col-span-12 pt-1 border-b border-gray-100 pb-4">
                                        <label className="flex items-center gap-3 cursor-pointer select-none group bg-orange-50/50 p-2 rounded-md border border-orange-100 shadow-sm">
                                            <div className="relative">
                                                <input type="checkbox" name="is_default" defaultChecked={editingItem?.is_default ?? false} className="peer hidden" />
                                                <div className="w-10 h-5 bg-gray-200 rounded-full border border-gray-300 peer-checked:bg-orange-600 peer-checked:border-orange-700 transition-all" />
                                                <div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full peer-checked:translate-x-5 transition-all shadow-sm" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[12px] font-black text-gray-900 uppercase tracking-tight group-hover:text-orange-600 transition-colors">Estatus Inicial de Sistema</span>
                                                <span className="text-[9px] text-orange-500 font-bold uppercase tracking-wider">Asignación automática a nuevas ventas si no hay config de campaña</span>
                                            </div>
                                        </label>
                                    </div>

                                    <div className="col-span-12 pt-1 border-b border-gray-100 pb-4">
                                        <label className="flex items-center gap-3 cursor-pointer select-none group bg-green-50/50 p-2 rounded-md border border-green-100 shadow-sm">
                                            <div className="relative">
                                                <input type="checkbox" name="is_productive" defaultChecked={editingItem?.is_productive ?? false} className="peer hidden" />
                                                <div className="w-10 h-5 bg-gray-200 rounded-full border border-gray-300 peer-checked:bg-green-600 peer-checked:border-green-700 transition-all" />
                                                <div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full peer-checked:translate-x-5 transition-all shadow-sm" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[12px] font-black text-gray-900 uppercase tracking-tight group-hover:text-green-600 transition-colors">¿Es Venta Productiva? (Suma a KPIs)</span>
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
                                        <div className="w-10 h-5 bg-gray-200 rounded-full border border-gray-300 peer-checked:bg-green-500 peer-checked:border-green-600 transition-all" />
                                        <div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full peer-checked:translate-x-5 transition-all shadow-sm" />
                                    </div>
                                    <span className="text-[13px] font-bold text-gray-900 uppercase tracking-tight group-hover:text-blue-600 transition-colors">Registro Habilitado</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-4 p-6 bg-gray-50 border-t border-gray-200 px-8">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 h-10 text-xs font-bold text-gray-400 uppercase hover:text-gray-900 transition-all">Cancelar</button>
                        <button disabled={actionLoading} className="bg-gray-900 text-white px-10 h-10 rounded-md text-xs font-bold uppercase tracking-widest transition-all hover:bg-black shadow-lg shadow-gray-200 active:scale-95 disabled:opacity-50">
                            {actionLoading ? 'Guardando...' : 'Confirmar Registro'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}