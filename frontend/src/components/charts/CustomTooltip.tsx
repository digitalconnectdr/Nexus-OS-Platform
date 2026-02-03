"use client";

import React from 'react';

interface CustomTooltipProps {
    active?: boolean;
    payload?: any[];
    label?: string;
    formatter?: (value: any) => string;
}

export const CustomTooltip: React.FC<CustomTooltipProps> = ({
    active,
    payload,
    label,
    formatter
}) => {
    if (!active || !payload || payload.length === 0) return null;

    const formatValue = (value: any) => {
        if (formatter) return formatter(value);
        if (typeof value === 'number') {
            // Format as currency if value is large
            if (value > 1000) {
                return new Intl.NumberFormat('es-DO', {
                    style: 'currency',
                    currency: 'DOP'
                }).format(value);
            }
            return value.toLocaleString('es-DO');
        }
        return value;
    };

    return (
        <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm text-gray-900 dark:text-white p-3 rounded-xl shadow-2xl border border-gray-200 dark:border-white/10 min-w-[180px] transition-colors duration-300">
            {label && (
                <p className="font-black text-sm mb-2 text-gray-900 dark:text-white border-b border-gray-100 dark:border-white/20 pb-1">
                    {label}
                </p>
            )}
            <div className="space-y-1">
                {payload.map((entry, index) => (
                    <div key={index} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <div
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: entry.color || entry.fill }}
                            />
                            <span className="text-xs font-medium text-gray-600 dark:text-white/80">
                                {entry.name}:
                            </span>
                        </div>
                        <span className="text-xs font-bold text-gray-900 dark:text-white">
                            {formatValue(entry.value)}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default CustomTooltip;
