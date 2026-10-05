-- OUTBOUND EMAIL STATUS REPORT
-- Read-only: this script does not create, update, or delete anything.
--
-- IMPORTANT LIMITATION
-- Supabase Edge Function console logs are not stored in PostgreSQL and cannot
-- be queried with SQL. This report combines the outbound-email evidence that
-- the application currently persists in:
--   1. job_assignment_notifications (new assignment workflow)
--   2. email_logs                  (legacy/general email audit records)
--   3. activity_log               (property notification/approval events)
--
-- A "submitted_unverified" status means the application recorded the send
-- after the SMTP edge function returned successfully. It does NOT prove inbox
-- delivery. Only a provider delivery event/webhook can prove delivery.

WITH parameters AS (
  SELECT
    now() - interval '30 days' AS starting_at,
    1000::integer AS maximum_rows
),

provider_sends AS (
  SELECT
    s.queued_at,
    s.submitted_at,
    s.updated_at AS last_updated_at,
    'outbound_email_sends'::text AS source,
    s.email_type,
    s.status,
    CASE s.status
      WHEN 'sending' THEN 'Submission in progress'
      WHEN 'submitted' THEN 'Accepted by provider; final delivery pending'
      WHEN 'partially_accepted' THEN 'Provider accepted some recipients and rejected others'
      WHEN 'delivered' THEN 'Provider reports delivery to every recipient server'
      WHEN 'deferred' THEN 'Recipient server temporarily deferred delivery'
      WHEN 'bounced' THEN 'Recipient server permanently rejected delivery'
      WHEN 'complained' THEN 'Recipient reported the message as spam'
      WHEN 'failed' THEN 'Application or SMTP submission failed'
      ELSE s.status
    END AS status_detail,
    array_to_string(s.to_emails, ', ') AS recipient_email,
    array_to_string(s.cc_emails, ', ') AS cc_emails,
    array_to_string(s.bcc_emails, ', ') AS bcc_emails,
    s.subject,
    s.provider_message_id,
    s.last_error,
    s.attempt_count,
    s.job_id,
    j.work_order_num,
    p.property_name,
    s.id AS source_record_id
  FROM public.outbound_email_sends s
  LEFT JOIN public.jobs j ON j.id = s.job_id
  LEFT JOIN public.properties p ON p.id = j.property_id
  CROSS JOIN parameters x
  WHERE s.created_at >= x.starting_at
),

assignment_sends AS (
  SELECT
    n.created_at AS queued_at,
    n.sent_at AS submitted_at,
    n.updated_at AS last_updated_at,
    'assignment_notification'::text AS source,
    'subcontractor_assignment'::text AS email_type,
    n.status::text AS status,
    CASE n.status
      WHEN 'pending' THEN 'Queued but not sent'
      WHEN 'processing' THEN 'Send attempt in progress'
      WHEN 'sent' THEN 'Accepted by SMTP; final delivery unverified'
      WHEN 'failed' THEN 'Send attempt failed'
      WHEN 'cancelled' THEN 'Cancelled before sending'
      ELSE n.status
    END AS status_detail,
    n.recipient_email,
    NULL::text AS cc_emails,
    NULL::text AS bcc_emails,
    'New Job Assignment - Please Accept or Decline'::text AS subject,
    n.provider_message_id,
    n.last_error,
    n.attempt_count,
    n.job_id,
    j.work_order_num,
    p.property_name,
    n.id AS source_record_id
  FROM public.job_assignment_notifications n
  LEFT JOIN public.jobs j ON j.id = n.job_id
  LEFT JOIN public.properties p ON p.id = j.property_id
  CROSS JOIN parameters x
  WHERE n.created_at >= x.starting_at
),

email_log_sends AS (
  SELECT
    COALESCE(
      NULLIF(to_jsonb(e)->>'created_at', '')::timestamptz,
      NULLIF(to_jsonb(e)->>'sent_at', '')::timestamptz
    ) AS queued_at,
    COALESCE(
      NULLIF(to_jsonb(e)->>'sent_at', '')::timestamptz,
      NULLIF(to_jsonb(e)->>'created_at', '')::timestamptz
    ) AS submitted_at,
    COALESCE(
      NULLIF(to_jsonb(e)->>'sent_at', '')::timestamptz,
      NULLIF(to_jsonb(e)->>'created_at', '')::timestamptz
    ) AS last_updated_at,
    'email_logs'::text AS source,
    COALESCE(
      NULLIF(to_jsonb(e)->>'notification_type', ''),
      NULLIF(to_jsonb(e)->>'template_type', ''),
      'general_email'
    ) AS email_type,
    'submitted_unverified'::text AS status,
    'Application recorded send after SMTP call; final delivery unverified'::text AS status_detail,
    to_jsonb(e)->>'recipient_email' AS recipient_email,
    to_jsonb(e)->>'cc_emails' AS cc_emails,
    to_jsonb(e)->>'bcc_emails' AS bcc_emails,
    to_jsonb(e)->>'subject' AS subject,
    to_jsonb(e)->>'provider_message_id' AS provider_message_id,
    to_jsonb(e)->>'last_error' AS last_error,
    COALESCE(NULLIF(to_jsonb(e)->>'attempt_count', '')::integer, 1) AS attempt_count,
    NULLIF(to_jsonb(e)->>'job_id', '')::uuid AS job_id,
    j.work_order_num,
    p.property_name,
    e.id AS source_record_id
  FROM public.email_logs e
  LEFT JOIN public.jobs j
    ON j.id = NULLIF(to_jsonb(e)->>'job_id', '')::uuid
  LEFT JOIN public.properties p ON p.id = j.property_id
  CROSS JOIN parameters x
  WHERE COALESCE(
    NULLIF(to_jsonb(e)->>'sent_at', '')::timestamptz,
    NULLIF(to_jsonb(e)->>'created_at', '')::timestamptz
  ) >= x.starting_at
),

