-- Correct cumulative extra-charge reapproval behavior without replacing or
-- deleting any existing approval, job, work-order, image, or audit record.

CREATE OR REPLACE FUNCTION public.approval_customer_line_items(p_items jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(item ORDER BY item::text), '[]'::jsonb)
  FROM (
    SELECT jsonb_strip_nulls(jsonb_build_object(
      'category', NULLIF(btrim(value->>'categoryName'), ''),
      'detail', NULLIF(btrim(value->>'detailName'), ''),
      'description', NULLIF(btrim(value->>'description'), ''),
      'quantity', CASE WHEN COALESCE(value->>'quantity', '') ~ '^-?[0-9]+([.][0-9]+)?$'
        THEN (value->>'quantity')::numeric ELSE 0 END,
      'bill_rate', CASE WHEN COALESCE(value->>'billRate', '') ~ '^-?[0-9]+([.][0-9]+)?$'
        THEN (value->>'billRate')::numeric ELSE 0 END,
      'bill_hours', CASE
        WHEN COALESCE(value->>'billHours', '') ~ '^-?[0-9]+([.][0-9]+)?$'
          THEN (value->>'billHours')::numeric
        ELSE NULL
      END,
      'amount', CASE
        WHEN COALESCE(value->>'calculatedBillAmount', '') ~ '^-?[0-9]+([.][0-9]+)?$'
          THEN (value->>'calculatedBillAmount')::numeric
        ELSE (CASE WHEN COALESCE(value->>'quantity', '') ~ '^-?[0-9]+([.][0-9]+)?$'
          THEN (value->>'quantity')::numeric ELSE 0 END)
          * (CASE WHEN COALESCE(value->>'billRate', '') ~ '^-?[0-9]+([.][0-9]+)?$'
          THEN (value->>'billRate')::numeric ELSE 0 END)
      END,
      'hourly', lower(COALESCE(value->>'isHourly', 'false')) IN ('true', 't', '1', 'yes')
    )) AS item
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(p_items) = 'array' THEN p_items ELSE '[]'::jsonb END
    )
  ) normalized;
$$;

CREATE OR REPLACE FUNCTION public.approval_customer_misc_items(p_items jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(item ORDER BY item::text), '[]'::jsonb)
  FROM (
    SELECT jsonb_strip_nulls(jsonb_build_object(
      'description', NULLIF(btrim(value->>'description'), ''),
      'amount', CASE
        WHEN COALESCE(value->>'price', '') ~ '^-?[0-9]+([.][0-9]+)?$'
          THEN (value->>'price')::numeric
        ELSE 0
      END
    )) AS item
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(p_items) = 'array' THEN p_items ELSE '[]'::jsonb END
    )
  ) normalized;
$$;

