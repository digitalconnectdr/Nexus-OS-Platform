'use client';

import { useState, useEffect } from 'react';
import Modal from './Modal';
import { useRouter } from 'next/navigation';
import { fetchFromAPI } from '@/lib/api';

interface EditSaleModalProps {
    sale: any | null;
    isOpen: boolean;
    onClose: () => void;
}

export default function EditSaleModal({ sale, isOpen, onClose }: EditSaleModalProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const formData = new FormData(e.currentTarget);
        const data = {
            assigned_to: formData.get('assigned_to'),
            comms_claro: parseFloat(formData.get('comms_claro') as string) || 0,
            comms_orion: parseFloat(formData.get('comms_orion') as string) || 0,
            comms_dofu: parseFloat(formData.get('comms_dofu') as string) || 0,
            inst_num: formData.get('inst_num'),
            last_updated_by: formData.get('last_updated_by'),
            status: formData.get('status'),
        };

        try {
            await fetchFromAPI(`/api/v1/sales/${sale.id}`, {
                method: 'PATCH',
                body: JSON.stringify(data),
            });

            router.refresh();
            onClose();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (!sale) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Editar Venta: ${sale.customer_name}`}>
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Estado</label>
                        <select
                            name="status"
                            defaultValue={sale.status}
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            <option value="Pending">Pendiente</option>
                            <option value="Approved">Aprobado</option>
                            <option value="Installed">Instalado</option>
                            <option value="Rejected">Rechazado</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Asignado A</label>
                        <input
                            name="assigned_to"
                            defaultValue={sale.assigned_to}
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Nombre del responsable"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Comms Claro</label>
                        <input
                            name="comms_claro"
                            type="number"
                            step="0.01"
                            defaultValue={sale.comms_claro}
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Comms Orion</label>
                        <input
                            name="comms_orion"
                            type="number"
                            step="0.01"
                            defaultValue={sale.comms_orion}
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Comms DOFU</label>
                        <input
                            name="comms_dofu"
                            type="number"
                            step="0.01"
                            defaultValue={sale.comms_dofu}
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Inst. Num</label>
                        <input
                            name="inst_num"
                            defaultValue={sale.inst_num}
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Número de instalación"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Auditoría (Tu Nombre)</label>
                        <input
                            name="last_updated_by"
                            defaultValue={sale.last_updated_by}
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Quién actualiza"
                            required
                        />
                    </div>
                </div>

                {error && <p className="text-red-500 text-sm font-bold text-center">{error}</p>}

                <div className="flex justify-end gap-3 pt-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2 border border-gray-200 rounded-lg font-bold text-gray-600 hover:bg-gray-50"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50"
                    >
                        {loading ? 'Guardando...' : 'Actualizar Datos'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
