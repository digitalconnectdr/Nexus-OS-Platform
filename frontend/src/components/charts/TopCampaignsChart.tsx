"use client";

import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { CustomTooltip } from './CustomTooltip';

interface CampaignOption {
    id: string;
    name: string;
}

interface Sale {
    id: string;
    campaign: string;
    campaign_id?: string;
    price: number;
    [key: string]: any;
}

interface TopCampaignsChartProps {
    campaigns: CampaignOption[];
    sales: Sale[];
    onBarClick?: (campaignId: string, campaignName: string) => void;
    limit?: number;
}

import { useTheme } from 'next-themes';

export const TopCampaignsChart: React.FC<TopCampaignsChartProps> = ({
    campaigns,
    sales,
    onBarClick,
    limit = 5
}) => {
    const { theme, resolvedTheme } = useTheme();
    const isDark = resolvedTheme === 'dark';

    // Process data dynamically from campaigns and sales
    const chartData = useMemo(() => {
        const grouped = campaigns.map(campaign => {
            const campaignSales = sales.filter(sale =>
                sale.campaign_id === campaign.id || sale.campaign === campaign.name
            );

            const count = campaignSales.length;
            const amount = campaignSales.reduce((sum, sale) => sum + (Number(sale.price) || 0), 0);

            return {
                id: campaign.id,
                name: campaign.name,
                count,
                amount,
                percentage: sales.length > 0 ? (count / sales.length) * 100 : 0
            };
        });

        return grouped
            .filter(item => item.count > 0)
            .sort((a, b) => b.count - a.count)
            .slice(0, limit);
    }, [campaigns, sales, limit]);

    const handleClick = (data: any) => {
        if (onBarClick) {
            onBarClick(data.id, data.name);
        }
    };

    const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

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
                    Top Campañas
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400 font-medium mt-1">
                    {chartData.length} campañas con más ventas
                </p>
            </div>

            <ResponsiveContainer width="100%" height={300}>
                <BarChart
                    data={chartData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={true} vertical={false} />
                    <XAxis
                        type="number"
                        tick={{ fontSize: 10, fill: axisColor }}
                        axisLine={{ stroke: gridColor }}
                        tickLine={{ stroke: gridColor }}
                    />
                    <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 10, fill: axisColor, fontWeight: 'bold' }}
                        axisLine={{ stroke: gridColor }}
                        tickLine={{ stroke: gridColor }}
                        width={90}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar
                        dataKey="count"
                        name="Ventas"
                        radius={[0, 8, 8, 0]}
                        onClick={handleClick}
                        animationDuration={800}
                        animationEasing="ease-out"
                        style={{ cursor: 'pointer' }}
                    >
                        {chartData.map((entry, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={COLORS[index % COLORS.length]}
                                className="hover:opacity-80 transition-opacity"
                            />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

export default TopCampaignsChart;
