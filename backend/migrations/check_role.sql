-- Check current role and session settings
SELECT 
    current_user as current_role,
    session_user as session_role,
    current_database() as database_name;

-- Check if there are any session-level settings
SHOW ALL;
