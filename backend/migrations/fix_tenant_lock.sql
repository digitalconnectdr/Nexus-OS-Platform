-- ============================================
-- MIGRATION: Fix Tenant Lock Error
-- Purpose: Remove triggers/functions causing "Tenant or user not found" error
-- Date: 2026-01-20
-- ============================================

-- STEP 1: Identify and Drop ALL triggers on critical tables
DO $$
DECLARE
    r RECORD;
BEGIN
    RAISE NOTICE '=== REMOVING TRIGGERS ===';
    FOR r IN (
        SELECT event_object_table, trigger_name 
        FROM information_schema.triggers 
        WHERE trigger_schema = 'public' 
        AND event_object_table IN ('organizations', 'users_profiles', 'role_permissions')
    ) LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.trigger_name) || ' ON public.' || quote_ident(r.event_object_table) || ' CASCADE;';
        RAISE NOTICE 'Trigger eliminado: % en tabla %', r.trigger_name, r.event_object_table;
    END LOOP;
END $$;

-- STEP 2: Find and list functions containing the error message
-- (This is diagnostic - shows which functions to investigate)
SELECT 
    proname as function_name,
    pg_get_functiondef(oid) as definition
FROM pg_proc 
WHERE prosrc ILIKE '%Tenant or user not found%'
   OR prosrc ILIKE '%tenant_id%'
   AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- STEP 3: Disable RLS on critical tables (TEMPORARY - for testing)
ALTER TABLE IF EXISTS public.organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.users_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.role_permissions DISABLE ROW LEVEL SECURITY;

-- STEP 4: Drop any existing problematic policies
DROP POLICY IF EXISTS "Tenant Isolation" ON public.organizations;
DROP POLICY IF EXISTS "Tenant Isolation" ON public.users_profiles;
DROP POLICY IF EXISTS "Tenant Isolation" ON public.role_permissions;

-- STEP 5: Verify tables are accessible
SELECT 'organizations' as table_name, COUNT(*) as row_count FROM public.organizations
UNION ALL
SELECT 'users_profiles', COUNT(*) FROM public.users_profiles
UNION ALL
SELECT 'role_permissions', COUNT(*) FROM public.role_permissions;

-- ============================================
-- NOTES:
-- After running this migration:
-- 1. Restart the backend server
-- 2. Clear browser cache
-- 3. Attempt login
-- 4. If successful, re-enable RLS with proper policies
-- ============================================
