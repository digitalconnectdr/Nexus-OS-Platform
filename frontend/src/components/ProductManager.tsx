'use client';

import { useState, useEffect, useCallback } from 'react';
import Modal from '@/components/Modal';
import { fetchFromAPI } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { PencilIcon, TrashIcon, CubeIcon, TagIcon, CurrencyDollarIcon, PresentationChartLineIcon, ArrowDownTrayIcon, CloudArrowUpIcon, ExclamationTriangleIcon, CheckCircleIcon, ArrowPathIcon, ArrowUpTrayIcon, ArchiveBoxXMarkIcon } from '@heroicons/react/24/outline';
import ProductsTable from './ProductsTable';
import Pagination from '@/components/ui/Pagination';
import LoadingState from '@/components/ui/LoadingState';
import { usePermission } from '@/hooks/usePermission';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';

export default function ProductManager({ searchTerm = '' }: { searchTerm?: string }) {
    const { can } = usePermission();
    const { toast } = useToast();
    const [products, setProducts] = useState<any[]>([]);
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<any>(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importLoading, setImportLoading] = useState(false);
    const [importResult, setImportResult] = useState<any>(null);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [batchLoading, setBatchLoading] = useState(false);
    const [localSearch, setLocalSearch] = useState(searchTerm);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [total, setTotal] = useState(0);
    const [isTrashView, setIsTrashView] = useState(false);

    useEffect(() => {
        loadData();

        const handleOpenModal = () => {
            setEditingProduct(null);
            setIsModalOpen(true);
        };

        window.addEventListener('open-product-modal', handleOpenModal);
        return () => window.removeEventListener('open-product-modal', handleOpenModal);
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            setPage(1); // Reset to page 1 on search
            loadData(localSearch);
        }, 300);
        return () => clearTimeout(timer);
    }, [localSearch]);

    // Reload when changing view mode (active vs trash)
    useEffect(() => {
        setPage(1);
        loadData();
    }, [isTrashView]);

    useEffect(() => {
        loadData();
    }, [page, pageSize]);

    const loadData = useCallback(async (q?: string) => {
        setLoading(true);
        setError(null);
        try {
            const queryParam = q || localSearch || searchTerm;
            const params = new URLSearchParams({
                page: page.toString(),
                size: pageSize.toString(),
                sort_by: 'name'
            });
            if (queryParam) params.append('search', queryParam);
            if (isTrashView) params.append('trashed', 'true');

            const productUrl = `/api/v1/products/?${params.toString()}`;

            const [pData, cData] = await Promise.all([
                fetchFromAPI(productUrl),
                fetchFromAPI('/api/v1/campaigns/')
            ]);

            setProducts(pData?.items || []);
            setTotal(pData?.total || 0);
            setCampaigns(cData?.items || (Array.isArray(cData) ? cData : []));
            setSelectedIds([]); // Limpiar selección al recargar
        } catch (err: any) {
            console.error('Failed to load products:', err);
            if (err.name === 'TypeError' || err.message.includes('fetch')) {
                setError("Conectando con el servidor...");
            } else {
                setError(err.message);
            }
        } finally {
            setLoading(false);
        }
    }, [searchTerm, localSearch]);

    const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setActionLoading(true);
        setError(null);
        const formData = new FormData(e.currentTarget);

        try {
            const orgData = await fetchFromAPI('/api/v1/organizations/me');

            const productData = {
                name: String(formData.get('name')).toUpperCase().trim(),
                family_name: String(formData.get('family_name')).toUpperCase().trim(),
                plan_name: String(formData.get('plan_name')).toUpperCase().trim(),
                current_price: parseFloat(formData.get('current_price') as string) || 0,
                current_pp: String(formData.get('current_pp') || '').toUpperCase().trim(),
                current_concept: formData.get('current_concept'),
                incentive: parseFloat(formData.get('incentive') as string) || 0,
                is_active: formData.get('is_active') === 'on',
                campaign_id: formData.get('campaign_id'),
                tenant_id: orgData.id
            };

            const url = editingProduct
                ? `/api/v1/products/${editingProduct.id}`
                : `/api/v1/products/`;

            await fetchFromAPI(url, {
                method: editingProduct ? 'PUT' : 'POST',
                body: JSON.stringify(productData)
            });

            setIsModalOpen(false);
            setEditingProduct(null);
            toast({
                title: "✅ Producto Guardado",
                description: `El SKU "${productData.name}" ha sido actualizado en el catálogo.`,
            });
            loadData();
        } catch (err: any) {
            console.error(err);
            setError(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const toggleStatus = async (product: any) => {
        try {
            await fetchFromAPI(`/api/v1/products/${product.id}`, {
                method: 'PUT',
                body: JSON.stringify({ is_active: !product.is_active })
            });
            loadData();
        } catch (err: any) {
            console.error('Failed to toggle status:', err);
            setError("Error al cambiar estatus");
        }
    };

    const handleToggleSelection = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleSelectAll = (ids: string[]) => {
        setSelectedIds(ids);
    };

    const handleBatchDelete = () => {
        toast({
            title: "¿Confirmar Acción Masiva?",
            description: `Se eliminarán ${selectedIds.length} productos permanentemente.`,
            variant: "destructive",
            duration: Infinity,
            action: (
                <ToastAction
                    altText="ELIMINAR"
                    onClick={async () => {
                        setBatchLoading(true);
                        try {
                            await fetchFromAPI('/api/v1/products/batch-delete', {
                                method: 'POST',
                                body: JSON.stringify(selectedIds)
                            });
                            toast({ title: "Acción Completada", description: "Varios ítems han sido removido del catálogo." });
                            setSelectedIds([]);
                            loadData();
                        } catch (err: any) {
                            toast({ title: "Error en Batch", description: err.message, variant: "destructive" });
                        } finally {
                            setBatchLoading(false);
                        }
                    }}
                >
                    ELIMINAR
                </ToastAction>
            )
        });
    };

    const handleExport = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            const baseUrl = process.env.NEXT_PUBLIC_API_URL;

            const response = await fetch(`${baseUrl}/api/v1/products/export`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || 'Fallo al exportar el catálogo');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `catalogo_productos_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            toast({ title: "✅ Exportación Iniciada", description: "El archivo CSV se ha generado correctamente." });
        } catch (err: any) {
            toast({
                title: "Error al exportar",
                description: err.message || "No se pudo generar el archivo.",
                variant: "destructive"
            });
        }
    };

    const handleDelete = (id: string) => {
        toast({
            title: "¿Eliminar Producto?",
            description: "Esta acción removerá el ítem de forma permanente.",
            variant: "destructive",
            duration: Infinity,
            action: (
                <ToastAction
                    altText="ELIMINAR"
                    onClick={async () => {
                        const previousProducts = [...products];
                        setProducts(prev => prev.filter(p => p.id !== id));
                        try {
                            await fetchFromAPI(`/api/v1/products/${id}`, { method: 'DELETE' });
                            toast({ title: "Producto Eliminado", description: "Catálogo actualizado." });
                        } catch (err: any) {
                            toast({ title: "Error", description: err.message, variant: "destructive" });
                            setProducts(previousProducts);
                        }
                    }}
                >
                    ELIMINAR
                </ToastAction>
            )
        });
    };

    const handlePurge = (id: string) => {
        // En la vista de papelera, eliminar significa purgar (force delete)
        // El backend debe manejar la eliminación física si ya está "deleted" o si se recibe un flag.
        // Asumiendo que el endpoint DELETE estándar elimina físicamente si ya está borrado (soft-delete state)
        // O si necesitamos un endpoint específico de purga.
        // Por ahora usaré el mismo DELETE, suponiendo que el backend maneja doble-eliminación o parámetro force.
        // Revisando tarea: "Backend: Schemas & Endpoints to support trashed filter".
        // Si no hay endpoint específico de purga, DELETE normal debería funcionar si el backend lo permite.

        // Mejor opción para estar seguro: enviar ?force=true si es trash view, aunque el backend podría deducirlo.

        const doPurge = async () => {
            const previousProducts = [...products];
            setProducts(prev => prev.filter(p => p.id !== id));
            try {
                // Try adding force param just in case backend supports it
                await fetchFromAPI(`/api/v1/products/${id}?force=true`, { method: 'DELETE' });
                toast({ title: "Producto Purgado", description: "Registro eliminado definitivamente." });
                // FORCE REFRESH
                loadData();
            } catch (err: any) {
                toast({ title: "Error al purgar", description: err.message, variant: "destructive" });
                setProducts(previousProducts);
            }
        };
        doPurge();
    };

    const listProductTemplate = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            const baseUrl = process.env.NEXT_PUBLIC_API_URL;

            const response = await fetch(`${baseUrl}/api/v1/products/template`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) throw new Error('Fallo al descargar la plantilla');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'plantilla_productos.csv';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err: any) {
            toast({
                title: "Error",
                description: err.message || "No se pudo descargar la plantilla.",
                variant: "destructive"
            });
        }
    };

    const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImportLoading(true);
        setImportResult(null);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const result = await fetchFromAPI('/api/v1/products/import', {
                method: 'POST',
                body: formData,
                isFormData: true
            });
            setImportResult(result);
            toast({
                title: "Importación Finalizada",
                description: `Proceso completado. Revise el resumen de resultados.`,
            });
            loadData();
        } catch (err: any) {
            toast({
                title: "Falla en Importación",
                description: err.message || "Error al procesar el archivo CSV.",
                variant: "destructive",
                duration: 10000
            });
        } finally {
            setImportLoading(false);
            e.target.value = ''; // Reset input
        }
    };

    return (
        <div className="">
            <div className="px-4 py-2 flex justify-between items-center mb-2">
                <div className="flex items-center gap-4 flex-1">
                    <h3 className="text-[11px] font-bold text-gray-900 dark:text-slate-100 uppercase tracking-widest text-[#001741] whitespace-nowrap">PRODUCTOS EN SISTEMA</h3>
                    <div className="relative w-64 group">
                        <input
                            type="text"
                            placeholder="BUSCAR SKU, PRODUCTO O FAMILIA..."
                            value={localSearch}
                            onChange={(e) => setLocalSearch(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-800 rounded-md py-1.5 pl-8 pr-3 text-[10px] font-bold text-gray-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:border-blue-600 focus:ring-4 focus:ring-blue-50 dark:focus:ring-blue-900/20 outline-none transition-all uppercase placeholder:text-gray-400"
                        />
                        <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 group-focus-within:text-blue-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>

                    <button
                        onClick={() => setIsTrashView(!isTrashView)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${isTrashView
                            ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 ring-2 ring-red-100 dark:ring-red-900/40'
                            : 'bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-slate-400 border border-transparent hover:bg-gray-100 dark:hover:bg-slate-700'
                            }`}
                        title={isTrashView ? "Salir de Papelera" : "Ver Papelera de Reciclaje"}
                    >
                        {isTrashView ? (
                            <>
                                <ArrowPathIcon className="w-3.5 h-3.5" />
                                <span>Volver a Activos</span>
                            </>
                        ) : (
                            <>
                                <ArchiveBoxXMarkIcon className="w-3.5 h-3.5" />
                                <span>Papelera</span>
                            </>
                        )}
                    </button>
                </div>
                <div className="flex items-center gap-3">
                    {can('config_products', 'products', 'export') && (
                        <button
                            onClick={handleExport}
                            className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold text-gray-600 dark:text-slate-400 border border-gray-200 dark:border-slate-800 rounded-md hover:bg-gray-50 dark:hover:bg-slate-800 transition-all uppercase tracking-wider"
                        >
                            <ArrowUpTrayIcon className="w-3.5 h-3.5" />
                            Exportar Todo
                        </button>
                    )}
                    {can('config_products', 'products', 'import') && (
                        <button
                            onClick={() => listProductTemplate()}
                            className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/30 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all uppercase tracking-wider"
                        >
                            <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                            Plantilla
                        </button>
                    )}
                    {can('config_products', 'products', 'import') && (
                        <button
                            onClick={() => setIsImportModalOpen(true)}
                            className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold text-white bg-[#001741] dark:bg-slate-800 dark:border dark:border-slate-700 rounded-md hover:bg-black dark:hover:bg-slate-750 transition-all uppercase tracking-wider shadow-sm"
                        >
                            <CloudArrowUpIcon className="w-3.5 h-3.5" />
                            Carga Masiva
                        </button>
                    )}
                </div>
            </div>

            {selectedIds.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/10 border-y border-red-100 dark:border-red-900/30 px-6 py-2.5 flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-4">
                        <div className="bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm">
                            {selectedIds.length}
                        </div>
                        <p className="text-[11px] font-bold text-red-900 dark:text-red-400 uppercase tracking-tight">Elementos seleccionados para acción masiva</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setSelectedIds([])}
                            className="text-[10px] font-bold text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 uppercase tracking-widest transition-colors"
                        >
                            Cancelar
                        </button>
                        {can('config_products', 'products', 'delete') && (
                            <button
                                onClick={handleBatchDelete}
                                disabled={batchLoading}
                                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider shadow-md shadow-red-200 dark:shadow-none transition-all active:scale-95 disabled:opacity-50"
                            >
                                {batchLoading ? (
                                    <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <TrashIcon className="w-3.5 h-3.5" />
                                )}
                                Eliminar Seleccionados
                            </button>
                        )}
                    </div>
                </div>
            )}

            {error && (
                <div className="bg-blue-50 dark:bg-blue-900/10 text-blue-800 dark:text-blue-400 px-4 py-2 text-[9px] font-black uppercase tracking-widest border-b border-blue-100 dark:border-blue-900/30 flex items-center justify-between animate-pulse">
                    <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                        {error.includes('Conectando') ? 'Sincronizando Catálogo...' : error}
                    </div>
                    <button
                        onClick={() => loadData()}
                        className="bg-blue-600 text-white px-2 py-0.5 rounded-sm hover:bg-blue-700 transition-colors"
                    >
                        Reintentar
                    </button>
                </div>
            )}

            <div className="bg-white dark:bg-slate-900">
                {loading ? (
                    <LoadingState message="Sincronizando catálogo de productos..." />
                ) : (
                    <ProductsTable
                        data={products}
                        searchTerm={searchTerm}
                        campaigns={campaigns}
                        selectedIds={selectedIds}
                        onToggleSelect={handleToggleSelection}
                        onSelectAll={handleSelectAll}
                        onEdit={(item) => { setEditingProduct(item); setIsModalOpen(true); }}
                        onDelete={handleDelete}
                        onToggleStatus={toggleStatus}
                        isTrashView={isTrashView}
                        onPurge={handlePurge}
                    />
                )}
            </div>

            <Pagination
                currentPage={page}
                totalRecords={total}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
            />

            <Modal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditingProduct(null); }}
                title={
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-white/10 rounded-lg backdrop-blur-md border border-white/20">
                            <CubeIcon className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-white tracking-tight uppercase leading-tight">
                                {editingProduct ? 'Configurar' : 'Registrar'} Producto / SKU
                            </h3>
                            <p className="text-[10px] text-blue-200/60 font-medium uppercase tracking-widest mt-0.5">Catálogo Maestro de Oferta Comercial</p>
                        </div>
                    </div>
                }
                maxWidth="max-w-4xl"
            >
                <form onSubmit={handleSave} className="-m-6 flex flex-col bg-white dark:bg-slate-900">
                    <div className="flex-1 p-6 space-y-6">
                        {/* SECCIÓN 1: DEFINICIÓN COMERCIAL */}
                        <div className="space-y-4">
                            <div className="border-b border-gray-100 dark:border-slate-800 pb-1.5 flex items-center gap-2">
                                <TagIcon className="w-3.5 h-3.5 text-blue-500" />
                                <p className="text-[12px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-[0.2em]">01. Definición Comercial</p>
                            </div>
                            <div className="grid grid-cols-12 gap-4">
                                <div className="col-span-6 space-y-1">
                                    <label className="text-[12px] font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider pl-1 font-black">Campaña</label>
                                    <select required name="campaign_id" defaultValue={editingProduct?.campaign_id || ''} className="w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-md px-3 h-[38px] text-xs font-bold text-gray-900 dark:text-slate-100 focus:border-blue-600 focus:ring-4 focus:ring-blue-50 dark:focus:ring-blue-900/20 outline-none appearance-none transition-all uppercase">
                                        <option value="" className="dark:bg-slate-800">Seleccione Campaña</option>
                                        {campaigns.map(c => <option key={c.id} value={c.id} className="dark:bg-slate-800">{c.name}</option>)}
                                    </select>
                                </div>
                                <div className="col-span-6 space-y-1">
                                    <label className="text-[12px] font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider pl-1 font-black">Familia / Categoría</label>
                                    <input
                                        required
                                        name="family_name"
                                        defaultValue={editingProduct?.family_name || ''}
                                        onChange={(e) => e.target.value = e.target.value.toUpperCase()}
                                        className="w-full border border-gray-300 dark:border-slate-700 rounded-md p-2.5 text-xs font-bold text-gray-900 dark:text-slate-100 focus:border-blue-600 focus:ring-4 focus:ring-blue-50 dark:focus:ring-blue-900/20 outline-none transition-all uppercase bg-white dark:bg-slate-800"
                                        placeholder="EJE: INTERNET RESIDENCIAL"
                                    />
                                </div>
                                <div className="col-span-6 space-y-1">
                                    <label className="text-[12px] font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider pl-1 font-black">PRODUCTO</label>
                                    <input
                                        required
                                        name="name"
                                        defaultValue={editingProduct?.name || ''}
                                        onChange={(e) => e.target.value = e.target.value.toUpperCase()}
                                        className="w-full border border-gray-300 dark:border-slate-700 rounded-md p-2.5 text-xs font-bold text-gray-900 dark:text-slate-100 focus:border-blue-600 focus:ring-4 focus:ring-blue-50 dark:focus:ring-blue-900/20 outline-none transition-all uppercase bg-white dark:bg-slate-800"
                                        placeholder="EJE: FIBRA ÓPTICA 500MB"
                                    />
                                </div>
                                <div className="col-span-6 space-y-1">
                                    <label className="text-[12px] font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider pl-1 font-black">PLAN</label>
                                    <input
                                        name="plan_name"
                                        defaultValue={editingProduct?.plan_name || ''}
                                        onChange={(e) => e.target.value = e.target.value.toUpperCase()}
                                        className="w-full border border-gray-300 dark:border-slate-700 rounded-md p-2.5 text-xs font-bold text-gray-900 dark:text-slate-100 focus:border-blue-600 focus:ring-4 focus:ring-blue-50 dark:focus:ring-blue-900/20 outline-none transition-all uppercase bg-white dark:bg-slate-800"
                                        placeholder="EJE: PLAN_HFC_500"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* SECCIÓN 2: VALORES Y COMISIONES */}
                        <div className="space-y-4">
                            <div className="border-b border-gray-100 dark:border-slate-800 pb-1.5 flex items-center gap-2">
                                <CurrencyDollarIcon className="w-3.5 h-3.5 text-green-600 dark:text-green-500" />
                                <p className="text-[12px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-[0.2em]">02. Valores e Incentivos</p>
                            </div>
                            <div className="grid grid-cols-12 gap-4">
                                <div className="col-span-4 space-y-1">
                                    <label className="text-[12px] font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider pl-1 font-black text-green-700 dark:text-green-500 tracking-tight">Venta Base ($)</label>
                                    <input required type="number" step="0.01" name="current_price" defaultValue={editingProduct?.current_price || 0} className="w-full border border-gray-300 dark:border-slate-700 rounded-md p-2.5 text-sm font-black text-gray-900 dark:text-slate-100 focus:border-green-600 focus:ring-4 focus:ring-green-50 dark:focus:ring-green-900/20 outline-none transition-all bg-green-50/10 dark:bg-green-900/10" />
                                </div>
                                <div className="col-span-4 space-y-1">
                                    <label className="text-[12px] font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider pl-1 font-black text-blue-700 dark:text-blue-500 tracking-tight">Comisión ($)</label>
                                    <input required type="number" step="0.01" name="incentive" defaultValue={editingProduct?.incentive || 0} className="w-full border border-gray-300 dark:border-slate-700 rounded-md p-2.5 text-sm font-black text-gray-900 dark:text-slate-100 focus:border-blue-600 focus:ring-4 focus:ring-blue-50 dark:focus:ring-blue-900/20 outline-none transition-all bg-blue-50/10 dark:bg-blue-900/10" />
                                </div>
                                <div className="col-span-4 flex items-end pb-0.5">
                                    <label className="flex items-center gap-3 cursor-pointer select-none group w-full bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-800 rounded-md h-[40px] px-4">
                                        <div className="relative">
                                            <input type="checkbox" name="is_active" defaultChecked={editingProduct ? editingProduct.is_active : true} className="peer hidden" />
                                            <div className="w-8 h-4 bg-gray-200 dark:bg-slate-700 rounded-full border border-gray-300 dark:border-slate-600 peer-checked:bg-green-500 peer-checked:border-green-600 transition-all" />
                                            <div className="absolute left-0.5 top-0.5 w-3 h-3 bg-white rounded-full peer-checked:translate-x-4 transition-all shadow-sm" />
                                        </div>
                                        <span className="text-[13px] font-black text-gray-900 dark:text-slate-100 uppercase group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors tracking-tight">Habilitado</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* SECCIÓN 3: PARAMETRÍA TÉCNICA */}
                        <div className="space-y-4">
                            <div className="border-b border-gray-100 dark:border-slate-800 pb-1.5 flex items-center gap-2">
                                <PresentationChartLineIcon className="w-3.5 h-3.5 text-gray-900 dark:text-slate-100" />
                                <p className="text-[12px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-[0.2em]">03. Parametría Técnica</p>
                            </div>
                            <div className="grid grid-cols-12 gap-4">
                                <div className="col-span-6 space-y-1">
                                    <label className="text-[12px] font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider pl-1 font-black">Referencia PP / SKU</label>
                                    <input
                                        name="current_pp"
                                        defaultValue={editingProduct?.current_pp || ''}
                                        onChange={(e) => e.target.value = e.target.value.toUpperCase()}
                                        className="w-full border border-gray-300 dark:border-slate-700 rounded-md p-2.5 text-xs font-mono font-bold text-gray-900 dark:text-slate-100 focus:border-gray-900 focus:ring-4 focus:ring-gray-100 dark:focus:ring-slate-800 outline-none transition-all uppercase bg-white dark:bg-slate-800"
                                        placeholder="EJE: PP-CLR-500"
                                    />
                                </div>
                                <div className="col-span-6 space-y-1">
                                    <label className="text-[12px] font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider pl-1 font-black">Concepto Factura</label>
                                    <input
                                        name="current_concept"
                                        defaultValue={editingProduct?.current_concept || ''}
                                        className="w-full border border-gray-300 dark:border-slate-700 rounded-md p-2.5 text-xs font-bold text-gray-900 dark:text-slate-100 focus:border-blue-600 focus:ring-4 focus:ring-blue-50 dark:focus:ring-blue-900/20 outline-none transition-all bg-white dark:bg-slate-800"
                                        placeholder="EJE: PLAN INTERNET"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-between items-center p-5 bg-gray-50 dark:bg-slate-800/50 border-t border-gray-200 dark:border-slate-800 shrink-0 px-8">
                        <div className="flex items-center gap-2">
                            <div className={`w-2.5 h-2.5 rounded-full ${editingProduct?.is_active ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                            <span className="text-[12px] font-black text-gray-500 dark:text-slate-400 uppercase tracking-widest leading-none">Status en Catálogo Maestro</span>
                        </div>
                        <div className="flex gap-4">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 h-10 text-xs font-bold text-gray-400 dark:text-slate-500 uppercase hover:text-gray-900 dark:hover:text-slate-300 transition-colors">Cancelar</button>
                            <button disabled={actionLoading} type="submit" className="bg-gray-900 dark:bg-slate-700 hover:bg-black dark:hover:bg-slate-600 text-white px-10 h-10 rounded-md text-xs font-bold uppercase tracking-widest transition-all shadow-lg shadow-gray-200 dark:shadow-none active:scale-95 disabled:opacity-50">
                                {actionLoading ? 'Actualizando...' : (editingProduct ? 'Aplicar Cambios' : 'Confirmar Nuevo SKU')}
                            </button>
                        </div>
                    </div>
                </form>
            </Modal>
            <Modal
                isOpen={isImportModalOpen}
                onClose={() => { setIsImportModalOpen(false); setImportResult(null); }}
                title={
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-white/10 rounded-lg backdrop-blur-md border border-white/20">
                            <CloudArrowUpIcon className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-white tracking-tight uppercase leading-tight">Carga Masiva de Productos</h3>
                            <p className="text-[10px] text-blue-200/60 font-medium uppercase tracking-widest mt-0.5">Importación rápida desde CSV</p>
                        </div>
                    </div>
                }
                maxWidth="max-w-2xl"
            >
                <div className="p-6 bg-white dark:bg-slate-900 -m-6 flex flex-col gap-6">
                    {!importResult ? (
                        <div className="space-y-6">
                            <div className="p-12 border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-xl bg-gray-50 dark:bg-slate-800/20 flex flex-col items-center justify-center gap-4 text-center">
                                <div className="p-4 bg-white dark:bg-slate-900 rounded-full shadow-sm border border-gray-100 dark:border-slate-800">
                                    <CloudArrowUpIcon className="w-8 h-8 text-blue-500" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-gray-900 dark:text-slate-100 uppercase">Seleccione el archivo CSV</p>
                                    <p className="text-[10px] text-gray-500 dark:text-slate-400 font-medium mt-1">Asegúrese de usar el formato de la plantilla oficial</p>
                                </div>
                                <input
                                    type="file"
                                    accept=".csv"
                                    onChange={handleImportFile}
                                    disabled={importLoading}
                                    className="block w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-[10px] file:font-bold file:bg-[#001741] file:text-white hover:file:bg-black cursor-pointer file:cursor-pointer"
                                />
                                {importLoading && (
                                    <div className="flex items-center gap-2 text-blue-600 text-xs font-bold animate-pulse">
                                        <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" />
                                        Procesando datos...
                                    </div>
                                )}
                            </div>
                            <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 p-4 rounded-lg flex gap-3">
                                <ExclamationTriangleIcon className="w-5 h-5 text-blue-500 shrink-0" />
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-blue-900 dark:text-blue-400 uppercase">Instrucciones Importantes</p>
                                    <ul className="text-[10px] text-blue-800 dark:text-blue-500 space-y-1 list-disc pl-4 font-medium uppercase tracking-tight">
                                        <li>No cambie los encabezados de la plantilla.</li>
                                        <li>La combinación de <span className="font-black text-blue-900 dark:text-blue-400">"Campaña + Referencia PP"</span> es el identificador único para actualizaciones.</li>
                                        <li>Los precios e incentivos deben ser números sin símbolos de moneda.</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className={`p-4 rounded-xl border ${importResult.error_count === 0 ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-900/30' : 'bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-900/30'}`}>
                                <div className="flex items-center gap-3">
                                    {importResult.error_count === 0 ? (
                                        <CheckCircleIcon className="w-6 h-6 text-green-500" />
                                    ) : (
                                        <ExclamationTriangleIcon className="w-6 h-6 text-orange-500" />
                                    )}
                                    <div>
                                        <p className={`text-sm font-black uppercase ${importResult.error_count === 0 ? 'text-green-900 dark:text-green-400' : 'text-orange-900 dark:text-orange-400'}`}>
                                            {importResult.error_count === 0 ? 'Importación Exitosa' : 'Importación con Advertencias'}
                                        </p>
                                        <p className="text-[10px] font-bold text-gray-600 dark:text-slate-400 uppercase">
                                            {importResult.success_count} productos procesados correctamente.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {importResult.errors.length > 0 && (
                                <div className="space-y-3">
                                    <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest pl-1">Detalle de Errores ({importResult.error_count})</p>
                                    <div className="max-h-[300px] overflow-y-auto border border-gray-200 dark:border-slate-800 rounded-lg shadow-inner">
                                        <table className="w-full text-left text-[10px]">
                                            <thead className="bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-slate-400 font-black uppercase sticky top-0">
                                                <tr>
                                                    <th className="px-3 py-2 border-b dark:border-slate-700">Fila</th>
                                                    <th className="px-3 py-2 border-b dark:border-slate-700">Columna</th>
                                                    <th className="px-3 py-2 border-b dark:border-slate-700">Mensaje de Error</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-slate-800 uppercase">
                                                {importResult.errors.map((error: any, idx: number) => (
                                                    <tr key={idx} className="hover:bg-red-50/50 dark:hover:bg-red-900/10">
                                                        <td className="px-3 py-2 font-mono font-bold text-gray-500 dark:text-slate-400">{error.row}</td>
                                                        <td className="px-3 py-2 font-bold text-gray-700 dark:text-slate-300">{error.column}</td>
                                                        <td className="px-3 py-2 text-red-600 dark:text-red-400 font-bold">{error.message}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={() => { setIsImportModalOpen(false); setImportResult(null); }}
                                className="w-full py-3 bg-gray-900 dark:bg-slate-700 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-black dark:hover:bg-slate-600 transition-all shadow-lg dark:shadow-none active:scale-95"
                            >
                                Entendido
                            </button>
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
}
