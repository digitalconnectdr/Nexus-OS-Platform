"""
Database indexes for performance optimization
Run this migration to add indexes to frequently queried columns
UPDATED: Fixed to match actual database schema
"""

-- Sales Orders indexes (FIXED: status is String, not status_id)
CREATE INDEX IF NOT EXISTS idx_sales_orders_agent_id ON sales_orders(agent_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_campaign_id ON sales_orders(campaign_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_created_at ON sales_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON sales_orders(status);
CREATE INDEX IF NOT EXISTS idx_sales_orders_tenant_id ON sales_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_supervisor_id ON sales_orders(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_product_id ON sales_orders(product_id);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_sales_orders_agent_date ON sales_orders(agent_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sales_orders_campaign_date ON sales_orders(campaign_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sales_orders_tenant_date ON sales_orders(tenant_id, created_at);

-- Sales Goals indexes
CREATE INDEX IF NOT EXISTS idx_sales_goals_user_id ON sales_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_goals_campaign_id ON sales_goals(campaign_id);
CREATE INDEX IF NOT EXISTS idx_sales_goals_month ON sales_goals(month);
CREATE INDEX IF NOT EXISTS idx_sales_goals_tenant_id ON sales_goals(tenant_id);

-- Composite index for goals queries
CREATE INDEX IF NOT EXISTS idx_sales_goals_user_month ON sales_goals(user_id, month);
CREATE INDEX IF NOT EXISTS idx_sales_goals_tenant_month ON sales_goals(tenant_id, month);

-- Users (users_profiles table)
CREATE INDEX IF NOT EXISTS idx_users_profiles_supervisor_id ON users_profiles(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_users_profiles_tenant_id ON users_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_profiles_role ON users_profiles(role);
CREATE INDEX IF NOT EXISTS idx_users_profiles_is_active ON users_profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_users_profiles_default_campaign_id ON users_profiles(default_campaign_id);

-- Campaigns indexes
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant_id ON campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_is_active ON campaigns(is_active);
CREATE INDEX IF NOT EXISTS idx_campaigns_default_status_id ON campaigns(default_status_id);

-- Products indexes
CREATE INDEX IF NOT EXISTS idx_products_campaign_id ON products(campaign_id);
CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);

-- Statuses indexes
CREATE INDEX IF NOT EXISTS idx_statuses_tenant_id ON statuses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_statuses_is_active ON statuses(is_active);

-- Analyze tables after creating indexes
ANALYZE sales_orders;
ANALYZE sales_goals;
ANALYZE users_profiles;
ANALYZE campaigns;
ANALYZE products;
ANALYZE statuses;
