-- highly optimized composite index for real-time dashboard queries
CREATE INDEX IF NOT EXISTS idx_sales_dashboard_optimized ON sales_orders(tenant_id, created_at DESC, status);

-- analyze to update statistics
ANALYZE sales_orders;
