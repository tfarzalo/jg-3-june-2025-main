-- =====================================================
-- Step 4: Grant Permissions
-- =====================================================
-- Run this FOURTH (after create_assignment_indexes.sql)
-- Purpose: Grant necessary permissions for functions and tables

-- Grant execute permissions on functions to authenticated users (subcontractors)
GRANT EXECUTE ON FUNCTION calculate_assignment_deadline(TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION assign_job_to_subcontractor(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION accept_job_assignment(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION decline_job_assignment(UUID, UUID, TEXT) TO authenticated;

-- Grant execute permission on auto-decline function to service_role only (for cron job)
GRANT EXECUTE ON FUNCTION auto_decline_expired_assignments() TO service_role;

-- Ensure RLS policies allow reading assignment deadline fields
-- (Assuming jobs table already has RLS enabled and proper policies)

-- Verify permissions
SELECT 
  routine_name,
  string_agg(privilege_type, ', ') as privileges,
  grantee
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
AND routine_name LIKE '%assignment%'
GROUP BY routine_name, grantee
ORDER BY routine_name, grantee;

-- Success message
SELECT 'All permissions granted successfully! ✅ Database setup complete! Ready to deploy Edge Function and Frontend.' as status;
