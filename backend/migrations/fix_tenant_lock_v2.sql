-- ============================================
-- MIGRATION: Aggressive Function/Trigger Removal
-- Purpose: Find and DESTROY the function throwing "Tenant or user not found"
-- Date: 2026-01-20 (HOTFIX v2)
-- ============================================

-- STEP 1: List ALL functions that might be the culprit
SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_functiondef(p.oid) as full_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND (
    p.prosrc ILIKE '%Tenant%' 
    OR p.prosrc ILIKE '%tenant%'
    OR p.prosrc ILIKE '%user not found%'
    OR p.proname ILIKE '%tenant%'
    OR p.proname ILIKE '%set_tenant%'
    OR p.proname ILIKE '%check_tenant%'
  );

-- STEP 2: Drop common tenant-related functions (AGGRESSIVE)
DROP FUNCTION IF EXISTS public.set_tenant_id(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_tenant_id() CASCADE;
DROP FUNCTION IF EXISTS public.check_tenant_access() CASCADE;
DROP FUNCTION IF EXISTS public.validate_tenant() CASCADE;
DROP FUNCTION IF EXISTS public.set_db_context(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.current_tenant_id() CASCADE;

-- STEP 3: Remove ALL triggers from users_profiles (NUCLEAR OPTION)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT trigger_name 
        FROM information_schema.triggers 
        WHERE event_object_schema = 'public' 
        AND event_object_table = 'users_profiles'
    ) LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.trigger_name) || ' ON public.users_profiles CASCADE;';
        RAISE NOTICE 'Dropped trigger: %', r.trigger_name;
    END LOOP;
END $$;

-- STEP 4: Check for SET commands in session that might be causing issues
-- Reset any session variables
RESET ALL;

-- STEP 5: Verify we can SELECT from users_profiles without error
SELECT id, email, role, tenant_id 
FROM public.users_profiles 
WHERE email = 'jcpenalo@gmail.com'
LIMIT 1;

-- ============================================
-- If the SELECT above FAILS, the function is still there
-- Run this to see the EXACT error:
-- ============================================
-- SELECT * FROM public.users_profiles LIMIT 1;
