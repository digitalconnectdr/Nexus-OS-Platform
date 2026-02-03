-- DIAGNOSTIC STEP 1: Test básico
SELECT '=== TEST 1: Database Info ===' as test;
SELECT current_database(), current_user;

-- DIAGNOSTIC STEP 2: Event Triggers
SELECT '=== TEST 2: Event Triggers ===' as test;
SELECT evtname, evtevent FROM pg_event_trigger;

-- DIAGNOSTIC STEP 3: Functions
SELECT '=== TEST 3: Functions ===' as test;
SELECT p.proname 
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public';

-- DIAGNOSTIC STEP 4: RLS Status
SELECT '=== TEST 4: RLS Status ===' as test;
SELECT c.relname, c.relrowsecurity
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public' AND c.relname = 'users_profiles';

-- DIAGNOSTIC STEP 5: Direct SELECT
SELECT '=== TEST 5: Direct SELECT ===' as test;
SELECT id, email, role FROM users_profiles WHERE email = 'jcpenalo@gmail.com';
