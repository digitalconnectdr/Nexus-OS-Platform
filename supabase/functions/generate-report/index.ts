import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { Database } from 'https://esm.sh/postgres@3.4.3'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { task_id } = await req.json()

        // Initialize Supabase client with service role
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseKey)

        // 1. Get task details
        const { data: task, error: taskError } = await supabase
            .from('report_tasks')
            .select('*')
            .eq('id', task_id)
            .single()

        if (taskError || !task) {
            throw new Error(`Task not found: ${task_id}`)
        }

        // 2. Update status to processing
        await supabase
            .from('report_tasks')
            .update({ status: 'processing' })
            .eq('id', task_id)

        // 3. Connect to PostgreSQL for data queries
        const databaseUrl = Deno.env.get('DATABASE_URL')!
        const db = new Database(databaseUrl)

        // 4. Generate report based on type
        let csvContent = ''
        const params = task.params || {}

        switch (task.report_type) {
            case 'efficiency':
                csvContent = await generateEfficiencyReport(db, params)
                break
            case 'scorecard':
                csvContent = await generateScorecardReport(db, params)
                break
            case 'campaign':
                csvContent = await generateCampaignReport(db, params)
                break
            case 'sales':
                csvContent = await generateSalesReport(db, params)
                break
            default:
                throw new Error(`Unknown report type: ${task.report_type}`)
        }

        // 5. Upload CSV to Storage
        const fileName = `${task.user_id}/${task_id}.csv`
        const { error: uploadError } = await supabase.storage
            .from('reports')
            .upload(fileName, csvContent, {
                contentType: 'text/csv',
                upsert: true
            })

        if (uploadError) {
            throw new Error(`Upload failed: ${uploadError.message}`)
        }

        // 6. Update task as completed
        await supabase
            .from('report_tasks')
            .update({
                status: 'completed',
                file_path: fileName,
                completed_at: new Date().toISOString()
            })
            .eq('id', task_id)

        await db.end()

        return new Response(
            JSON.stringify({ success: true, file_path: fileName }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Error generating report:', error)

        // Mark task as failed
        try {
            const supabase = createClient(
                Deno.env.get('SUPABASE_URL')!,
                Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
            )

            await supabase
                .from('report_tasks')
                .update({
                    status: 'failed',
                    error_message: error.message
                })
                .eq('id', task_id)
        } catch (updateError) {
            console.error('Failed to update task status:', updateError)
        }

        return new Response(
            JSON.stringify({ error: error.message }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )
    }
})

// Report generation functions
async function generateEfficiencyReport(db: any, params: any): Promise<string> {
    const { start_date, end_date, supervisor_id } = params
    const month = start_date.substring(0, 7) // YYYY-MM

    // Query supervisors and agents data
    const query = `
    SELECT 
      u.id,
      u.first_name || ' ' || u.last_name as nombre,
      u.role,
      u.supervisor_id,
      COALESCE(SUM(sg.target_amount), 0) as objetivo_money,
      COALESCE(SUM(sg.target_units), 0) as objetivo_count,
      COALESCE(SUM(so.snapshot_price), 0) as logro_money,
      COALESCE(COUNT(so.id), 0) as logro_count
    FROM users u
    LEFT JOIN sales_goals sg ON sg.user_id = u.id AND sg.month = $1
    LEFT JOIN sales_orders so ON so.agent_id = u.id 
      AND DATE_TRUNC('month', so.created_at) = $1::date
      AND so.status = 'Approved'
    WHERE u.role IN ('Supervisor senior', 'Supervision', 'agent', 'Representante')
    ${supervisor_id ? 'AND (u.id = $2 OR u.supervisor_id = $2)' : ''}
    GROUP BY u.id, u.first_name, u.last_name, u.role, u.supervisor_id
  `

    const result = await db.queryObject(query, supervisor_id ? [month, supervisor_id] : [month])

    // Build CSV
    let csv = '--- RENDIMIENTO DE SUPERVISORES Y AGENTES ---\n'
    csv += 'ID,Nombre,Rol,Logro ($),Logro (#),Objetivo ($),Objetivo (#),Cumpl. ($) %,Cumpl. (#) %,Estatus\n'

    for (const row of result.rows) {
        const compMoney = row.objetivo_money > 0 ? (row.logro_money / row.objetivo_money * 100).toFixed(1) : '0.0'
        const compCount = row.objetivo_count > 0 ? (row.logro_count / row.objetivo_count * 100).toFixed(1) : '0.0'
        const status = parseFloat(compMoney) >= 100 ? 'Good' : parseFloat(compMoney) >= 80 ? 'Warning' : 'Critical'

        csv += `${row.id},"${row.nombre}",${row.role},${row.logro_money},${row.logro_count},${row.objetivo_money},${row.objetivo_count},${compMoney},${compCount},${status}\n`
    }

    return csv
}

async function generateScorecardReport(db: any, params: any): Promise<string> {
    // Similar implementation for scorecard
    return await generateEfficiencyReport(db, params)
}

async function generateCampaignReport(db: any, params: any): Promise<string> {
    const { month } = params

    const query = `
    SELECT 
      c.id,
      c.name as nombre,
      COALESCE(SUM(sg.target_amount), 0) as objetivo_money,
      COALESCE(SUM(so.snapshot_price), 0) as logro_money
    FROM campaigns c
    LEFT JOIN sales_goals sg ON sg.campaign_id = c.id AND sg.month = $1
    LEFT JOIN sales_orders so ON so.campaign_id = c.id 
      AND DATE_TRUNC('month', so.created_at) = $1::date
    GROUP BY c.id, c.name
  `

    const result = await db.queryObject(query, [month])

    let csv = '--- RENDIMIENTO DE CAMPAÑAS ---\n'
    csv += 'ID Campaña,Nombre,Logro ($),Objetivo ($),Cumpl. ($) %\n'

    for (const row of result.rows) {
        const comp = row.objetivo_money > 0 ? (row.logro_money / row.objetivo_money * 100).toFixed(1) : '0.0'
        csv += `${row.id},"${row.nombre}",${row.logro_money},${row.objetivo_money},${comp}\n`
    }

    return csv
}

async function generateSalesReport(db: any, params: any): Promise<string> {
    const { start_date, end_date, campaign_id, scope } = params

    let query = `
    SELECT 
      so.created_at,
      u.first_name || ' ' || u.last_name as agente,
      c.name as campana,
      so.customer_name,
      so.customer_doc_id,
      so.snapshot_price,
      so.status
    FROM sales_orders so
    LEFT JOIN users u ON u.id = so.agent_id
    LEFT JOIN campaigns c ON c.id = so.campaign_id
    WHERE so.created_at >= $1 AND so.created_at <= $2
  `

    if (campaign_id) {
        query += ` AND so.campaign_id = $3`
    }

    const result = await db.queryObject(
        query,
        campaign_id ? [start_date, end_date, campaign_id] : [start_date, end_date]
    )

    let csv = '--- REPORTE DE VENTAS ---\n'
    csv += 'Fecha,Agente,Campaña,Cliente,Doc ID,Monto,Estatus\n'

    for (const row of result.rows) {
        const fecha = new Date(row.created_at).toISOString().split('T')[0]
        csv += `${fecha},"${row.agente}","${row.campana}","${row.customer_name}",${row.customer_doc_id},${row.snapshot_price},${row.status}\n`
    }

    return csv
}
