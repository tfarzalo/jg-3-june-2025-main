/*
  Restore the billing-aware get_job_details contract after the scheduled_end_date
  migration replaced it with a reduced payload.

  This is forward-only and non-destructive:
  - keeps scheduled_end_date support
  - restores base, hourly, and extra charge billing payloads
  - scopes billing rates to the job property, category, and unit size
  - restores the snapshot-aware get_job_details wrapper
*/

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS scheduled_end_date date;

CREATE OR REPLACE FUNCTION public.get_job_details_live(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_property_id uuid;
  v_category_id uuid;
  v_unit_size_id uuid;
  v_unit_size_label_snapshot text;
  v_job_category_name text;
  v_extra_charges_hours integer;
  v_extra_charges_description text;
  v_billing_category_id uuid;
  v_billing_category_name text;
  v_hourly_billing_category_id uuid;
  v_billing_category_exists boolean;
  v_unit_size_exists boolean;
  v_regular_billing_record jsonb;
  v_hourly_billing_record jsonb;
  v_regular_billing_count integer;
  v_hourly_billing_count integer;
  v_regular_bill_amount numeric;
  v_regular_sub_pay_amount numeric;
  v_hourly_bill_amount numeric;
  v_hourly_sub_pay_amount numeric;
  v_matching_billing_categories jsonb;
  v_billing_details jsonb;
  v_hourly_billing_details jsonb;
  v_extra_charges_details jsonb;
  v_debug_info jsonb;
  v_work_order jsonb;
  v_property jsonb;
  v_unit_size jsonb;
  v_job_type jsonb;
  v_job_phase jsonb;
BEGIN
  SELECT
    j.property_id,
    j.job_category_id,
    j.unit_size_id,
    NULLIF(btrim(j.unit_size_label_snapshot), ''),
    jc.name
  INTO
    v_property_id,
    v_category_id,
    v_unit_size_id,
    v_unit_size_label_snapshot,
    v_job_category_name
  FROM public.jobs j
  LEFT JOIN public.job_categories jc ON jc.id = j.job_category_id
  WHERE j.id = p_job_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT
    wo.extra_hours,
    wo.extra_charges_description
  INTO
    v_extra_charges_hours,
    v_extra_charges_description
  FROM public.work_orders wo
  WHERE wo.job_id = p_job_id
    AND wo.is_active = true
  ORDER BY wo.created_at DESC
  LIMIT 1;

  /*
    Billing accuracy depends on resolving the property's own billing category
    before reading billing_details. Matching by category name alone can pull a
    same-named category from another property.
  */
  SELECT
    bc.id,
    bc.name
  INTO
    v_billing_category_id,
    v_billing_category_name
  FROM public.billing_categories bc
  JOIN public.billing_details bd ON bd.category_id = bc.id
  WHERE bd.property_id = v_property_id
    AND bc.name = v_job_category_name
    AND (bc.property_id = v_property_id OR bc.property_id IS NULL)
  ORDER BY (bc.property_id = v_property_id) DESC, bc.created_at DESC NULLS LAST
  LIMIT 1;

  SELECT
    bd.category_id
  INTO
    v_hourly_billing_category_id
  FROM public.billing_details bd
  JOIN public.billing_categories bc ON bc.id = bd.category_id
  WHERE bd.property_id = v_property_id
    AND bc.name = v_job_category_name
    AND (bc.property_id = v_property_id OR bc.property_id IS NULL)
    AND bd.is_hourly = true
  ORDER BY (bc.property_id = v_property_id) DESC, bc.created_at DESC NULLS LAST
  LIMIT 1;

  v_billing_category_exists := v_billing_category_id IS NOT NULL;
  v_unit_size_exists := v_unit_size_id IS NOT NULL;

  SELECT
    jsonb_build_object(
      'bill_amount', bd.bill_amount,
      'sub_pay_amount', bd.sub_pay_amount,
      'profit_amount', bd.bill_amount - bd.sub_pay_amount,
      'is_hourly', bd.is_hourly,
      'display_order', 1,
      'section_name', 'Regular Billing',
      'debug', jsonb_build_object(
        'bill_amount', bd.bill_amount,
        'sub_pay_amount', bd.sub_pay_amount,
        'is_hourly', bd.is_hourly,
        'category_id', bd.category_id,
        'unit_size_id', bd.unit_size_id,
        'property_id', bd.property_id
      )
    ),
    COUNT(*)
  INTO
    v_regular_billing_record,
    v_regular_billing_count
  FROM public.billing_details bd
  WHERE bd.property_id = v_property_id
    AND bd.category_id = v_billing_category_id
    AND bd.unit_size_id = v_unit_size_id
    AND bd.is_hourly = false
  GROUP BY bd.bill_amount, bd.sub_pay_amount, bd.is_hourly, bd.category_id, bd.unit_size_id, bd.property_id
  LIMIT 1;

  SELECT
    jsonb_build_object(
      'bill_amount', bd.bill_amount,
      'sub_pay_amount', bd.sub_pay_amount,
      'profit_amount', bd.bill_amount - bd.sub_pay_amount,
      'is_hourly', bd.is_hourly,
      'display_order', 2,
      'section_name', 'Hourly Billing',
      'debug', jsonb_build_object(
        'bill_amount', bd.bill_amount,
        'sub_pay_amount', bd.sub_pay_amount,
        'is_hourly', bd.is_hourly,
        'category_id', bd.category_id,
        'unit_size_id', bd.unit_size_id,
        'property_id', bd.property_id
      )
    ),
    COUNT(*)
  INTO
    v_hourly_billing_record,
    v_hourly_billing_count
  FROM public.billing_details bd
  WHERE bd.property_id = v_property_id
    AND bd.category_id = COALESCE(v_hourly_billing_category_id, v_billing_category_id)
    AND bd.unit_size_id = v_unit_size_id
    AND bd.is_hourly = true
  GROUP BY bd.bill_amount, bd.sub_pay_amount, bd.is_hourly, bd.category_id, bd.unit_size_id, bd.property_id
  LIMIT 1;

  v_regular_bill_amount := COALESCE((v_regular_billing_record->>'bill_amount')::numeric, 0);
  v_regular_sub_pay_amount := COALESCE((v_regular_billing_record->>'sub_pay_amount')::numeric, 0);
  v_hourly_bill_amount := CASE WHEN v_hourly_billing_record IS NOT NULL THEN (v_hourly_billing_record->>'bill_amount')::numeric ELSE NULL END;
  v_hourly_sub_pay_amount := CASE WHEN v_hourly_billing_record IS NOT NULL THEN (v_hourly_billing_record->>'sub_pay_amount')::numeric ELSE NULL END;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', bc.id,
      'name', bc.name,
      'property_id', bc.property_id,
      'billing_detail_property_id', bd.property_id
    )
  )
  INTO v_matching_billing_categories
  FROM public.billing_categories bc
  JOIN public.billing_details bd ON bd.category_id = bc.id
  WHERE bd.property_id = v_property_id
    AND bc.name = v_job_category_name;

  v_billing_details := CASE
    WHEN v_regular_billing_record IS NOT NULL THEN
      jsonb_build_object(
        'bill_amount', v_regular_bill_amount,
        'sub_pay_amount', v_regular_sub_pay_amount,
        'profit_amount', v_regular_bill_amount - v_regular_sub_pay_amount,
        'is_hourly', false,
        'display_order', 1,
        'section_name', 'Regular Billing',
        'debug', jsonb_build_object(
          'bill_amount', v_regular_bill_amount,
          'sub_pay_amount', v_regular_sub_pay_amount,
          'billing_category_id', v_billing_category_id,
          'billing_category_name', v_billing_category_name,
          'unit_size_id', v_unit_size_id,
          'job_category_name', v_job_category_name,
          'raw_record', v_regular_billing_record,
          'record_count', v_regular_billing_count,
          'billing_category_exists', v_billing_category_exists,
          'unit_size_exists', v_unit_size_exists,
          'matching_billing_categories', v_matching_billing_categories,
          'query_params', jsonb_build_object(
            'property_id', v_property_id,
            'billing_category_id', v_billing_category_id,
            'unit_size_id', v_unit_size_id,
            'is_hourly', false
          )
        )
      )
    ELSE NULL
  END;

  v_hourly_billing_details := CASE
    WHEN v_hourly_billing_record IS NOT NULL THEN
      jsonb_build_object(
        'bill_amount', v_hourly_bill_amount,
        'sub_pay_amount', v_hourly_sub_pay_amount,
        'profit_amount', v_hourly_bill_amount - v_hourly_sub_pay_amount,
        'is_hourly', true,
        'display_order', 2,
        'section_name', 'Hourly Billing',
        'debug', jsonb_build_object(
          'bill_amount', v_hourly_bill_amount,
          'sub_pay_amount', v_hourly_sub_pay_amount,
          'billing_category_id', COALESCE(v_hourly_billing_category_id, v_billing_category_id),
          'billing_category_name', v_billing_category_name,
          'unit_size_id', v_unit_size_id,
          'job_category_name', v_job_category_name,
          'raw_record', v_hourly_billing_record,
          'record_count', v_hourly_billing_count,
          'billing_category_exists', COALESCE(v_hourly_billing_category_id, v_billing_category_id) IS NOT NULL,
          'unit_size_exists', v_unit_size_exists,
          'matching_billing_categories', v_matching_billing_categories,
          'query_params', jsonb_build_object(
            'property_id', v_property_id,
            'billing_category_id', COALESCE(v_hourly_billing_category_id, v_billing_category_id),
            'unit_size_id', v_unit_size_id,
            'is_hourly', true
          )
        )
      )
    ELSE NULL
  END;

  v_extra_charges_details := CASE
    WHEN COALESCE(v_extra_charges_hours, 0) > 0 THEN
      jsonb_build_object(
        'description', v_extra_charges_description,
        'hours', v_extra_charges_hours,
        'hourly_rate', COALESCE(v_hourly_bill_amount, 40),
        'sub_pay_rate', COALESCE(v_hourly_sub_pay_amount, 25),
        'bill_amount', v_extra_charges_hours * COALESCE(v_hourly_bill_amount, 40),
        'sub_pay_amount', v_extra_charges_hours * COALESCE(v_hourly_sub_pay_amount, 25),
        'profit_amount', v_extra_charges_hours * (COALESCE(v_hourly_bill_amount, 40) - COALESCE(v_hourly_sub_pay_amount, 25)),
        'is_hourly', true,
        'display_order', 3,
        'section_name', 'Extra Charges'
      )
    ELSE NULL
  END;

  v_debug_info := jsonb_build_object(
    'property_id', v_property_id,
    'job_category_id', v_category_id,
    'billing_category_id', v_billing_category_id,
    'billing_category_name', v_billing_category_name,
    'hourly_billing_category_id', v_hourly_billing_category_id,
    'unit_size_id', v_unit_size_id,
    'job_category_name', v_job_category_name,
    'billing_category_exists', v_billing_category_exists,
    'unit_size_exists', v_unit_size_exists,
    'matching_billing_categories', v_matching_billing_categories,
    'regular_billing', v_regular_billing_record,
    'hourly_billing', v_hourly_billing_record
  );

  SELECT jsonb_build_object(
      'id', wo.id,
      'submission_date', wo.submission_date,
      'created_at', wo.submission_date,
      'submitted_by_name', COALESCE(u.full_name, u.email, 'System User'),
      'unit_number', wo.unit_number,
      'unit_size', wo.unit_size,
      'is_occupied', wo.is_occupied,
      'is_full_paint', wo.is_full_paint,
      'job_category_id', wo.job_category_id,
      'job_category', jc.name,
      'has_sprinklers', wo.has_sprinklers,
      'sprinklers_painted', wo.sprinklers_painted,
      'sprinkler_form_left_in_unit', wo.sprinkler_form_left_in_unit,
      'painted_ceilings', wo.painted_ceilings,
      'ceiling_rooms_count', wo.ceiling_rooms_count,
      'individual_ceiling_count', wo.individual_ceiling_count,
      'ceiling_display_label', wo.ceiling_display_label,
      'ceiling_billing_detail_id', wo.ceiling_billing_detail_id,
      'painted_patio', wo.painted_patio,
      'painted_garage', wo.painted_garage,
      'painted_cabinets', wo.painted_cabinets,
      'painted_crown_molding', wo.painted_crown_molding,
      'painted_front_door', wo.painted_front_door,
      'has_accent_wall', wo.has_accent_wall,
      'accent_wall_type', wo.accent_wall_type,
      'accent_wall_count', wo.accent_wall_count,
      'accent_wall_billing_detail_id', wo.accent_wall_billing_detail_id,
      'has_extra_charges', wo.has_extra_charges,
      'extra_charges_description', wo.extra_charges_description,
      'extra_hours', wo.extra_hours,
      'extra_charges_line_items', wo.extra_charges_line_items,
      'additional_comments', wo.additional_comments,
      'additional_services', wo.additional_services,
      'repair_cost', wo.repair_cost,
      'repair_description', wo.repair_description,
      'misc_additional_cost_items', wo.misc_additional_cost_items,
      'is_active', wo.is_active
    )
  INTO v_work_order
  FROM public.work_orders wo
  LEFT JOIN public.job_categories jc ON jc.id = wo.job_category_id
  LEFT JOIN public.profiles u ON u.id = wo.prepared_by
  WHERE wo.job_id = p_job_id
    AND wo.is_active = true
  ORDER BY wo.created_at DESC
  LIMIT 1;

  SELECT jsonb_build_object(
      'id', p.id,
      'name', p.property_name,
      'address', p.address,
      'address_2', p.address_2,
      'city', p.city,
      'state', p.state,
      'zip', p.zip,
      'ap_email', p.ap_email,
      'ap_name', p.ap_name,
      'primary_contact_email', p.primary_contact_email,
      'quickbooks_number', p.quickbooks_number,
      'is_archived', p.is_archived
    )
  INTO v_property
  FROM public.properties p
  WHERE p.id = v_property_id;

  SELECT jsonb_build_object(
      'id', us.id,
      'label', COALESCE(v_unit_size_label_snapshot, us.unit_size_label)
    )
  INTO v_unit_size
  FROM public.unit_sizes us
  WHERE us.id = v_unit_size_id;

  SELECT jsonb_build_object(
      'id', jt.id,
      'label', jt.job_type_label
    )
  INTO v_job_type
  FROM public.job_types jt
  JOIN public.jobs j ON j.job_type_id = jt.id
  WHERE j.id = p_job_id;

  SELECT jsonb_build_object(
      'id', jp.id,
      'label', jp.job_phase_label,
      'job_phase_label', jp.job_phase_label,
      'color_light_mode', jp.color_light_mode,
      'color_dark_mode', jp.color_dark_mode
    )
  INTO v_job_phase
  FROM public.job_phases jp
  JOIN public.jobs j ON j.current_phase_id = jp.id
  WHERE j.id = p_job_id;

  SELECT jsonb_build_object(
      'id', j.id,
      'work_order_num', j.work_order_num,
      'unit_number', j.unit_number,
      'description', j.description,
      'scheduled_date', j.scheduled_date,
      'scheduled_end_date', j.scheduled_end_date,
      'purchase_order', j.purchase_order,
      'is_occupied', j.is_occupied,
      'is_full_paint', COALESCE((v_work_order ->> 'is_full_paint')::boolean, false),
      'assigned_to', j.assigned_to,
      'assigned_to_name', COALESCE(p.full_name, p.email, j.assigned_to_name_snapshot, j.assigned_to_email_snapshot),
      'assignment_status', j.assignment_status,
      'assignment_decision_at', j.assignment_decision_at,
      'declined_reason_code', j.declined_reason_code,
      'declined_reason_text', j.declined_reason_text,
      'invoice_sent', j.invoice_sent,
      'invoice_paid', j.invoice_paid,
      'invoice_sent_date', j.invoice_sent_date,
      'invoice_paid_date', j.invoice_paid_date,
      'repair_amount', j.repair_amount,
      'repair_sub_pay', j.repair_sub_pay,
      'cancellation_trip_charge_added', j.cancellation_trip_charge_added,
      'cancellation_trip_charge_bill_amount', j.cancellation_trip_charge_bill_amount,
      'cancellation_trip_charge_sub_pay_amount', j.cancellation_trip_charge_sub_pay_amount,
      'historical_data_mode', j.historical_data_mode,
      'active_snapshot_id', j.active_snapshot_id,
      'snapshot_frozen_at', NULL,
      'snapshot_phase_label', j.snapshot_last_phase_label,
      'unit_size_label_snapshot', v_unit_size_label_snapshot,
      'total_billing_amount', j.total_billing_amount,
      'property', v_property,
      'unit_size', v_unit_size,
      'job_type', v_job_type,
      'job_phase', v_job_phase,
      'job_category', CASE
        WHEN jc.id IS NOT NULL THEN jsonb_build_object(
          'id', jc.id,
          'name', jc.name,
          'description', jc.description
        )
        ELSE NULL
      END,
      'work_order', v_work_order,
      'billing_details', v_billing_details,
      'hourly_billing_details', v_hourly_billing_details,
      'extra_charges_details', v_extra_charges_details,
      'debug_billing_joins', v_debug_info
    )
  INTO v_result
  FROM public.jobs j
  LEFT JOIN public.job_categories jc ON jc.id = j.job_category_id
  LEFT JOIN public.profiles p ON p.id = j.assigned_to
  WHERE j.id = p_job_id;

  RETURN v_result;
