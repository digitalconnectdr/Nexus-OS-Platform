"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    useReactTable,
} from "@tanstack/react-table";
import { PencilIcon, TrashIcon, InformationCircleIcon } from "@heroicons/react/24/outline";

// --- TYPES ---
export type Sale = {
    id: string;
    date: string;
    time: string;
    campaign: string;
    campaign_id?: string;
    client: string;
    doc_id: string;
    contact: string;
    os_madre: string;
    os_hija: string;
    family: string;
    product: string;
    plan: string;
    pp: string;
    concept: string;
    price: number;
    status: string;
    assigned_to: string;
    comms_claro: string;
    comms_orion: string;
    comms_dofu: string;
    inst_num: string;
    auditor: string;
    updated_at?: string;
    modified_fields?: string[];
    last_status_change?: { user: string; at: string };
    agent?: string;
};

export type StatusOption = { id: string; name: string; color_hex: string; };
export type CampaignOption = { id: string; name: string; };

// --- CONTRAST HELPER ---
const getContrastYIQ = (hexcolor: string) => {
    hexcolor = hexcolor.replace("#", "");
    if (hexcolor.length === 3) {
        hexcolor = hexcolor.split('').map(s => s + s).join('');
    }
    const r = parseInt(hexcolor.substr(0, 2), 16);
    const g = parseInt(hexcolor.substr(2, 2), 16);
    const b = parseInt(hexcolor.substr(4, 2), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? 'text-[#072D44]' : 'text-white';
};

// --- INLINE CELL COMPONENT ---
const InlineCell = ({
    value,
    mappedDisplay,
    rowId,
    columnKey,
    onSave,
    type = "text",
    options = [],
    campaigns = [],
    maxLength,
    isNumericOnly = false
}: {
    value: any,
    mappedDisplay?: any,
    rowId: string,
    columnKey: string,
    onSave: any,
    type?: "text" | "select" | "number" | "campaign",
    options?: StatusOption[],
    campaigns?: CampaignOption[],
    maxLength?: number,
    isNumericOnly?: boolean
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

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value;
        if (isNumericOnly) {
            val = val.replace(/\D/g, "");
        }
        if (maxLength && val.length > maxLength) {
            val = val.slice(0, maxLength);
        }
        setTempValue(val);
    };

    if (isEditing) {
        if (type === "select") {
            return (
                <div className="relative w-full">
                    <select
                        ref={inputRef as any}
                        value={tempValue || ""}
                        onChange={(e) => setTempValue(e.target.value)}
                        onBlur={handleBlur}
                        className="absolute top-1/2 left-0 -translate-y-1/2 z-[60] w-auto min-w-[180px] h-8 text-[11px] border-2 border-blue-500 rounded-md bg-white text-[#072D44] font-bold px-2 focus:ring-4 focus:ring-blue-100 outline-none shadow-2xl"
                    >
                        <option value="">Seleccionar Estatus...</option>
                        {options.map(opt => (
                            <option key={opt.id} value={opt.id}>{opt.name}</option>
                        ))}
                    </select>
                </div>
            )
        }
        if (type === "campaign") {
            return (
                <div className="relative w-full">
                    <select
                        ref={inputRef as any}
                        value={tempValue || ""}
                        onChange={(e) => setTempValue(e.target.value)}
                        onBlur={handleBlur}
                        className="absolute top-1/2 left-0 -translate-y-1/2 z-[60] w-auto min-w-[200px] h-8 text-[11px] border-2 border-blue-500 rounded-md bg-white text-[#072D44] font-bold px-2 focus:ring-4 focus:ring-blue-100 outline-none shadow-2xl"
                    >
                        <option value="">Seleccionar Campaña...</option>
                        {campaigns.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>
            )
        }

        const isComm = columnKey.startsWith("comms_");

        if (isComm) {
            return (
                <div className="relative w-full h-full min-h-[40px]">
                    <div className="absolute top-0 left-0 z-[70] flex flex-col gap-1">
                        <textarea
                            ref={inputRef as any}
                            autoFocus
                            value={tempValue || ""}
                            onChange={(e: any) => handleChange(e)}
                            onBlur={handleBlur}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) handleBlur();
                                if (e.key === "Escape") {
                                    setTempValue(value);
                                    setIsEditing(false);
                                }
                            }}
                            className="w-[300px] h-[120px] p-3 text-[11px] border-2 border-blue-600 rounded-lg bg-white text-[#072D44] font-bold focus:ring-4 focus:ring-blue-100 outline-none shadow-[0_20px_50px_rgba(0,0,0,0.3)] resize-none leading-relaxed"
                            placeholder="Escribe el comentario aquí..."
                        />
                        <div className="flex justify-between items-center px-2 py-1 bg-gray-900 rounded-md text-white shadow-lg">
                            <span className="text-[9px] font-black uppercase tracking-widest opacity-60">Comentario</span>
                            <span className={`text-[10px] font-black ${tempValue?.length >= 130 ? 'text-red-400' : 'text-blue-400'}`}>
                                {tempValue?.length || 0}/130
                            </span>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className="relative w-full h-full">
                <input
                    ref={inputRef as any}
                    autoFocus
                    value={tempValue || ""}
                    onChange={(e: any) => handleChange(e)}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    className="absolute top-1/2 left-0 -translate-y-1/2 z-[60] w-auto min-w-[250px] h-8 px-4 text-[12px] border-2 border-blue-500 rounded-lg bg-white text-[#072D44] font-bold focus:ring-4 focus:ring-blue-100 outline-none shadow-[0_15px_30px_rgba(0,0,0,0.2)]"
                />
            </div>
        );
    }

    if (type === "select") {
        const currentStatus = options.find(o => o.id === value || o.name === value);
        const statusColor = currentStatus?.color_hex || "#D0D7E1";
        const textColorClass = getContrastYIQ(statusColor);

        return (
            <div
                onClick={() => setIsEditing(true)}
                className={`cursor-pointer px-3 py-1 rounded-full text-[10px] font-black uppercase border border-black/5 inline-block transition-all hover:brightness-110 active:scale-95 shadow-sm ${textColorClass}`}
                style={{ backgroundColor: statusColor }}
            >
                {currentStatus?.name || value || "--"}
            </div>
        );
    }

    if (type === "campaign") {
        const campaign = campaigns.find(c => c.id === value || c.name === value);
        return (
            <div onClick={() => setIsEditing(true)} className="cursor-pointer min-h-[20px] hover:bg-blue-50 px-2 py-1 rounded-md border border-transparent hover:border-blue-100 transition-all font-bold text-[#072D44]">
                {campaign?.name || mappedDisplay || value || "--"}
            </div>
        );
    }

    // Commission Comment Logic
    const isComm = columnKey.startsWith("comms_");
    const displayValue = value || <span className="text-gray-300 italic">--</span>;

    return (
        <div
            onClick={() => setIsEditing(true)}
            className="group relative cursor-pointer min-h-[20px] hover:bg-blue-50 px-2 py-1 rounded-md border border-transparent hover:border-blue-100 transition-all font-bold text-[#072D44] flex items-center gap-1"
        >
            <span className="truncate max-w-[120px]">
                {displayValue}
            </span>
            {isComm && value && (
                <>
                    <InformationCircleIcon className="w-3 h-3 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute bottom-full mb-2 left-0 hidden group-hover:block bg-gray-900 text-white text-[10px] p-2 rounded shadow-xl z-50 w-[200px] whitespace-normal leading-tight border border-white/20">
                        {value}
                    </div>
                </>
            )}
        </div>
    );
};

