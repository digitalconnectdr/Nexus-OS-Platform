'use client';

import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

interface CampaignsTableProps {
    data: any[];
    onEdit: (item: any) => void;
    onDelete: (id: string) => void;
}

export default function CampaignsTable({ data, onEdit, onDelete }: CampaignsTableProps) {
    const handleDelete = async (id: string) => {
        if (!confirm('¿Está seguro de eliminar permanentemente esta campaña?')) return;
        onDelete(id);
    };

    return (
        <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm bg-white">
            <table className="w-full text-left text-sm text-gray-700">
                <thead className="bg-gray-50 uppercase font-bold text-[14px] text-gray-500 border-b border-gray-200">
                    <tr>
                        <th className="px-4 py-3">Campaña</th>
                        <th className="px-4 py-3">Código</th>
                        <th className="px-4 py-3 text-center" title="Define el estado inicial que se asignará automáticamente a las nuevas ventas creadas para esta campaña específica">Estatus Inicial</th>
                        <th className="px-4 py-3 text-center">Estado</th>
                        <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {data.length === 0 ? (
                        <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400 font-medium text-[12px] uppercase tracking-widest">Sin registros en la base actual</td></tr>
                    ) : data.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50 transition-colors group">
                            <td className="px-4 py-2.5 font-bold text-gray-800 text-[12px] uppercase">{item.name}</td>
                            <td className="px-4 py-2.5 text-[12px] font-mono font-bold text-gray-600 uppercase">{item.campaign_code || '---'}</td>
                            <td className="px-4 py-2.5 text-center">
                                {item.default_status ? (
                                    <div className="flex items-center justify-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase w-fit mx-auto">
                                        <div
                                            className="w-1.5 h-1.5 rounded-full"
                                            style={{ backgroundColor: item.default_status.color_hex }}
                                        />
                                        {item.default_status.name}
                                    </div>
                                ) : (
                                    <span className="bg-gray-50 text-gray-400 border border-gray-200 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase block w-fit mx-auto tracking-tighter opacity-60">
                                        ⚙️ GLOBAL
                                    </span>
                                )}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                                {item.is_active ? (
                                    <span className="bg-green-50 text-green-700 border border-green-200 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase block w-fit mx-auto">ACTIVO</span>
                                ) : (
                                    <span className="bg-gray-100 text-gray-600 border border-gray-200 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase block w-fit mx-auto">INACTIVO</span>
                                )}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                                <div className="flex justify-end items-center gap-2">
                                    <button
                                        onClick={() => onEdit(item)}
                                        className="p-1 text-blue-600 hover:bg-blue-100 rounded transition-all"
                                        title="Editar registro"
                                    >
                                        <PencilIcon className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(item.id)}
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