activity_email_sends AS (
  SELECT
    a.created_at AS queued_at,
    a.created_at AS submitted_at,
    a.created_at AS last_updated_at,
    'activity_log'::text AS source,
    COALESCE(a.metadata->>'notification_type', a.metadata->>'event_type', 'property_email') AS email_type,
    'submitted_unverified'::text AS status,
    'Property/approval activity recorded after SMTP call; final delivery unverified'::text AS status_detail,
    a.metadata->>'recipient_email' AS recipient_email,
    a.metadata->>'cc_emails' AS cc_emails,
    a.metadata->>'bcc_emails' AS bcc_emails,
    a.metadata->>'subject' AS subject,
    a.metadata->>'provider_message_id' AS provider_message_id,
    a.metadata->>'last_error' AS last_error,
    1::integer AS attempt_count,
    CASE
      WHEN COALESCE(a.metadata->>'job_id', a.entity_id::text) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN COALESCE(a.metadata->>'job_id', a.entity_id::text)::uuid
      ELSE NULL
    END AS job_id,
    j.work_order_num,
    p.property_name,
    a.id AS source_record_id
  FROM public.activity_log a
  LEFT JOIN public.jobs j ON j.id = CASE
    WHEN COALESCE(a.metadata->>'job_id', a.entity_id::text) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    THEN COALESCE(a.metadata->>'job_id', a.entity_id::text)::uuid
    ELSE NULL
  END
  LEFT JOIN public.properties p ON p.id = j.property_id
  CROSS JOIN parameters x
  WHERE a.created_at >= x.starting_at
    AND COALESCE(a.metadata->>'event_type', '') LIKE '%\_email\_sent' ESCAPE '\'
    -- Avoid duplicating records already present in email_logs.
    AND NOT EXISTS (
      SELECT 1
      FROM public.email_logs e
      WHERE NULLIF(to_jsonb(e)->>'job_id', '')::uuid = j.id
        AND ABS(EXTRACT(EPOCH FROM (
          COALESCE(
            NULLIF(to_jsonb(e)->>'sent_at', '')::timestamptz,
            NULLIF(to_jsonb(e)->>'created_at', '')::timestamptz
          ) - a.created_at
        ))) <= 10
    )
),

all_outbound_email AS (
  SELECT * FROM provider_sends
  UNION ALL
  SELECT * FROM assignment_sends a
  WHERE NOT EXISTS (
    SELECT 1 FROM provider_sends p
    WHERE p.provider_message_id = a.provider_message_id
      AND p.provider_message_id IS NOT NULL
  )
  UNION ALL
  SELECT * FROM email_log_sends e
  WHERE NOT EXISTS (
    SELECT 1 FROM provider_sends p
    WHERE p.job_id = e.job_id
      AND p.subject = e.subject
      AND ABS(EXTRACT(EPOCH FROM (p.queued_at - e.queued_at))) <= 10
  )
  UNION ALL
  SELECT * FROM activity_email_sends
)

SELECT
  queued_at,
  submitted_at,
  last_updated_at,
  source,
  email_type,
  status,
  status_detail,
  recipient_email,
  cc_emails,
  bcc_emails,
  subject,
  provider_message_id,
  last_error,
  attempt_count,
  job_id,
  work_order_num,
  property_name,
  source_record_id
FROM all_outbound_email
ORDER BY COALESCE(submitted_at, queued_at) DESC
LIMIT (SELECT maximum_rows FROM parameters);

-- Useful changes:
--   * Change interval '30 days' near the top to interval '24 hours',
--     interval '7 days', etc.
--   * Add this before ORDER BY to inspect one recipient:
--       WHERE lower(recipient_email) = lower('recipient@example.com')
--   * Add this before ORDER BY to see only problems/not-yet-sent rows:
--       WHERE status IN ('pending', 'processing', 'failed')
