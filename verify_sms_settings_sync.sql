-- SMS Settings Sync Verification Report
-- Run this in Supabase SQL Editor to check sync status

-- ============================================================================
-- 1. SYNC STATUS CHECK
-- ============================================================================
-- This query shows any users where sms_consent_given and sms_enabled don't match
-- EXPECTED: 0 rows (all should be in sync)

SELECT 
  p.id,
  p.email,
  p.full_name,
  p.role,
  p.sms_phone,
  p.sms_consent_given AS profile_consent,
  p.sms_consent_given_at,
  s.sms_enabled AS settings_enabled,
  s.updated_at AS settings_updated_at,
  CASE 
    WHEN p.sms_consent_given != s.sms_enabled THEN '❌ MISMATCH'
    WHEN p.sms_consent_given IS NULL OR s.sms_enabled IS NULL THEN '⚠️ NULL VALUE'
    ELSE '✅ IN SYNC'
  END AS sync_status
FROM profiles p
LEFT JOIN user_sms_notification_settings s ON p.id = s.user_id
WHERE s.user_id IS NOT NULL -- Only show users with SMS settings
ORDER BY 
  CASE 
    WHEN p.sms_consent_given != s.sms_enabled THEN 1
    WHEN p.sms_consent_given IS NULL OR s.sms_enabled IS NULL THEN 2
    ELSE 3
  END,
  p.email;

-- ============================================================================
-- 2. SMS-ELIGIBLE USERS OVERVIEW
-- ============================================================================
-- Shows all users who have SMS settings, grouped by consent status

SELECT 
  CASE 
    WHEN p.sms_consent_given AND s.sms_enabled THEN '✅ Fully Enabled'
    WHEN NOT p.sms_consent_given AND NOT s.sms_enabled THEN '❌ Disabled'
    WHEN p.sms_consent_given != s.sms_enabled THEN '⚠️ SYNC ISSUE'
    ELSE '❓ Unknown'
  END AS status,
  COUNT(*) AS user_count,
  COUNT(CASE WHEN p.sms_phone IS NOT NULL THEN 1 END) AS with_phone,
  COUNT(CASE WHEN p.sms_phone IS NULL THEN 1 END) AS missing_phone
FROM profiles p
INNER JOIN user_sms_notification_settings s ON p.id = s.user_id
WHERE p.role IN ('admin', 'is_super_admin', 'jg_management', 'subcontractor')
GROUP BY 
  CASE 
    WHEN p.sms_consent_given AND s.sms_enabled THEN '✅ Fully Enabled'
    WHEN NOT p.sms_consent_given AND NOT s.sms_enabled THEN '❌ Disabled'
    WHEN p.sms_consent_given != s.sms_enabled THEN '⚠️ SYNC ISSUE'
    ELSE '❓ Unknown'
  END
ORDER BY 
  CASE 
    WHEN status LIKE '%SYNC ISSUE%' THEN 1
    WHEN status LIKE '%Fully Enabled%' THEN 2
    WHEN status LIKE '%Disabled%' THEN 3
    ELSE 4
  END;

-- ============================================================================
-- 3. DETAILED USER SETTINGS
-- ============================================================================
-- Shows complete SMS configuration for each user with role-based eligibility

SELECT 
  p.email,
  p.full_name,
  p.role,
  p.sms_phone,
  p.sms_consent_given,
  FORMAT('%s', p.sms_consent_given_at) AS consent_given_at,
  s.sms_enabled,
  s.notify_chat_received,
  s.notify_job_assigned,
  s.notify_charges_approved,
  s.notify_work_order_submitted,
  s.notify_job_accepted,
  FORMAT('%s', s.updated_at) AS settings_updated_at,
  -- Readiness check
  CASE 
    WHEN p.sms_phone IS NULL THEN '⚠️ Missing phone'
    WHEN NOT p.sms_consent_given THEN '⚠️ No consent'
    WHEN NOT s.sms_enabled THEN '⚠️ SMS disabled'
    ELSE '✅ Ready to receive SMS'
  END AS readiness_status
FROM profiles p
INNER JOIN user_sms_notification_settings s ON p.id = s.user_id
WHERE p.role IN ('admin', 'is_super_admin', 'jg_management', 'subcontractor')
ORDER BY 
  CASE p.role
    WHEN 'is_super_admin' THEN 1
    WHEN 'admin' THEN 2
    WHEN 'jg_management' THEN 3
    WHEN 'subcontractor' THEN 4
    ELSE 5
  END,
  p.email;

-- ============================================================================
-- 4. USERS MISSING SMS SETTINGS
-- ============================================================================
-- Shows SMS-eligible users who don't have a settings row
-- EXPECTED: 0 rows (auto-seed trigger should create for all new users)

