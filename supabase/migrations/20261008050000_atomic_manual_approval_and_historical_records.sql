-- Make manual extra-charge approval atomic and allow internal users to create
-- a permanent, read-only approval record for older jobs that predate tokens.
-- This migration is additive. It does not change job/work-order amounts,
-- historical snapshots, phases, or existing approval decisions.

ALTER TABLE public.approval_tokens
  ADD COLUMN IF NOT EXISTS decision_source TEXT;

ALTER TABLE public.approval_tokens
  DROP CONSTRAINT IF EXISTS approval_tokens_decision_source_check;
ALTER TABLE public.approval_tokens
  ADD CONSTRAINT approval_tokens_decision_source_check
  CHECK (decision_source IS NULL OR decision_source IN ('approval_link', 'internal_manual', 'historical_record'));

COMMENT ON COLUMN public.approval_tokens.decision_source IS
  'How the recorded decision was made. This is display/audit metadata and does not control job state.';

-- Preserve existing decisions while adding source metadata only where it is
-- currently absent. A manual event must belong to the same token cycle.
UPDATE public.approval_tokens token_row
SET decision_source = CASE
  WHEN EXISTS (
    SELECT 1
    FROM public.job_phase_changes change_row
    WHERE change_row.job_id = token_row.job_id
      AND change_row.change_reason ILIKE 'Extra charges approved manually%'
      AND change_row.changed_at >= token_row.created_at
      AND change_row.changed_at <= COALESCE(token_row.decision_at, token_row.used_at, now()) + interval '5 minutes'
  ) THEN 'internal_manual'
  ELSE 'approval_link'
END
WHERE token_row.decision IS NOT NULL
  AND token_row.decision_source IS NULL;

-- Public link submissions are customer/link decisions. Internal manual RPCs
-- set their source explicitly before this trigger runs.
CREATE OR REPLACE FUNCTION public.capture_approval_decision_maker()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.decision IS NULL AND NEW.decision IN ('approved', 'declined') THEN
    NEW.decision_maker_name := COALESCE(
      NULLIF(btrim(NEW.decision_maker_name), ''),
      NULLIF(btrim(NEW.approver_name), ''),
      NULLIF(btrim(OLD.approver_name), '')
    );
    NEW.decision_maker_email := lower(COALESCE(
      NULLIF(btrim(NEW.decision_maker_email), ''),
      NULLIF(btrim(NEW.approver_email), ''),
      NULLIF(btrim(OLD.approver_email), '')
    ));
    NEW.decision_source := COALESCE(NEW.decision_source, 'approval_link');

    IF NEW.decision_maker_name IS NULL THEN
      RAISE EXCEPTION 'Approver name is required';
    END IF;
    IF NEW.decision_maker_email IS NULL
       OR NEW.decision_maker_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
      RAISE EXCEPTION 'A valid approver email is required';
    END IF;

    NEW.approver_name := OLD.approver_name;
    NEW.approver_email := OLD.approver_email;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS capture_approval_decision_maker_trigger
  ON public.approval_tokens;
CREATE TRIGGER capture_approval_decision_maker_trigger
BEFORE UPDATE OF decision, approver_name, approver_email,
  decision_maker_name, decision_maker_email, decision_source
ON public.approval_tokens
FOR EACH ROW
EXECUTE FUNCTION public.capture_approval_decision_maker();

