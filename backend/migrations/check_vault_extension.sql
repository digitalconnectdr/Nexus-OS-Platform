-- Check what supabase_vault extension does
-- Look for functions in the vault schema
SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname IN ('vault', 'pgsodium')
ORDER BY n.nspname, p.proname;

-- Check if there are any vault-related triggers
SELECT 
    t.tgname as trigger_name,
    c.relname as table_name,
    p.proname as function_name,
    pg_get_triggerdef(t.oid) as trigger_definition
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
JOIN pg_namespace pn ON p.pronamespace = pn.oid
WHERE pn.nspname IN ('vault', 'pgsodium')
  AND NOT t.tgisinternal;
