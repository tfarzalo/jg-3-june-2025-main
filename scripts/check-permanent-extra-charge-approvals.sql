-- READ-ONLY preflight for permanent extra-charge approval links.
-- Safe to run in the Supabase SQL Editor. This script makes no changes.
--
-- Interpretation:
--   PASS   = required behavior is present
--   FAIL   = run/repair the related migration before relying on permanent links
--   INFO   = informational only (migration history can be absent after manual SQL)

WITH function_checks AS (
  SELECT
    p.proname,
    pg_get_functiondef(p.oid) AS definition
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'process_approval_token',
      'process_decline_token',
      'create_or_refresh_approval_token'
    )
), checks AS (
  SELECT
    10 AS sort_order,
    'expires_at permits NULL'::text AS check_name,
    CASE WHEN EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'approval_tokens'
        AND column_name = 'expires_at'
        AND is_nullable = 'YES'
    ) THEN 'PASS' ELSE 'FAIL' END AS status,
    'Required so external approval links can have no expiration.'::text AS details

  UNION ALL

  SELECT
    20,
    'Approval invalidation columns exist',
    CASE WHEN (
      SELECT count(*)
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'approval_tokens'
        AND column_name IN ('invalidated_at', 'invalidation_reason')
    ) = 2 THEN 'PASS' ELSE 'FAIL' END,
    'Required by the current approval and decline functions.'

  UNION ALL

  SELECT
    30,
    'Approve function ignores clock expiration',
    CASE WHEN EXISTS (
      SELECT 1 FROM function_checks
      WHERE proname = 'process_approval_token'
        AND definition ILIKE '%invalidated_at%'
        AND definition NOT SIMILAR TO '%expires_at[[:space:]]*(>|>=|<|<=)%'
        AND definition NOT ILIKE '%expires_at IS NOT NULL%'
    ) THEN 'PASS' ELSE 'FAIL' END,
    'The customer approval RPC must not reject an otherwise-current request based on expires_at.'

  UNION ALL

  SELECT
    40,
    'Decline function ignores clock expiration',
    CASE WHEN EXISTS (
      SELECT 1 FROM function_checks
      WHERE proname = 'process_decline_token'
        AND definition ILIKE '%invalidated_at%'
        AND definition NOT SIMILAR TO '%expires_at[[:space:]]*(>|>=|<|<=)%'
        AND definition NOT ILIKE '%expires_at IS NOT NULL%'
    ) THEN 'PASS' ELSE 'FAIL' END,
    'The customer decline RPC must not reject an otherwise-current request based on expires_at.'

  UNION ALL

  SELECT
    50,
    'Token creator makes customer links permanent',
    CASE WHEN EXISTS (
      SELECT 1 FROM function_checks
      WHERE proname = 'create_or_refresh_approval_token'
        AND definition ILIKE '%p_is_preview%10 minutes%else null%'
        AND definition ILIKE '%expires_at = NULL%'
    ) THEN 'PASS' ELSE 'FAIL' END,
    'Expected behavior: preview links expire after 10 minutes; real extra-charge links use NULL.'

  UNION ALL

  SELECT
    60,
    'Existing unresolved customer links are permanent',
    CASE WHEN NOT EXISTS (
      SELECT 1
      FROM public.approval_tokens
      WHERE approval_type = 'extra_charges'
        AND used_at IS NULL
        AND decision IS NULL
        AND expires_at IS NOT NULL
    ) THEN 'PASS' ELSE 'FAIL' END,
    format(
      '%s unresolved current extra-charge link(s) still have an expiration timestamp.',
      (
        SELECT count(*)
        FROM public.approval_tokens
        WHERE approval_type = 'extra_charges'
          AND used_at IS NULL
          AND decision IS NULL
          AND expires_at IS NOT NULL
      )
    )

  UNION ALL

  SELECT
    70,
    'Decision notification trigger exists',
    CASE WHEN EXISTS (
      SELECT 1
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'approval_tokens'
        AND t.tgname = 'approval_decision_admin_notifications'
        AND NOT t.tgisinternal
        AND t.tgenabled <> 'D'
    ) THEN 'PASS' ELSE 'FAIL' END,
    'Ancillary October 8 behavior: notify internal users when a decision is recorded.'

  UNION ALL

  SELECT
    80,
    'Broad anonymous approval-token policies removed',
    CASE WHEN NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'approval_tokens'
        AND policyname IN (
          'Anyone can read valid approval tokens',
          'Anyone can read active or completed approval tokens',
          'Anyone can update approval tokens to mark as used',
          'Anyone can complete active approval tokens'
        )
    ) THEN 'PASS' ELSE 'FAIL' END,
    'These obsolete public table policies are removed by the October 8 migration.'

  UNION ALL

  SELECT
    90,
    'approval_tokens is in realtime publication',
    CASE WHEN NOT EXISTS (
      SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) OR EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'approval_tokens'
    ) THEN 'PASS' ELSE 'FAIL' END,
    'Required for live admin status updates when Supabase Realtime is enabled.'

  UNION ALL

  SELECT
    100 + row_number() OVER (ORDER BY requested.version)::integer,
    'Migration history: ' || requested.version,
    CASE WHEN history.version IS NOT NULL THEN 'INFO: RECORDED' ELSE 'INFO: NOT RECORDED' END,
    CASE WHEN history.version IS NOT NULL
      THEN 'Present in supabase_migrations.schema_migrations.'
      ELSE 'Not recorded; actual checks above remain authoritative because SQL may have been applied manually.'
    END
  FROM (
    VALUES
      ('20261006050000'),
      ('20261008000000'),
      ('20261009000000')
  ) AS requested(version)
  LEFT JOIN supabase_migrations.schema_migrations history
    ON history.version = requested.version
)
SELECT check_name, status, details
FROM checks
ORDER BY sort_order;

-- Optional supporting detail: list any unresolved external approvals that
-- still carry an expiration. This is also read-only and returns zero rows when
-- the permanent-link data migration is fully in place.
SELECT
  id,
  job_id,
  created_at,
  expires_at,
  approver_email
FROM public.approval_tokens
WHERE approval_type = 'extra_charges'
  AND used_at IS NULL
  AND decision IS NULL
  AND expires_at IS NOT NULL
ORDER BY created_at DESC;
