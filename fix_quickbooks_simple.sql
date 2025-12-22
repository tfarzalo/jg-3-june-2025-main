-- Simple fix to add quickbooks_number to get_job_details function
-- This will replace the current function

CREATE OR REPLACE FUNCTION public.get_job_details(p_job_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Get job details with proper job phase colors and quickbooks_number
  SELECT json_build_object(
    'id', j.id,
    'work_order_num', j.work_order_num,
    'unit_number', j.unit_number,
    'description', j.description,
    'scheduled_date', j.scheduled_date,
    'assigned_to', j.assigned_to,
    'property', json_build_object(
      'id', p.id, 
      'name', p.property_name,
      'address', p.address, 
      'address_2', p.address_2,
      'city', p.city, 
      'state', p.state, 
      'zip', p.zip,
      'ap_email', p.ap_email,
      'quickbooks_number', p.quickbooks_number
    ),
    'unit_size', json_build_object('id', us.id, 'label', us.unit_size_label),
    'job_type', json_build_object('id', jt.id, 'label', jt.job_type_label),
    'job_phase', json_build_object(
      'id', jp.id,
      'label', jp.job_phase_label,
      'name', jp.job_phase_label,  -- alias for legacy UI
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
        'additional_comments', wo.additional_comments,
        'is_active', wo.is_active
      )
      FROM public.work_orders wo
      LEFT JOIN public.job_categories jc ON jc.id = wo.job_category_id
      WHERE wo.job_id = j.id AND wo.is_active = true
    ),
    'billing_details', json_build_object(
      'bill_amount', 0,
      'sub_pay_amount', 0,
      'profit_amount', 0,
      'is_hourly', false
    ),
    'hourly_billing_details', json_build_object(
      'bill_amount', 0,
      'sub_pay_amount', 0,
      'profit_amount', 0,
      'is_hourly', true
    ),
    'extra_charges_details', null
  )
  INTO v_result
  FROM public.jobs j
  LEFT JOIN public.properties p ON p.id = j.property_id
  LEFT JOIN public.unit_sizes us ON us.id = j.unit_size_id
  LEFT JOIN public.job_types jt ON jt.id = j.job_type_id
  LEFT JOIN public.job_phases jp ON jp.id = j.current_phase_id
  WHERE j.id = p_job_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_job_details(UUID) TO authenticated;
