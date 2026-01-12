'use client';

import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

interface PaginationProps {
    currentPage: number;
    totalRecords: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onPageSizeChange?: (size: number) => void;
}

export default function Pagination({
    currentPage,
    totalRecords,
    pageSize,
    onPageChange,
    onPageSizeChange
}: PaginationProps) {
    const totalPages = Math.ceil(totalRecords / pageSize);

    if (totalRecords === 0) return null;

    return (
        <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-100 shadow-sm mt-4">
            <div className="flex items-center gap-4">
                {onPageSizeChange && (
                    <select
                        value={pageSize}
                        onChange={(e) => onPageSizeChange(Number(e.target.value))}
                        className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1 text-[11px] font-black text-[#072D44] outline-none focus:border-blue-600 transition-all cursor-pointer"
                    >
                        {[10, 20, 50, 100].map(s => (
                            <option key={s} value={s}>{s} FILAS</option>
                        ))}
                    </select>
                )}
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-2">
                    MOSTRANDO <span className="text-gray-900">{Math.min(totalRecords, (currentPage - 1) * pageSize + 1)}</span> - <span className="text-gray-900">{Math.min(totalRecords, currentPage * pageSize)}</span> DE <span className="text-gray-900">{totalRecords}</span> REGISTROS
                </div>
            </div>

            <div className="flex items-center gap-3">
                <button
                    disabled={currentPage === 1}
                    onClick={() => onPageChange(currentPage - 1)}
                    className="p-2 border border-gray-100 rounded-lg hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
                    title="Anterior"
                >
                    <ChevronLeftIcon className="w-4 h-4 text-[#072D44]" />
                </button>

                <div className="flex items-center gap-1">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-tight">PÁGINA</span>
                    <span className="text-[12px] font-black text-[#072D44] bg-gray-50 px-2.5 py-1 rounded-md border border-gray-100">{currentPage}</span>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-tight">DE {totalPages || 1}</span>
                </div>

                <button
                    disabled={currentPage >= totalPages}
                    onClick={() => onPageChange(currentPage + 1)}
                    className="p-2 border border-gray-100 rounded-lg hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
                    title="Siguiente"
                >
                    <ChevronRightIcon className="w-4 h-4 text-[#072D44]" />
                </button>
            </div>
        </div>
    );
}
