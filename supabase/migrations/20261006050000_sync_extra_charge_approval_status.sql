-- Let authenticated office users read completed extra-charge decisions. The
-- original public policy intentionally exposes only active, unused links, so
-- it cannot serve the admin status UI after a decision is recorded.
ALTER TABLE public.approval_tokens
  ADD COLUMN IF NOT EXISTS invalidated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invalidation_reason TEXT;

DROP POLICY IF EXISTS "Internal users can read approval decisions"
ON public.approval_tokens;

CREATE POLICY "Internal users can read approval decisions"
ON public.approval_tokens
FOR SELECT
TO authenticated
USING (public.is_internal_admin_user());

-- JobDetails already subscribes to approval_tokens changes. Ensure the table
-- is actually part of the Supabase realtime publication, without failing or
-- duplicating membership when it is already configured.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'approval_tokens'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.approval_tokens;
  END IF;
END
$$;

-- Customer decisions are valid for as long as the request is the current,
-- unused request for a live job. expires_at remains available to the internal
-- pending-email workflow, but no longer closes the customer action window.
CREATE OR REPLACE FUNCTION public.process_approval_token(
  p_token VARCHAR(255),
  p_approver_name TEXT DEFAULT NULL,
  p_approver_email TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_data RECORD;
  v_job_work_order_num INTEGER;
  v_work_order_phase_id UUID;
  v_current_phase_id UUID;
  v_current_phase_label TEXT;
  v_system_user_id UUID;
  v_effective_approver_name TEXT;
  v_effective_approver_email TEXT;
BEGIN
  SELECT * INTO v_token_data
  FROM approval_tokens
  WHERE token = p_token
  FOR UPDATE;

  IF NOT FOUND OR v_token_data.approval_type <> 'extra_charges' THEN
    RETURN json_build_object('success', false, 'error', 'Invalid approval token');
  END IF;

  IF v_token_data.used_at IS NOT NULL OR v_token_data.decision IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'This approval request has already been completed');
  END IF;

  IF v_token_data.invalidated_at IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'This approval request is no longer active');
  END IF;

  IF EXISTS (
    SELECT 1 FROM approval_tokens newer
    WHERE newer.job_id = v_token_data.job_id
      AND newer.approval_type = v_token_data.approval_type
      AND newer.created_at > v_token_data.created_at
      AND newer.invalidated_at IS NULL
  ) THEN
    RETURN json_build_object('success', false, 'error', 'This approval request has been superseded');
  END IF;

  SELECT j.work_order_num, j.current_phase_id, jp.job_phase_label
  INTO v_job_work_order_num, v_current_phase_id, v_current_phase_label
  FROM jobs j
  LEFT JOIN job_phases jp ON jp.id = j.current_phase_id
  WHERE j.id = v_token_data.job_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'The associated job was deleted');
  END IF;

  IF v_current_phase_label = 'Cancelled' THEN
    RETURN json_build_object('success', false, 'error', 'The associated job was cancelled');
  END IF;

  IF v_current_phase_label <> 'Pending Work Order' THEN
    RETURN json_build_object('success', false, 'error', 'The associated job is no longer awaiting this approval');
  END IF;

  SELECT id INTO v_work_order_phase_id
  FROM job_phases
  WHERE job_phase_label = 'Work Order'
  LIMIT 1;

  IF v_work_order_phase_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Work Order phase not found');
  END IF;

  v_effective_approver_name := COALESCE(NULLIF(btrim(p_approver_name), ''), v_token_data.approver_name);
  v_effective_approver_email := COALESCE(NULLIF(btrim(p_approver_email), ''), v_token_data.approver_email);

  UPDATE approval_tokens
  SET used_at = NOW(), decision = 'approved', decision_at = NOW(),
      approver_name = v_effective_approver_name,
      approver_email = v_effective_approver_email
  WHERE id = v_token_data.id
    AND used_at IS NULL
    AND decision IS NULL;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'This approval request has already been completed');
  END IF;

  UPDATE jobs
  SET current_phase_id = v_work_order_phase_id, updated_at = NOW()
  WHERE id = v_token_data.job_id;

  SELECT id INTO v_system_user_id
  FROM profiles
  WHERE role IN ('is_super_admin', 'admin', 'jg_management')
  ORDER BY CASE role WHEN 'is_super_admin' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END,
           created_at ASC
  LIMIT 1;

  IF v_system_user_id IS NULL THEN
    SELECT id INTO v_system_user_id FROM profiles ORDER BY created_at ASC LIMIT 1;
  END IF;

  INSERT INTO job_phase_changes (
    job_id, changed_by, from_phase_id, to_phase_id, change_reason
  ) VALUES (
    v_token_data.job_id, v_system_user_id, v_current_phase_id,
    v_work_order_phase_id,
    format('Extra charges approved by %s',
      COALESCE(v_effective_approver_name, v_effective_approver_email, 'approval recipient'))
  );

  RETURN json_build_object(
    'success', true, 'message', 'Approval processed successfully',
    'job_id', v_token_data.job_id, 'work_order_num', v_job_work_order_num,
    'decision', 'approved', 'approver_name', v_effective_approver_name,
    'approver_email', v_effective_approver_email
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', format('Database error: %s', SQLERRM));
END;
$$;

CREATE OR REPLACE FUNCTION public.process_decline_token(
  p_token VARCHAR(255),
  p_decline_reason TEXT DEFAULT NULL,
  p_approver_name TEXT DEFAULT NULL,
  p_approver_email TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_data RECORD;
  v_job_work_order_num INTEGER;
  v_current_phase_id UUID;
  v_current_phase_label TEXT;
  v_system_user_id UUID;
  v_effective_approver_name TEXT;
  v_effective_approver_email TEXT;
BEGIN
  SELECT * INTO v_token_data
  FROM approval_tokens
  WHERE token = p_token
  FOR UPDATE;

  IF NOT FOUND OR v_token_data.approval_type <> 'extra_charges' THEN
    RETURN json_build_object('success', false, 'error', 'Invalid approval token');
  END IF;

  IF v_token_data.used_at IS NOT NULL OR v_token_data.decision IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'This approval request has already been completed');
  END IF;

  IF v_token_data.invalidated_at IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'This approval request is no longer active');
  END IF;

  IF EXISTS (
    SELECT 1 FROM approval_tokens newer
    WHERE newer.job_id = v_token_data.job_id
      AND newer.approval_type = v_token_data.approval_type
      AND newer.created_at > v_token_data.created_at
      AND newer.invalidated_at IS NULL
  ) THEN
    RETURN json_build_object('success', false, 'error', 'This approval request has been superseded');
  END IF;

  SELECT j.work_order_num, j.current_phase_id, jp.job_phase_label
  INTO v_job_work_order_num, v_current_phase_id, v_current_phase_label
  FROM jobs j
  LEFT JOIN job_phases jp ON jp.id = j.current_phase_id
  WHERE j.id = v_token_data.job_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'The associated job was deleted');
  END IF;

  IF v_current_phase_label = 'Cancelled' THEN
    RETURN json_build_object('success', false, 'error', 'The associated job was cancelled');
  END IF;

  IF v_current_phase_label <> 'Pending Work Order' THEN
    RETURN json_build_object('success', false, 'error', 'The associated job is no longer awaiting this approval');
  END IF;

  v_effective_approver_name := COALESCE(NULLIF(btrim(p_approver_name), ''), v_token_data.approver_name);
  v_effective_approver_email := COALESCE(NULLIF(btrim(p_approver_email), ''), v_token_data.approver_email);

  UPDATE approval_tokens
  SET used_at = NOW(), decision = 'declined', decision_at = NOW(),
      decline_reason = p_decline_reason,
      approver_name = v_effective_approver_name,
      approver_email = v_effective_approver_email
  WHERE id = v_token_data.id
    AND used_at IS NULL
    AND decision IS NULL;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'This approval request has already been completed');
  END IF;

  SELECT id INTO v_system_user_id
  FROM profiles
  WHERE role IN ('is_super_admin', 'admin', 'jg_management')
  ORDER BY CASE role WHEN 'is_super_admin' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END,
           created_at ASC
  LIMIT 1;

  IF v_system_user_id IS NULL THEN
    SELECT id INTO v_system_user_id FROM profiles ORDER BY created_at ASC LIMIT 1;
  END IF;

  INSERT INTO job_phase_changes (
    job_id, changed_by, from_phase_id, to_phase_id, change_reason
  ) VALUES (
    v_token_data.job_id, v_system_user_id, v_current_phase_id,
    v_current_phase_id,
    format('Extra charges declined by %s%s',
      COALESCE(v_effective_approver_name, v_effective_approver_email, 'approval recipient'),
      CASE WHEN NULLIF(btrim(p_decline_reason), '') IS NOT NULL
        THEN format('. Reason: %s', p_decline_reason) ELSE '' END)
  );

  RETURN json_build_object(
    'success', true, 'message', 'Extra charges declined successfully',
    'job_id', v_token_data.job_id, 'work_order_num', v_job_work_order_num,
    'decision', 'declined', 'approver_name', v_effective_approver_name,
    'approver_email', v_effective_approver_email
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', format('Database error: %s', SQLERRM));
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_approval_token(VARCHAR, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_decline_token(VARCHAR, TEXT, TEXT, TEXT) TO anon, authenticated;

-- A token is created before email submission because the link must be embedded
-- in the message. Preserve but invalidate a just-created, unused request when
-- the customer copy was not accepted, so it cannot supersede a valid link.
CREATE OR REPLACE FUNCTION public.invalidate_unsent_approval_token(p_token_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invalidated_id UUID;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_internal_admin_user() THEN
    RETURN false;
  END IF;

  UPDATE approval_tokens
  SET invalidated_at = NOW(),
      invalidation_reason = 'customer_email_not_accepted'
  WHERE id = p_token_id
    AND approval_type = 'extra_charges'
    AND used_at IS NULL
    AND decision IS NULL
    AND created_at > NOW() - INTERVAL '1 hour'
    AND invalidated_at IS NULL
  RETURNING id INTO v_invalidated_id;

  RETURN v_invalidated_id IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.invalidate_unsent_approval_token(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.invalidate_unsent_approval_token(UUID) TO authenticated;
