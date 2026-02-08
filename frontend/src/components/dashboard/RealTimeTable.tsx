"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    useReactTable,
} from "@tanstack/react-table";
import { PencilIcon, TrashIcon, InformationCircleIcon, AdjustmentsHorizontalIcon, EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { usePermission } from "@/hooks/usePermission";

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

export type StatusOption = {
    id: string;
    name: string;
    color_hex: string;
    scope: string;
    is_productive: bool;
};
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
    canEdit = true,
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
    isNumericOnly?: boolean,
    canEdit?: boolean
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
                        className="absolute top-1/2 left-0 -translate-y-1/2 z-[60] w-auto min-w-[180px] h-8 text-[11px] border-2 border-blue-500 dark:border-blue-400 rounded-md bg-white dark:bg-slate-900 text-[#072D44] dark:text-slate-100 font-bold px-2 focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/20 outline-none shadow-2xl"
                    >
                        <option value="">Seleccionar Estatus...</option>
                        {options.map(opt => (
                            <option key={opt.id} value={opt.id} className="dark:bg-slate-900">{opt.name}</option>
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
                        className="absolute top-1/2 left-0 -translate-y-1/2 z-[60] w-auto min-w-[200px] h-8 text-[11px] border-2 border-blue-500 dark:border-blue-400 rounded-md bg-white dark:bg-slate-900 text-[#072D44] dark:text-slate-100 font-bold px-2 focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/20 outline-none shadow-2xl"
                    >
                        <option value="">Seleccionar Campaña...</option>
                        {campaigns.map(c => (
                            <option key={c.id} value={c.id} className="dark:bg-slate-900">{c.name}</option>
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
                            className="w-[300px] h-[120px] p-3 text-[11px] border-2 border-blue-600 dark:border-blue-500 rounded-lg bg-white dark:bg-slate-900 text-[#072D44] dark:text-slate-100 font-bold focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/20 outline-none shadow-[0_20px_50px_rgba(0,0,0,0.3)] resize-none leading-relaxed"
                            placeholder="Escribe el comentario aquí..."
                        />
                        <div className="flex justify-between items-center px-2 py-1 bg-gray-900 dark:bg-slate-800 rounded-md text-white shadow-lg">
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
                    className="absolute top-1/2 left-0 -translate-y-1/2 z-[60] w-auto min-w-[250px] h-8 px-4 text-[12px] border-2 border-blue-500 dark:border-blue-400 rounded-lg bg-white dark:bg-slate-900 text-[#072D44] dark:text-slate-100 font-bold focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/20 outline-none shadow-[0_15px_30px_rgba(0,0,0,0.2)]"
                />
            </div>
        );
    }

    if (type === "select") {
        const lookupValue = String(value || "").toUpperCase();
        const currentStatus = options.find(o =>
            String(o.id).toUpperCase() === lookupValue ||
            String(o.name).toUpperCase() === lookupValue
        );
        const statusColor = currentStatus?.color_hex || "#D0D7E1";
        const textColorClass = getContrastYIQ(statusColor);

        return (
            <div
                onClick={() => canEdit && setIsEditing(true)}
                className={`${canEdit ? 'cursor-pointer' : 'cursor-default'} px-3 py-1 rounded-full text-[10px] font-black uppercase border border-black/5 inline-block transition-all hover:brightness-110 active:scale-95 shadow-sm ${textColorClass}`}
                style={{ backgroundColor: statusColor }}
            >
                {currentStatus?.name || value || "--"}
            </div>
        );
    }

    if (type === "campaign") {
        const campaign = campaigns.find(c => c.id === value || c.name === value);
        return (
            <div
                onClick={() => canEdit && setIsEditing(true)}
                className={`${canEdit ? 'cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/40 hover:ring-2 hover:ring-blue-300 dark:hover:ring-blue-800 hover:border-blue-200 dark:hover:border-blue-700' : 'cursor-default'} min-h-[20px] px-2 py-1 rounded-md border border-transparent transition-all duration-150 font-bold text-[#072D44] dark:text-slate-200`}
            >
                {campaign?.name || mappedDisplay || value || "--"}
            </div>
        );
    }

    // Commission Comment Logic
    const isComm = columnKey.startsWith("comms_");
    const displayValue = value || <span className="text-gray-300 italic">--</span>;

    return (
        <div
            onClick={() => canEdit && setIsEditing(true)}
            className={`group relative ${canEdit ? 'cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/40 hover:ring-1 hover:ring-blue-300 dark:hover:ring-blue-800 hover:border-blue-200 dark:hover:border-blue-700' : 'cursor-default'} min-h-[20px] px-2 py-1 rounded-md border border-transparent transition-all duration-150 font-bold text-[#072D44] dark:text-slate-200 flex items-center gap-1`}
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
    const lookupValue = String(statusId || "").toUpperCase();
    const currentStatus = options.find(o =>
        String(o.id).toUpperCase() === lookupValue ||
        String(o.name).toUpperCase() === lookupValue
    );
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
    onDelete,
    isTrashView = false,
    onPurge
}: {
    data: Sale[],
    statuses: StatusOption[],
    campaigns: CampaignOption[],
    onUpdate: (id: string, field: string, value: any) => void,
    onDelete: (id: string) => void,
    isTrashView?: boolean,
    onPurge?: (id: string) => void
}) {
    const { can } = usePermission();
    const canUpdate = can('dashboard', 'sales', 'update');
    const canDelete = can('dashboard', 'sales', 'delete');
    const canChangeStatus = can('dashboard', 'sales', 'change_status');

    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' | null }>({ key: 'date', direction: 'desc' });
    const [showColumnSelector, setShowColumnSelector] = useState(false);

    // Column visibility state with localStorage persistence
    const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('dashboard-visible-columns');
            if (saved) {
                return JSON.parse(saved);
            }
        }
        // Default: all columns visible
        return {
            date: true, time: true, agent: true, campaign: true, client: true,
            doc_id: true, contact: true, os_madre: true, os_hija: true,
            family: true, product: true, plan: true, pp: true, concept: true,
            price: true, status: true, assigned_to: true, comms_claro: true,
            comms_orion: true, comms_dofu: true, inst_num: true, auditor: true,
            last_status_change: true, actions: true
        };
    });

    // Save to localStorage when visibility changes
    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('dashboard-visible-columns', JSON.stringify(visibleColumns));
        }
    }, [visibleColumns]);

    const toggleColumn = (columnId: string) => {
        setVisibleColumns(prev => ({ ...prev, [columnId]: !prev[columnId] }));
    };

    const resetColumns = () => {
        const allVisible: Record<string, boolean> = {};
        Object.keys(visibleColumns).forEach(key => { allVisible[key] = true; });
        setVisibleColumns(allVisible);
    };

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
                    <span className="text-[10px] font-black text-gray-700 dark:text-slate-300 uppercase tracking-tight truncate max-w-[80px]" title={email}>
                        {display}
                    </span>
                );
            }
        },
        {
            accessorKey: "campaign",
            header: "CAMPAÑA",
            cell: info => <InlineCell value={info.row.original.campaign_id} mappedDisplay={info.row.original.campaign} rowId={info.row.original.id} columnKey="campaign_id" type="campaign" campaigns={campaigns} onSave={onUpdate} canEdit={canUpdate} />
        },
        { accessorKey: "client", header: "CLIENTE", cell: info => <InlineCell value={info.getValue()} rowId={info.row.original.id} columnKey="client" onSave={onUpdate} canEdit={canUpdate} /> },
        { accessorKey: "doc_id", header: "DOC ID", cell: info => <InlineCell value={info.getValue()} rowId={info.row.original.id} columnKey="doc_id" onSave={onUpdate} canEdit={canUpdate} /> },
        { accessorKey: "contact", header: "CONTACTO", cell: info => <InlineCell value={info.getValue()} rowId={info.row.original.id} columnKey="contact" isNumericOnly={true} maxLength={11} onSave={onUpdate} canEdit={canUpdate} /> },
        { accessorKey: "os_madre", header: "OS MADRE", cell: info => <InlineCell value={info.getValue()} rowId={info.row.original.id} columnKey="os_madre" maxLength={11} onSave={onUpdate} canEdit={canUpdate} /> },
        { accessorKey: "os_hija", header: "OS HIJA", cell: info => <InlineCell value={info.getValue()} rowId={info.row.original.id} columnKey="os_hija" maxLength={11} onSave={onUpdate} canEdit={canUpdate} /> },
        { accessorKey: "family", header: "FAMILIA", cell: info => <InlineCell value={info.getValue()} rowId={info.row.original.id} columnKey="family" onSave={onUpdate} canEdit={canUpdate} /> },
        { accessorKey: "product", header: "PRODUCTO", cell: info => <InlineCell value={info.getValue()} rowId={info.row.original.id} columnKey="product" onSave={onUpdate} canEdit={canUpdate} /> },
        { accessorKey: "plan", header: "PLAN", cell: info => <InlineCell value={info.getValue()} rowId={info.row.original.id} columnKey="plan" onSave={onUpdate} canEdit={canUpdate} /> },
        { accessorKey: "pp", header: "PP", cell: info => <InlineCell value={info.getValue()} rowId={info.row.original.id} columnKey="pp" onSave={onUpdate} canEdit={canUpdate} /> },
        { accessorKey: "concept", header: "CONCEPTO", cell: info => <InlineCell value={info.getValue()} rowId={info.row.original.id} columnKey="concept" onSave={onUpdate} canEdit={canUpdate} /> },
        { accessorKey: "price", header: "MONTO", cell: info => <InlineCell value={info.getValue()} rowId={info.row.original.id} columnKey="price" type="text" onSave={onUpdate} canEdit={canUpdate} /> },
        {
            accessorKey: "status",
            header: "ESTATUS",
            cell: info => <InlineCell value={info.row.original.status} rowId={info.row.original.id} columnKey="status_id" type="select" options={statuses} onSave={onUpdate} canEdit={canChangeStatus} />
        },
        { accessorKey: "assigned_to", header: "ASIGNADO", cell: info => <InlineCell value={info.getValue()} rowId={info.row.original.id} columnKey="assigned_to" onSave={onUpdate} canEdit={canUpdate} /> },
        { accessorKey: "comms_claro", header: "COM CLARO", cell: info => <InlineCell value={info.getValue()} rowId={info.row.original.id} columnKey="comms_claro" maxLength={130} onSave={onUpdate} canEdit={canUpdate} /> },
        { accessorKey: "comms_orion", header: "COM ORION", cell: info => <InlineCell value={info.getValue()} rowId={info.row.original.id} columnKey="comms_orion" maxLength={130} onSave={onUpdate} canEdit={canUpdate} /> },
        { accessorKey: "comms_dofu", header: "COM DOFU", cell: info => <InlineCell value={info.getValue()} rowId={info.row.original.id} columnKey="comms_dofu" maxLength={130} onSave={onUpdate} canEdit={canUpdate} /> },
        { accessorKey: "inst_num", header: "INST NUM", cell: info => <InlineCell value={info.getValue()} rowId={info.row.original.id} columnKey="inst_num" isNumericOnly={true} maxLength={11} onSave={onUpdate} canEdit={canUpdate} /> },
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
                            <span className="text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase">{auditorDisplay}</span>
                            <span className="text-[9px] font-medium text-gray-400 dark:text-slate-500">{formattedDate}</span>
                        </div>
                        {modified.length > 0 ? (
                            <div className="text-[9px] text-gray-500 dark:text-slate-400 font-medium truncate max-w-[150px]" title={modified.join(", ")}>
                                <span className="text-gray-300 dark:text-slate-600 mr-1">✎</span>
                                {modified.join(", ")}
                            </div>
                        ) : (
                            <span className="text-[9px] text-gray-300 dark:text-slate-600 italic">Sin cambios recientes</span>
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
                    <div className="flex flex-col leading-tight min-w-[100px] border-l border-gray-100 dark:border-slate-800 pl-2">
                        <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase" title={audit.user}>{user}</span>
                        <span className="text-[9px] font-medium text-gray-500 dark:text-slate-500">
                            {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                );
            }
        },
        {
            id: "actions",
            header: "ACCIONES",
            cell: ({ row }) => {
                if (!canUpdate && !canDelete && !isTrashView) {
                    return <div className="text-center text-gray-300 font-bold">—</div>;
                }
                return (
                    <div className="flex justify-end items-center gap-1">
                        {isTrashView ? (
                            canDelete && ( // Assuming delete permission implies purge permission or separate permission
                                <button
                                    title="Purgar Definitivamente"
                                    onClick={() => onPurge && onPurge(row.original.id)}
                                    className="p-1 px-1.5 text-red-400 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all duration-150 hover:scale-110 hover:shadow-md active:scale-95"
                                >
                                    <TrashIcon className="w-3.5 h-3.5" />
                                </button>
                            )
                        ) : (
                            <>
                                {canUpdate && (
                                    <button title="Editar Registro" className="p-1 px-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all duration-150 hover:scale-110 hover:shadow-md active:scale-95">
                                        <PencilIcon className="w-3.5 h-3.5" />
                                    </button>
                                )}
                                {canDelete && (
                                    <button
                                        title="Eliminar Registro"
                                        onClick={() => onDelete(row.original.id)}
                                        className="p-1 px-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all duration-150 hover:scale-110 hover:shadow-md active:scale-95"
                                    >
                                        <TrashIcon className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                );
            }
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
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden flex flex-col transition-colors duration-300">
            {/* SEARCH BAR */}
            <div className="p-4 bg-gray-50/50 dark:bg-slate-950/20 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-4 w-4 text-gray-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <input
                        type="text"
                        placeholder="Buscar por cliente, documento, campaña, estatus, agente..."
                        className="block w-full pl-10 pr-3 py-2 border border-gray-200 dark:border-slate-800 rounded-lg leading-5 bg-white dark:bg-slate-950 placeholder-gray-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 sm:text-[11px] font-bold text-[#072D44] dark:text-slate-100 transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest whitespace-nowrap">
                        {filteredAndSortedData.length} registros encontrados
                    </span>

                    {/* Column Selector Button */}
                    <div className="relative">
                        <button
                            onClick={() => setShowColumnSelector(!showColumnSelector)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-gray-600 dark:text-slate-400 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 hover:border-gray-300 dark:hover:border-slate-700 hover:shadow-md transition-all duration-150 active:scale-95"
                            title="Configurar columnas visibles"
                        >
                            <AdjustmentsHorizontalIcon className="w-3.5 h-3.5" />
                            <span className="uppercase tracking-wider">Columnas</span>
                        </button>

                        {/* Column Selector Modal */}
                        {showColumnSelector && (
                            <>
                                {/* Backdrop Overlay */}
                                <div
                                    className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
                                    onClick={() => setShowColumnSelector(false)}
                                />

                                {/* Modal */}
                                <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-800 rounded-2xl shadow-2xl z-50 max-h-[85vh] overflow-hidden flex flex-col">
                                    {/* Header */}
                                    <div className="bg-gradient-to-r from-[#05233A] to-[#072D44] dark:from-slate-950 dark:to-slate-900 text-white p-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <AdjustmentsHorizontalIcon className="w-5 h-5" />
                                                <h3 className="text-sm font-black uppercase tracking-wider">Configurar Columnas</h3>
                                            </div>
                                            <button
                                                onClick={() => setShowColumnSelector(false)}
                                                className="text-white/70 hover:text-white hover:bg-white/10 rounded-lg p-1.5 transition-all"
                                            >
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-white/60 mt-1.5 font-medium">Selecciona las columnas que deseas visualizar</p>
                                    </div>

                                    {/* Scrollable Column List */}
                                    <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
                                        {Object.entries({
                                            date: 'Fecha', time: 'Hora', agent: 'Agente', campaign: 'Campaña',
                                            client: 'Cliente', doc_id: 'Doc ID', contact: 'Contacto',
                                            os_madre: 'OS Madre', os_hija: 'OS Hija', family: 'Familia',
                                            product: 'Producto', plan: 'Plan', pp: 'PP', concept: 'Concepto',
                                            price: 'Monto', status: 'Estatus', assigned_to: 'Asignado',
                                            comms_claro: 'Com Claro', comms_orion: 'Com Orion',
                                            comms_dofu: 'Com Dofu', inst_num: 'Inst Num',
                                            auditor: 'Últ. Cambio', last_status_change: 'Últ. Status'
                                        }).map(([key, label]) => {
                                            const isRequired = ['date', 'client', 'status', 'actions'].includes(key);
                                            const isVisible = visibleColumns[key] ?? true;

                                            return (
                                                <label
                                                    key={key}
                                                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-150 ${isRequired
                                                        ? 'bg-blue-50/70 dark:bg-blue-900/10 cursor-not-allowed border border-blue-100 dark:border-blue-900/40'
                                                        : 'hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer hover:shadow-sm border border-transparent hover:border-gray-200 dark:hover:border-slate-700'
                                                        }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isVisible}
                                                        onChange={() => !isRequired && toggleColumn(key)}
                                                        disabled={isRequired}
                                                        className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-50 cursor-pointer"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <span className={`text-[12px] font-bold block ${isVisible ? 'text-[#072D44] dark:text-slate-100' : 'text-gray-400 dark:text-slate-600 line-through'
                                                            }`}>
                                                            {label}
                                                        </span>
                                                        {isRequired && (
                                                            <span className="text-[9px] text-blue-600 dark:text-blue-400 font-semibold uppercase tracking-wider">
                                                                Columna requerida
                                                            </span>
                                                        )}
                                                    </div>
                                                    {isVisible ? (
                                                        <EyeIcon className="w-5 h-5 text-blue-500 flex-shrink-0" />
                                                    ) : (
                                                        <EyeSlashIcon className="w-5 h-5 text-gray-300 flex-shrink-0" />
                                                    )}
                                                </label>
                                            );
                                        })}
                                    </div>

                                    {/* Footer */}
                                    <div className="bg-gray-50 dark:bg-slate-950 p-4 border-t border-gray-200 dark:border-slate-800 flex gap-2">
                                        <button
                                            onClick={resetColumns}
                                            className="flex-1 px-4 py-2.5 text-[11px] font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/40 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all duration-150 active:scale-95 uppercase tracking-wider"
                                        >
                                            ✓ Mostrar Todas
                                        </button>
                                        <button
                                            onClick={() => setShowColumnSelector(false)}
                                            className="px-4 py-2.5 text-[11px] font-black text-gray-600 dark:text-slate-400 bg-white dark:bg-slate-900 border-2 border-gray-200 dark:border-slate-800 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 hover:border-gray-300 dark:hover:border-slate-700 hover:shadow-md transition-all duration-150 active:scale-95 uppercase tracking-wider"
                                        >
                                            Cerrar
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-slate-800 scrollbar-track-transparent">
                <table className="w-full text-left border-collapse whitespace-nowrap min-w-[1500px]">
                    <thead className="bg-gradient-to-r from-[#05233A] to-[#072D44] dark:from-slate-950 dark:to-slate-900 text-white">
                        {table.getHeaderGroups().map(hg => (
                            <tr key={hg.id}>
                                {hg.headers.filter(h => visibleColumns[h.column.id] !== false).map(h => {
                                    const sortableKeys = ["date", "time", "campaign", "product", "plan", "concept", "status", "assigned_to", "audit", "agent"];
                                    const canSort = sortableKeys.includes(h.column.id) || h.column.columnDef.header?.toString().toLowerCase() !== 'acciones';

                                    return (
                                        <th
                                            key={h.id}
                                            onClick={() => canSort && handleSort(h.column.id)}
                                            className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest border-r border-[#064469]/50 last:border-r-0 ${canSort ? 'cursor-pointer hover:bg-[#0a3d5c] hover:shadow-inner transition-all duration-150' : ''}`}
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
                    <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
                        {table.getRowModel().rows.map((row, i) => (
                            <tr key={row.id} className={`transition-all duration-150 h-9 ${i % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-gray-50 dark:bg-slate-950/40'} hover:bg-blue-50 dark:hover:bg-blue-900/10 hover:shadow-md transition-colors`}>
                                {row.getVisibleCells().filter(cell => visibleColumns[cell.column.id] !== false).map(cell => (
                                    <td key={cell.id} className="px-4 py-0.5 text-[11px] text-[#072D44] dark:text-slate-300 border-r border-gray-100 dark:border-slate-800 last:border-r-0">
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