// --- STATUS BADGE COMPONENT ---
const StatusBadge = ({ statusId, options }: { statusId: string, options: StatusOption[] }) => {
    const currentStatus = options.find(o => o.id === statusId);
    const statusColor = currentStatus?.color_hex || "#D0D7E1";
    const textColorClass = getContrastYIQ(statusColor);

    return (
        <div
            className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border border-black/5 inline-block ${textColorClass}`}
            style={{ backgroundColor: statusColor }}
        >
            {currentStatus?.name || statusId || "--"}
        </div>
    );
};

export default function RealTimeTable({
    data,
    statuses,
    campaigns,
    onUpdate,
    onDelete
}: {
    data: Sale[],
    statuses: StatusOption[],
    campaigns: CampaignOption[],
    onUpdate: (id: string, field: string, value: any) => void,
    onDelete: (id: string) => void
}) {
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' | null }>({ key: 'date', direction: 'desc' });

    // --- DEBOUNCE SEARCH ---
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const columns: ColumnDef<Sale>[] = [
        { accessorKey: "date", header: "FECHA", cell: ({ row }) => <span className="text-gray-400 font-bold">{row.getValue("date")}</span> },
        { accessorKey: "time", header: "HORA", cell: ({ row }) => <span className="text-gray-400 font-bold">{row.getValue("time")}</span> },
        {
            accessorKey: "agent",
            header: "AGENTE",
            cell: ({ row }) => {
                const email = row.original.agent || "-";
                const display = email.includes("@") ? email.split("@")[0] : email;
                return (
                    <span className="text-[10px] font-black text-gray-700 uppercase tracking-tight truncate max-w-[80px]" title={email}>
                        {display}
                    </span>
                );
            }
        },
        {
            accessorKey: "campaign",
            header: "CAMPAÑA",
            cell: info => <InlineCell value={info.row.original.campaign_id} mappedDisplay={info.row.original.campaign} rowId={info.row.original.id} columnKey="campaign_id" type="campaign" campaigns={campaigns} onSave={onUpdate} />
        },
        { accessorKey: "client", header: "CLIENTE", cell: info => <InlineCell value={info.getValue()} rowId={info.row.original.id} columnKey="client" onSave={onUpdate} /> },
        { accessorKey: "doc_id", header: "DOC ID", cell: info => <InlineCell value={info.getValue()} rowId={info.row.original.id} columnKey="doc_id" onSave={onUpdate} /> },
        { accessorKey: "contact", header: "CONTACTO", cell: info => <InlineCell value={info.getValue()} rowId={info.row.original.id} columnKey="contact" isNumericOnly={true} maxLength={11} onSave={onUpdate} /> },
        { accessorKey: "os_madre", header: "OS MADRE", cell: info => <InlineCell value={info.getValue()} rowId={info.row.original.id} columnKey="os_madre" maxLength={11} onSave={onUpdate} /> },
        { accessorKey: "os_hija", header: "OS HIJA", cell: info => <InlineCell value={info.getValue()} rowId={info.row.original.id} columnKey="os_hija" maxLength={11} onSave={onUpdate} /> },
        { accessorKey: "family", header: "FAMILIA", cell: info => <InlineCell value={info.getValue()} rowId={info.row.original.id} columnKey="family" onSave={onUpdate} /> },
        { accessorKey: "product", header: "PRODUCTO", cell: info => <InlineCell value={info.getValue()} rowId={info.row.original.id} columnKey="product" onSave={onUpdate} /> },
        { accessorKey: "plan", header: "PLAN", cell: info => <InlineCell value={info.getValue()} rowId={info.row.original.id} columnKey="plan" onSave={onUpdate} /> },
        { accessorKey: "pp", header: "PP", cell: info => <InlineCell value={info.getValue()} rowId={info.row.original.id} columnKey="pp" onSave={onUpdate} /> },
        { accessorKey: "concept", header: "CONCEPTO", cell: info => <InlineCell value={info.getValue()} rowId={info.row.original.id} columnKey="concept" onSave={onUpdate} /> },
        { accessorKey: "price", header: "MONTO", cell: info => <InlineCell value={info.getValue()} rowId={info.row.original.id} columnKey="price" type="text" onSave={onUpdate} /> },
        {
            accessorKey: "status",
            header: "ESTATUS",
            cell: info => <InlineCell value={info.row.original.status} rowId={info.row.original.id} columnKey="status_id" type="select" options={statuses} onSave={onUpdate} />
        },
        { accessorKey: "assigned_to", header: "ASIGNADO", cell: info => <InlineCell value={info.getValue()} rowId={info.row.original.id} columnKey="assigned_to" onSave={onUpdate} /> },
        { accessorKey: "comms_claro", header: "COM CLARO", cell: info => <InlineCell value={info.getValue()} rowId={info.row.original.id} columnKey="comms_claro" maxLength={130} onSave={onUpdate} /> },
        { accessorKey: "comms_orion", header: "COM ORION", cell: info => <InlineCell value={info.getValue()} rowId={info.row.original.id} columnKey="comms_orion" maxLength={130} onSave={onUpdate} /> },
        { accessorKey: "comms_dofu", header: "COM DOFU", cell: info => <InlineCell value={info.getValue()} rowId={info.row.original.id} columnKey="comms_dofu" maxLength={130} onSave={onUpdate} /> },
        { accessorKey: "inst_num", header: "INST NUM", cell: info => <InlineCell value={info.getValue()} rowId={info.row.original.id} columnKey="inst_num" isNumericOnly={true} maxLength={11} onSave={onUpdate} /> },
        {
            accessorKey: "auditor",
            header: "ÚLT. CAMBIO",
            cell: ({ row }) => {
                const updatedAt = row.original.updated_at;
                const auditor = row.original.auditor || "SISTEMA";
                const modified = row.original.modified_fields || [];

                const formattedDate = updatedAt ? new Date(updatedAt).toLocaleString('es-DO', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                }) : "---";

                const auditorDisplay = auditor.includes("@") ? auditor.split("@")[0] : auditor;

                return (
                    <div className="flex flex-col leading-tight min-w-[140px] group relative">
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black text-blue-700 uppercase">{auditorDisplay}</span>
                            <span className="text-[9px] font-medium text-gray-400">{formattedDate}</span>
                        </div>
                        {modified.length > 0 ? (
                            <div className="text-[9px] text-gray-500 font-medium truncate max-w-[150px]" title={modified.join(", ")}>
                                <span className="text-gray-300 mr-1">✎</span>
                                {modified.join(", ")}
                            </div>
                        ) : (
                            <span className="text-[9px] text-gray-300 italic">Sin cambios recientes</span>
                        )}
                    </div>
                );
            }
        },
        {
            accessorKey: "last_status_change",
            header: "ÚLT. STATUS",
            cell: ({ row }) => {
                const audit = row.original.last_status_change;
                if (!audit) return <span className="text-[10px] text-gray-300">---</span>;

                const date = new Date(audit.at);
                const user = audit.user.includes("@") ? audit.user.split("@")[0] : audit.user;

                return (
                    <div className="flex flex-col leading-tight min-w-[100px] border-l border-gray-100 pl-2">
                        <span className="text-[10px] font-bold text-blue-700 uppercase" title={audit.user}>{user}</span>
                        <span className="text-[9px] font-medium text-gray-500">
                            {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                );
            }
        },
        {
            id: "actions",
            header: "ACCIONES",
            cell: ({ row }) => (
                <div className="flex justify-end items-center gap-1">
                    <button title="Editar Registro" className="p-1 px-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                        <PencilIcon className="w-3.5 h-3.5" />
                    </button>
                    <button
                        title="Eliminar Registro"
                        onClick={() => onDelete(row.original.id)}
                        className="p-1 px-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    >
                        <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                </div>
            )
        }
    ];

    // --- SORTING & FILTERING (MEMOIZED) ---
    const handleSort = (key: string) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const filteredAndSortedData = useMemo(() => {
        // 1. Sort
        let result = [...data];
        if (sortConfig.key) {
            result.sort((a: any, b: any) => {
                const aVal = a[sortConfig.key] || "";
                const bVal = b[sortConfig.key] || "";
                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        // 2. Filter
        if (debouncedSearchTerm) {
            const s = debouncedSearchTerm.toLowerCase();
            result = result.filter(item => (
                (item.campaign?.toLowerCase() || "").includes(s) ||
                (item.client?.toLowerCase() || "").includes(s) ||
                (item.doc_id?.toLowerCase() || "").includes(s) ||
                (item.contact?.toLowerCase() || "").includes(s) ||
                (item.os_madre?.toLowerCase() || "").includes(s) ||
                (item.os_hija?.toLowerCase() || "").includes(s) ||
                (item.family?.toLowerCase() || "").includes(s) ||
                (item.product?.toLowerCase() || "").includes(s) ||
                (item.plan?.toLowerCase() || "").includes(s) ||
                (item.status?.toLowerCase() || "").includes(s) ||
                (item.assigned_to?.toLowerCase() || "").includes(s) ||
                (item.agent?.toLowerCase() || "").includes(s)
            ));
        }
        return result;
    }, [data, debouncedSearchTerm, sortConfig]);

    const table = useReactTable({
        data: filteredAndSortedData,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    return (
        <div className="bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden flex flex-col">
            {/* SEARCH BAR */}
            <div className="p-4 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <input
                        type="text"
                        placeholder="Buscar por cliente, documento, campaña, estatus, agente..."
                        className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 sm:text-[11px] font-bold text-[#072D44] transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">
                        {filteredAndSortedData.length} registros encontrados
                    </span>
                </div>
            </div>

            <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
                <table className="w-full text-left border-collapse whitespace-nowrap min-w-[1500px]">
                    <thead className="bg-[#072D44] text-white">
                        {table.getHeaderGroups().map(hg => (
                            <tr key={hg.id}>
                                {hg.headers.map(h => {
                                    const sortableKeys = ["date", "time", "campaign", "product", "plan", "concept", "status", "assigned_to", "audit", "agent"];
                                    const canSort = sortableKeys.includes(h.column.id) || h.column.columnDef.header?.toString().toLowerCase() !== 'acciones';

                                    return (
                                        <th
                                            key={h.id}
                                            onClick={() => canSort && handleSort(h.column.id)}
                                            className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest border-r border-[#064469] last:border-r-0 ${canSort ? 'cursor-pointer hover:bg-[#0a3d5c] transition-colors' : ''}`}
                                        >
                                            <div className="flex items-center gap-1.5">
                                                <span>{flexRender(h.column.columnDef.header, h.getContext())}</span>
                                                {canSort && (
                                                    <span className="flex flex-col -space-y-1 opacity-30">
                                                        <svg className={`w-2 h-2 ${sortConfig.key === h.column.id && sortConfig.direction === 'asc' ? 'text-blue-400 opacity-100' : ''}`} fill="currentColor" viewBox="0 0 20 20"><path d="M5 10l5-5 5 5H5z" /></svg>
                                                        <svg className={`w-2 h-2 ${sortConfig.key === h.column.id && sortConfig.direction === 'desc' ? 'text-blue-400 opacity-100' : ''}`} fill="currentColor" viewBox="0 0 20 20"><path d="M5 10l5 5 5-5H5z" /></svg>
                                                    </span>
                                                )}
                                            </div>
                                        </th>
                                    );
                                })}
                            </tr>
                        ))}
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {table.getRowModel().rows.map((row, i) => (
                            <tr key={row.id} className={`transition-colors h-9 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-blue-50/30`}>
                                {row.getVisibleCells().map(cell => (
                                    <td key={cell.id} className="px-4 py-0.5 text-[11px] text-[#072D44] border-r border-gray-50 last:border-r-0">
                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* FOOTER ELIMINADO PARA USAR EL DEL PADRE */}
        </div>
    );
}
