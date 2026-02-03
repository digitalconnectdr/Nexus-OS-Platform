-- Find ALL functions that still exist and could be causing the error
SELECT 
    p.proname as function_name,
    pg_get_functiondef(p.oid) as full_code
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
ORDER BY p.proname;
