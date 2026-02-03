-- Check for Supabase Auth Hooks (these run on every auth operation)
SELECT 
    id,
    hook_table_id,
    hook_name,
    created_at
FROM supabase_functions.hooks
WHERE hook_table_id IN (
    SELECT id FROM supabase_functions.hook_tables 
    WHERE table_name IN ('auth.users', 'public.users_profiles')
);

-- Alternative: Check pg_catalog for any hooks
SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname IN ('auth', 'supabase_functions')
  AND pg_get_functiondef(p.oid) ILIKE '%tenant%'
ORDER BY n.nspname, p.proname;
