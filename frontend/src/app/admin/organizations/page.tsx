'use client';
import { useState, useEffect } from 'react';
import { fetchFromAPI } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import Modal from '@/components/Modal';
import {
    PlusIcon,
    PencilSquareIcon,
    TrashIcon,
    BuildingOfficeIcon,
    ArrowPathIcon,
    ShieldCheckIcon
} from '@heroicons/react/24/outline';
import LoadingState from '@/components/ui/LoadingState';
import { usePermission } from '@/hooks/usePermission';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';

interface Organization {
    id: string;
    name: string;
    slug: string;
    created_at?: string;
}

export default function OrganizationsPage() {
    const { can } = usePermission();
    const { toast } = useToast();
    const [orgs, setOrgs] = useState<Organization[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState('');

    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
    const [showDeleted, setShowDeleted] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        slug: ''
    });

    const fetchOrgs = async () => {
        setLoading(true);
        try {
            const data = await fetchFromAPI(`/api/v1/organizations/?trashed=${showDeleted}`);
            // Robust check: even if API returns some because of partial filters 
            // the client will only show based on toggle
            const filteredData = data.filter((o: any) => showDeleted ? o.is_deleted : !o.is_deleted);
            setOrgs(filteredData);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al cargar organizaciones');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrgs();
    }, [showDeleted]);

    const handleOpenModal = (org: Organization | null = null) => {
        setEditingOrg(org);
        setFormData({
            name: org ? org.name : '',
            slug: org ? org.slug : ''
        });
        setError('');
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setActionLoading(true);
        setError('');

        try {
            const url = editingOrg ? `/api/v1/organizations/${editingOrg.id}` : '/api/v1/organizations/';
            const method = editingOrg ? 'PATCH' : 'POST';

            await fetchFromAPI(url, {
                method,
                body: JSON.stringify(formData)
            });

            setIsModalOpen(false);
            toast({
                title: "Cambios Guardados",
                description: `La organización "${formData.name}" ha sido gestionada con éxito.`,
            });
            fetchOrgs();
        } catch (err: any) {
            setError(err.message || 'Error al guardar');
        } finally {
            setActionLoading(false);
        }
    };

    const handleRestore = (org: any) => {
        toast({
            title: "¿Restaurar Organización?",
            description: `Se reactivará el acceso para "${org.name}".`,
            action: (
                <ToastAction
                    altText="RESTAURAR"
                    onClick={async () => {
                        setActionLoading(true);
                        try {
                            await fetchFromAPI(`/api/v1/organizations/${org.id}`, {
                                method: 'PATCH',
                                body: JSON.stringify({ is_deleted: false })
                            });
                            toast({ title: "Organización Restaurada", description: "La organización está activa nuevamente." });
                            fetchOrgs();
                        } catch (err: any) {
                            toast({ title: "Error", description: err.message, variant: "destructive" });
                        } finally {
                            setActionLoading(false);
                        }
                    }}
                >
                    RESTAURAR
                </ToastAction>
            )
        });
    };

    const handleDelete = (id: string, name: string) => {
        toast({
            title: "¿Eliminar Tenante?",
            description: `Se eliminará permanentemente la organización "${name}" y todos sus datos asociados.`,
            variant: "destructive",
            duration: Infinity,
            action: (
                <ToastAction
                    altText="ELIMINAR"
                    onClick={async () => {
                        setActionLoading(true);
                        try {
                            await fetchFromAPI(`/api/v1/organizations/${id}`, { method: 'DELETE' });
                            toast({ title: "Tenante Eliminado", description: "La organización ya no existe en el sistema." });
                            fetchOrgs();
                        } catch (err: any) {
                            toast({ title: "Error", description: err.message, variant: "destructive" });
                        } finally {
                            setActionLoading(false);
                        }
                    }}
                >
                    ELIMINAR
                </ToastAction>
            )
        });
    };

    // Permisos Dinámicos
    const canCreate = can('policies', 'organizations', 'create');
    const canEdit = can('policies', 'organizations', 'update');
    const canDelete = can('policies', 'organizations', 'delete');

    return (
        <div className="w-full max-w-[1600px] mx-auto p-6 space-y-6">
            <header className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight uppercase flex items-center gap-2">
                        <BuildingOfficeIcon className="w-8 h-8 text-blue-600" />
                        Instancias y Organizaciones
                    </h1>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">
                        Configuración Global de Tenantes
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer select-none bg-white px-3 py-2 rounded-lg border border-slate-200">
                        <input
                            type="checkbox"
                            checked={showDeleted}
                            onChange={(e) => setShowDeleted(e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 transition-all"
                        />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ver Eliminados</span>
                    </label>

                    {canCreate && (
                        <button
                            onClick={() => handleOpenModal()}
                            className="bg-blue-700 hover:bg-blue-800 text-white px-6 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 shadow-lg shadow-blue-200 transition-all uppercase tracking-tighter"
                        >
                            <PlusIcon className="w-5 h-5" />
                            Nueva Organización
                        </button>
                    )}
                </div>
            </header>

            {
                error && !isModalOpen && (
                    <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded mb-6 flex justify-between items-center">
                        <span className="font-medium">{error}</span>
                        <button onClick={() => setError('')} className="text-red-500 hover:text-red-700">×</button>
                    </div>
                )
            }

            <div className="bg-white shadow-xl shadow-slate-200/50 rounded-2xl border border-slate-100 overflow-hidden">
                <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50/50">
                        <tr>
                            <th className="px-8 py-4 text-left text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Organización</th>
                            <th className="px-8 py-4 text-left text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Identificador (Slug)</th>
                            <th className="px-8 py-4 text-left text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">ID de Rastreo</th>
                            <th className="px-8 py-4 text-right text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-50">
                        {loading ? (
                            <tr>
                                <td colSpan={4} className="px-8 py-4">
                                    <LoadingState message="Sincronizando Organizaciones..." />
                                </td>
                            </tr>
                        ) : orgs.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-8 py-12 text-center text-slate-400 font-medium">No hay organizaciones registradas</td>
                            </tr>
                        ) : orgs.map((org: any) => (
                            <tr key={org.id} className={`hover:bg-slate-50/30 transition-colors group ${org.is_deleted ? 'opacity-60 grayscale bg-slate-50' : ''}`}>
                                <td className="px-8 py-5 whitespace-nowrap">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold transition-all ${org.is_deleted ? 'bg-slate-200 text-slate-500' : 'bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white'}`}>
                                            {org.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-700 text-sm tracking-tight">{org.name}</span>
                                            {org.is_deleted && <span className="text-[9px] font-black text-red-500 uppercase tracking-widest">ELIMINADO</span>}
                                        </div>
                                    </div>
                                </td>
                                <td className="px-8 py-5 whitespace-nowrap">
                                    <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold font-mono uppercase">
                                        {org.slug}
                                    </span>
                                </td>
                                <td className="px-8 py-5 whitespace-nowrap">
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(org.id);
                                            toast({ title: "ID Copiado", description: "El identificador está en el portapapeles." });
                                        }}
                                        className="text-slate-400 hover:text-blue-600 transition-colors flex items-center gap-2 group/id"
                                    >
                                        <span className="text-[10px] font-mono leading-none">{org.id}</span>
                                        <svg className="w-3.5 h-3.5 opacity-0 group-hover/id:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                        </svg>
                                    </button>
                                </td>
                                <td className="px-8 py-5 whitespace-nowrap text-right">
                                    <div className="flex justify-end gap-2">
                                        {!org.is_deleted ? (
                                            <>
                                                {canEdit && (
                                                    <button
                                                        onClick={() => handleOpenModal(org)}
                                                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                        title="Editar"
                                                    >
                                                        <PencilSquareIcon className="w-5 h-5" />
                                                    </button>
                                                )}
                                                {canDelete && (
                                                    <button
                                                        onClick={() => handleDelete(org.id, org.name)}
                                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                        title="Eliminar"
                                                    >
                                                        <TrashIcon className="w-5 h-5" />
                                                    </button>
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                {canEdit && (
                                                    <button
                                                        onClick={() => handleRestore(org)}
                                                        className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                        title="Restaurar"
                                                    >
                                                        <ArrowPathIcon className="w-5 h-5" />
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={
                    <div className="flex items-center gap-2 font-black uppercase tracking-tight">
                        <ShieldCheckIcon className="w-5 h-5 text-blue-400" />
                        {editingOrg ? 'Editar Organización' : 'Nueva Organización'}
                    </div>
                }
                maxWidth="max-w-md"
            >
                <form onSubmit={handleSave} className="space-y-6">
                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-xs font-bold border border-red-100">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Nombre Comercial</label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all"
                            placeholder="Ej. Acme Corp"
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Slug (URL / ID)</label>
                        <input
                            type="text"
                            value={formData.slug}
                            onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all font-mono"
                            placeholder="acme-corp (Opcional)"
                        />
                        <p className="text-[10px] text-slate-400 mt-2 ml-1">Si se deja vacío, se generará automáticamente a partir del nombre.</p>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="flex-1 px-4 py-3 border border-slate-200 text-slate-500 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={actionLoading}
                            className="flex-1 px-4 py-3 bg-[#001741] text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-blue-900 transition-all shadow-lg shadow-blue-100 disabled:opacity-50"
                        >
                            {actionLoading ? 'Guardando...' : 'Guardar Cambios'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div >
    );
}
