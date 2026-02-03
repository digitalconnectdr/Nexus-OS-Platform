-- ============================================
-- MIGRATION: Nuclear Option - Find Hidden Execution
-- Purpose: Find EVERYTHING that could be executing on connection
-- Date: 2026-01-20 (HOTFIX v3 - NUCLEAR)
-- ============================================

-- STEP 1: Check for ALTER DATABASE settings that run on connect
SELECT datname, datacl, datconfig
FROM pg_database
WHERE datname = current_database();

-- STEP 2: Check for session_preload_libraries or other auto-load
SHOW session_preload_libraries;
SHOW shared_preload_libraries;

-- STEP 3: List ALL functions in public schema (to see what's left)
SELECT 
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as arguments,
    CASE 
        WHEN p.provolatile = 'i' THEN 'IMMUTABLE'
        WHEN p.provolatile = 's' THEN 'STABLE'
        WHEN p.provolatile = 'v' THEN 'VOLATILE'
    END as volatility,
    p.prosecdef as security_definer
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
ORDER BY p.proname;

-- STEP 4: Check for EVENT TRIGGERS (these run on DDL/DML)
SELECT evtname, evtevent, evtfoid::regproc, evtenabled
FROM pg_event_trigger;

-- STEP 5: NUCLEAR - Drop ALL remaining functions in public schema
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT p.oid::regprocedure as func_signature
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
    ) LOOP
        BEGIN
            EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE';
            RAISE NOTICE 'Dropped function: %', r.func_signature;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not drop: % (Error: %)', r.func_signature, SQLERRM;
        END;
    END LOOP;
END $$;

-- STEP 6: Test direct SELECT again
SELECT id, email, role FROM users_profiles WHERE email = 'jcpenalo@gmail.com';

-- ============================================
-- IMPORTANT: After running this, test if Python backend works
-- If it STILL fails, the problem is in asyncpg driver or connection string
-- ============================================
