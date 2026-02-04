-- Enable RLS on role_permissions if not already enabled
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- POLICY: Allow Super Admins full access to role_permissions
-- This uses the app_metadata or user_metadata from the JWT
-- Assuming 'role' is stored in app_metadata or top level of JWT claim that Supabase exposes via auth.jwt()

CREATE POLICY "Super Admins can do everything on role_permissions"
ON role_permissions
FOR ALL
USING (
  auth.jwt() ->> 'role' = 'service_role' 
  OR 
  (auth.jwt() -> 'app_metadata' ->> 'role' = 'Super Admin')
  OR
  (auth.jwt() -> 'user_metadata' ->> 'role' = 'Super Admin')
)
WITH CHECK (
  auth.jwt() ->> 'role' = 'service_role' 
  OR 
  (auth.jwt() -> 'app_metadata' ->> 'role' = 'Super Admin')
  OR
  (auth.jwt() -> 'user_metadata' ->> 'role' = 'Super Admin')
);

-- Ensure Service Role always bypasses (redundant usually, but safe)
GRANT ALL ON role_permissions TO service_role;
