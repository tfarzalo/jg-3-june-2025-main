-- Drop the existing function first
DROP FUNCTION IF EXISTS get_job_details(uuid);

-- Create the updated function
CREATE OR REPLACE FUNCTION get_job_details(job_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result json;
    v_property_id uuid;
    v_category_id uuid;
    v_unit_size_id uuid;
BEGIN
    -- Get the job's property, category, and unit size IDs
    SELECT j.property_id, bc.id, j.unit_size_id
    INTO v_property_id, v_category_id, v_unit_size_id
    FROM jobs j
    LEFT JOIN work_orders wo_main ON wo_main.job_id = j.id
    LEFT JOIN job_categories jc ON wo_main.job_category_id = jc.id
    LEFT JOIN billing_categories bc ON bc.name = jc.name
    WHERE j.id = job_id;

    SELECT json_build_object(
        'id', j.id,
        'work_order_num', j.work_order_num,
        'unit_number', j.unit_number,
        'description', j.description,
        'scheduled_date', j.scheduled_date,
        'property', json_build_object(
            'id', p.id,
            'name', p.property_name,
            'address', p.address,
            'address_2', p.address_2,
            'city', p.city,
            'state', p.state,
            'zip', p.zip
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
            'label', jp.job_phase_label,
            'color_light_mode', jp.color_light_mode,
            'color_dark_mode', jp.color_dark_mode,
            'sort_order', jp.sort_order,
            'order_index', jp.order_index
        ),
        'work_order', (
            SELECT json_build_object(
                'id', wo.id,
                'submission_date', wo.submission_date,
                'unit_number', wo.unit_number,
                'is_occupied', wo.is_occupied,
                'is_full_paint', wo.is_full_paint,
                'unit_size', wo.unit_size,
                'paint_type', wo.paint_type,
                'has_sprinklers', wo.has_sprinklers,
                'sprinklers_painted', wo.sprinklers_painted,
                'sprinkler_photo_path', wo.sprinkler_photo_path,
                'sprinkler_head_photo_path', wo.sprinkler_head_photo_path,
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
                'additional_comments', wo.additional_comments,
                'bill_amount', wo.bill_amount,
                'sub_pay_amount', wo.sub_pay_amount,
                'profit_amount', wo.profit_amount,
                'is_hourly', wo.is_hourly
            )
            FROM work_orders wo
            WHERE wo.job_id = j.id
            LIMIT 1
        ),
        'billing_details', json_build_object(
             'bill_amount', bd.bill_amount,
             'sub_pay_amount', bd.sub_pay_amount,
             'profit_amount', bd.profit_amount,
             'is_hourly', bd.is_hourly
        ),
        'hourly_billing_details', (
            SELECT json_build_object(
                'bill_amount', bd_hr.bill_amount,
                'sub_pay_amount', bd_hr.sub_pay_amount,
                'profit_amount', bd_hr.profit_amount,
                'is_hourly', bd_hr.is_hourly
            )
            FROM billing_details bd_hr
            WHERE bd_hr.property_id = v_property_id
              AND bd_hr.category_id = v_category_id
              AND bd_hr.unit_size_id = v_unit_size_id
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
    ) INTO result
    FROM jobs j
    LEFT JOIN properties p ON j.property_id = p.id
    LEFT JOIN unit_sizes us ON j.unit_size_id = us.id
    LEFT JOIN job_types jt ON j.job_type_id = jt.id
    LEFT JOIN job_phases jp ON j.current_phase_id = jp.id
    LEFT JOIN work_orders wo_main ON wo_main.job_id = j.id
    LEFT JOIN job_categories jc ON wo_main.job_category_id = jc.id
    LEFT JOIN billing_categories bc ON bc.name = jc.name
    LEFT JOIN billing_details bd ON bd.property_id = j.property_id AND bd.category_id = bc.id AND bd.unit_size_id = j.unit_size_id
    WHERE j.id = job_id;

    RETURN result;
END;
$$; 