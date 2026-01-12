'use client';

import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

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
    // El filtrado ahora es Server-Side
    const isAllSelected = data.length > 0 && selectedIds.length === data.length;

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            onSelectAll(data.map(p => p.id));
        } else {
            onSelectAll([]);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Está seguro de eliminar este producto del catálogo?')) return;
        onDelete(id);
    };

    return (
        <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm bg-white">
            <table className="w-full text-left text-sm text-gray-700">
                <thead className="bg-gray-50 uppercase font-bold text-[11px] text-gray-500 border-b border-gray-200 tracking-wider">
                    <tr>
                        <th className="px-4 py-3 w-10">
                            <input
                                type="checkbox"
                                checked={isAllSelected}
                                onChange={handleSelectAll}
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                        </th>
                        <th className="px-4 py-3">Campaña Madre</th>
                        <th className="px-4 py-3">Familia de Origen</th>
                        <th className="px-4 py-3">Nodo de Venta (Producto / Plan)</th>
                        <th className="px-4 py-3 text-right">Precio ($)</th>
                        <th className="px-4 py-3 text-center">Estado</th>
                        <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {data.length === 0 ? (
                        <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400 font-medium text-[12px] uppercase tracking-widest">No hay coincidencias en el catálogo</td></tr>
                    ) : data.map((product) => (
                        <tr key={product.id} className={`hover:bg-gray-50 transition-colors group ${selectedIds.includes(product.id) ? 'bg-blue-50/30' : ''}`}>
                            <td className="px-4 py-2.5 w-10 border-r border-gray-50">
                                <input
                                    type="checkbox"
                                    checked={selectedIds.includes(product.id)}
                                    onChange={() => onToggleSelect(product.id)}
                                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                            </td>
                            <td className="px-4 py-2.5 border-r border-gray-50 text-[12px] font-bold text-gray-700 uppercase">
                                {campaigns.find(c => c.id === product.campaign_id)?.name || '---'}
                            </td>
                            <td className="px-4 py-2.5 text-[11px] font-bold text-gray-500 border-r border-gray-50 uppercase">{product.family_name}</td>
                            <td className="px-4 py-2.5 border-r border-gray-50">
                                <div className="flex flex-col">
                                    <span className="text-[12px] font-bold text-gray-800 uppercase leading-tight">{product.name}</span>
                                    <span className="text-[9px] font-black text-blue-600/60 uppercase tracking-tighter mt-0.5">{product.plan_name || 'PLAN ESTÁNDAR'}</span>
                                </div>
                            </td>
                            <td className="px-4 py-2.5 text-[12px] font-bold text-right text-gray-900 border-r border-gray-50 tabular-nums">
                                ${(product.current_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-2.5 text-center border-r border-gray-50">
                                <button
                                    onClick={() => onToggleStatus(product)}
                                    className={`text-[9px] font-black px-2 py-0.5 rounded-full border transition-all uppercase tracking-tighter ${product.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}
                                >
                                    {product.is_active ? 'ACTIVO' : 'INACTIVO'}
                                </button>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                                <div className="flex justify-end items-center gap-2">
                                    <button
                                        onClick={() => onEdit(product)}
                                        className="p-1 text-blue-600 hover:bg-blue-100 rounded transition-all"
                                        title="Editar registro"
                                    >
                                        <PencilIcon className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(product.id)}
                                        className="p-1 text-red-600 hover:bg-red-100 rounded transition-all"
                                        title="Eliminar registro"
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
