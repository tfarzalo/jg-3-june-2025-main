-- Update get_job_details function to include invoice status fields
CREATE OR REPLACE FUNCTION public.get_job_details(p_job_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
  v_property_id UUID;
  v_category_id UUID;
  v_unit_size_id UUID;
  v_job_category_name TEXT;
  v_extra_charges_hours INTEGER;
  v_extra_charges_description TEXT;
  v_billing_category_id UUID;
  v_billing_category_name TEXT;
  v_hourly_billing_category_id UUID;
  v_billing_category_exists BOOLEAN;
  v_unit_size_exists BOOLEAN;
  v_regular_billing_record JSON;
  v_hourly_billing_record JSON;
  v_regular_billing_count INTEGER;
  v_hourly_billing_count INTEGER;
  v_regular_bill_amount NUMERIC;
  v_regular_sub_pay_amount NUMERIC;
  v_hourly_bill_amount NUMERIC;
  v_hourly_sub_pay_amount NUMERIC;
  v_matching_billing_categories JSON;
  v_billing_details JSON;
  v_hourly_billing_details JSON;
  v_extra_charges_details JSON;
  v_debug_info JSON;
BEGIN
  -- Core ids
  SELECT j.property_id, jc.id, j.unit_size_id, jc.name
  INTO v_property_id, v_category_id, v_unit_size_id, v_job_category_name
  FROM public.jobs j
  LEFT JOIN public.work_orders wo ON wo.job_id = j.id AND wo.is_active = true
  LEFT JOIN public.job_categories jc ON jc.id = wo.job_category_id
  WHERE j.id = p_job_id;

  -- Active WO extra charges
  SELECT wo.extra_hours, wo.extra_charges_description
  INTO v_extra_charges_hours, v_extra_charges_description
  FROM public.work_orders wo
  WHERE wo.job_id = p_job_id AND wo.is_active = true;

  -- Existence helpers
  v_billing_category_exists := EXISTS (
    SELECT 1 FROM public.billing_categories
    WHERE name = v_job_category_name AND property_id = v_property_id
  );

  v_unit_size_exists := EXISTS (
    SELECT 1 FROM public.unit_sizes WHERE id = v_unit_size_id
  );

  -- Category ids
  SELECT id INTO v_billing_category_id
  FROM public.billing_categories
  WHERE name = v_job_category_name AND property_id = v_property_id;

  SELECT id INTO v_hourly_billing_category_id
  FROM public.billing_categories
  WHERE name = 'Extra Charges' AND property_id = v_property_id;

  -- Regular (base) billing record
  SELECT
    json_build_object(
      'id', bd.id,
      'bill_amount', bd.bill_amount,
      'sub_pay_amount', bd.sub_pay_amount,
      'profit_amount', bd.profit_amount,
      'is_hourly', bd.is_hourly
    )
  INTO v_regular_billing_record
  FROM public.billing_details bd
  WHERE bd.property_id = v_property_id
    AND bd.category_id = v_billing_category_id
    AND bd.unit_size_id = v_unit_size_id
    AND bd.is_hourly = false
  LIMIT 1;

  -- Count regular billing records
  SELECT COUNT(*)
  INTO v_regular_billing_count
  FROM public.billing_details bd
  WHERE bd.property_id = v_property_id
    AND bd.category_id = v_billing_category_id
    AND bd.unit_size_id = v_unit_size_id
    AND bd.is_hourly = false;

  -- Hourly (extra charges) record
  SELECT
    json_build_object(
      'id', bd.id,
      'bill_amount', bd.bill_amount,
      'sub_pay_amount', bd.sub_pay_amount,
      'profit_amount', bd.profit_amount,
      'is_hourly', bd.is_hourly
    )
  INTO v_hourly_billing_record
  FROM public.billing_details bd
  WHERE bd.property_id = v_property_id
    AND bd.category_id = v_hourly_billing_category_id
    AND bd.unit_size_id = v_unit_size_id
    AND bd.is_hourly = true
  LIMIT 1;

  -- Count hourly billing records
  SELECT COUNT(*)
  INTO v_hourly_billing_count
  FROM public.billing_details bd
  WHERE bd.property_id = v_property_id
    AND bd.category_id = v_hourly_billing_category_id
    AND bd.unit_size_id = v_unit_size_id
    AND bd.is_hourly = true;

  v_regular_bill_amount := COALESCE((v_regular_billing_record->>'bill_amount')::NUMERIC, 0);
  v_regular_sub_pay_amount := COALESCE((v_regular_billing_record->>'sub_pay_amount')::NUMERIC, 0);
  v_hourly_bill_amount := COALESCE((v_hourly_billing_record->>'bill_amount')::NUMERIC, 0);
  v_hourly_sub_pay_amount := COALESCE((v_hourly_billing_record->>'sub_pay_amount')::NUMERIC, 0);

  v_billing_details := json_build_object(
    'bill_amount', v_regular_bill_amount,
    'sub_pay_amount', v_regular_sub_pay_amount,
    'profit_amount', v_regular_bill_amount - v_regular_sub_pay_amount,
    'is_hourly', false
  );

  v_hourly_billing_details := json_build_object(
    'bill_amount', v_hourly_bill_amount,
    'sub_pay_amount', v_hourly_sub_pay_amount,
    'profit_amount', v_hourly_bill_amount - v_hourly_sub_pay_amount,
    'is_hourly', true
  );

  v_extra_charges_details := CASE
    WHEN v_extra_charges_hours > 0 AND v_hourly_bill_amount > 0 THEN
      json_build_object(
        'description', v_extra_charges_description,
        'hours', v_extra_charges_hours,
        'hourly_rate', v_hourly_bill_amount,
        'sub_pay_rate', v_hourly_sub_pay_amount,
        'bill_amount', v_extra_charges_hours * v_hourly_bill_amount,
        'sub_pay_amount', v_extra_charges_hours * v_hourly_sub_pay_amount,
        'profit_amount', v_extra_charges_hours * (v_hourly_bill_amount - v_hourly_sub_pay_amount),
        'is_hourly', true
      )
    ELSE NULL
  END;

  -- Final result with backward-compatible fields and embedded chosen billing details
  v_result := (
    SELECT json_build_object(
      'id', j.id,
      'work_order_num', j.work_order_num,
      'unit_number', j.unit_number,
      'description', j.description,
      'scheduled_date', j.scheduled_date,
      'assigned_to', j.assigned_to,
      'invoice_sent', j.invoice_sent,
      'invoice_paid', j.invoice_paid,
      'invoice_sent_date', j.invoice_sent_date,
      'invoice_paid_date', j.invoice_paid_date,
      'property', json_build_object(
        'id', p.id, 'name', p.property_name,
        'address', p.address, 'address_2', p.address_2,
        'city', p.city, 'state', p.state, 'zip', p.zip,
        'ap_email', p.ap_email,
        'quickbooks_number', p.quickbooks_number
      ),
      'unit_size', json_build_object('id', us.id, 'label', us.unit_size_label),
      'job_type', json_build_object('id', jt.id, 'label', jt.job_type_label),
      'job_phase', json_build_object(
        'id', jp.id,
        'label', jp.job_phase_label,
        'name',  jp.job_phase_label,  -- alias for any legacy UI expecting `name`
        'color_light_mode', jp.color_light_mode,
        'color_dark_mode', jp.color_dark_mode
      ),
      'work_order', (
        SELECT json_build_object(
          'id', wo.id,
          'submission_date', wo.submission_date,
          'unit_number', wo.unit_number,
          'is_occupied', wo.is_occupied,
          'is_full_paint', wo.is_full_paint,
          'unit_size', wo.unit_size,
          'job_category', jc.name,
          'job_category_id', jc.id,
          'has_sprinklers', wo.has_sprinklers,
          'sprinklers_painted', wo.sprinklers_painted,
          'painted_ceilings', wo.painted_ceilings,
          'ceiling_rooms_count', wo.ceiling_rooms_count,
          'individual_ceiling_count', wo.individual_ceiling_count,
          'ceiling_display_label', wo.ceiling_display_label,
          'ceiling_billing_detail_id', wo.ceiling_billing_detail_id,
          'ceiling_billing_detail', CASE WHEN wo.ceiling_billing_detail_id IS NOT NULL THEN (
              SELECT json_build_object(
                'id', bd.id,
                'bill_amount', bd.bill_amount,
                'sub_pay_amount', bd.sub_pay_amount
              ) FROM public.billing_details bd
              WHERE bd.id = wo.ceiling_billing_detail_id
            ) ELSE NULL END,
          'painted_patio', wo.painted_patio,
          'painted_garage', wo.painted_garage,
          'painted_cabinets', wo.painted_cabinets,
          'painted_crown_molding', wo.painted_crown_molding,
          'painted_front_door', wo.painted_front_door,
          'has_accent_wall', wo.has_accent_wall,
          'accent_wall_type', wo.accent_wall_type,
          'accent_wall_count', wo.accent_wall_count,
          'accent_wall_billing_detail_id', wo.accent_wall_billing_detail_id,
          'accent_wall_billing_detail', CASE WHEN wo.accent_wall_billing_detail_id IS NOT NULL THEN (
              SELECT json_build_object(
                'id', bd2.id,
                'bill_amount', bd2.bill_amount,
                'sub_pay_amount', bd2.sub_pay_amount
              ) FROM public.billing_details bd2
              WHERE bd2.id = wo.accent_wall_billing_detail_id
            ) ELSE NULL END,
          'has_extra_charges', wo.has_extra_charges,
          'extra_charges_description', wo.extra_charges_description,
          'extra_hours', wo.extra_hours,
          'additional_comments', wo.additional_comments,
          'is_active', wo.is_active
        )
        FROM public.work_orders wo
        LEFT JOIN public.job_categories jc ON jc.id = wo.job_category_id
        WHERE wo.job_id = j.id AND wo.is_active = true
      ),
      'billing_details', v_billing_details,
      'hourly_billing_details', v_hourly_billing_details,
      'extra_charges_details', v_extra_charges_details
    )
    FROM public.jobs j
    LEFT JOIN public.properties p ON p.id = j.property_id
    LEFT JOIN public.unit_sizes us ON us.id = j.unit_size_id
    LEFT JOIN public.job_types jt ON jt.id = j.job_type_id
    LEFT JOIN public.job_phases jp ON jp.id = j.current_phase_id
    WHERE j.id = p_job_id
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_job_details(UUID) TO authenticated;
