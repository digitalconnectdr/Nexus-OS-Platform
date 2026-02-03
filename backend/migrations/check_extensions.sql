-- Check for Supabase extensions that might be intercepting queries
SELECT 
    extname as extension_name,
    extversion as version,
    extrelocatable as relocatable
FROM pg_extension
WHERE extname NOT IN ('plpgsql')  -- Exclude default extension
ORDER BY extname;
