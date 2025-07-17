-- Grant necessary permissions for auth schema
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT USAGE ON SCHEMA auth TO service_role;

-- Grant select permission on auth.users table
GRANT SELECT ON auth.users TO authenticated;
GRANT SELECT ON auth.users TO service_role; 