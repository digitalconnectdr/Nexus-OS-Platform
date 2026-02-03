-- URGENCE: Fix UndefinedColumnError
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- Ensuring other tables have the column for the upcoming double-layer delete logic
ALTER TABLE users_profiles ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE sales_goals ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
-- Tournaments table check (assuming table name 'tournaments')
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
