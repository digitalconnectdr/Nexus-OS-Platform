"use client";

import { useEffect, useState, useRef } from "react";
import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    useReactTable,
    getPaginationRowModel,
} from "@tanstack/react-table";
import { PencilIcon, TrashIcon } from "@heroicons/react/24/outline";
import { fetchFromAPI } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

// --- TYPES ---
type Sale = {
    id: string;
    date: string; time: string; campaign: string; client: string;
    doc_id: string; contact: string; os_madre: string; os_hija: string;
    product: string; plan: string; pp: string; concept: string;
    price: number; status: string; assigned_to: string;
    comms_claro: string; comms_orion: string; comms_dofu: string;
    inst_num: string; audit: string;
};

type StatusOption = { id: string; name: string; color_hex: string; };

// --- INLINE CELL COMPONENT ---
const InlineCell = ({
    value,
    rowId,
    columnKey,
    onSave,
    type = "text",
    options = []
}: {
    value: any, rowId: string, columnKey: string, onSave: any, type?: "text" | "select" | "number", options?: StatusOption[]
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [tempValue, setTempValue] = useState(value);
    const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

    useEffect(() => { setTempValue(value); }, [value]);

    useEffect(() => {
        if (isEditing && inputRef.current) inputRef.current.focus();
    }, [isEditing]);

    const handleBlur = () => {
        setIsEditing(false);
        if (tempValue !== value) {
            onSave(rowId, columnKey, tempValue);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") handleBlur();
        if (e.key === "Escape") {
            setTempValue(value);
            setIsEditing(false);
        }
    };

    if (isEditing) {
        if (type === "select") {
            return (
                <select
                    ref={inputRef as any}
                    value={tempValue}
                    onChange={(e) => setTempValue(e.target.value)}
                    onBlur={handleBlur}
                    className="w-full h-6 text-[10px] border border-[#5790AB] rounded-sm bg-white text-[#072D44] font-bold p-0 focus:ring-1 focus:ring-[#5790AB] outline-none"
                >
                    {options.length > 0 ? options.map(opt => (
                        <option key={opt.id} value={opt.name}>{opt.name}</option>
                    )) : <option value={value}>{value}</option>}
                </select>
            )
        }
        return (
            <Input
                ref={inputRef as any}
                value={tempValue}
                onChange={(e) => setTempValue(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                className="h-6 w-full text-[10px] px-1 py-0 rounded-sm border-[#5790AB] bg-white text-[#072D44] font-bold focus:ring-1 focus:ring-[#5790AB]"
            />
        );
    }

    if (type === "select") {
        const statusColor = options.find(o => o.name === value)?.color_hex || "#D0D7E1";
        return (
            <div onClick={() => setIsEditing(true)} className="cursor-pointer px-2 py-0.5 rounded text-[10px] font-bold uppercase border border-black/10 inline-block transition-all hover:scale-105" style={{ backgroundColor: statusColor, color: '#072D44' }}>
                {value || "--"}
            </div>
        );
    }

    return (
        <div onClick={() => setIsEditing(true)} className="cursor-pointer min-h-[16px] hover:bg-[#D0D7E1]/30 px-1 rounded truncate font-semibold text-[#072D44] transition-colors">
            {type === "number" && columnKey === "price"
                ? new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(Number(value))
                : value || <span className="text-gray-300 italic">--</span>}
        </div>
    );
};

export default function OperativeMasterPanel({ initialData = [] }: { initialData?: Sale[] }) {
    const [records, setRecords] = useState<Sale[]>(initialData);
    const [statusOptions, setStatusOptions] = useState<StatusOption[]>([]);
    const [loading, setLoading] = useState(true);

    // SYNC INITIAL DATA
    useEffect(() => {
        if (initialData && initialData.length > 0) {
            setRecords(initialData);
            setLoading(false);
        }
    }, [initialData]);

    // FETCH FALLBACK/STATUS OPTIONS
    useEffect(() => {
        async function fetchOptions() {
            try {
                // If initialData is still empty after a while, fetch from API as fallback
                if (records.length === 0) {
                    const sales = await fetchFromAPI("/api/v1/sales/");
                    setRecords(sales);
                }

                const statuses = await fetchFromAPI("/api/v1/statuses/");
                setStatusOptions(statuses);
            } catch (e) {
                console.error(e);
                // Fallback options on error
                setStatusOptions([
                    { id: 'pending', name: 'Pending', color_hex: '#D0D7E1' },
                    { id: 'approved', name: 'Approved', color_hex: '#bbf7d0' },
                    { id: 'rejected', name: 'Rejected', color_hex: '#fecaca' }
                ]);
            }
            finally { setLoading(false); }
        }
        fetchOptions();
    }, []);

    const handleUpdate = async (id: string, field: string, value: any) => {
        const oldRecords = [...records];
        const updatedRow = records.find(r => r.id === id);
        if (!updatedRow) return;

        const newRow = { ...updatedRow, [field]: value };
        setRecords(prev => prev.map(row => row.id === id ? newRow : row));

        try {
            const backendPayload: any = { ...newRow };
            if (field === "client") backendPayload["client"] = value;
            if (field === "doc_id") backendPayload["doc_id"] = value;
            if (field === "status") backendPayload["status"] = value;
            if (field === "contact") backendPayload["contact"] = value;

            await fetchFromAPI(`/api/v1/sales/${id}`, {
                method: 'PUT',
                body: JSON.stringify(backendPayload)
            });
        } catch (err) {
            console.error("Save failed", err);
            setRecords(oldRecords);
            alert("Error al guardar cambios.");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("¿Está seguro de eliminar permanentemente esta venta?")) return;
        try {
            await fetchFromAPI(`/api/v1/sales/${id}`, {
                method: 'DELETE'
            });
            setRecords(prev => prev.filter(r => r.id !== id));
        } catch (err) {
            console.error(err);
            alert("Error de conexión al intentar eliminar el registro.");
        }
    };

    const columns: ColumnDef<Sale>[] = [
        { accessorKey: "date", header: "FECHA", cell: ({ row }) => <span className="text-gray-400 font-bold">{row.getValue("date")}</span> },
        { accessorKey: "time", header: "HORA", cell: ({ row }) => <span className="text-gray-400 font-bold">{row.getValue("time")}</span> },
        { accessorKey: "campaign", header: "CAMPAÑA", cell: info => <InlineCell value={info.getValue()} rowId={info.row.original.id} columnKey="campaign" onSave={handleUpdate} /> },
        { accessorKey: "client", header: "CLIENTE", cell: info => <InlineCell value={info.getValue()} rowId={info.row.original.id} columnKey="client" onSave={handleUpdate} /> },
        { accessorKey: "doc_id", header: "DOCUMENTO", cell: info => <InlineCell value={info.getValue()} rowId={info.row.original.id} columnKey="doc_id" onSave={handleUpdate} /> },
        { accessorKey: "contact", header: "CONTACTO", cell: info => <InlineCell value={info.getValue()} rowId={info.row.original.id} columnKey="contact" onSave={handleUpdate} /> },
        { accessorKey: "os_madre", header: "OS MADRE", cell: info => <InlineCell value={info.getValue()} rowId={info.row.original.id} columnKey="os_madre" onSave={handleUpdate} /> },
        { accessorKey: "os_hija", header: "OS HIJA", cell: info => <InlineCell value={info.getValue()} rowId={info.row.original.id} columnKey="os_hija" onSave={handleUpdate} /> },
        { accessorKey: "product", header: "PRODUCTO", cell: info => <InlineCell value={info.getValue()} rowId={info.row.original.id} columnKey="product" onSave={handleUpdate} /> },
        { accessorKey: "plan", header: "PLAN", cell: info => <InlineCell value={info.getValue()} rowId={info.row.original.id} columnKey="plan" onSave={handleUpdate} /> },
        { accessorKey: "price", header: "PRECIO", cell: info => <InlineCell value={info.getValue()} rowId={info.row.original.id} columnKey="price" type="number" onSave={handleUpdate} /> },
        {
            accessorKey: "status",
            header: "ESTATUS",
            cell: info => <InlineCell value={info.getValue()} rowId={info.row.original.id} columnKey="status" type="select" options={statusOptions} onSave={handleUpdate} />
        },
        { accessorKey: "assigned_to", header: "ASIGNADO", cell: info => <InlineCell value={info.getValue()} rowId={info.row.original.id} columnKey="assigned_to" onSave={handleUpdate} /> },
        { accessorKey: "comms_dofu", header: "COMS. DOFU", cell: info => <InlineCell value={info.getValue()} rowId={info.row.original.id} columnKey="comms_dofu" onSave={handleUpdate} /> },
        { accessorKey: "inst_num", header: "INST #", cell: info => <InlineCell value={info.getValue()} rowId={info.row.original.id} columnKey="inst_num" onSave={handleUpdate} /> },
        { accessorKey: "audit", header: "AUDITORÍA", cell: info => <span className="opacity-60 italic">{String(info.getValue() || "Sistema")}</span> },
        {
            id: "actions",
            header: "ACCIONES",
            cell: ({ row }) => (
                <div className="flex justify-end items-center gap-2">
                    <button
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        title="Información detallada"
                    >
                        <PencilIcon className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => handleDelete(row.original.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        title="Eliminar registro permanentemente"
                    >
                        <TrashIcon className="w-4 h-4" />
                    </button>
                </div>
            )
        }
    ];

    const table = useReactTable({
        data: records,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: { pagination: { pageSize: 15 } }
    });

    if (loading && records.length === 0) return (
        <div className="p-8 text-center animate-pulse">
            <p className="text-[#072D44] font-black uppercase tracking-widest text-[10px]">Cargando Panel Maestro...</p>
        </div>
    );

    return (
        <Card className="mt-4 border-t-4 border-t-[#5790AB] shadow-2xl rounded-none overflow-hidden">
            <CardHeader className="py-2.5 bg-white border-b border-gray-100 flex flex-row justify-between items-center px-4">
                <div>
                    <CardTitle className="text-sm font-black text-[#072D44] tracking-tight uppercase">Panel Maestro Operativo</CardTitle>
                    <p className="text-[9px] text-[#5790AB] font-bold uppercase tracking-widest">Control Centralizado • {records.length} Registros Activos</p>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="w-full overflow-x-auto scrollbar-thin scrollbar-thumb-[#5790AB] scrollbar-track-transparent">
                    <table className="w-full text-[10px] text-left border-collapse whitespace-nowrap min-w-[2100px]">
                        <thead className="bg-[#072D44] text-white font-bold uppercase tracking-wider">
                            {table.getHeaderGroups().map(hg => (
                                <tr key={hg.id}>
                                    {hg.headers.map(h => (
                                        <th key={h.id} className="px-2 py-2.5 border-r border-[#064469] last:border-r-0 text-center">
                                            {flexRender(h.column.columnDef.header, h.getContext())}
                                        </th>
                                    ))}
                                </tr>
                            ))}
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {table.getRowModel().rows.map((row, i) => (
                                <tr key={row.id} className={`transition-colors h-10 ${i % 2 === 0 ? 'bg-white' : 'bg-[#F9FAFB]'} hover:bg-[#D0D7E1]/20`}>
                                    {row.getVisibleCells().map(cell => (
                                        <td key={cell.id} className="px-2 py-1 border-r border-gray-50 last:border-r-0 text-[#072D44]">
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="flex items-center justify-between px-6 py-3 bg-[#F9FAFB] border-t border-gray-200">
                    <div className="text-[9px] font-black text-[#5790AB] uppercase tracking-widest">
                        Mostrando {table.getState().pagination.pageIndex * 15 + 1} - {Math.min((table.getState().pagination.pageIndex + 1) * 15, records.length)} de {records.length}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
