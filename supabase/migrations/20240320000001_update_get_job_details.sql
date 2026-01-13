-- Update the get_job_details function to properly handle category_id
CREATE OR REPLACE FUNCTION get_job_details(job_id UUID)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
    v_result json;
    v_property_id UUID;
    v_category_id UUID;
    v_unit_size_id UUID;
BEGIN
    -- Get the property_id, category_id, and unit_size_id for the job
    SELECT 
        j.property_id,
        wo.job_category_id,
        j.unit_size_id
    INTO 
        v_property_id,
        v_category_id,
        v_unit_size_id
    FROM jobs j
    LEFT JOIN work_orders wo ON wo.job_id = j.id
    WHERE j.id = job_id;

    -- Build the result object
    SELECT json_build_object(
        'id', j.id,
        'work_order_num', j.work_order_num,
        'unit_number', j.unit_number,
        'description', j.description,
        'scheduled_date', j.scheduled_date,
        'assigned_to', j.assigned_to,
        'assigned_to_name', p.full_name,
        'property', json_build_object(
            'id', p.id,
            'name', p.property_name,
            'address', p.address,
            'address_2', p.address_2,
            'city', p.city,
            'state', p.state,
            'zip', p.zip,
            'ap_name', p.ap_name,
            'ap_email', p.ap_email,
            'is_archived', p.is_archived
        ),
        'unit_size', json_build_object(
            'id', us.id,
            'label', us.unit_size_label
        ),
        'job_type', json_build_object(
            'id', jt.id,
            'label', jt.job_type_label
        ),
        'job_phase', json_build_object(
            'id', jp.id,
            'job_phase_label', jp.job_phase_label,
            'color_light_mode', jp.color_light_mode,
            'color_dark_mode', jp.color_dark_mode
        ),
        'work_order', (
            SELECT json_build_object(
                'id', wo.id,
                'submission_date', wo.submission_date,
                'is_occupied', wo.is_occupied,
                'is_full_paint', wo.is_full_paint,
                'job_category', jc.name,
                'job_category_id', jc.id,
                'has_sprinklers', wo.has_sprinklers,
                'sprinklers_painted', wo.sprinklers_painted,
                'painted_ceilings', wo.painted_ceilings,
                'ceiling_rooms_count', wo.ceiling_rooms_count,
                'painted_patio', wo.painted_patio,
                'painted_garage', wo.painted_garage,
                'painted_cabinets', wo.painted_cabinets,
                'painted_crown_molding', wo.painted_crown_molding,
                'painted_front_door', wo.painted_front_door,
                'has_accent_wall', wo.has_accent_wall,
                'accent_wall_type', wo.accent_wall_type,
                'accent_wall_count', wo.accent_wall_count,
                'has_extra_charges', wo.has_extra_charges,
                'extra_charges_description', wo.extra_charges_description,
                'extra_hours', wo.extra_hours,
                'additional_comments', wo.additional_comments
            )
            FROM work_orders wo
            LEFT JOIN job_categories jc ON jc.id = wo.job_category_id
            WHERE wo.job_id = j.id
        ),
        'billing_details', (
            SELECT json_build_object(
                'id', bd.id,
                'bill_amount', bd.bill_amount,
                'sub_pay_amount', bd.sub_pay_amount,
                'profit_amount', bd.profit_amount,
                'is_hourly', bd.is_hourly,
                'category_id', bd.category_id,
                'unit_size', json_build_object(
                    'id', us_bd.id,
                    'label', us_bd.unit_size_label
                )
            )
            FROM billing_details bd
            JOIN unit_sizes us_bd ON us_bd.id = bd.unit_size_id
            WHERE bd.property_id = j.property_id
            AND bd.category_id = v_category_id
            AND bd.unit_size_id = j.unit_size_id
            AND bd.is_hourly = false
            LIMIT 1
        ),
        'hourly_billing_details', (
            SELECT json_build_object(
                'id', bd_hr.id,
                'bill_amount', bd_hr.bill_amount,
                'sub_pay_amount', bd_hr.sub_pay_amount,
                'profit_amount', bd_hr.profit_amount,
                'is_hourly', bd_hr.is_hourly,
                'category_id', bd_hr.category_id,
                'unit_size', json_build_object(
                    'id', us_hr.id,
                    'label', us_hr.unit_size_label
                )
            )
            FROM billing_details bd_hr
            JOIN unit_sizes us_hr ON us_hr.id = bd_hr.unit_size_id
            WHERE bd_hr.property_id = j.property_id
            AND bd_hr.category_id = v_category_id
            AND bd_hr.unit_size_id = j.unit_size_id
            AND bd_hr.is_hourly = true
            LIMIT 1
        ),
        'debug_billing_joins', json_build_object(
            'property_id', j.property_id,
            'work_order_job_category_id', wo_main.job_category_id,
            'billing_category_id', v_category_id,
            'billing_category_name', bc.name,
            'job_unit_size_id', j.unit_size_id,
            'billing_details_id', bd.id,
            'billing_details_bill_amount', bd.bill_amount,
            'billing_details_sub_pay_amount', bd.sub_pay_amount,
            'billing_details_profit_amount', bd.profit_amount,
            'billing_details_is_hourly', bd.is_hourly
        )
    ) INTO v_result
    FROM jobs j
    LEFT JOIN properties p ON p.id = j.property_id
    LEFT JOIN unit_sizes us ON us.id = j.unit_size_id
    LEFT JOIN job_types jt ON jt.id = j.job_type_id
    LEFT JOIN job_phases jp ON jp.id = j.current_phase_id
    LEFT JOIN work_orders wo_main ON wo_main.job_id = j.id
    LEFT JOIN job_categories jc ON wo_main.job_category_id = jc.id
    LEFT JOIN billing_categories bc ON bc.name = jc.name
    LEFT JOIN billing_details bd ON bd.property_id = j.property_id 
        AND bd.category_id = bc.id 
        AND bd.unit_size_id = j.unit_size_id
    WHERE j.id = job_id;

    RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_job_details TO authenticated;

-- Enable the function for RPC
ALTER FUNCTION get_job_details(UUID) SET search_path = public; 