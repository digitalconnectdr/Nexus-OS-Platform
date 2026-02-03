import { FilterCriteria } from './AdvancedFilters';
import type { Sale } from '../dashboard/RealTimeTable';

export const applyFilters = (sales: Sale[], filters: FilterCriteria): Sale[] => {
    return sales.filter(sale => {
        // Filtro de fecha
        if (filters.dateFrom) {
            const saleDate = new Date(sale.date);
            const fromDate = new Date(filters.dateFrom);
            if (saleDate < fromDate) return false;
        }

        if (filters.dateTo) {
            const saleDate = new Date(sale.date);
            const toDate = new Date(filters.dateTo);
            toDate.setHours(23, 59, 59, 999); // Include entire day
            if (saleDate > toDate) return false;
        }

        // Filtro de estado
        if (filters.status) {
            if (sale.status !== filters.status) return false;
        }

        // Filtro de campañas (multi-select)
        if (filters.campaigns && filters.campaigns.length > 0) {
            const match = filters.campaigns.some(campaignId =>
                sale.campaign_id === campaignId || sale.campaign === campaignId
            );
            if (!match) return false;
        }

        // Filtro de agentes (multi-select)
        if (filters.agents && filters.agents.length > 0) {
            const match = filters.agents.some(agent =>
                sale.agent === agent || sale.assigned_to === agent
            );
            if (!match) return false;
        }

        // Filtro de productos (multi-select)
        if (filters.products && filters.products.length > 0) {
            const match = filters.products.includes(sale.product || '');
            if (!match) return false;
        }

        // Filtro de supervisores (multi-select) - Por ahora skip, necesitamos agregar supervisor_id al Sale type
        // TODO: Agregar supervisor_id al tipo Sale en RealTimeTable
        if (filters.supervisors && filters.supervisors.length > 0) {
            // Skip por ahora hasta que se agregue supervisor_id al tipo Sale
            // const match = filters.supervisors.includes(sale.supervisor_id || '');
            // if (!match) return false;
        }

        // Filtro de monto
        if (filters.amountFrom !== undefined) {
            if (Number(sale.price) < filters.amountFrom) return false;
        }

        if (filters.amountTo !== undefined) {
            if (Number(sale.price) > filters.amountTo) return false;
        }

        return true;
    });
};

// Extraer agentes únicos de las ventas
export const extractUniqueAgents = (sales: Sale[]): string[] => {
    const agents = new Set<string>();
    sales.forEach(sale => {
        const agent = sale.agent || sale.assigned_to;
        if (agent && agent !== '--' && agent !== 'SISTEMA') {
            agents.add(agent);
        }
    });
    return Array.from(agents).sort();
};

// Extraer productos únicos de las ventas
export const extractUniqueProducts = (sales: Sale[]): string[] => {
    const products = new Set<string>();
    sales.forEach(sale => {
        if (sale.product && sale.product !== '--') {
            products.add(sale.product);
        }
    });
    return Array.from(products).sort();
};
