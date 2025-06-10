CREATE OR REPLACE FUNCTION get_job_details(job_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result json;
BEGIN
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
        )
    ) INTO result
    FROM jobs j
    LEFT JOIN properties p ON j.property_id = p.id
    LEFT JOIN unit_sizes us ON j.unit_size_id = us.id
    LEFT JOIN job_types jt ON j.job_type_id = jt.id
    LEFT JOIN job_phases jp ON j.current_phase_id = jp.id
    WHERE j.id = job_id;

    RETURN result;
END;
$$; 