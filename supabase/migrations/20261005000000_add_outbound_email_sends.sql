-- Additive outbound-email audit ledger.
-- This migration does not alter or delete existing email_logs, activity_log,
-- assignment notifications, jobs, contacts, templates, or approval tokens.

CREATE TABLE IF NOT EXISTS public.outbound_email_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('zoho', 'mailgun')),
  provider_message_id text,
  email_type text NOT NULL DEFAULT 'general',
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  to_emails text[] NOT NULL DEFAULT '{}',
  cc_emails text[] NOT NULL DEFAULT '{}',
  bcc_emails text[] NOT NULL DEFAULT '{}',
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'sending'
    CHECK (status IN (
      'sending', 'submitted', 'partially_accepted', 'rejected', 'failed',
      'delivered', 'deferred', 'bounced', 'complained'
    )),
  accepted_recipients text[] NOT NULL DEFAULT '{}',
  rejected_recipients text[] NOT NULL DEFAULT '{}',
  pending_recipients text[] NOT NULL DEFAULT '{}',
  attachment_count integer NOT NULL DEFAULT 0 CHECK (attachment_count >= 0),
  attachment_bytes bigint NOT NULL DEFAULT 0 CHECK (attachment_bytes >= 0),
  smtp_response text,
  attempt_count integer NOT NULL DEFAULT 1 CHECK (attempt_count >= 1),
  last_error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  queued_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outbound_email_sends_created_at
  ON public.outbound_email_sends (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_outbound_email_sends_status
  ON public.outbound_email_sends (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_outbound_email_sends_provider_message_id
  ON public.outbound_email_sends (provider_message_id)
  WHERE provider_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_outbound_email_sends_job_id
  ON public.outbound_email_sends (job_id, created_at DESC)
  WHERE job_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.outbound_email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outbound_email_send_id uuid REFERENCES public.outbound_email_sends(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('mailgun')),
  provider_event_id text NOT NULL,
  provider_message_id text,
  event_type text NOT NULL,
  severity text,
  recipient_email text,
  reason text,
  event_at timestamptz NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS idx_outbound_email_events_send_id
  ON public.outbound_email_events (outbound_email_send_id, event_at DESC);

CREATE INDEX IF NOT EXISTS idx_outbound_email_events_message_id
  ON public.outbound_email_events (provider_message_id, event_at DESC)
  WHERE provider_message_id IS NOT NULL;

ALTER TABLE public.outbound_email_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbound_email_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Internal users can read outbound email sends"
  ON public.outbound_email_sends;
CREATE POLICY "Internal users can read outbound email sends"
  ON public.outbound_email_sends
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role <> 'subcontractor'
    )
  );

DROP POLICY IF EXISTS "Internal users can read outbound email events"
  ON public.outbound_email_events;
CREATE POLICY "Internal users can read outbound email events"
  ON public.outbound_email_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role <> 'subcontractor'
    )
  );

GRANT SELECT ON public.outbound_email_sends TO authenticated;
GRANT SELECT ON public.outbound_email_events TO authenticated;

COMMENT ON TABLE public.outbound_email_sends IS
  'Provider submission and delivery-status ledger for application-generated outbound email.';

COMMENT ON COLUMN public.outbound_email_sends.status IS
  'submitted means accepted by the SMTP provider, not necessarily delivered to the recipient mailbox.';

COMMENT ON TABLE public.outbound_email_events IS
  'Signed Mailgun delivery, deferral, bounce, and complaint events for each outbound message recipient.';
