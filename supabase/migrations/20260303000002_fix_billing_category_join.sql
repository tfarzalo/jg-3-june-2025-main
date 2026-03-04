-- billing_categories has no property_id; property scoping must go through billing_details(property_id)

-- Important: drop the old signature first so we can change the return type/shape
DROP FUNCTION IF EXISTS public.get_job_details(uuid);

CREATE OR REPLACE FUNCTION public.get_job_details(p_job_id uuid)
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
  -- Core job attributes
  SELECT 
    j.property_id,
    j.job_category_id,
    j.unit_size_id,
    jc.name
  INTO 
    v_property_id,
    v_category_id,
    v_unit_size_id,
    v_job_category_name
  FROM jobs j
  LEFT JOIN job_categories jc ON jc.id = j.job_category_id
  WHERE j.id = p_job_id;

  -- Extra charges captured on active work order
  SELECT 
    wo.extra_hours,
    wo.extra_charges_description
  INTO 
    v_extra_charges_hours,
    v_extra_charges_description
  FROM work_orders wo
  WHERE wo.job_id = p_job_id
    AND wo.is_active = true;

  -- Resolve billing category scoped by property through billing_details
  SELECT 
    bc.id,
    bc.name
  INTO 
    v_billing_category_id,
    v_billing_category_name
  FROM billing_categories bc
  JOIN billing_details bd ON bd.category_id = bc.id
  WHERE bd.property_id = v_property_id
    AND bc.name = v_job_category_name
  LIMIT 1;

  -- Find hourly billing category (is_hourly = true) scoped to property
  SELECT 
    bd.category_id
  INTO 
    v_hourly_billing_category_id
  FROM billing_details bd
  JOIN billing_categories bc ON bc.id = bd.category_id
  WHERE bd.property_id = v_property_id
    AND bc.name = v_job_category_name
    AND bd.is_hourly = true
  LIMIT 1;

  v_billing_category_exists := v_billing_category_id IS NOT NULL;
  v_unit_size_exists := v_unit_size_id IS NOT NULL;

  -- Regular billing (is_hourly = false)
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
        'unit_size_id', bd.unit_size_id
      )
    ),
    COUNT(*)
  INTO 
    v_regular_billing_record,
    v_regular_billing_count
  FROM billing_details bd
  WHERE bd.category_id = v_billing_category_id
    AND bd.unit_size_id = v_unit_size_id
    AND bd.is_hourly = false
  GROUP BY bd.bill_amount, bd.sub_pay_amount, bd.is_hourly, bd.category_id, bd.unit_size_id
  LIMIT 1;

  -- Hourly billing (is_hourly = true)
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
        'unit_size_id', bd.unit_size_id
      )
    ),
    COUNT(*)
  INTO 
    v_hourly_billing_record,
    v_hourly_billing_count
  FROM billing_details bd
  WHERE bd.category_id = v_billing_category_id
    AND bd.unit_size_id = v_unit_size_id
    AND bd.is_hourly = true
  GROUP BY bd.bill_amount, bd.sub_pay_amount, bd.is_hourly, bd.category_id, bd.unit_size_id
  LIMIT 1;

  v_regular_bill_amount := COALESCE((v_regular_billing_record->>'bill_amount')::numeric, 0);
  v_regular_sub_pay_amount := COALESCE((v_regular_billing_record->>'sub_pay_amount')::numeric, 0);
  v_hourly_bill_amount := CASE WHEN v_hourly_billing_record IS NOT NULL THEN (v_hourly_billing_record->>'bill_amount')::numeric ELSE NULL END;
  v_hourly_sub_pay_amount := CASE WHEN v_hourly_billing_record IS NOT NULL THEN (v_hourly_billing_record->>'sub_pay_amount')::numeric ELSE NULL END;

  -- Matching categories (for debugging visibility)
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', bc.id,
      'name', bc.name,
      'property_id', bd.property_id
    )
  )
  INTO v_matching_billing_categories
  FROM billing_categories bc
  JOIN billing_details bd ON bd.category_id = bc.id
  WHERE bd.property_id = v_property_id
    AND bc.name = v_job_category_name;

  -- Build regular billing details payload
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
          'raw_record', v_regular_billing_record,
          'record_count', v_regular_billing_count,
          'query_params', jsonb_build_object(
            'property_id', v_property_id,
            'billing_category_id', v_billing_category_id,
            'unit_size_id', v_unit_size_id,
            'is_hourly', false
          )
        )
      )
    ELSE
      NULL
  END;

  -- Build hourly billing details payload
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
          'raw_record', v_hourly_billing_record,
          'record_count', v_hourly_billing_count,
          'query_params', jsonb_build_object(
            'property_id', v_property_id,
            'billing_category_id', v_billing_category_id,
            'unit_size_id', v_unit_size_id,
            'is_hourly', true
          )
        )
      )
    ELSE
      NULL
  END;

  -- Extra charges based on hours (legacy path)
  v_extra_charges_details := CASE 
    WHEN v_extra_charges_hours > 0 THEN
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
    ELSE
      NULL
  END;

  -- Debug info for support
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

  -- Active work order payload (includes extra charge line items if present)
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
      'is_active', wo.is_active
    )
    INTO v_work_order
  FROM work_orders wo
  LEFT JOIN job_categories jc ON jc.id = wo.job_category_id
  LEFT JOIN profiles u ON u.id = wo.prepared_by
  WHERE wo.job_id = p_job_id
    AND wo.is_active = true
  ORDER BY wo.created_at DESC
  LIMIT 1;

  -- Property payload
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
  FROM properties p
  WHERE p.id = v_property_id;

  -- Unit size payload
  SELECT jsonb_build_object(
      'id', us.id,
      'label', us.unit_size_label
    )
    INTO v_unit_size
  FROM unit_sizes us
  WHERE us.id = v_unit_size_id;

  -- Job type payload
  SELECT jsonb_build_object(
      'id', jt.id,
      'label', jt.job_type_label
    )
    INTO v_job_type
  FROM job_types jt
  JOIN jobs j ON j.job_type_id = jt.id
  WHERE j.id = p_job_id;

  -- Job phase payload with colors
  SELECT jsonb_build_object(
      'id', jp.id,
      'label', jp.job_phase_label,
      'color_light_mode', jp.color_light_mode,
      'color_dark_mode', jp.color_dark_mode
    )
    INTO v_job_phase
  FROM job_phases jp
  JOIN jobs j ON j.current_phase_id = jp.id
  WHERE j.id = p_job_id;

  -- Final result with nested property/work_order and billing payloads
  SELECT jsonb_build_object(
      'id', j.id,
      'work_order_num', j.work_order_num,
      'unit_number', j.unit_number,
      'description', j.description,
      'scheduled_date', j.scheduled_date,
      'purchase_order', j.purchase_order,
      'is_occupied', j.is_occupied,
      -- Source from active work order (jobs table no longer stores this)
        'is_full_paint', (v_work_order ->> 'is_full_paint')::boolean,
        'assigned_to', j.assigned_to,
        'assigned_to_name', COALESCE(p.full_name, p.email, NULL),
      'assignment_status', j.assignment_status,
      'assignment_decision_at', j.assignment_decision_at,
      'declined_reason_code', j.declined_reason_code,
      'declined_reason_text', j.declined_reason_text,
      'invoice_sent', j.invoice_sent,
      'invoice_paid', j.invoice_paid,
      'invoice_sent_date', j.invoice_sent_date,
      'invoice_paid_date', j.invoice_paid_date,
      'property', v_property,
      'unit_size', v_unit_size,
      'job_type', v_job_type,
      'job_phase', v_job_phase,
      'job_category', jsonb_build_object(
        'id', jc.id,
        'name', jc.name,
        'description', jc.description
      ),
      'work_order', v_work_order,
      'billing_details', v_billing_details,
      'hourly_billing_details', v_hourly_billing_details,
      'extra_charges_details', v_extra_charges_details,
      'debug_billing_joins', v_debug_info
    )
    INTO v_result
  FROM jobs j
    LEFT JOIN job_categories jc ON jc.id = j.job_category_id
    LEFT JOIN profiles p ON p.id = j.assigned_to
    WHERE j.id = p_job_id;

  RETURN v_result;
END;
$$;