CREATE OR REPLACE FUNCTION public.approval_customer_work_order_signature(
  p_line_items jsonb,
  p_misc_items jsonb,
  p_has_extra_charges boolean,
  p_legacy_description text,
  p_legacy_hours numeric,
  p_repair_cost numeric,
  p_repair_description text
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT jsonb_strip_nulls(jsonb_build_object(
    'line_items', public.approval_customer_line_items(p_line_items),
    'misc_items', public.approval_customer_misc_items(p_misc_items),
    'has_extra_charges', COALESCE(p_has_extra_charges, false),
    'legacy_description', NULLIF(btrim(p_legacy_description), ''),
    'legacy_hours', COALESCE(p_legacy_hours, 0),
    'repair_cost', COALESCE(p_repair_cost, 0),
    'repair_description', NULLIF(btrim(p_repair_description), '')
  ));
$$;

CREATE OR REPLACE FUNCTION public.mark_extra_charge_approval_outdated(
  p_job_id uuid,
  p_reason text DEFAULT 'extra_charge_details_changed'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invalidated integer := 0;
  v_pending_phase_id uuid;
  v_current_phase_id uuid;
  v_current_phase_label text;
  v_historical_mode text;
BEGIN
  SELECT j.current_phase_id, jp.job_phase_label, COALESCE(j.historical_data_mode, 'live')
  INTO v_current_phase_id, v_current_phase_label, v_historical_mode
  FROM public.jobs j
  LEFT JOIN public.job_phases jp ON jp.id = j.current_phase_id
  WHERE j.id = p_job_id
  FOR UPDATE OF j;

  -- Frozen/terminal history remains completely untouched until the established
  -- reopen flow returns the job to live data.
  IF v_historical_mode = 'snapshot'
     AND v_current_phase_label IN ('Completed Work Orders', 'Quality Control', 'Completed', 'Invoicing', 'Cancelled', 'Archived')
  THEN
    RETURN 0;
  END IF;

  UPDATE public.approval_tokens
  SET invalidated_at = COALESCE(invalidated_at, now()),
      invalidation_reason = COALESCE(invalidation_reason, p_reason)
  WHERE job_id = p_job_id
    AND approval_type = 'extra_charges'
    AND invalidated_at IS NULL;
  GET DIAGNOSTICS v_invalidated = ROW_COUNT;

  IF v_invalidated = 0 THEN RETURN 0; END IF;

  SELECT id INTO v_pending_phase_id
  FROM public.job_phases
  WHERE job_phase_label = 'Pending Work Order'
  LIMIT 1;

  IF v_pending_phase_id IS NOT NULL AND v_current_phase_id IS DISTINCT FROM v_pending_phase_id THEN
    UPDATE public.jobs
    SET current_phase_id = v_pending_phase_id, updated_at = now()
    WHERE id = p_job_id;

    INSERT INTO public.job_phase_changes (
      job_id, from_phase_id, to_phase_id, changed_by, change_reason
    ) VALUES (
      p_job_id, v_current_phase_id, v_pending_phase_id, auth.uid(),
      'Extra charge details were modified after an approval request - updated cumulative approval required'
    );
  END IF;

  RETURN v_invalidated;
END;
$$;

CREATE OR REPLACE FUNCTION public.require_reapproval_after_extra_charge_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_signature jsonb;
  v_new_signature jsonb;
BEGIN
  v_old_signature := public.approval_customer_work_order_signature(
    OLD.extra_charges_line_items, OLD.misc_additional_cost_items,
    OLD.has_extra_charges, OLD.extra_charges_description, OLD.extra_hours,
    OLD.repair_cost, OLD.repair_description
  );
  v_new_signature := public.approval_customer_work_order_signature(
    NEW.extra_charges_line_items, NEW.misc_additional_cost_items,
    NEW.has_extra_charges, NEW.extra_charges_description, NEW.extra_hours,
    NEW.repair_cost, NEW.repair_description
  );

  IF v_old_signature IS DISTINCT FROM v_new_signature THEN
    PERFORM public.mark_extra_charge_approval_outdated(NEW.job_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS require_reapproval_after_extra_charge_change_trigger ON public.work_orders;
CREATE TRIGGER require_reapproval_after_extra_charge_change_trigger
AFTER UPDATE OF extra_charges_line_items, misc_additional_cost_items,
  has_extra_charges, extra_charges_description, extra_hours,
  repair_cost, repair_description
ON public.work_orders
FOR EACH ROW
EXECUTE FUNCTION public.require_reapproval_after_extra_charge_change();

CREATE OR REPLACE FUNCTION public.require_reapproval_after_job_misc_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(OLD.repair_amount, 0) IS DISTINCT FROM COALESCE(NEW.repair_amount, 0) THEN
    PERFORM public.mark_extra_charge_approval_outdated(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS require_reapproval_after_job_misc_change_trigger ON public.jobs;
CREATE TRIGGER require_reapproval_after_job_misc_change_trigger
AFTER UPDATE OF repair_amount ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.require_reapproval_after_job_misc_change();

-- Resends reuse an unchanged pending request. A changed cumulative snapshot
-- preserves and supersedes the former page, then creates a new request.
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
  IF NOT public.is_internal_admin_user() THEN RAISE EXCEPTION 'Not authorized to create approval requests'; END IF;
  IF p_job_id IS NULL OR v_type NOT IN ('extra_charges', 'extra_charges_preview') THEN
    RAISE EXCEPTION 'Invalid approval request';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_job_id::text || ':' || v_type, 0));

  IF NOT p_is_preview THEN
    SELECT * INTO v_record
    FROM public.approval_tokens a
    WHERE a.job_id = p_job_id
      AND a.approval_type = 'extra_charges'
      AND a.used_at IS NULL AND a.decision IS NULL AND a.invalidated_at IS NULL
    ORDER BY a.created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF FOUND AND COALESCE(v_record.extra_charges_data->'items', '[]'::jsonb)
      = COALESCE(p_extra_charges_data->'items', '[]'::jsonb)
      AND COALESCE(v_record.extra_charges_data->>'total', '0')::numeric
        = COALESCE(p_extra_charges_data->>'total', '0')::numeric
    THEN
      UPDATE public.approval_tokens a
      SET approver_email = COALESCE(NULLIF(btrim(p_approver_email), ''), a.approver_email),
          approver_name = COALESCE(NULLIF(btrim(p_approver_name), ''), a.approver_name),
          expires_at = NULL
      WHERE a.id = v_record.id
      RETURNING a.* INTO v_record;
      RETURN QUERY SELECT v_record.id, v_record.token::text, v_record.expires_at, true;
      RETURN;
    ELSIF FOUND THEN
      UPDATE public.approval_tokens
      SET invalidated_at = now(), invalidation_reason = 'extra_charge_details_changed'
      WHERE approval_tokens.id = v_record.id;
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

-- Manual approval changes decision metadata only on an existing current page;
-- it never rewrites that page's immutable sent snapshot or selected images.
CREATE OR REPLACE FUNCTION public.approve_extra_charges_manually(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job record;
  v_work_order_phase uuid;
  v_profile record;
  v_token public.approval_tokens%ROWTYPE;
  v_now timestamptz := now();
  v_snapshot jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_internal_admin_user() THEN
    RAISE EXCEPTION 'Not authorized to approve extra charges manually';
  END IF;

  SELECT j.id, j.current_phase_id, jp.job_phase_label INTO v_job
  FROM public.jobs j LEFT JOIN public.job_phases jp ON jp.id = j.current_phase_id
  WHERE j.id = p_job_id FOR UPDATE OF j;
  IF NOT FOUND THEN RAISE EXCEPTION 'Job not found'; END IF;
  IF v_job.job_phase_label <> 'Pending Work Order' THEN
    RAISE EXCEPTION 'The job is no longer awaiting an approval decision';
  END IF;

  SELECT id INTO v_work_order_phase FROM public.job_phases
  WHERE job_phase_label = 'Work Order' LIMIT 1;
  IF v_work_order_phase IS NULL THEN RAISE EXCEPTION 'Work Order phase not found'; END IF;

  SELECT id, full_name, email INTO v_profile FROM public.profiles WHERE id = auth.uid();
  IF v_profile.email IS NULL THEN RAISE EXCEPTION 'The approving admin profile requires an email address'; END IF;

  SELECT * INTO v_token FROM public.approval_tokens
  WHERE job_id = p_job_id AND approval_type = 'extra_charges'
    AND invalidated_at IS NULL AND decision IS NULL AND used_at IS NULL
  ORDER BY created_at DESC LIMIT 1 FOR UPDATE;

  IF FOUND THEN
    UPDATE public.approval_tokens
    SET used_at = v_now, decision = 'approved', decision_at = v_now,
        decision_maker_name = COALESCE(v_profile.full_name, v_profile.email),
        decision_maker_email = v_profile.email, decision_source = 'internal_manual',
        decline_reason = NULL, expires_at = NULL
    WHERE id = v_token.id RETURNING * INTO v_token;
  ELSE
    v_snapshot := public.build_extra_charge_approval_snapshot(p_job_id);
    INSERT INTO public.approval_tokens (
      job_id, token, approval_type, extra_charges_data, approver_email,
      approver_name, expires_at, used_at, decision, decision_at,
      decision_maker_name, decision_maker_email, decision_source
    ) VALUES (
      p_job_id, gen_random_uuid()::text, 'extra_charges', v_snapshot,
      v_profile.email, COALESCE(v_profile.full_name, v_profile.email), NULL,
      v_now, 'approved', v_now, COALESCE(v_profile.full_name, v_profile.email),
      v_profile.email, 'internal_manual'
    ) RETURNING * INTO v_token;
  END IF;

  UPDATE public.jobs SET current_phase_id = v_work_order_phase, updated_at = v_now WHERE id = p_job_id;
  INSERT INTO public.job_phase_changes (job_id, changed_by, from_phase_id, to_phase_id, changed_at, change_reason)
  VALUES (p_job_id, auth.uid(), v_job.current_phase_id, v_work_order_phase, v_now,
    format('Extra charges approved manually by %s - job advanced to Work Order',
      COALESCE(v_profile.full_name, v_profile.email)));

  RETURN jsonb_build_object('success', true, 'token', v_token.token, 'decision_at', v_now);
END;
$$;

-- Notify on the first recorded decision whether it was written by UPDATE or
-- inserted already decided by the manual-approval transaction.
CREATE OR REPLACE FUNCTION public.notify_internal_users_of_approval_decision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile record;
  v_work_order_num integer;
  v_property_name text;
  v_unit_number text;
  v_amount numeric;
  v_title text;
  v_message text;
BEGIN
  IF NEW.approval_type <> 'extra_charges'
    OR NEW.decision IS NULL
    OR (TG_OP = 'UPDATE' AND OLD.decision IS NOT NULL)
  THEN RETURN NEW; END IF;

  SELECT j.work_order_num, p.property_name, j.unit_number
  INTO v_work_order_num, v_property_name, v_unit_number
  FROM public.jobs j LEFT JOIN public.properties p ON p.id = j.property_id
  WHERE j.id = NEW.job_id;

  v_amount := CASE
    WHEN jsonb_typeof(NEW.extra_charges_data->'total') = 'number'
      THEN (NEW.extra_charges_data->>'total')::numeric
    ELSE NULL
  END;
  v_title := CASE WHEN NEW.decision = 'approved'
    THEN 'Extra charges approved' ELSE 'Extra charges declined — high priority' END;
  v_message := format('WO-%s · %s · Unit %s%s',
    lpad(COALESCE(v_work_order_num, 0)::text, 6, '0'),
    COALESCE(v_property_name, 'Property'), COALESCE(v_unit_number, 'N/A'),
    CASE WHEN v_amount IS NOT NULL
      THEN format(' · $%s', to_char(v_amount, 'FM999999990.00')) ELSE '' END);

  FOR v_profile IN
    SELECT id FROM public.profiles
    WHERE role IN ('is_super_admin', 'admin', 'jg_management')
  LOOP
    -- The token id is the idempotency key for this decision notification.
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = v_profile.id
        AND n.metadata->>'event' = 'extra_charge_approval_decision'
        AND n.metadata->>'approval_token_id' = NEW.id::text
    ) THEN
      INSERT INTO public.notifications (
        user_id, type, title, message, job_id, entity_id, is_read, metadata
      ) VALUES (
        v_profile.id, 'other', v_title, v_message, NEW.job_id, NEW.job_id, false,
        jsonb_build_object(
          'event', 'extra_charge_approval_decision', 'decision', NEW.decision,
          'priority', CASE WHEN NEW.decision = 'declined' THEN 'high' ELSE 'normal' END,
          'job_id', NEW.job_id, 'approval_token_id', NEW.id,
          'route', format('/dashboard/jobs/%s', NEW.job_id)
        )
      );
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS approval_decision_admin_notifications ON public.approval_tokens;
DROP TRIGGER IF EXISTS approval_decision_admin_notifications_insert ON public.approval_tokens;
CREATE TRIGGER approval_decision_admin_notifications
AFTER UPDATE OF decision ON public.approval_tokens
FOR EACH ROW
WHEN (NEW.decision IS NOT NULL AND OLD.decision IS NULL)
EXECUTE FUNCTION public.notify_internal_users_of_approval_decision();
CREATE TRIGGER approval_decision_admin_notifications_insert
AFTER INSERT ON public.approval_tokens
FOR EACH ROW
WHEN (NEW.decision IS NOT NULL)
EXECUTE FUNCTION public.notify_internal_users_of_approval_decision();

REVOKE ALL ON FUNCTION public.approval_customer_line_items(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.approval_customer_misc_items(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.approval_customer_work_order_signature(jsonb, jsonb, boolean, text, numeric, numeric, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_extra_charge_approval_outdated(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.require_reapproval_after_extra_charge_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.require_reapproval_after_job_misc_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_internal_users_of_approval_decision() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_or_refresh_approval_token(uuid, text, text, text, jsonb, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_extra_charges_manually(uuid) TO authenticated;
