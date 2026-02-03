import { useState, useEffect, useMemo } from 'react';
import { PencilIcon, UserIcon } from '@heroicons/react/24/outline';
import { fetchFromAPI } from '@/lib/api';
import Modal from '@/components/Modal';
import { usePermission } from '@/hooks/usePermission';

interface UsersTableProps {
    data: any[];
    supervisors: any[];
    campaigns: any[];
    onRefresh: () => void;
}

export default function UsersTable({ data, supervisors, campaigns, onRefresh }: UsersTableProps) {
    const { can } = usePermission();
    const [allSkills, setAllSkills] = useState<{ label: string, value: string }[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // --- DEDUPLICACIÓN DE OPCIONES ---
    const uniqueCampaigns = useMemo(() => {
        const seen = new Set();
        return campaigns.filter(c => {
            const name = (c.name || "").toUpperCase();
            if (name && !seen.has(name)) {
                seen.add(name);
                return true;
            }
            return false;
        });
    }, [campaigns]);


    // TAREA 1: Cargar catálogo de skills (manifest optimizado)
    useEffect(() => {
        const loadSkills = async () => {
            try {
                const response = await fetchFromAPI('/api/v1/products/skills-manifest');
                setAllSkills(response?.items || (Array.isArray(response) ? response : []));
            } catch (err) {
                console.error("Error cargando skills para modal", err);
            }
        };
        if (isModalOpen) {
            loadSkills();
        }
    }, [isModalOpen]);

    useEffect(() => {

        const handleOpenNew = () => {
            setEditingItem(null);
            setIsModalOpen(true);
        };
        window.addEventListener('open-user-modal', handleOpenNew);
        return () => window.removeEventListener('open-user-modal', handleOpenNew);
    }, []);

    const handleEditClick = (item: any) => {
        setEditingItem(item);
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setActionLoading(true);
        setError(null);
        const formData = new FormData(e.currentTarget);

        try {
            // Solo campos operativos permitidos para PATCH
            const payload = {
                vicidial_user: formData.get('vicidial_user'),
                card_number: formData.get('card_number'),
                supervisor_id: formData.get('supervisor_id') || null,
                default_campaign_id: formData.get('default_campaign_id') || null,
                product_skills: Array.from(formData.getAll('product_skills')),
                custom_max_tasks: formData.get('custom_max_tasks') ? parseInt(formData.get('custom_max_tasks') as string) : null,
                join_date: formData.get('join_date') ? new Date(formData.get('join_date') as string).toISOString() : null
            };

            await fetchFromAPI(`/api/v1/users/${editingItem.id}`, {
                method: 'PATCH',
                body: JSON.stringify(payload)
            });

            setIsModalOpen(false);
            setEditingItem(null);
            onRefresh();
        } catch (err: any) {
            console.error(err);
            setError(err.message);
        } finally {
            setActionLoading(false);
        }
    };


    return (
        <div className="overflow-hidden border rounded-md border-gray-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 transition-colors">
            <table className="w-full text-left text-sm text-gray-700 dark:text-slate-300">
                <thead className="bg-gray-50 dark:bg-slate-800/50 uppercase font-bold text-[14px] text-gray-500 dark:text-slate-400 border-b border-gray-200 dark:border-slate-800">
                    <tr className="border-b dark:border-slate-800">
                        <th className="px-4 py-3">Agente / Usuario</th>
                        <th className="px-4 py-3">Supervisor</th>
                        <th className="px-4 py-3">Campaña</th>
                        <th className="px-4 py-3 text-center">Login / Vicidial</th>
                        <th className="px-4 py-3 text-center">Nº Tarjeta</th>
                        <th className="px-4 py-3 text-center">Estado</th>
                        <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                    {data.length === 0 ? (
                        <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400 dark:text-slate-500 font-medium text-[12px] uppercase tracking-widest">Sin registros en la base actual</td></tr>
                    ) : data.map((item) => (
                        <tr key={item.id} className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-all group">
                            <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700 text-slate-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-900 group-hover:border-blue-200 dark:group-hover:border-blue-800 group-hover:text-blue-500 transition-colors">
                                        <UserIcon className="w-4 h-4" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[12px] font-bold text-gray-800 dark:text-slate-200 uppercase tracking-tight">{item.first_name} {item.last_name}</span>
                                        <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">{item.role}</span>
                                    </div>
                                </div>
                            </td>
                            <td className="px-4 py-2.5">
                                {item.supervisor_id ? (
                                    <span className="text-[12px] font-bold text-gray-600 dark:text-slate-400 uppercase">
                                        {supervisors.find(s => s.id === item.supervisor_id)?.first_name || '---'}
                                    </span>
                                ) : (
                                    <span className="text-gray-400 dark:text-slate-500 italic text-[11px] tracking-tight">Sin asignar</span>
                                )}
                            </td>
                            <td className="px-4 py-2.5 text-[12px] font-bold text-gray-500 dark:text-slate-400 uppercase">
                                {campaigns.find(c => c.id === item.default_campaign_id)?.name || <span className="text-gray-300 dark:text-slate-600 font-normal">--</span>}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                                {item.vicidial_user ? (
                                    <span className="text-[12px] font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded border border-blue-100 dark:border-blue-900/30 uppercase">{item.vicidial_user}</span>
                                ) : (
                                    <span className="text-orange-400 dark:text-orange-500 font-bold text-[10px] flex items-center justify-center gap-1 uppercase tracking-tight">
                                        ⚠️ Pendiente
                                    </span>
                                )}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                                {item.card_number ? (
                                    <span className="text-[10px] font-bold text-gray-500 font-mono">
                                        {item.card_number}
                                    </span>
                                ) : (
                                    <span className="text-orange-400 font-bold text-[10px] flex items-center justify-center gap-1 uppercase tracking-tight">
                                        ⚠️ PENDIENTE
                                    </span>
                                )}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                                {item.is_blocked ? (
                                    <span className="bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400 border border-red-200 dark:border-red-900/30 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase block w-fit mx-auto">BLOQUEADO</span>
                                ) : item.is_active ? (
                                    <span className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-900/30 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase block w-fit mx-auto">ACTIVO</span>
                                ) : (
                                    <span className="bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-500 border border-gray-200 dark:border-slate-700 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase block w-fit mx-auto">INACTIVO</span>
                                )}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                                <div className="flex justify-end items-center gap-2">
                                    {can('config_users', 'config_users', 'update') && (
                                        <button
                                            onClick={() => handleEditClick(item)}
                                            className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-all"
                                            title="Editar operatividad"
                                        >
                                            <PencilIcon className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <Modal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditingItem(null); }}
                title={
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-white/10 rounded-lg backdrop-blur-md border border-white/20">
                            <UserIcon className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-white tracking-tight uppercase leading-tight">Configuración de Operatividad</h3>
                            <p className="text-[10px] text-blue-200/60 font-medium uppercase tracking-widest mt-0.5">Gestión de Perfil y Parámetros</p>
                        </div>
                    </div>
                }
                maxWidth="max-w-4xl"
            >
                <form onSubmit={handleSave} className="-m-6 flex flex-col bg-white dark:bg-slate-900 transition-colors">
                    <div className="flex-1 p-5 space-y-5">
                        {error && (
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-2 rounded-lg text-xs font-bold uppercase animate-shake">
                                {error}
                            </div>
                        )}

                        <div className="space-y-4">
                            <div className="border-b border-gray-100 dark:border-slate-800 pb-1.5">
                                <p className="text-[12px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-[0.2em]">01. Identidad Administrada</p>
                            </div>
                            <div className="grid grid-cols-12 gap-4">
                                <div className="col-span-6 space-y-1">
                                    <label className="text-[12px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider pl-1">Nombre Completo</label>
                                    <input disabled readOnly value={editingItem ? `${editingItem.first_name} ${editingItem.last_name}` : ''} className="w-full bg-gray-50 dark:bg-slate-800/50 text-gray-400 dark:text-slate-500 border border-gray-200 dark:border-slate-800 rounded-md px-3 h-9 text-xs font-bold cursor-not-allowed uppercase" />
                                </div>
                                <div className="col-span-6 space-y-1">
                                    <label className="text-[12px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider pl-1">Email / Usuario System</label>
                                    <input disabled readOnly value={editingItem?.email || ''} className="w-full bg-gray-50 dark:bg-slate-800/50 text-gray-400 dark:text-slate-500 border border-gray-200 dark:border-slate-800 rounded-md px-3 h-9 text-xs font-bold cursor-not-allowed uppercase" />
                                </div>
                                <div className="col-span-12 space-y-1">
                                    <label className="text-[12px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider pl-1 font-mono">Rol de Sistema</label>
                                    <div className="flex items-center gap-2 h-9 px-3 bg-blue-50/30 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900 rounded-md text-blue-700 dark:text-blue-400 text-xs font-bold uppercase tracking-tight">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                        {editingItem?.role || 'REPRESENTANTE'}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="border-b border-gray-100 dark:border-slate-800 pb-1.5 flex justify-between items-center">
                                <p className="text-[12px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em]">02. Parámetros Operativos</p>
                            </div>
                            <div className="grid grid-cols-12 gap-4">
                                <div className="col-span-6 space-y-1">
                                    <label className="text-[12px] font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider pl-1">ID Softphone / Vici</label>
                                    <input
                                        name="vicidial_user"
                                        defaultValue={editingItem?.vicidial_user}
                                        onChange={(e) => e.target.value = e.target.value.toUpperCase()}
                                        className="w-full border border-gray-300 dark:border-slate-700 rounded-md px-3 h-9 text-xs font-bold text-gray-900 dark:text-white focus:border-blue-600 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/20 outline-none transition-all uppercase bg-white dark:bg-slate-800"
                                        placeholder="EJE: 1001"
                                    />
                                </div>
                                <div className="col-span-6 space-y-1">
                                    <label className="text-[12px] font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider pl-1">Número de Tarjeta</label>
                                    <input
                                        name="card_number"
                                        defaultValue={editingItem?.card_number}
                                        onChange={(e) => e.target.value = e.target.value.toUpperCase()}
                                        className="w-full border border-gray-300 dark:border-slate-700 rounded-md px-3 h-9 text-xs font-bold text-gray-900 dark:text-white focus:border-blue-600 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/20 outline-none transition-all uppercase bg-white dark:bg-slate-800"
                                        placeholder="0000-0000-0000-0000"
                                    />
                                </div>
                                <div className="col-span-6 space-y-1">
                                    <label className="text-[12px] font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider pl-1">Jerarquía (Supervisor)</label>
                                    <select name="supervisor_id" defaultValue={editingItem?.supervisor_id || ''} className="w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-md px-3 h-9 text-xs font-bold text-gray-900 dark:text-white focus:border-blue-600 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/20 outline-none transition-all uppercase appearance-none">
                                        <option value="">Independiente / Sin Supervisor</option>
                                        {supervisors.map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
                                    </select>
                                </div>
                                <div className="col-span-6 space-y-1">
                                    <label className="text-[12px] font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider pl-1">Asignación de Campaña</label>
                                    <select name="default_campaign_id" defaultValue={editingItem?.default_campaign_id || ''} className="w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-md px-3 h-9 text-xs font-bold text-gray-900 dark:text-white focus:border-blue-600 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/20 outline-none transition-all uppercase appearance-none">
                                        <option value="">Sin Asignación</option>
                                        {uniqueCampaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div className="col-span-12 space-y-1">
                                    <label className="text-[12px] font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider pl-1 font-bold text-blue-600 dark:text-blue-400">Especialidades de Producto (Skills)</label>
                                    <div className="flex flex-wrap gap-4 p-3 border border-gray-100 dark:border-slate-800 rounded-md bg-gray-50/50 dark:bg-slate-800/50">
                                        {allSkills.map(item => (
                                            <label key={item.value} className="flex items-center gap-2 cursor-pointer group whitespace-nowrap">
                                                <input
                                                    type="checkbox"
                                                    name="product_skills"
                                                    value={item.value}
                                                    defaultChecked={editingItem?.product_skills?.includes(item.value)}
                                                    className="w-4 h-4 rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 transition-all bg-white dark:bg-slate-700"
                                                />
                                                <span className="text-[10px] font-bold text-gray-600 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                                    {item.label}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                    <p className="text-[9px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-wider mt-1">Selecciona todos los productos que este usuario está capacitado para gestionar</p>
                                </div>
                                <div className="col-span-6 space-y-1">
                                    <label className="text-[12px] font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider pl-1 text-orange-600 dark:text-orange-400 font-black">Límite WIP Individual</label>
                                    <input
                                        type="number"
                                        name="custom_max_tasks"
                                        placeholder="Usa límite del rol"
                                        defaultValue={editingItem?.custom_max_tasks}
                                        className="w-full border border-gray-300 dark:border-slate-700 rounded-md px-3 h-9 text-xs font-bold text-gray-900 dark:text-white focus:border-orange-500 dark:focus:border-orange-400 focus:ring-2 focus:ring-orange-100 dark:focus:ring-orange-900/20 outline-none transition-all bg-white dark:bg-slate-800"
                                    />
                                    <p className="text-[9px] text-orange-400 dark:text-orange-500 font-bold uppercase">Sobrescribe el límite global del rol para este usuario</p>
                                </div>
                                <div className="col-span-6 space-y-1">
                                    <label className="text-[12px] font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider pl-1">Fecha Efectiva Alta</label>
                                    <input type="date" name="join_date" defaultValue={editingItem?.join_date ? editingItem.join_date.split('T')[0] : ''} className="w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-md px-3 h-9 text-xs font-bold text-gray-900 dark:text-white focus:border-blue-600 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/20 outline-none transition-all" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-6 bg-gray-50 dark:bg-slate-950 border-t border-gray-200 dark:border-slate-800 shrink-0 px-8">
                        <div className="flex items-center gap-2">
                            <div className={`w-2.5 h-2.5 rounded-full ${editingItem?.is_active ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                            <span className="text-[12px] font-black text-gray-500 dark:text-slate-400 uppercase tracking-widest">{editingItem?.is_active ? 'USUARIO ACTIVO EN SISTEMA' : 'USUARIO INACTIVO'}</span>
                        </div>
                        <div className="flex gap-4">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 h-10 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 rounded-md transition-all">Cancelar</button>
                            <button disabled={actionLoading} type="submit" className="bg-gray-900 dark:bg-slate-100 hover:bg-black dark:hover:bg-white text-white dark:text-slate-900 px-10 h-10 rounded-md text-xs font-bold uppercase tracking-widest transition-all shadow-lg dark:shadow-none active:scale-95 disabled:opacity-50">
                                {actionLoading ? 'Guardando...' : 'Aplicar Cambios'}
                            </button>
                        </div>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