END;
$$;

DROP FUNCTION IF EXISTS public.get_job_details(uuid);

CREATE OR REPLACE FUNCTION public.get_job_details(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phase_label text;
  v_phase_id uuid;
  v_phase_color_light text;
  v_phase_color_dark text;
  v_snapshot_id uuid;
  v_snapshot_payload jsonb;
  v_snapshot_frozen_at timestamptz;
  v_live_payload jsonb;
  v_scheduled_end_date date;
  v_trip_charge_added boolean := false;
  v_trip_charge_bill numeric(12,2) := 0;
  v_trip_charge_sub numeric(12,2) := 0;
BEGIN
  SELECT jp.job_phase_label,
         jp.id,
         jp.color_light_mode,
         jp.color_dark_mode,
         j.active_snapshot_id,
         j.scheduled_end_date,
         COALESCE(j.cancellation_trip_charge_added, false),
         COALESCE(j.cancellation_trip_charge_bill_amount, 0),
         COALESCE(j.cancellation_trip_charge_sub_pay_amount, 0)
  INTO v_phase_label,
       v_phase_id,
       v_phase_color_light,
       v_phase_color_dark,
       v_snapshot_id,
       v_scheduled_end_date,
       v_trip_charge_added,
       v_trip_charge_bill,
       v_trip_charge_sub
  FROM public.jobs j
  LEFT JOIN public.job_phases jp ON jp.id = j.current_phase_id
  WHERE j.id = p_job_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF public.is_terminal_job_phase(v_phase_label) THEN
    IF v_snapshot_id IS NULL THEN
      v_snapshot_id := public.create_or_refresh_job_snapshot(
        p_job_id,
        'Automatic terminal job snapshot',
        auth.uid(),
        true
      );
    END IF;

    SELECT snapshot_payload, frozen_at
    INTO v_snapshot_payload, v_snapshot_frozen_at
    FROM public.job_snapshots
    WHERE id = v_snapshot_id;

    IF v_snapshot_payload IS NOT NULL THEN
      RETURN public.decorate_job_payload_with_static_subcontractors(p_job_id, v_snapshot_payload)
        || jsonb_build_object(
          'scheduled_end_date', v_scheduled_end_date,
          'job_phase', jsonb_build_object(
            'id', v_phase_id,
            'label', v_phase_label,
            'job_phase_label', v_phase_label,
            'color_light_mode', v_phase_color_light,
            'color_dark_mode', v_phase_color_dark
          ),
          'cancellation_trip_charge_added', v_trip_charge_added,
          'cancellation_trip_charge_bill_amount', v_trip_charge_bill,
          'cancellation_trip_charge_sub_pay_amount', v_trip_charge_sub,
          'historical_data_mode', 'snapshot',
          'active_snapshot_id', v_snapshot_id,
          'snapshot_frozen_at', v_snapshot_frozen_at,
          'snapshot_phase_label', v_phase_label
        );
    END IF;
  END IF;

  v_live_payload := public.decorate_job_payload_with_static_subcontractors(
    p_job_id,
    public.get_job_details_live(p_job_id)
  );

  RETURN v_live_payload
    || jsonb_build_object(
      'historical_data_mode', 'live',
      'active_snapshot_id', NULL,
      'snapshot_frozen_at', NULL,
      'snapshot_phase_label', NULL
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_job_details_live(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_job_details(uuid) TO authenticated;
