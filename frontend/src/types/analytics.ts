import { z } from 'zod';

// --- Definición de Esquemas Zod (Validación en tiempo de ejecución) ---

export const CampaignMetricSchema = z.object({
    campaign_name: z.string(),
    leads_generated: z.number(),
    conversion_rate: z.number(),
    active: z.boolean(),
});

export const SupervisorMetricSchema = z.object({
    supervisor_name: z.string(),
    team_efficiency: z.number(),
    active_agents: z.number(),
});

export const GoalComplianceSchema = z.object({
    metric_name: z.string(),
    target: z.number(),
    current: z.number(),
    status: z.enum(['On Track', 'Risk', 'Behind']), // Enum estricto
});

export const OperationsMetricsSchema = z.object({
    by_campaign: z.array(CampaignMetricSchema),
    by_supervisor: z.array(SupervisorMetricSchema),
});

export const DashboardDataSchema = z.object({
    period_start: z.string(), // Las fechas viajan como strings en JSON
    period_end: z.string(),
    operations_metrics: OperationsMetricsSchema,
    goals_compliance: z.array(GoalComplianceSchema),
});

// --- Inferencia de Tipos TypeScript (Para uso en componentes) ---
export type DashboardData = z.infer<typeof DashboardDataSchema>;
