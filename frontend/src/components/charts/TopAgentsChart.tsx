"use client";

import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { CustomTooltip } from './CustomTooltip';

interface Sale {
    id: string;
    agent?: string;
    assigned_to?: string;
    price: number;
    [key: string]: any;
}

interface TopAgentsChartProps {
    sales: Sale[];
    onBarClick?: (agent: string) => void;
    limit?: number;
}

import { useTheme } from 'next-themes';

export const TopAgentsChart: React.FC<TopAgentsChartProps> = ({
    sales,
    onBarClick,
    limit = 5
}) => {
    const { theme, resolvedTheme } = useTheme();
    const isDark = resolvedTheme === 'dark';

    // Process data dynamically from sales - extract unique agents
    const chartData = useMemo(() => {
        const grouped: Record<string, { count: number; amount: number }> = {};

        sales.forEach(sale => {
            const agent = sale.agent || sale.assigned_to || 'Sin asignar';
            if (!grouped[agent]) {
                grouped[agent] = { count: 0, amount: 0 };
            }
            grouped[agent].count += 1;
            grouped[agent].amount += Number(sale.price) || 0;
        });

        return Object.entries(grouped)
            .map(([agent, data]) => ({
                agent: agent.includes('@') ? agent.split('@')[0] : agent,
                fullAgent: agent,
                count: data.count,
                amount: data.amount,
                percentage: sales.length > 0 ? (data.count / sales.length) * 100 : 0
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, limit);
    }, [sales, limit]);

    const handleClick = (data: any) => {
        if (onBarClick) {
            onBarClick(data.fullAgent);
        }
    };

    const getBarColor = (index: number) => {
        const colors = ['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EF4444'];
        return colors[index % colors.length];
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
                    Top Agentes
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400 font-medium mt-1">
                    {chartData.length} agentes con más ventas
                </p>
            </div>

            <ResponsiveContainer width="100%" height={300}>
                <BarChart
                    data={chartData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 60 }}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                    <XAxis
                        dataKey="agent"
                        tick={{ fontSize: 10, fill: axisColor, fontWeight: 'bold' }}
                        axisLine={{ stroke: gridColor }}
                        tickLine={{ stroke: gridColor }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
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
                    <Bar
                        dataKey="count"
                        name="Ventas"
                        radius={[8, 8, 0, 0]}
                        onClick={handleClick}
                        animationDuration={800}
                        animationEasing="ease-out"
                        style={{ cursor: 'pointer' }}
                    >
                        {chartData.map((entry, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={getBarColor(index)}
                                className="hover:opacity-80 transition-opacity"
                            />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

export default TopAgentsChart;
