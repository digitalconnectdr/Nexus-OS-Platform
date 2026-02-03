-- ==========================================================
-- NEXUS OS: DATABASE SCHEMA SNAPSHOT (DDL)
-- Generated: 2026-02-02
-- Compatibility: PostgreSQL 14+
-- ==========================================================

-- PRE-REQUISITES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ORGANIZATIONS (Core Tenant Entity)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR NOT NULL,
    slug VARCHAR UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. STATUSES (Lifecycle configuration)
CREATE TABLE statuses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR NOT NULL,
    color_hex VARCHAR DEFAULT '#CBD5E0',
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    is_active_work BOOLEAN NOT NULL DEFAULT TRUE,
    is_productive BOOLEAN NOT NULL DEFAULT FALSE,
    scope VARCHAR NOT NULL DEFAULT 'DASHBOARD'
);

-- 3. CAMPAIGNS (Business Units)
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR NOT NULL,
    campaign_code VARCHAR,
    is_active BOOLEAN DEFAULT TRUE,
    requires_digitization BOOLEAN DEFAULT FALSE,
    default_status_id UUID REFERENCES statuses(id)
);

-- 4. PRODUCTS (Catalog)
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES organizations(id),
    campaign_id UUID REFERENCES campaigns(id),
    family_name VARCHAR NOT NULL,
    name VARCHAR NOT NULL,
    plan_name VARCHAR,
    current_price NUMERIC(10, 2),
    current_pp TEXT,
    current_concept TEXT,
    incentive NUMERIC(10, 2),
    is_active BOOLEAN DEFAULT TRUE
);

-- 5. USERS PROFILES (HR & Security)
CREATE TABLE users_profiles (
    id UUID PRIMARY KEY, -- References Supabase Auth.Users
    tenant_id UUID REFERENCES organizations(id),
    role VARCHAR, -- admin, manager, supervisor, agent, qa
    first_name VARCHAR,
    last_name VARCHAR,
    avatar_url VARCHAR,
    email VARCHAR,
    is_active BOOLEAN DEFAULT TRUE,
    is_deleted BOOLEAN DEFAULT FALSE,
    last_seen_at TIMESTAMP WITH TIME ZONE,
    skills JSONB DEFAULT '[]',
    supervisor_id UUID REFERENCES users_profiles(id),
    default_campaign_id UUID REFERENCES campaigns(id),
    join_date TIMESTAMP WITH TIME ZONE,
    vicidial_user VARCHAR,
    card_number VARCHAR,
    product_skill VARCHAR,
    product_skills JSONB DEFAULT '[]',
    custom_max_tasks NUMERIC(10, 0)
);

-- 6. SALES ORDERS (Main Transactions)
CREATE TABLE sales_orders (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES organizations(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    agent_id UUID REFERENCES users_profiles(id),
    customer_name VARCHAR,
    customer_doc_id VARCHAR,
    product_id UUID REFERENCES products(id),
    campaign_id UUID REFERENCES campaigns(id),
    supervisor_id UUID REFERENCES users_profiles(id),
    
    -- Snapshots for History
    snapshot_family VARCHAR,
    snapshot_product_name VARCHAR,
    snapshot_plan VARCHAR,
    snapshot_price NUMERIC(10, 2),
    snapshot_pp TEXT,
    snapshot_concept TEXT,
    
    status VARCHAR,
    customer_contact VARCHAR,
    os_madre VARCHAR,
    os_hija VARCHAR,
    assigned_to VARCHAR,
    comms_claro VARCHAR,
    comms_orion VARCHAR,
    comms_dofu VARCHAR,
    inst_num VARCHAR,
    last_updated_by VARCHAR,
    modified_fields JSONB DEFAULT '[]',
    last_status_change JSONB,
    is_deleted BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE,
    
    digitizer_id UUID REFERENCES users_profiles(id),
    installation_date TIMESTAMP WITH TIME ZONE,
    
    PRIMARY KEY (id, created_at) -- Composite key for potential partitioning
);

-- 7. ROLE PERMISSIONS (RBAC)
CREATE TABLE role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES organizations(id),
    role VARCHAR NOT NULL,
    module VARCHAR NOT NULL,
    resource VARCHAR NOT NULL,
    action VARCHAR NOT NULL,
    name VARCHAR,
    is_allowed BOOLEAN DEFAULT FALSE,
    CONSTRAINT _role_resource_action_tenant_uc UNIQUE (role, resource, action, tenant_id)
);

-- 8. ROLE POLICIES (Operational Limits)
CREATE TABLE role_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES organizations(id),
    role VARCHAR NOT NULL,
    smart_routing_enabled BOOLEAN DEFAULT FALSE,
    default_limit NUMERIC(10, 0) DEFAULT 5,
    workable_statuses JSONB DEFAULT '["PENDIENTE"]',
    CONSTRAINT _role_tenant_policy_uc UNIQUE (role, tenant_id)
);

-- 9. SALES GOALS (Forecasting)
CREATE TABLE sales_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES organizations(id),
    campaign_id UUID NOT NULL REFERENCES campaigns(id),
    user_id UUID REFERENCES users_profiles(id),
    product_id UUID REFERENCES products(id),
    product_family VARCHAR NOT NULL DEFAULT 'GENERAL',
    month VARCHAR NOT NULL, -- Format YYYY-MM
    target_amount DOUBLE PRECISION DEFAULT 0,
    target_units INTEGER DEFAULT 0,
    target_daily_amount DOUBLE PRECISION DEFAULT 0,
    target_daily_count INTEGER DEFAULT 0,
    is_manual_daily BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

-- 10. TOURNAMENTS (Gamification)
CREATE TABLE tournaments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR NOT NULL,
    description TEXT,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    bonus_amount NUMERIC(10, 2) DEFAULT 0,
    points_config JSONB NOT NULL DEFAULT '{}',
    target_points NUMERIC(10, 0) DEFAULT 100,
    campaign_id UUID REFERENCES campaigns(id),
    product_family VARCHAR,
    supervisor_id UUID REFERENCES users_profiles(id),
    is_active BOOLEAN DEFAULT TRUE,
    winner_id UUID REFERENCES users_profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

-- 11. TOURNAMENT PARTICIPATIONS (Gamification)
CREATE TABLE tournament_participations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users_profiles(id),
    is_disqualified BOOLEAN DEFAULT FALSE,
    disqualification_reason TEXT,
    is_winner BOOLEAN DEFAULT FALSE,
    award_details JSONB NOT NULL DEFAULT '{}',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT _tournament_user_uc UNIQUE (tournament_id, user_id)
);

-- INDEXES (Optimization)
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_goals_month ON sales_goals(month);
CREATE INDEX IF NOT EXISTS idx_permissions_role ON role_permissions(role, tenant_id);