SELECT 
  p.id,
  p.email,
  p.full_name,
  p.role,
  p.created_at,
  '❌ Missing SMS settings row' AS issue
FROM profiles p
LEFT JOIN user_sms_notification_settings s ON p.id = s.user_id
WHERE p.role IN ('admin', 'is_super_admin', 'jg_management', 'subcontractor')
  AND s.user_id IS NULL
ORDER BY p.created_at DESC;

-- ============================================================================
-- 5. RECENT SMS SETTING CHANGES
-- ============================================================================
-- Shows the 20 most recent SMS setting updates

SELECT 
  p.email,
  p.full_name,
  s.sms_enabled,
  p.sms_consent_given,
  s.updated_at,
  EXTRACT(EPOCH FROM (NOW() - s.updated_at))/60 AS minutes_ago
FROM user_sms_notification_settings s
INNER JOIN profiles p ON s.user_id = p.id
ORDER BY s.updated_at DESC
LIMIT 20;

-- ============================================================================
-- 6. CONSENT GIVEN WITHOUT PHONE NUMBER
-- ============================================================================
-- Shows users who consented to SMS but haven't set a phone number

SELECT 
  p.email,
  p.full_name,
  p.sms_consent_given,
  p.sms_consent_given_at,
  s.sms_enabled,
  '⚠️ Consent given but no phone number' AS warning
FROM profiles p
INNER JOIN user_sms_notification_settings s ON p.id = s.user_id
WHERE p.sms_consent_given = true
  AND (p.sms_phone IS NULL OR p.sms_phone = '')
ORDER BY p.sms_consent_given_at DESC;

-- ============================================================================
-- 7. AUTO-FIX SYNC MISMATCHES
-- ============================================================================
-- UNCOMMENT AND RUN ONLY IF MISMATCHES FOUND IN QUERY #1
-- This will sync profiles.sms_consent_given to match user_sms_notification_settings.sms_enabled

/*
UPDATE profiles p
SET 
  sms_consent_given = s.sms_enabled,
  sms_consent_given_at = CASE 
    WHEN s.sms_enabled THEN COALESCE(p.sms_consent_given_at, NOW())
    ELSE NULL
  END,
  updated_at = NOW()
FROM user_sms_notification_settings s
WHERE p.id = s.user_id
  AND p.sms_consent_given != s.sms_enabled;

-- After running the fix, check how many rows were updated
SELECT 
  COUNT(*) AS rows_fixed,
  'SMS consent synced to match settings table' AS action
FROM profiles p
INNER JOIN user_sms_notification_settings s ON p.id = s.user_id
WHERE p.sms_consent_given = s.sms_enabled;
*/

-- ============================================================================
-- 8. NOTIFICATION EVENT ELIGIBILITY BY ROLE
-- ============================================================================
-- Shows which notification types each role should have access to

WITH role_eligibility AS (
  SELECT 
    'is_super_admin' AS role,
    true AS chat, true AS job_assigned, true AS charges_approved,
    true AS work_order, true AS job_accepted
  UNION ALL
  SELECT 'admin', true, true, true, true, true
  UNION ALL
  SELECT 'jg_management', true, true, true, true, true
  UNION ALL
  SELECT 'subcontractor', true, true, true, false, false
)
SELECT 
  role,
  CASE WHEN chat THEN '✅' ELSE '—' END AS chat_received,
  CASE WHEN job_assigned THEN '✅' ELSE '—' END AS job_assigned,
  CASE WHEN charges_approved THEN '✅' ELSE '—' END AS charges_approved,
  CASE WHEN work_order THEN '✅' ELSE '—' END AS work_order_submitted,
  CASE WHEN job_accepted THEN '✅' ELSE '—' END AS job_accepted
FROM role_eligibility
ORDER BY 
  CASE role
    WHEN 'is_super_admin' THEN 1
    WHEN 'admin' THEN 2
    WHEN 'jg_management' THEN 3
    WHEN 'subcontractor' THEN 4
    ELSE 5
  END;

-- ============================================================================
-- END OF REPORT
-- ============================================================================

-- Summary of what to look for:
--
-- ✅ Query #1 returns 0 rows (no sync mismatches)
-- ✅ Query #2 shows most users are "Fully Enabled" or "Disabled" (not sync issues)
-- ✅ Query #3 shows all users have correct notification flags for their role
-- ✅ Query #4 returns 0 rows (all eligible users have settings rows)
-- ✅ Query #6 shows few/no users with consent but missing phone
--
-- If you see issues, run query #7 (auto-fix) or investigate individual cases
