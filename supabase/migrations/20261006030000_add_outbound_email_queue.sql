-- Durable, recipient-isolated outbound email queue.
-- Additive only: existing email audit/event data and direct sending remain intact.

ALTER TABLE public.outbound_email_sends
  DROP CONSTRAINT IF EXISTS outbound_email_sends_status_check;

ALTER TABLE public.outbound_email_sends
  ADD CONSTRAINT outbound_email_sends_status_check CHECK (status IN (
    'queued', 'processing', 'retrying', 'sending', 'submitted',
    'partially_accepted', 'rejected', 'failed', 'delivered',
    'deferred', 'bounced', 'complained'
  ));

CREATE TABLE IF NOT EXISTS public.outbound_email_queue_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.outbound_email_queue_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.outbound_email_queue_messages(id) ON DELETE CASCADE,
  audit_id uuid NOT NULL REFERENCES public.outbound_email_sends(id) ON DELETE CASCADE,
  recipient text NOT NULL,
  original_recipient_field text NOT NULL CHECK (original_recipient_field IN ('to', 'cc', 'bcc')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'retrying', 'submitted', 'failed')),
  available_at timestamptz NOT NULL DEFAULT now(),
  attempt_count integer NOT NULL DEFAULT 0,
  locked_at timestamptz,
  submitted_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outbound_email_queue_due
  ON public.outbound_email_queue_deliveries (status, available_at, created_at)
  WHERE status IN ('queued', 'retrying');

CREATE TABLE IF NOT EXISTS public.outbound_email_queue_throttle (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  next_send_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.outbound_email_queue_throttle (singleton, next_send_at)
VALUES (true, now())
ON CONFLICT (singleton) DO NOTHING;

ALTER TABLE public.outbound_email_queue_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbound_email_queue_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbound_email_queue_throttle ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.claim_outbound_email_delivery(p_spacing_seconds integer DEFAULT 2)
RETURNS TABLE (
  delivery_id uuid,
  queue_message_id uuid,
  audit_id uuid,
  recipient text,
  original_recipient_field text,
  payload jsonb,
  send_at timestamptz,
  attempt_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delivery public.outbound_email_queue_deliveries%ROWTYPE;
  v_next_send_at timestamptz;
  v_send_at timestamptz;
BEGIN
  -- Recover work abandoned by a terminated worker after five minutes.
  UPDATE public.outbound_email_queue_deliveries
  SET status = 'retrying',
      available_at = now(),
      locked_at = NULL,
      updated_at = now(),
      last_error = COALESCE(last_error, 'Recovered after worker interruption')
  WHERE status = 'processing'
    AND locked_at < now() - interval '5 minutes'
    AND attempt_count < 4;

  UPDATE public.outbound_email_queue_deliveries
  SET status = 'failed',
      locked_at = NULL,
      updated_at = now(),
      last_error = COALESCE(last_error, 'Queue worker stopped during the final delivery attempt')
  WHERE status = 'processing'
    AND locked_at < now() - interval '5 minutes'
    AND attempt_count >= 4;

  -- Only one worker may claim during each spacing window. Other concurrent
  -- invocations return immediately instead of reserving work far in advance.
  SELECT next_send_at INTO v_next_send_at
  FROM public.outbound_email_queue_throttle
  WHERE singleton = true
  FOR UPDATE;

  IF COALESCE(v_next_send_at, now()) > now() THEN
    RETURN;
  END IF;

  SELECT * INTO v_delivery
  FROM public.outbound_email_queue_deliveries
  WHERE status IN ('queued', 'retrying')
    AND available_at <= now()
    AND attempt_count < 4
  ORDER BY available_at, created_at
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_send_at := now();

  UPDATE public.outbound_email_queue_throttle
  SET next_send_at = v_send_at + make_interval(secs => GREATEST(1, LEAST(p_spacing_seconds, 10)))
  WHERE singleton = true;

  UPDATE public.outbound_email_queue_deliveries AS d
  SET status = 'processing',
      attempt_count = d.attempt_count + 1,
      locked_at = now(),
      updated_at = now()
  WHERE id = v_delivery.id
  RETURNING * INTO v_delivery;

  UPDATE public.outbound_email_sends
  SET status = 'processing', attempt_count = v_delivery.attempt_count, updated_at = now()
  WHERE id = v_delivery.audit_id;

  RETURN QUERY
  SELECT v_delivery.id, v_delivery.message_id, v_delivery.audit_id, v_delivery.recipient,
         v_delivery.original_recipient_field, m.payload, v_send_at,
         v_delivery.attempt_count
  FROM public.outbound_email_queue_messages m
  WHERE m.id = v_delivery.message_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_outbound_email_delivery(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_outbound_email_delivery(integer) TO service_role;

COMMENT ON TABLE public.outbound_email_queue_deliveries IS
  'Durable recipient-level queue for paced application email submission.';
