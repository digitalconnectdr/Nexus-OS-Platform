'use client';

import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { usePermission } from '@/hooks/usePermission';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';

interface CampaignsTableProps {
    data: any[];
    onEdit: (item: any) => void;
    onDelete: (id: string) => void;
}

export default function CampaignsTable({ data, onEdit, onDelete }: CampaignsTableProps) {
    const { can } = usePermission();
    const { toast } = useToast();

    const handleDelete = (id: string) => {
        toast({
            title: "¿Confirmar eliminación?",
            description: "Esta acción no se puede deshacer y afectará los registros vinculados.",
            variant: "destructive",
            duration: Infinity,
            action: (
                <ToastAction
                    altText="Confirmar eliminación"
                    onClick={() => onDelete(id)}
                    className="bg-red-600 text-white hover:bg-red-700 border-none px-4"
                >
                    ELIMINAR
                </ToastAction>
            ),
        });
    };

    return (
        <div className="overflow-hidden border border-gray-200 dark:border-slate-800 rounded-lg shadow-sm">
            <table className="w-full text-left">
                <thead className="bg-gray-50 dark:bg-slate-800/50 uppercase font-bold text-[14px] text-gray-500 dark:text-slate-300 border-b border-gray-200 dark:border-slate-800">
                    <tr className="border-b dark:border-slate-800">
                        <th className="px-6 py-4">Campaña Madre</th>
                        <th className="px-6 py-4">Código Interno</th>
                        <th className="px-6 py-4 whitespace-nowrap">Estado Inicial</th>
                        <th className="px-6 py-4 text-center">Estado</th>
                        <th className="px-6 py-4 text-right">Acciones</th>
                    </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-100 dark:divide-slate-800">
                    {data.length > 0 ? (
                        data.map((item) => (
                            <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors group">
                                <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <span className="text-[14px] font-bold text-gray-700 dark:text-slate-300 uppercase tracking-tight">{item.name}</span>
                                        <span className="text-[9px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-tighter">ID: {item.id.substring(0, 8)}...</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-[12px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest">{item.campaign_code || '---'}</span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-black uppercase px-2 py-1 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-100 dark:border-blue-900/30">
                                        {item.default_status_name || 'CONFIG. GLOBAL'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <span className={`px-3 py-1 text-[11px] font-black uppercase tracking-widest rounded-full border ${item.is_active
                                        ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-900/30'
                                        : 'bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-500 border-gray-200 dark:border-slate-700'
                                        }`}>
                                        {item.is_active ? 'Activo' : 'Inactivo'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {can('config_campaigns', 'campaigns', 'manage') && (
                                            <>
                                                <button
                                                    onClick={() => onEdit(item)}
                                                    className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                                                    title="Editar"
                                                >
                                                    <PencilIcon className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(item.id)}
                                                    className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <TrashIcon className="w-5 h-5" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-gray-500 dark:text-slate-400 text-sm font-black uppercase tracking-widest">
                                No se encontraron registros coincidentes
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
