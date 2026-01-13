-- =====================================================
-- TEST APPROVAL SYSTEM AFTER FIX
-- =====================================================
-- This script tests the approval system with various scenarios
-- Run each section separately to test different cases
-- =====================================================

-- =====================================================
-- TEST 1: Check that Work Order phase exists
-- =====================================================
-- This phase is required for approvals to work
SELECT 
  id,
  job_phase_label,
  '✅ Work Order phase exists' as status
FROM job_phases 
WHERE job_phase_label = 'Work Order';

-- Expected: Should return 1 row with the Work Order phase
-- If empty: You need to create the Work Order phase


-- =====================================================
-- TEST 2: Check that system users exist
-- =====================================================
-- Function needs at least one user for changed_by field
SELECT 
  id,
  email,
  role,
  CASE 
    WHEN role IN ('admin', 'jg_management') THEN '✅ System user (preferred)'
    ELSE '⚠️ Regular user (fallback)'
  END as status
FROM profiles
ORDER BY 
  CASE 
    WHEN role IN ('admin', 'jg_management') THEN 1
    ELSE 2
  END,
  created_at ASC
LIMIT 5;

-- Expected: At least 1 user (preferably admin/management)
-- If empty: System will log a warning but approval will still succeed


-- =====================================================
-- TEST 3: Check recent approval tokens
-- =====================================================
-- View recent approval tokens and their status
SELECT 
  LEFT(token, 20) || '...' as token_preview,
  job_id,
  approver_email,
  approver_name,
  CASE 
    WHEN used_at IS NOT NULL THEN '✅ Used'
    WHEN expires_at < NOW() THEN '⏰ Expired'
    WHEN expires_at > NOW() THEN '🟢 Valid'
  END as status,
  created_at,
  expires_at,
  used_at
FROM approval_tokens
ORDER BY created_at DESC
LIMIT 10;

-- Expected: Shows your recent approval tokens
-- Valid tokens can be used for testing


-- =====================================================
-- TEST 4: Check system logs for any errors
-- =====================================================
-- This should be empty after fresh install
SELECT 
  level,
  message,
  context,
  created_at
FROM system_logs
ORDER BY created_at DESC
LIMIT 20;

-- Expected: Empty or only INFO level entries
-- If ERROR/CRITICAL: Review the error details


-- =====================================================
-- TEST 5: Test the function with invalid token (Safe Test)
-- =====================================================
-- This tests error handling without affecting real data
SELECT process_approval_token('invalid-test-token-12345');

-- Expected: Should return JSON with success=false and error message
-- Example: {"success": false, "error": "Invalid approval token"}


-- =====================================================
-- TEST 6: Create a test approval token (Optional)
-- =====================================================
-- Only run this if you want to create a test token
-- Replace the values with actual job_id and other details

/*
INSERT INTO approval_tokens (
  id,
  job_id,
  token,
  approval_type,
  extra_charges_data,
  approver_email,
  approver_name,
  expires_at,
  created_at
) VALUES (
  gen_random_uuid(),
  'YOUR-JOB-ID-HERE',  -- Replace with real job ID
  'test-token-' || gen_random_uuid()::text,
  'extra_charges',
  '{"items": [{"description": "Test charge", "cost": 100}], "total": 100}'::jsonb,
  'test@example.com',
  'Test User',
  NOW() + INTERVAL '30 minutes',
  NOW()
)
RETURNING 
  'Test token created!' as status,
  token,
  expires_at;
*/

-- To use the test token:
-- 1. Uncomment the INSERT above
-- 2. Replace YOUR-JOB-ID-HERE with a real job ID
-- 3. Run the INSERT
-- 4. Copy the token from the result
-- 5. Test with: SELECT process_approval_token('your-token-here');


-- =====================================================
-- TEST 7: Monitor approval processing
-- =====================================================
-- Run this query after processing an approval to verify
SELECT 
  j.work_order_num,
  j.unit_number,
  jp.job_phase_label as current_phase,
  at.approver_name,
  at.used_at,
  jpc.change_reason,
  jpc.changed_at,
  p.email as changed_by_user
FROM jobs j
LEFT JOIN job_phases jp ON jp.id = j.current_phase_id
LEFT JOIN approval_tokens at ON at.job_id = j.id
LEFT JOIN job_phase_changes jpc ON jpc.job_id = j.id
LEFT JOIN profiles p ON p.id = jpc.changed_by
WHERE at.used_at IS NOT NULL
  AND at.used_at > NOW() - INTERVAL '1 hour'
ORDER BY at.used_at DESC
LIMIT 5;

-- Expected: Shows recently approved jobs with phase changes
-- Verify: current_phase = 'Work Order'
-- Verify: changed_by_user exists (not null)


-- =====================================================
-- SUMMARY - Run this to get overall health check
-- =====================================================
SELECT 
  '🔍 APPROVAL SYSTEM HEALTH CHECK' as section,
  '' as detail
UNION ALL
SELECT 
  'Work Order Phase',
  CASE 
    WHEN EXISTS(SELECT 1 FROM job_phases WHERE job_phase_label = 'Work Order')
    THEN '✅ Exists'
    ELSE '❌ Missing - CREATE IT!'
  END
UNION ALL
SELECT 
  'System Users',
  CASE 
    WHEN EXISTS(SELECT 1 FROM profiles WHERE role IN ('admin', 'jg_management'))
    THEN '✅ Admin/Management found'
    WHEN EXISTS(SELECT 1 FROM profiles)
    THEN '⚠️ Only regular users (will work but not ideal)'
    ELSE '❌ No users found!'
  END
UNION ALL
SELECT 
  'Function Installed',
  CASE 
    WHEN EXISTS(SELECT 1 FROM information_schema.routines WHERE routine_name = 'process_approval_token')
    THEN '✅ Function exists'
    ELSE '❌ Function missing!'
  END
UNION ALL
SELECT 
  'Anonymous Access',
  CASE 
    WHEN has_function_privilege('anon', 'process_approval_token(varchar)', 'execute')
    THEN '✅ Granted (required for external users)'
    ELSE '❌ Not granted - external users cannot approve!'
  END
UNION ALL
SELECT 
  'System Logs Table',
  CASE 
    WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'system_logs')
    THEN '✅ Exists'
    ELSE '❌ Missing'
  END
UNION ALL
SELECT 
  'Recent Errors',
  CASE 
    WHEN EXISTS(SELECT 1 FROM system_logs WHERE level IN ('ERROR', 'CRITICAL'))
    THEN '⚠️ Errors found - check system_logs table'
    ELSE '✅ No errors'
  END
UNION ALL
SELECT 
  '========================================',
  'All items should show ✅';

-- =====================================================
-- If all checks pass, your approval system is ready! 🎉
-- =====================================================
