-- Check RLS Policies on users_profiles
SELECT 
    policyname,
    permissive,
    cmd as command,
    qual as using_clause,
    with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'users_profiles';

-- If no results, RLS is enabled but NO policies exist
-- This means: DENY ALL by default
