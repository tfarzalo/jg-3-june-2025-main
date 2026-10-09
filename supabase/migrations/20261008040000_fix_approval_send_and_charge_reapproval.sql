-- Repair the approval-send RPC/schema contract and ensure a customer-billing
-- change supersedes the approval for the previous amount.

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
          expires_at = NULL
      WHERE a.id = v_record.id
      RETURNING a.* INTO v_record;

      RETURN QUERY SELECT v_record.id, v_record.token::text, v_record.expires_at, true;
      RETURN;
    END IF;
  END IF;

  INSERT INTO public.approval_tokens (
    job_id, token, approval_type, approver_email, approver_name,
    expires_at, extra_charges_data
  ) VALUES (
    p_job_id, gen_random_uuid()::text, v_type, p_approver_email, p_approver_name,
    CASE WHEN p_is_preview THEN now() + interval '10 minutes' ELSE NULL END,
    p_extra_charges_data
  ) RETURNING * INTO v_record;

  RETURN QUERY SELECT v_record.id, v_record.token::text, v_record.expires_at, false;
END;
$$;

REVOKE ALL ON FUNCTION public.create_or_refresh_approval_token(uuid, text, text, text, jsonb, boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_or_refresh_approval_token(uuid, text, text, text, jsonb, boolean)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.extra_charge_customer_total(p_items jsonb)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(SUM(
    CASE
      WHEN item ? 'calculatedBillAmount' THEN COALESCE((item ->> 'calculatedBillAmount')::numeric, 0)
      ELSE COALESCE((item ->> 'quantity')::numeric, 0) * COALESCE((item ->> 'billRate')::numeric, 0)
    END
  ), 0)
  FROM jsonb_array_elements(
    CASE WHEN jsonb_typeof(p_items) = 'array' THEN p_items ELSE '[]'::jsonb END
  ) item;
$$;

CREATE OR REPLACE FUNCTION public.require_reapproval_after_extra_charge_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_total numeric;
  v_new_total numeric;
  v_invalidated integer;
  v_pending_phase_id uuid;
  v_current_phase_id uuid;
BEGIN
  v_old_total := public.extra_charge_customer_total(OLD.extra_charges_line_items);
  v_new_total := public.extra_charge_customer_total(NEW.extra_charges_line_items);
  IF v_old_total IS NOT DISTINCT FROM v_new_total THEN
    RETURN NEW;
  END IF;

  UPDATE public.approval_tokens
  SET invalidated_at = now(),
      invalidation_reason = 'extra_charge_amount_changed'
  WHERE job_id = NEW.job_id
    AND approval_type = 'extra_charges'
    AND invalidated_at IS NULL;
  GET DIAGNOSTICS v_invalidated = ROW_COUNT;

  -- No prior request means this is the initial approval cycle; the normal work
  -- order submission flow is responsible for selecting Pending Work Order.
  IF v_invalidated = 0 THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_pending_phase_id
  FROM public.job_phases
  WHERE job_phase_label = 'Pending Work Order'
  LIMIT 1;

  SELECT current_phase_id INTO v_current_phase_id
  FROM public.jobs
  WHERE id = NEW.job_id
  FOR UPDATE;

  IF v_pending_phase_id IS NULL THEN
    RAISE EXCEPTION 'Pending Work Order phase not found';
  END IF;

  IF v_current_phase_id IS DISTINCT FROM v_pending_phase_id THEN
    UPDATE public.jobs
    SET current_phase_id = v_pending_phase_id
    WHERE id = NEW.job_id;

    INSERT INTO public.job_phase_changes (
      job_id, from_phase_id, to_phase_id, changed_by, change_reason
    ) VALUES (
      NEW.job_id, v_current_phase_id, v_pending_phase_id, auth.uid(),
      format(
        'Approved extra charges changed from $%s to $%s - updated customer approval required',
        to_char(v_old_total, 'FM999999990.00'),
        to_char(v_new_total, 'FM999999990.00')
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS require_reapproval_after_extra_charge_change_trigger
  ON public.work_orders;
CREATE TRIGGER require_reapproval_after_extra_charge_change_trigger
  AFTER UPDATE OF extra_charges_line_items ON public.work_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.require_reapproval_after_extra_charge_change();

REVOKE ALL ON FUNCTION public.extra_charge_customer_total(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.require_reapproval_after_extra_charge_change() FROM PUBLIC;
