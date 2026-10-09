-- Resending an unresolved extra-charge approval email must retain its existing
-- URL. Completed decisions remain immutable so a later, genuinely new approval
-- cycle cannot erase the prior audit trail.

CREATE OR REPLACE FUNCTION public.create_or_refresh_approval_token(
  p_job_id uuid,
  p_approval_type text,
  p_approver_email text DEFAULT NULL,
  p_approver_name text DEFAULT NULL,
  p_extra_charges_data jsonb DEFAULT NULL,
  p_is_preview boolean DEFAULT false
)
RETURNS TABLE (id uuid, token text, expires_at timestamptz, reused boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record public.approval_tokens%ROWTYPE;
  v_type text := CASE WHEN p_is_preview THEN 'extra_charges_preview' ELSE p_approval_type END;
BEGIN
  IF NOT public.is_internal_admin_user() THEN
    RAISE EXCEPTION 'Not authorized to create approval requests';
  END IF;
  IF p_job_id IS NULL OR v_type NOT IN ('extra_charges', 'extra_charges_preview') THEN
    RAISE EXCEPTION 'Invalid approval request';
  END IF;

  -- Serialize sends for this job so two clicks cannot create two pending URLs.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_job_id::text || ':' || v_type, 0));

  IF NOT p_is_preview THEN
    SELECT * INTO v_record
    FROM public.approval_tokens a
    WHERE a.job_id = p_job_id
      AND a.approval_type = 'extra_charges'
      AND a.used_at IS NULL
      AND a.decision IS NULL
      AND a.invalidated_at IS NULL
    ORDER BY a.created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
      UPDATE public.approval_tokens a
      SET approver_email = COALESCE(NULLIF(btrim(p_approver_email), ''), a.approver_email),
          approver_name = COALESCE(NULLIF(btrim(p_approver_name), ''), a.approver_name),
          extra_charges_data = COALESCE(p_extra_charges_data, a.extra_charges_data),
          expires_at = NULL,
          sent_at = now(),
          status = 'pending'
      WHERE a.id = v_record.id
      RETURNING a.* INTO v_record;

      RETURN QUERY SELECT v_record.id, v_record.token::text, v_record.expires_at, true;
      RETURN;
    END IF;
  END IF;

  INSERT INTO public.approval_tokens (
    job_id, token, approval_type, approver_email, approver_name,
    expires_at, extra_charges_data, status, sent_at
  ) VALUES (
    p_job_id, gen_random_uuid()::text, v_type, p_approver_email, p_approver_name,
    CASE WHEN p_is_preview THEN now() + interval '10 minutes' ELSE NULL END,
    p_extra_charges_data, 'pending', CASE WHEN p_is_preview THEN NULL ELSE now() END
  ) RETURNING * INTO v_record;

  RETURN QUERY SELECT v_record.id, v_record.token::text, v_record.expires_at, false;
END;
$$;

REVOKE ALL ON FUNCTION public.create_or_refresh_approval_token(uuid, text, text, text, jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_or_refresh_approval_token(uuid, text, text, text, jsonb, boolean) TO authenticated;
