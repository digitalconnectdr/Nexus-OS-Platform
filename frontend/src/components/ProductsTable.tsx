'use client';

import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { usePermission } from '@/hooks/usePermission';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';

interface ProductsTableProps {
    data: any[];
    searchTerm: string;
    campaigns: any[];
    selectedIds: string[];
    onToggleSelect: (id: string) => void;
    onSelectAll: (ids: string[]) => void;
    onEdit: (item: any) => void;
    onDelete: (id: string) => void;
    onToggleStatus: (item: any) => void;
}

export default function ProductsTable({
    data,
    searchTerm,
    campaigns,
    selectedIds,
    onToggleSelect,
    onSelectAll,
    onEdit,
    onDelete,
    onToggleStatus
}: ProductsTableProps) {
    const { can } = usePermission();
    const { toast } = useToast();
    // El filtrado ahora es Server-Side
    const isAllSelected = data.length > 0 && selectedIds.length === data.length;

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            onSelectAll(data.map(p => p.id));
        } else {
            onSelectAll([]);
        }
    };

    const handleDelete = (id: string) => {
        toast({
            title: "¿Confirmar eliminación?",
            description: "Esta acción eliminará el producto del catálogo permanentemente.",
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
        <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm bg-white">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-800">
                <thead className="bg-gray-50 dark:bg-slate-800/50 uppercase font-bold text-[11px] text-gray-500 dark:text-slate-300 border-b border-gray-200 dark:border-slate-800 tracking-wider">
                    <tr>
                        <th className="px-6 py-3 text-left">
                            <input
                                type="checkbox"
                                checked={isAllSelected}
                                onChange={handleSelectAll}
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                        </th>
                        <th className="px-4 py-3 text-left">Campaña Madre</th>
                        <th className="px-4 py-3 text-left">Familia de Origen</th>
                        <th className="px-4 py-3 text-left">Nodo de Venta (Producto / Plan)</th>
                        <th className="px-4 py-3 text-right">Precio ($)</th>
                        <th className="px-4 py-3 text-right">Comisión ($)</th>
                        <th className="px-4 py-3 text-center">Estado</th>
                        <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-800">
                    {data.map((product) => (
                        <tr key={product.id} className={`hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors group ${selectedIds.includes(product.id) ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 text-blue-600 border-gray-300 dark:border-slate-700 rounded focus:ring-blue-500 dark:bg-slate-800"
                                    checked={selectedIds.includes(product.id)}
                                    onChange={() => onToggleSelect(product.id)}
                                />
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                                <span className="text-[11px] font-black text-gray-900 dark:text-slate-100 uppercase tracking-tight">
                                    {campaigns.find(c => c.id === product.campaign_id)?.name || '---'}
                                </span>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase">
                                {product.family_name}
                            </td>
                            <td className="px-4 py-4">
                                <div className="flex flex-col">
                                    <strong className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                                        {product.name}
                                    </strong>
                                    <a href="#" onClick={(e) => e.preventDefault()} className="text-[10px] text-blue-600 dark:text-blue-400 font-bold hover:underline uppercase tracking-tighter mt-0.5">
                                        {product.plan_name || 'SIN DESCRIPCIÓN'}
                                    </a>
                                </div>
                            </td>
                            <td className="px-4 py-4 text-right whitespace-nowrap">
                                <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                                    ${(product.current_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </td>
                            <td className="px-4 py-4 text-right whitespace-nowrap">
                                <span className="text-xs font-black text-blue-700 dark:text-blue-400">
                                    ${(product.incentive || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-center">
                                <button
                                    onClick={() => can('config_products', 'products', 'update') && onToggleStatus(product)}
                                    disabled={!can('config_products', 'products', 'update')}
                                    className={`px-2.5 py-1 inline-flex text-[9px] font-black uppercase tracking-widest rounded-full border ${product.is_active
                                        ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-900/30'
                                        : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-500 border-gray-200 dark:border-slate-700'}`}
                                >
                                    {product.is_active ? 'Activo' : 'Inactivo'}
                                </button>
                            </td>
                            <td className="px-4 py-4 text-right whitespace-nowrap">
                                <div className="flex justify-end items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {can('config_products', 'products', 'update') && (
                                        <button
                                            onClick={() => onEdit(product)}
                                            className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                                            title="Editar"
                                        >
                                            <PencilIcon className="w-5 h-5" />
                                        </button>
                                    )}
                                    {can('config_products', 'products', 'delete') && (
                                        <button
                                            onClick={() => handleDelete(product.id)}
                                            className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                                            title="Eliminar"
                                        >
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                            </td>
                        </tr>
                    ))}
                    {data.length === 0 && (
                        <tr>
                            <td colSpan={8} className="px-6 py-12 text-center text-gray-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest">
                                No se encontraron productos coincidentes
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
