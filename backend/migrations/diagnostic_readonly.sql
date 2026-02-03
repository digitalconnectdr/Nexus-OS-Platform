-- ============================================
-- SIMPLIFIED DIAGNOSTIC (Supabase Compatible)
-- Purpose: Find the EXACT source of "Tenant or user not found" error
-- Date: 2026-01-20 (v2 - Simplified)
-- IMPORTANT: This script does NOT modify anything
-- ============================================

-- ========================================
-- SECTION 1: DATABASE INFO
-- ========================================
SELECT '=== DATABASE INFO ===' as section;

SELECT 
    current_database() as database_name,
    current_user as current_user,
    session_user as session_user;

-- ========================================
-- SECTION 2: EVENT TRIGGERS (CRITICAL)
-- ========================================
SELECT '=== EVENT TRIGGERS ===' as section;

SELECT 
    evtname as trigger_name,
    evtevent as event_type,
    evtfoid::regproc as function_called,
    evtenabled as is_enabled
FROM pg_event_trigger
ORDER BY evtname;

-- ========================================
-- SECTION 3: ALL FUNCTIONS (CRITICAL)
-- ========================================
SELECT '=== ALL FUNCTIONS IN PUBLIC SCHEMA ===' as section;

SELECT 
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as arguments,
    CASE 
        WHEN p.provolatile = 'i' THEN 'IMMUTABLE'
        WHEN p.provolatile = 's' THEN 'STABLE'
        WHEN p.provolatile = 'v' THEN 'VOLATILE'
    END as volatility,
    p.prosecdef as is_security_definer
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
ORDER BY p.proname;

-- ========================================
-- SECTION 4: TRIGGERS ON USERS_PROFILES
-- ========================================
SELECT '=== TRIGGERS ON USERS_PROFILES ===' as section;

SELECT 
    t.tgname as trigger_name,
    p.proname as function_name,
    CASE t.tgtype::int & 66
        WHEN 2 THEN 'BEFORE'
        WHEN 64 THEN 'INSTEAD OF'
        ELSE 'AFTER'
    END as trigger_timing,
    CASE 
        WHEN t.tgtype::int & 4 = 4 THEN 'INSERT'
        WHEN t.tgtype::int & 8 = 8 THEN 'DELETE'
        WHEN t.tgtype::int & 16 = 16 THEN 'UPDATE'
        ELSE 'OTHER'
    END as trigger_event
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname = 'users_profiles'
  AND NOT t.tgisinternal
ORDER BY t.tgname;

-- ========================================
-- SECTION 5: RLS STATUS
-- ========================================
SELECT '=== RLS STATUS ===' as section;

SELECT 
    c.relname as table_name,
    c.relrowsecurity as rls_enabled,
    c.relforcerowsecurity as rls_forced
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND c.relname IN ('users_profiles', 'organizations', 'role_permissions');

-- ========================================
-- SECTION 6: RLS POLICIES (SIMPLIFIED)
-- ========================================
SELECT '=== RLS POLICIES ===' as section;

SELECT 
    tablename,
    policyname,
    permissive,
    cmd as command,
    qual as using_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('users_profiles', 'organizations', 'role_permissions')
ORDER BY tablename, policyname;

-- ========================================
-- SECTION 7: SEARCH FOR ERROR MESSAGE (MOST IMPORTANT)
-- ========================================
SELECT '=== FUNCTIONS WITH ERROR MESSAGE ===' as section;

SELECT 
    p.proname as function_name,
    substring(pg_get_functiondef(p.oid), 1, 500) as definition_preview
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND (
    pg_get_functiondef(p.oid) ILIKE '%Tenant or user not found%'
    OR pg_get_functiondef(p.oid) ILIKE '%tenant_id%'
  );

-- ========================================
-- SECTION 8: DIRECT SELECT TEST
-- ========================================
SELECT '=== DIRECT SELECT TEST ===' as section;

SELECT 
    id, 
    email, 
    role, 
    tenant_id,
    is_active,
    is_deleted
FROM users_profiles 
WHERE email = 'jcpenalo@gmail.com';

-- ========================================
-- SECTION 9: TABLE TYPE CHECK
-- ========================================
SELECT '=== TABLE TYPE ===' as section;

SELECT 
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'users_profiles';

-- ============================================
-- END OF DIAGNOSTIC
-- Share ALL results with me
-- ============================================
