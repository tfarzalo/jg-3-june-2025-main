-- Fix get_job_details function to include ap_name and ap_email fields
-- This ensures the property object includes the AP contact information

-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS get_job_details(uuid);

-- Create the updated function with AP contact fields
CREATE OR REPLACE FUNCTION get_job_details(p_job_id UUID)
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
    v_billing_category_id UUID;
    v_hourly_billing_category_id UUID;
    v_debug_info JSON;
    v_billing_details JSON;
    v_hourly_billing_details JSON;
    v_extra_charges_details JSON;
    v_error_info JSON;
    v_job_category_name TEXT;
    v_regular_bill_amount NUMERIC;
    v_regular_sub_pay_amount NUMERIC;
    v_hourly_bill_amount NUMERIC;
    v_hourly_sub_pay_amount NUMERIC;
    v_regular_billing_record JSON;
    v_hourly_billing_record JSON;
    v_billing_category_name TEXT;
    v_regular_billing_count INTEGER;
    v_hourly_billing_count INTEGER;
    v_property_billing_count INTEGER;
    v_category_billing_count INTEGER;
    v_unit_size_billing_count INTEGER;
    v_billing_category_exists BOOLEAN;
    v_unit_size_exists BOOLEAN;
    v_matching_billing_categories JSON;
    v_extra_charges_hours NUMERIC;
    v_extra_charges_description TEXT;
BEGIN
    -- Get the property_id, category_id, and unit_size_id for the job
    SELECT 
        j.property_id,
        bc.id,
        j.unit_size_id
    INTO 
        v_property_id,
        v_category_id,
        v_unit_size_id
    FROM jobs j
    LEFT JOIN work_orders wo ON wo.job_id = j.id
    LEFT JOIN job_categories jc ON wo.job_category_id = jc.id
    LEFT JOIN billing_categories bc ON bc.name = jc.name
    WHERE j.id = p_job_id;

    -- Get the job details with property information including AP contact fields
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
            'ap_name', p.ap_name,
            'ap_email', p.ap_email,
            'quickbooks_number', p.quickbooks_number,
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
                'job_category_id', wo.job_category_id,
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
            FROM work_orders wo
            WHERE wo.job_id = j.id
            LIMIT 1
        )
    )
    INTO v_result
    FROM jobs j
    LEFT JOIN properties p ON j.property_id = p.id
    LEFT JOIN unit_sizes us ON j.unit_size_id = us.id
    LEFT JOIN job_types jt ON j.job_type_id = jt.id
    LEFT JOIN job_phases jp ON j.current_phase_id = jp.id
    WHERE j.id = p_job_id;

    RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_job_details(uuid) TO authenticated;