-- Build the immutable page payload from the data already stored on the job
-- and its latest work order. Dynamic JSON access keeps old/frozen rows usable
-- even when some newer optional fields are absent.
CREATE OR REPLACE FUNCTION public.build_extra_charge_approval_snapshot(p_job_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job JSONB;
  v_property JSONB;
  v_work_order JSONB;
  v_items JSONB := '[]'::jsonb;
  v_item JSONB;
  v_description TEXT;
  v_quantity NUMERIC;
  v_bill_rate NUMERIC;
  v_cost NUMERIC;
  v_total NUMERIC := 0;
BEGIN
  SELECT to_jsonb(j), to_jsonb(p)
  INTO v_job, v_property
  FROM public.jobs j
  LEFT JOIN public.properties p ON p.id = j.property_id
  WHERE j.id = p_job_id;

  IF v_job IS NULL THEN
    RAISE EXCEPTION 'Job not found';
  END IF;

  SELECT to_jsonb(wo)
  INTO v_work_order
  FROM public.work_orders wo
  WHERE wo.job_id = p_job_id
  ORDER BY wo.submission_date DESC NULLS LAST, wo.created_at DESC NULLS LAST
  LIMIT 1;

  IF v_work_order IS NULL THEN
    RAISE EXCEPTION 'A submitted work order is required';
  END IF;

  IF jsonb_typeof(v_work_order->'extra_charges_line_items') = 'array' THEN
    FOR v_item IN SELECT value FROM jsonb_array_elements(v_work_order->'extra_charges_line_items')
    LOOP
      BEGIN
        v_quantity := COALESCE(NULLIF(v_item->>'quantity', '')::numeric, 0);
      EXCEPTION WHEN invalid_text_representation THEN
        v_quantity := 0;
      END;
      BEGIN
        v_bill_rate := COALESCE(NULLIF(v_item->>'billRate', '')::numeric, 0);
      EXCEPTION WHEN invalid_text_representation THEN
        v_bill_rate := 0;
      END;
      BEGIN
        v_cost := COALESCE(NULLIF(v_item->>'calculatedBillAmount', '')::numeric, v_quantity * v_bill_rate, 0);
      EXCEPTION WHEN invalid_text_representation THEN
        v_cost := v_quantity * v_bill_rate;
      END;
      v_description := COALESCE(
        NULLIF(btrim(v_item->>'description'), ''),
        NULLIF(btrim(concat_ws(' - ', v_item->>'categoryName', v_item->>'detailName')), ''),
        'Extra Charge'
      );
      v_items := v_items || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
        'description', v_description,
        'cost', v_cost,
        'quantity', v_quantity,
        'unit', COALESCE(NULLIF(v_item->>'unit', ''), CASE
          WHEN lower(COALESCE(v_item->>'isHourly', 'false')) IN ('true', 't', '1', 'yes') THEN 'hours'
          ELSE 'units'
        END),
        'hours', CASE
          WHEN lower(COALESCE(v_item->>'isHourly', 'false')) IN ('true', 't', '1', 'yes') THEN v_quantity
          ELSE NULL
        END,
        'bill_hours', CASE
          WHEN COALESCE(v_item->>'billHours', '') ~ '^-?[0-9]+([.][0-9]+)?$'
            THEN (v_item->>'billHours')::numeric
          ELSE NULL
        END
      )));
      v_total := v_total + v_cost;
    END LOOP;
  END IF;

  IF jsonb_typeof(v_work_order->'misc_additional_cost_items') = 'array' THEN
    FOR v_item IN SELECT value FROM jsonb_array_elements(v_work_order->'misc_additional_cost_items')
    LOOP
      BEGIN
        v_cost := COALESCE(NULLIF(v_item->>'price', '')::numeric, 0);
      EXCEPTION WHEN invalid_text_representation THEN
        v_cost := 0;
      END;
      IF v_cost <> 0 OR NULLIF(btrim(v_item->>'description'), '') IS NOT NULL THEN
        v_items := v_items || jsonb_build_array(jsonb_build_object(
          'description', COALESCE(NULLIF(btrim(v_item->>'description'), ''), 'Miscellaneous Additional Cost'),
          'cost', v_cost,
          'quantity', 1,
          'unit', 'item'
        ));
        v_total := v_total + v_cost;
      END IF;
    END LOOP;
  END IF;

  IF jsonb_array_length(v_items) = 0 THEN
    BEGIN
      v_cost := COALESCE(NULLIF(v_job#>>'{extra_charges_details,bill_amount}', '')::numeric, 0);
    EXCEPTION WHEN invalid_text_representation THEN
      v_cost := 0;
    END;
    IF v_cost <> 0 OR lower(COALESCE(v_work_order->>'has_extra_charges', 'false')) IN ('true', 't', '1', 'yes') THEN
      v_items := jsonb_build_array(jsonb_build_object(
        'description', COALESCE(
          NULLIF(btrim(v_job#>>'{extra_charges_details,description}'), ''),
          NULLIF(btrim(v_work_order->>'extra_charges_description'), ''),
          'Extra Charges'
        ),
        'cost', v_cost,
        'hours', CASE
          WHEN COALESCE(v_work_order->>'extra_hours', '') ~ '^-?[0-9]+([.][0-9]+)?$'
            THEN (v_work_order->>'extra_hours')::numeric
          ELSE 0
        END,
        'unit', 'hours'
      ));
      v_total := v_cost;
    END IF;
  END IF;

  IF jsonb_array_length(v_items) = 0 THEN
    RAISE EXCEPTION 'No stored extra-charge details were found';
  END IF;

  RETURN jsonb_build_object(
    'items', v_items,
    'total', v_total,
    'historical_record', true,
    'job_details', jsonb_build_object(
      'work_order_num', v_job->>'work_order_num',
      'unit_number', v_job->>'unit_number',
      'property_name', v_property->>'property_name',
      'property_address', v_property->>'address'
    )
  );
END;
$$;

-- One transaction: token decision, job phase, and phase-history audit either
-- all succeed or all roll back.
CREATE OR REPLACE FUNCTION public.approve_extra_charges_manually(p_job_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job RECORD;
  v_work_order_phase UUID;
  v_profile RECORD;
  v_token public.approval_tokens%ROWTYPE;
  v_now TIMESTAMPTZ := now();
  v_snapshot JSONB;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_internal_admin_user() THEN
    RAISE EXCEPTION 'Not authorized to approve extra charges manually';
  END IF;

  SELECT j.id, j.current_phase_id, jp.job_phase_label
  INTO v_job
  FROM public.jobs j
  LEFT JOIN public.job_phases jp ON jp.id = j.current_phase_id
  WHERE j.id = p_job_id
  FOR UPDATE OF j;

  IF NOT FOUND THEN RAISE EXCEPTION 'Job not found'; END IF;
  IF v_job.job_phase_label <> 'Pending Work Order' THEN
    RAISE EXCEPTION 'The job is no longer awaiting an approval decision';
  END IF;

  SELECT id INTO v_work_order_phase
  FROM public.job_phases
  WHERE job_phase_label = 'Work Order'
  LIMIT 1;
  IF v_work_order_phase IS NULL THEN RAISE EXCEPTION 'Work Order phase not found'; END IF;

  SELECT id, full_name, email INTO v_profile
  FROM public.profiles
  WHERE id = auth.uid();
  IF v_profile.email IS NULL THEN RAISE EXCEPTION 'The approving admin profile requires an email address'; END IF;

  v_snapshot := public.build_extra_charge_approval_snapshot(p_job_id);

  SELECT * INTO v_token
  FROM public.approval_tokens
  WHERE job_id = p_job_id
    AND approval_type = 'extra_charges'
    AND invalidated_at IS NULL
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.approval_tokens
    SET used_at = v_now,
        decision = 'approved',
        decision_at = v_now,
        decision_maker_name = COALESCE(v_profile.full_name, v_profile.email),
        decision_maker_email = v_profile.email,
        decision_source = 'internal_manual',
        decline_reason = NULL,
        extra_charges_data = v_snapshot,
        expires_at = NULL
    WHERE id = v_token.id
    RETURNING * INTO v_token;
  ELSE
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

  UPDATE public.jobs
  SET current_phase_id = v_work_order_phase,
      updated_at = v_now
  WHERE id = p_job_id;

  INSERT INTO public.job_phase_changes (
    job_id, changed_by, from_phase_id, to_phase_id, changed_at, change_reason
  ) VALUES (
    p_job_id, auth.uid(), v_job.current_phase_id, v_work_order_phase, v_now,
    format('Extra charges approved manually by %s - job advanced to Work Order',
      COALESCE(v_profile.full_name, v_profile.email))
  );

  RETURN jsonb_build_object('success', true, 'token', v_token.token, 'decision_at', v_now);
END;
$$;

-- Reuse the original page whenever possible. Only create a replacement when
-- an older job has a stored decision but no approval_tokens row.
CREATE OR REPLACE FUNCTION public.ensure_extra_charge_approval_record(p_job_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.approval_tokens%ROWTYPE;
  v_change RECORD;
  v_actor RECORD;
  v_decision TEXT;
  v_source TEXT;
  v_name TEXT;
  v_email TEXT;
  v_snapshot JSONB;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_internal_admin_user() THEN
    RAISE EXCEPTION 'Not authorized to create historical approval records';
  END IF;

  PERFORM 1 FROM public.jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Job not found'; END IF;

  SELECT * INTO v_existing
  FROM public.approval_tokens
  WHERE job_id = p_job_id AND approval_type = 'extra_charges'
  ORDER BY created_at DESC
  LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('success', true, 'token', v_existing.token, 'created', false);
  END IF;

  SELECT change_row.changed_at, change_row.change_reason, change_row.changed_by
  INTO v_change
  FROM public.job_phase_changes change_row
  WHERE change_row.job_id = p_job_id
    AND change_row.change_reason ILIKE '%extra charges%'
    AND (change_row.change_reason ILIKE '%approv%' OR change_row.change_reason ILIKE '%declin%')
  ORDER BY change_row.changed_at DESC
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No stored extra-charge approval or decline decision was found';
  END IF;

  v_decision := CASE WHEN v_change.change_reason ILIKE '%declin%' THEN 'declined' ELSE 'approved' END;
  v_source := CASE WHEN v_change.change_reason ILIKE '%approved manually%' THEN 'internal_manual' ELSE 'historical_record' END;
  SELECT full_name, email INTO v_actor FROM public.profiles WHERE id = v_change.changed_by;
  v_name := COALESCE(
    NULLIF(substring(v_change.change_reason FROM '(?i)extra charges (?:approved|declined|rejected)(?: manually)? by ([^.;-]+)'), ''),
    v_actor.full_name,
    'Recorded approver'
  );
  v_email := COALESCE(v_actor.email, 'historical-approval@jgpaintingprosinc.com');
  v_snapshot := public.build_extra_charge_approval_snapshot(p_job_id);

  INSERT INTO public.approval_tokens (
    job_id, token, approval_type, extra_charges_data, approver_email,
    approver_name, expires_at, used_at, decision, decision_at,
    decision_maker_name, decision_maker_email, decision_source
  ) VALUES (
    p_job_id, gen_random_uuid()::text, 'extra_charges', v_snapshot,
    v_email, v_name, NULL, v_change.changed_at, v_decision, v_change.changed_at,
    v_name, v_email, v_source
  ) RETURNING * INTO v_existing;

  RETURN jsonb_build_object('success', true, 'token', v_existing.token, 'created', true);
END;
$$;

REVOKE ALL ON FUNCTION public.build_extra_charge_approval_snapshot(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.approve_extra_charges_manually(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ensure_extra_charge_approval_record(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_extra_charges_manually(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_extra_charge_approval_record(UUID) TO authenticated;
