-- Migration: Add unique constraint to products table
-- Prevents duplicate products (same name) within the same campaign and tenant.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'products_tenant_campaign_name_key'
    ) THEN
        ALTER TABLE products
        ADD CONSTRAINT products_tenant_campaign_name_key UNIQUE (tenant_id, campaign_id, name);
        RAISE NOTICE 'Constraint products_tenant_campaign_name_key added';
    ELSE
        RAISE NOTICE 'Constraint products_tenant_campaign_name_key already exists';
    END IF;
END $$;
