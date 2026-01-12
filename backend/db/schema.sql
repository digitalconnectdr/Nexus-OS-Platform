-- 1. CONFIGURACIÓN
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. NÚCLEO
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users_profiles (
    id UUID PRIMARY KEY, -- En Supabase referencia a auth.users(id)
    tenant_id UUID REFERENCES organizations(id),
    role TEXT CHECK (role IN ('admin', 'manager', 'supervisor', 'agent', 'qa')),
    first_name TEXT,
    last_name TEXT,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    last_seen_at TIMESTAMP WITH TIME ZONE,
    skills JSONB DEFAULT '[]'::jsonb,
    -- Operational Fields (Phase 19)
    supervisor_id UUID REFERENCES users_profiles(id),
    default_campaign_id UUID REFERENCES campaigns(id),
    join_date TIMESTAMP WITH TIME ZONE,
    vicidial_user TEXT,
    card_number TEXT,
    product_skill TEXT
);

-- 3. CATÁLOGO
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES organizations(id) NOT NULL,
    name TEXT NOT NULL,
    campaign_code TEXT,
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES organizations(id) NOT NULL,
    campaign_id UUID REFERENCES campaigns(id),
    family_name TEXT NOT NULL,
    name TEXT NOT NULL,
    plan_name TEXT,
    current_price DECIMAL(10,2),
    current_pp TEXT,
    current_concept TEXT,
    incentive DECIMAL(10,2) DEFAULT 0.0,
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS monthly_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES organizations(id) NOT NULL,
    campaign_id UUID REFERENCES campaigns(id) NOT NULL,
    user_id UUID REFERENCES users_profiles(id), -- Nullable for campaign-wide goals
    product_name TEXT, -- Nullable for campaign-wide goals
    month TEXT NOT NULL, -- YYYY-MM
    target_amount DECIMAL(12,2) DEFAULT 0.0,
    target_units DECIMAL(12,2) DEFAULT 0.0,
    daily_amount DECIMAL(12,2) DEFAULT 0.0,
    daily_units DECIMAL(12,2) DEFAULT 0.0
);

CREATE TABLE IF NOT EXISTS sales_statuses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES organizations(id) NOT NULL,
    name TEXT NOT NULL,
    color_hex TEXT DEFAULT '#CBD5E0',
    is_active BOOLEAN DEFAULT true
);

-- 4. VENTAS (Particionada + Snapshots)
CREATE TABLE IF NOT EXISTS sales_orders (
    id UUID DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES organizations(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    agent_id UUID REFERENCES users_profiles(id),
    customer_name TEXT,
    customer_doc_id TEXT,
    product_id UUID REFERENCES products(id),
    snapshot_product_name TEXT, -- Capturado Nivel 2
    snapshot_plan TEXT,         -- Capturado Nivel 4
    snapshot_price DECIMAL(10,2), -- Precio histórico
    snapshot_pp TEXT,
    snapshot_concept TEXT,
    status TEXT CHECK (status IN ('Pending', 'Approved', 'Installed', 'Rejected')),
    -- New Fields (Phase 12)
    customer_contact TEXT,
    os_madre TEXT,
    os_hija TEXT,
    assigned_to TEXT,
    comms_claro DECIMAL(10,2),
    comms_orion DECIMAL(10,2),
    comms_dofu DECIMAL(10,2),
    inst_num TEXT,
    last_updated_by TEXT,
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Partición para 2025
CREATE TABLE IF NOT EXISTS sales_orders_y2025 PARTITION OF sales_orders
    FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

-- 5. GAMIFICACIÓN
CREATE TABLE IF NOT EXISTS manual_awards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES organizations(id),
    title TEXT NOT NULL,
    winner_user_id UUID REFERENCES users_profiles(id),
    description TEXT,
    valid_until TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS leaderboard_moderation (
    user_id UUID REFERENCES users_profiles(id),
    tenant_id UUID REFERENCES organizations(id),
    is_hidden BOOLEAN DEFAULT true,
    hidden_reason TEXT,
    PRIMARY KEY (user_id, tenant_id)
);

-- 6. SEGURIDAD (RLS)
ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE users_profiles ENABLE ROW LEVEL SECURITY;

-- Política de Aislamiento de Tenant (Simpificada para Supabase)
-- Nota: auth.uid() es una función de Supabase para obtener el ID del usuario autenticado.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Isolation' AND tablename = 'sales_orders') THEN
        CREATE POLICY "Tenant Isolation" ON sales_orders
            USING (tenant_id = (SELECT tenant_id FROM users_profiles WHERE id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Isolation' AND tablename = 'products') THEN
        CREATE POLICY "Tenant Isolation" ON products
            USING (tenant_id = (SELECT tenant_id FROM users_profiles WHERE id = auth.uid()));
    END IF;
END
$$;
