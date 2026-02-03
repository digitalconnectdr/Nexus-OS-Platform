"use client";

import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { CustomTooltip } from './CustomTooltip';

import { useTheme } from 'next-themes';

interface Sale {
    id: string;
    date: string;
    price: number;
    [key: string]: any;
}

interface SalesTrendChartProps {
    sales: Sale[];
    onPointClick?: (date: string) => void;
}

export const SalesTrendChart: React.FC<SalesTrendChartProps> = ({
    sales,
    onPointClick
}) => {
    const { theme, resolvedTheme } = useTheme();
    const isDark = resolvedTheme === 'dark';

    // Group sales by date dynamically
    const chartData = useMemo(() => {
        const grouped = sales.reduce((acc, sale) => {
            const date = sale.date;
            if (!acc[date]) {
                acc[date] = {
                    date,
                    count: 0,
                    amount: 0
                };
            }
            acc[date].count += 1;
            acc[date].amount += Number(sale.price) || 0;
            return acc;
        }, {} as Record<string, { date: string; count: number; amount: number }>);

        return Object.values(grouped)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .slice(-30); // Last 30 days
    }, [sales]);

    const handleClick = (data: any) => {
        if (onPointClick && data && data.activePayload) {
            onPointClick(data.activePayload[0].payload.date);
        }
    };

    if (chartData.length === 0) {
        return (
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-lg p-6 h-[400px] flex items-center justify-center transition-colors">
                <p className="text-gray-400 dark:text-slate-500 text-sm font-medium">No hay datos para mostrar</p>
            </div>
        );
    }

    const axisColor = isDark ? '#94a3b8' : '#64748b'; // slate-400 vs slate-500
    const gridColor = isDark ? '#1e293b' : '#e2e8f0'; // slate-800 vs slate-200

    return (
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-lg p-6 hover:shadow-xl transition-all duration-300">
            <div className="mb-4">
                <h3 className="text-lg font-black text-[#072D44] dark:text-white uppercase tracking-tight">
                    Tendencia de Ventas
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400 font-medium mt-1">
                    Últimos {chartData.length} días
                </p>
            </div>

            <ResponsiveContainer width="100%" height={300}>
                <AreaChart
                    data={chartData}
                    onClick={handleClick}
                    style={{ cursor: 'pointer' }}
                >
                    <defs>
                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                    <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fill: axisColor }}
                        axisLine={{ stroke: gridColor }}
                        tickLine={{ stroke: gridColor }}
                        tickFormatter={(value) => {
                            const date = new Date(value);
                            return `${date.getDate()}/${date.getMonth() + 1}`;
                        }}
                    />
                    <YAxis
                        tick={{ fontSize: 10, fill: axisColor }}
                        axisLine={{ stroke: gridColor }}
                        tickLine={{ stroke: gridColor }}
                        label={{
                            value: 'Ventas',
                            angle: -90,
                            position: 'insideLeft',
                            style: { fontSize: 11, fill: axisColor, fontWeight: 'bold' }
                        }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                        type="monotone"
                        dataKey="count"
                        name="Cantidad"
                        stroke="#3B82F6"
                        strokeWidth={3}
                        fill="url(#colorCount)"
                        animationDuration={800}
                        animationEasing="ease-out"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};

export default SalesTrendChart;
