-- Universal, address-level recipient email verification.
-- Additive only: no existing email, recipient, notification, or auth data is changed.

CREATE TABLE public.recipient_email_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  normalized_email text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'unverified'
    CHECK (status IN ('unverified', 'verification_sent', 'verified', 'delivery_problem')),
  verification_sent_at timestamptz,
  verified_at timestamptz,
  last_attempt_at timestamptz,
  send_count integer NOT NULL DEFAULT 0 CHECK (send_count >= 0),
  last_outbound_email_send_id uuid REFERENCES public.outbound_email_sends(id) ON DELETE SET NULL,
  last_provider_message_id text,
  last_mailgun_event text,
  last_delivery_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (normalized_email = lower(btrim(email))),
  CHECK (normalized_email <> '')
);

CREATE TABLE public.recipient_email_verification_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_id uuid NOT NULL REFERENCES public.recipient_email_verifications(id) ON DELETE CASCADE,
  recipient_type text NOT NULL
    CHECK (recipient_type IN ('profile', 'property_contact', 'property_system_contact')),
  recipient_id uuid NOT NULL,
  recipient_key text,
  recipient_name text,
  email text NOT NULL,
  normalized_email text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  token_expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'prepared'
    CHECK (status IN ('prepared', 'sent', 'send_failed', 'verified', 'expired', 'delivery_problem')),
  initiated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  outbound_email_send_id uuid REFERENCES public.outbound_email_sends(id) ON DELETE SET NULL,
  provider_message_id text,
  sent_at timestamptz,
  verified_at timestamptz,
  last_mailgun_event text,
  delivery_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (normalized_email = lower(btrim(email))),
  CHECK (char_length(token_hash) = 64)
);

CREATE INDEX idx_recipient_email_verification_attempts_verification
  ON public.recipient_email_verification_attempts (verification_id, created_at DESC);
CREATE INDEX idx_recipient_email_verification_attempts_outbound
  ON public.recipient_email_verification_attempts (outbound_email_send_id)
  WHERE outbound_email_send_id IS NOT NULL;
CREATE INDEX idx_recipient_email_verification_attempts_expiry
  ON public.recipient_email_verification_attempts (token_expires_at)
  WHERE status IN ('prepared', 'sent');

ALTER TABLE public.recipient_email_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipient_email_verification_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal users can read recipient email verification status"
  ON public.recipient_email_verifications
  FOR SELECT TO authenticated
  USING (public.is_internal_admin_user());

CREATE POLICY "Internal users can read recipient email verification attempts"
  ON public.recipient_email_verification_attempts
  FOR SELECT TO authenticated
  USING (public.is_internal_admin_user());

GRANT SELECT ON public.recipient_email_verifications TO authenticated;
GRANT SELECT ON public.recipient_email_verification_attempts TO authenticated;

-- Serializes attempts for one address and enforces the cooldown in the database,
-- so duplicate browser requests cannot create duplicate messages.
CREATE OR REPLACE FUNCTION public.prepare_recipient_email_verification(
  p_email text,
  p_recipient_type text,
  p_recipient_id uuid,
  p_recipient_key text,
  p_recipient_name text,
  p_token_hash text,
  p_token_expires_at timestamptz,
  p_initiated_by uuid,
  p_cooldown_seconds integer DEFAULT 600
)
RETURNS TABLE (verification_id uuid, attempt_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := btrim(p_email);
  v_normalized text := lower(btrim(p_email));
  v_verification_id uuid;
  v_attempt_id uuid;
  v_last_attempt timestamptz;
BEGIN
  IF v_normalized = '' OR v_normalized !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'Invalid recipient email address';
  END IF;
  IF p_recipient_type NOT IN ('profile', 'property_contact', 'property_system_contact') THEN
    RAISE EXCEPTION 'Invalid recipient type';
  END IF;

  INSERT INTO public.recipient_email_verifications (email, normalized_email)
  VALUES (v_email, v_normalized)
  ON CONFLICT (normalized_email) DO UPDATE
    SET email = EXCLUDED.email, updated_at = now()
  RETURNING id INTO v_verification_id;

  PERFORM 1 FROM public.recipient_email_verifications
  WHERE id = v_verification_id FOR UPDATE;

  SELECT created_at INTO v_last_attempt
  FROM public.recipient_email_verification_attempts
  WHERE recipient_email_verification_attempts.verification_id = v_verification_id
    AND status IN ('prepared', 'sent')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_last_attempt IS NOT NULL
    AND v_last_attempt > now() - make_interval(secs => GREATEST(60, p_cooldown_seconds)) THEN
    RAISE EXCEPTION 'A verification email was sent recently. Please wait before sending another.';
  END IF;

  INSERT INTO public.recipient_email_verification_attempts (
    verification_id, recipient_type, recipient_id, recipient_key, recipient_name,
    email, normalized_email, token_hash, token_expires_at, initiated_by
  ) VALUES (
    v_verification_id, p_recipient_type, p_recipient_id, nullif(btrim(p_recipient_key), ''),
    nullif(btrim(p_recipient_name), ''), v_email, v_normalized, p_token_hash,
    p_token_expires_at, p_initiated_by
  ) RETURNING id INTO v_attempt_id;

  UPDATE public.recipient_email_verifications
  SET last_attempt_at = now(), send_count = send_count + 1, updated_at = now()
  WHERE id = v_verification_id;

  RETURN QUERY SELECT v_verification_id, v_attempt_id;
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_recipient_email_verification(text, text, uuid, text, text, text, timestamptz, uuid, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_recipient_email_verification(text, text, uuid, text, text, text, timestamptz, uuid, integer)
  TO service_role;

COMMENT ON TABLE public.recipient_email_verifications IS
  'Canonical address-level verification status; changing an entity email naturally selects a different record.';
COMMENT ON TABLE public.recipient_email_verification_attempts IS
  'Immutable send/token history tying each verification attempt to its authoritative recipient source.';
