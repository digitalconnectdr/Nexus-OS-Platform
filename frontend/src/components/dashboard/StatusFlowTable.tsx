"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PencilIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

import { fetchFromAPI } from "@/lib/api";

type Status = {
    id: string;
    name: string;
    color_hex: string;
    is_active: boolean;
    is_default: boolean;
    is_active_work: boolean;
    is_productive: boolean;
    tenant_id?: string;
};

export default function StatusFlowTable({
    data,
    onSave
}: {
    data: Status[],
    onSave: (items: Status[]) => void
}) {
    const { toast } = useToast();
    const [localData, setLocalData] = useState<Status[]>(data || []);
    const [selectedRow, setSelectedRow] = useState<Status | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        if (data) setLocalData(data);
    }, [data]);

    const handleEditClick = (row: Status) => {
        setSelectedRow({ ...row });
        setIsModalOpen(true);
    };

    const handleModalSave = async () => {
        if (!selectedRow) return;

        try {
            const updatedRow = { ...selectedRow };

            await fetchFromAPI(`/api/v1/statuses/${selectedRow.id}`, {
                method: 'PUT',
                body: JSON.stringify(updatedRow)
            });

            const response = await fetchFromAPI('/api/v1/statuses/');
            const safeList = response?.items || (Array.isArray(response) ? response : []);
            setLocalData(safeList);
            onSave(safeList);
            setIsModalOpen(false);
            toast({ title: "Estado Actualizado", description: "Los cambios han sido aplicados correctamente." });
        } catch (err: any) {
            toast({ title: "Error al Guardar", description: err.message, variant: "destructive" });
        }
    };

    const handleDelete = (id: string) => {
        toast({
            title: "¿Eliminar Estatus Operativo?",
            description: "Esta acción no se puede deshacer y afectará a las ventas vinculadas.",
            variant: "destructive",
            duration: Infinity,
            action: (
                <ToastAction
                    altText="ELIMINAR"
                    onClick={async () => {
                        try {
                            await fetchFromAPI(`/api/v1/statuses/${id}`, { method: 'DELETE' });
                            const newData = localData.filter(item => item.id !== id);
                            setLocalData(newData);
                            onSave(newData);
                            toast({ title: "Estatus Eliminado", description: "El catálogo ha sido actualizado." });
                        } catch (err: any) {
                            toast({ title: "Error", description: err.message, variant: "destructive" });
                        }
                    }}
                >
                    ELIMINAR
                </ToastAction>
            )
        });
    };

    return (
        <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm bg-white">
            <table className="w-full text-left text-sm text-gray-700">
                <thead className="bg-gray-50 uppercase font-bold text-[14px] text-gray-500 border-b border-gray-200">
                    <tr>
                        <th className="px-4 py-3">Nombre Estatus</th>
                        <th className="px-4 py-3 text-center">Muestra</th>
                        <th className="px-4 py-3 text-center">Estado</th>
                        <th className="px-4 py-3 text-center" title="Define si el estatus es para trabajo activo (Dashboard) o histórico (Archivo)">Ámbito</th>
                        <th className="px-4 py-3 text-center" title="Indica si los registros en este estatus se contabilizan como ventas logradas">KPIs</th>
                        <th className="px-4 py-3 text-center" title="Estatus que se asigna automáticamente a las nuevas ventas creadas">Default</th>
                        <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {localData.length === 0 ? (
                        <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400 font-medium text-[12px] uppercase tracking-widest">Sin registros encontrados</td></tr>
                    ) : localData.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50 transition-colors group">
                            <td className="px-4 py-2.5 font-bold text-gray-800 text-[12px] uppercase">
                                {item.name}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                                <div
                                    className="w-4 h-4 rounded-full mx-auto border border-black/10 shadow-sm"
                                    style={{ backgroundColor: item.color_hex }}
                                />
                            </td>
                            <td className="px-4 py-2.5 text-center">
                                {item.is_active ? (
                                    <span className="bg-green-50 text-green-700 border border-green-200 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase block w-fit mx-auto">ACTIVO</span>
                                ) : (
                                    <span className="bg-gray-100 text-gray-600 border border-gray-200 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase block w-fit mx-auto">INACTIVO</span>
                                )}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                                {item.is_active_work ? (
                                    <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[9px] px-2 py-0.5 rounded-full font-black uppercase inline-flex items-center gap-1 shadow-sm mx-auto">
                                        <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
                                        Dashboard
                                    </span>
                                ) : (
                                    <span className="bg-gray-50 text-gray-500 border border-gray-200 text-[9px] px-2 py-0.5 rounded-full font-bold uppercase inline-flex items-center gap-1 mx-auto">
                                        Archivo
                                    </span>
                                )}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                                {item.is_productive ? (
                                    <span className="bg-green-50 text-green-700 border border-green-200 text-[10px] px-2 py-0.5 rounded-full font-black uppercase inline-flex items-center gap-1 shadow-sm mx-auto" title="Cuenta para Scorecard">
                                        📈 VENTA
                                    </span>
                                ) : (
                                    <span className="text-[10px] font-bold text-gray-200 uppercase tracking-widest">--</span>
                                )}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                                {item.is_default ? (
                                    <span className="bg-blue-600 text-white text-[9px] px-2 py-0.5 rounded-md font-black uppercase tracking-tighter inline-flex items-center gap-1 shadow-sm">
                                        ⭐ DEFAULT
                                    </span>
                                ) : (
                                    <span className="text-[10px] font-bold text-gray-200 uppercase tracking-widest">--</span>
                                )}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                                <div className="flex justify-end items-center gap-2">
                                    <button
                                        onClick={() => handleEditClick(item)}
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

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="sm:max-w-xl border-none p-0 overflow-hidden shadow-2xl bg-white">
                    <DialogHeader className="h-16 bg-slate-900 px-8 flex flex-row items-center justify-between space-y-0 text-white">
                        <div className="flex items-center gap-3">
                            <div className="p-1.5 bg-slate-800 rounded-lg">
                                <PencilIcon className="w-4 h-4 text-blue-400" />
                            </div>
                            <div>
                                <DialogTitle className="text-white font-bold uppercase tracking-tight text-sm">Editar Estatus Operativo</DialogTitle>
                                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest leading-none mt-0.5">Gestión de flujo y visualización</p>
                            </div>
                        </div>
                    </DialogHeader>
                    {selectedRow && (
                        <div className="p-8 space-y-6 bg-white">
                            <div className="grid grid-cols-12 gap-5">
                                <div className="col-span-12 space-y-1.5 border-b border-gray-100 pb-4">
                                    <label className="flex items-center gap-4 cursor-pointer select-none group bg-blue-50 p-3 rounded-lg border border-blue-100 transition-all hover:bg-blue-100">
                                        <div className="relative">
                                            <input
                                                type="checkbox"
                                                checked={selectedRow.is_default}
                                                onChange={(e) => setSelectedRow({ ...selectedRow, is_default: e.target.checked, is_active: e.target.checked ? true : selectedRow.is_active })}
                                                className="peer hidden"
                                            />
                                            <div className="w-12 h-6 bg-gray-200 rounded-full border border-gray-300 peer-checked:bg-blue-600 peer-checked:border-blue-700 transition-all" />
                                            <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full peer-checked:translate-x-6 transition-all shadow-md" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[12px] font-black text-gray-900 uppercase tracking-tight group-hover:text-blue-700 transition-colors" title="Estatus que se asignará automáticamente a ventas nuevas si no hay configuración por campaña">ESTATUS PREDETERMINADO</span>
                                            <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">Se asignará automáticamente a ventas nuevas</span>
                                        </div>
                                    </label>
                                </div>

                                <div className="col-span-12 space-y-1.5 border-b border-gray-100 pb-4">
                                    <label className="flex items-center gap-4 cursor-pointer select-none group bg-indigo-50 p-3 rounded-lg border border-indigo-100 transition-all hover:bg-indigo-100">
                                        <div className="relative">
                                            <input
                                                type="checkbox"
                                                checked={selectedRow.is_active_work}
                                                onChange={(e) => setSelectedRow({ ...selectedRow, is_active_work: e.target.checked })}
                                                className="peer hidden"
                                            />
                                            <div className="w-12 h-6 bg-gray-200 rounded-full border border-gray-300 peer-checked:bg-indigo-600 peer-checked:border-indigo-700 transition-all" />
                                            <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full peer-checked:translate-x-6 transition-all shadow-md" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[12px] font-black text-gray-900 uppercase tracking-tight group-hover:text-indigo-700 transition-colors" title="Define si este estado es parte del flujo de trabajo activo (se muestra en el Dashboard) o es para archivo histórico">VISIBILIDAD EN DASHBOARD (ÁMBITO)</span>
                                            <span className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider">¿Requiere seguimiento operativo inmediato?</span>
                                        </div>
                                    </label>
                                </div>

                                <div className="col-span-12 space-y-1.5 border-b border-gray-100 pb-4">
                                    <label className="flex items-center gap-4 cursor-pointer select-none group bg-green-50 p-3 rounded-lg border border-green-100 transition-all hover:bg-green-100">
                                        <div className="relative">
                                            <input
                                                type="checkbox"
                                                checked={selectedRow.is_productive}
                                                onChange={(e) => setSelectedRow({ ...selectedRow, is_productive: e.target.checked })}
                                                className="peer hidden"
                                            />
                                            <div className="w-12 h-6 bg-gray-200 rounded-full border border-gray-300 peer-checked:bg-green-600 peer-checked:border-green-700 transition-all" />
                                            <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full peer-checked:translate-x-6 transition-all shadow-md" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[12px] font-black text-gray-900 uppercase tracking-tight group-hover:text-green-700 transition-colors" title="Si se marca, las ventas en este estado serán contabilizadas como metas cumplidas en los reportes de rendimiento y KPIs">ESTATUS PRODUCTIVO (KPI)</span>
                                            <span className="text-[10px] text-green-600 font-bold uppercase tracking-wider">¿Suma como unidad lograda en el Scorecard?</span>
                                        </div>
                                    </label>
                                </div>

                                <div className="col-span-12 space-y-1.5">
                                    <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Nombre Descriptivo</Label>
                                    <Input
                                        value={selectedRow.name}
                                        onChange={(e) => setSelectedRow({ ...selectedRow, name: e.target.value.toUpperCase() })}
                                        className="w-full border-gray-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none uppercase font-bold text-gray-900 text-xs h-10 px-3 transition-all"
                                    />
                                </div>
                                <div className="col-span-12 md:col-span-8 space-y-1.5">
                                    <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Identificador de Color</Label>
                                    <div className="flex gap-4">
                                        <input
                                            type="color"
                                            value={selectedRow.color_hex}
                                            onChange={(e) => setSelectedRow({ ...selectedRow, color_hex: e.target.value })}
                                            className="w-14 h-10 border-none p-1 bg-transparent cursor-pointer"
                                        />
                                        <Input
                                            value={selectedRow.color_hex}
                                            readOnly
                                            className="font-mono text-[10px] bg-gray-50 border-gray-200 text-gray-600 h-10 px-4 flex-1 font-bold uppercase tracking-widest"
                                        />
                                    </div>
                                </div>
                                <div className="col-span-12 md:col-span-4 flex items-end pb-1.5">
                                    <label className="flex items-center gap-3 cursor-pointer select-none group">
                                        <div className="relative">
                                            <input
                                                type="checkbox"
                                                checked={selectedRow.is_active}
                                                disabled={selectedRow.is_default}
                                                onChange={(e) => setSelectedRow({ ...selectedRow, is_active: e.target.checked })}
                                                className="peer hidden"
                                            />
                                            <div className="w-10 h-5 bg-gray-200 rounded-full border border-gray-300 peer-checked:bg-green-500 peer-checked:border-green-600 transition-all" />
                                            <div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full peer-checked:translate-x-5 transition-all shadow-sm" />
                                        </div>
                                        <span className="text-[10px] font-bold text-gray-900 uppercase group-hover:text-blue-600 transition-colors tracking-tight">Activo</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter className="bg-gray-50 p-6 px-8 border-t border-gray-100 mt-0">
                        <Button
                            variant="ghost"
                            onClick={() => setIsModalOpen(false)}
                            className="text-[10px] font-bold uppercase text-gray-400 hover:text-gray-900 hover:bg-gray-100 px-6 h-10"
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleModalSave}
                            className="bg-gray-900 hover:bg-black text-white text-[10px] font-bold uppercase px-10 h-10 rounded-md shadow-lg shadow-gray-200 transition-all active:scale-95"
                        >
                            Confirmar Cambios
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
