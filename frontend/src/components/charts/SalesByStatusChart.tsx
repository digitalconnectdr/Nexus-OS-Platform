"use client";

import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { CustomTooltip } from './CustomTooltip';

interface StatusOption {
    id: string;
    name: string;
    color_hex: string;
}

interface Sale {
    id: string;
    status: string;
    [key: string]: any;
}

interface SalesByStatusChartProps {
    statuses: StatusOption[];
    sales: Sale[];
    onSegmentClick?: (statusId: string, statusName: string) => void;
}

import { useTheme } from 'next-themes';

export const SalesByStatusChart: React.FC<SalesByStatusChartProps> = ({
    statuses,
    sales,
    onSegmentClick
}) => {
    const { theme, resolvedTheme } = useTheme();
    const isDark = resolvedTheme === 'dark';

    // Process data dynamically from statuses and sales
    const chartData = useMemo(() => {
        return statuses.map(status => {
            const count = sales.filter(sale => sale.status === status.id || sale.status === status.name).length;
            const percentage = sales.length > 0 ? (count / sales.length) * 100 : 0;

            return {
                id: status.id,
                name: status.name,
                value: count,
                color: status.color_hex,
                percentage: percentage.toFixed(1)
            };
        }).filter(item => item.value > 0); // Only show statuses with sales
    }, [statuses, sales]);

    const handleClick = (data: any) => {
        if (onSegmentClick) {
            onSegmentClick(data.id, data.name);
        }
    };

    const renderCustomLabel = (entry: any) => {
        return `${entry.percentage}%`;
    };

    if (chartData.length === 0) {
        return (
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-lg p-6 h-[400px] flex items-center justify-center transition-colors">
                <p className="text-gray-400 dark:text-slate-500 text-sm font-medium">No hay datos para mostrar</p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-lg p-6 hover:shadow-xl transition-all duration-300">
            <div className="mb-4">
                <h3 className="text-lg font-black text-[#072D44] dark:text-white uppercase tracking-tight">
                    Ventas por Estado
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400 font-medium mt-1">
                    Distribución de {sales.length} ventas
                </p>
            </div>

            <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                    <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={renderCustomLabel}
                        outerRadius={100}
                        innerRadius={60}
                        fill="#8884d8"
                        dataKey="value"
                        onClick={handleClick}
                        animationDuration={800}
                        animationEasing="ease-out"
                        style={{ cursor: 'pointer' }}
                    >
                        {chartData.map((entry, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={entry.color}
                                className="hover:opacity-80 transition-opacity"
                            />
                        ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                        verticalAlign="bottom"
                        height={36}
                        iconType="circle"
                        formatter={(value, entry: any) => (
                            <span className="text-xs font-bold text-gray-700 dark:text-slate-300">
                                {value} ({entry.payload.value})
                            </span>
                        )}
                    />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
};

export default SalesByStatusChart;
