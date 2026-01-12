'use client';

export default function SkeletonTable({ rows = 5, cols = 6 }: { rows?: number, cols?: number }) {
    return (
        <div className="w-full bg-white rounded-2xl border border-slate-100 overflow-hidden animate-pulse">
            <div className="bg-slate-50 border-b border-slate-100 p-4">
                <div className="h-4 bg-slate-200 rounded-md w-1/4"></div>
            </div>
            <div className="p-0">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="border-b border-slate-50">
                            {[...Array(cols)].map((_, i) => (
                                <th key={i} className="p-4 text-left">
                                    <div className="h-3 bg-slate-100 rounded-md w-16"></div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {[...Array(rows)].map((_, rowIndex) => (
                            <tr key={rowIndex} className="border-b border-slate-50 last:border-0">
                                {[...Array(cols)].map((_, colIndex) => (
                                    <td key={colIndex} className="p-4">
                                        <div className={`h-3 bg-slate-50 rounded-md ${colIndex === 0 ? 'w-24' : 'w-16'}`}></div>
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
