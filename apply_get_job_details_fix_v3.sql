-- Apply the get_job_details function fix - Version 3
-- This script fixes the GROUP BY clause issue

-- Drop and recreate the function with the corrected query structure
DROP FUNCTION IF EXISTS get_job_details(UUID);

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
    v_error_info JSON;
BEGIN
    -- Get the job's property, category, and unit size IDs
    SELECT 
        j.property_id,
        jc.id,
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

    -- Get extra charges information from the active work order
    SELECT 
        wo.extra_hours,
        wo.extra_charges_description
    INTO 
        v_extra_charges_hours,
        v_extra_charges_description
    FROM work_orders wo
    WHERE wo.job_id = p_job_id
    AND wo.is_active = true;

    -- Get billing category information (regular billing)
    SELECT 
        bc.id,
        bc.name
    INTO 
        v_billing_category_id,
        v_billing_category_name
    FROM billing_categories bc
    WHERE bc.property_id = v_property_id
    AND bc.name = v_job_category_name;

    -- Get hourly billing category information
    -- Look for billing_details with is_hourly = true for this category
    SELECT 
        bd.category_id
    INTO 
        v_hourly_billing_category_id
    FROM billing_details bd
    JOIN billing_categories bc ON bc.id = bd.category_id
    WHERE bc.property_id = v_property_id
    AND bc.name = v_job_category_name
    AND bd.is_hourly = true
    LIMIT 1;

    -- Check if billing category and unit size exist
    v_billing_category_exists := v_billing_category_id IS NOT NULL;
    v_unit_size_exists := v_unit_size_id IS NOT NULL;

    -- Get regular billing details (is_hourly = false) - separate queries to avoid GROUP BY issues
    SELECT 
        json_build_object(
            'bill_amount', bd.bill_amount,
            'sub_pay_amount', bd.sub_pay_amount,
            'profit_amount', bd.bill_amount - bd.sub_pay_amount,
            'is_hourly', bd.is_hourly,
            'display_order', 1,
            'section_name', 'Base Billing'
        )
    INTO v_regular_billing_record
    FROM billing_details bd
    WHERE bd.property_id = v_property_id
    AND bd.category_id = v_billing_category_id
    AND bd.unit_size_id = v_unit_size_id
    AND bd.is_hourly = false
    LIMIT 1;

    -- Get count of regular billing records
    SELECT COUNT(*)
    INTO v_regular_billing_count
    FROM billing_details bd
    WHERE bd.property_id = v_property_id
    AND bd.category_id = v_billing_category_id
    AND bd.unit_size_id = v_unit_size_id
    AND bd.is_hourly = false;

    -- Get hourly billing details (is_hourly = true) - separate queries to avoid GROUP BY issues
    SELECT 
        json_build_object(
            'bill_amount', bd.bill_amount,
            'sub_pay_amount', bd.sub_pay_amount,
            'profit_amount', bd.bill_amount - bd.sub_pay_amount,
            'is_hourly', bd.is_hourly,
            'display_order', 2,
            'section_name', 'Hourly Billing'
        )
    INTO v_hourly_billing_record
    FROM billing_details bd
    WHERE bd.property_id = v_property_id
    AND bd.category_id = v_billing_category_id
    AND bd.unit_size_id = v_unit_size_id
    AND bd.is_hourly = true
    LIMIT 1;

    -- Get count of hourly billing records
    SELECT COUNT(*)
    INTO v_hourly_billing_count
    FROM billing_details bd
    WHERE bd.property_id = v_property_id
    AND bd.category_id = v_billing_category_id
    AND bd.unit_size_id = v_unit_size_id
    AND bd.is_hourly = true;

    -- Extract amounts from records
    IF v_regular_billing_record IS NOT NULL THEN
        v_regular_bill_amount := (v_regular_billing_record->>'bill_amount')::NUMERIC;
        v_regular_sub_pay_amount := (v_regular_billing_record->>'sub_pay_amount')::NUMERIC;
    END IF;

    IF v_hourly_billing_record IS NOT NULL THEN
        v_hourly_bill_amount := (v_hourly_billing_record->>'bill_amount')::NUMERIC;
        v_hourly_sub_pay_amount := (v_hourly_billing_record->>'sub_pay_amount')::NUMERIC;
    END IF;

    -- Get matching billing categories for debug
    SELECT json_agg(
        json_build_object(
            'id', bc.id,
            'name', bc.name,
            'property_id', bc.property_id
        )
    )
    INTO v_matching_billing_categories
    FROM billing_categories bc
    WHERE bc.property_id = v_property_id
    AND bc.name = v_job_category_name;

    -- Build billing details
    v_billing_details := CASE 
        WHEN v_regular_billing_record IS NOT NULL THEN
            json_build_object(
                'bill_amount', v_regular_bill_amount,
                'sub_pay_amount', v_regular_sub_pay_amount,
                'profit_amount', v_regular_bill_amount - v_regular_sub_pay_amount,
                'is_hourly', false,
                'display_order', 1,
                'section_name', 'Base Billing',
                'debug', json_build_object(
                    'bill_amount', v_regular_bill_amount,
                    'sub_pay_amount', v_regular_sub_pay_amount,
                    'raw_record', v_regular_billing_record,
                    'record_count', v_regular_billing_count,
                    'query_params', json_build_object(
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

    -- Build hourly billing details
    v_hourly_billing_details := CASE 
        WHEN v_hourly_billing_record IS NOT NULL THEN
            json_build_object(
                'bill_amount', v_hourly_bill_amount,
                'sub_pay_amount', v_hourly_sub_pay_amount,
                'profit_amount', v_hourly_bill_amount - v_hourly_sub_pay_amount,
                'is_hourly', true,
                'display_order', 2,
                'section_name', 'Hourly Billing',
                'debug', json_build_object(
                    'bill_amount', v_hourly_bill_amount,
                    'sub_pay_amount', v_hourly_sub_pay_amount,
                    'raw_record', v_hourly_billing_record,
                    'record_count', v_hourly_billing_count,
                    'query_params', json_build_object(
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

    -- Build extra charges details
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
                'is_hourly', true,
                'display_order', 3,
                'section_name', 'Extra Charges',
                'debug', json_build_object(
                    'hourly_bill_amount', v_hourly_bill_amount,
                    'sub_pay_amount', v_hourly_sub_pay_amount,
                    'extra_hours', v_extra_charges_hours,
                    'has_hourly_billing', v_hourly_bill_amount > 0,
                    'raw_hourly_record', v_hourly_billing_record,
                    'billing_category_exists', v_hourly_billing_category_id IS NOT NULL,
                    'unit_size_exists', v_unit_size_exists,
                    'matching_billing_categories', v_matching_billing_categories,
                    'query_params', json_build_object(
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

    -- Build debug information
    v_debug_info := json_build_object(
        'property_id', v_property_id,
        'job_category_id', v_category_id,
        'billing_category_id', v_billing_category_id,
        'billing_category_name', v_billing_category_name,
        'hourly_billing_category_id', v_hourly_billing_category_id,
        'unit_size_id', v_unit_size_id,
        'job_category_name', v_job_category_name,
        'extra_charges', json_build_object(
            'hours', v_extra_charges_hours,
            'description', v_extra_charges_description
        ),
        'billing_counts', json_build_object(
            'property_total', (SELECT COUNT(*) FROM billing_categories WHERE property_id = v_property_id),
            'category_total', (SELECT COUNT(*) FROM billing_categories WHERE name = v_job_category_name),
            'unit_size_total', (SELECT COUNT(*) FROM unit_sizes WHERE id = v_unit_size_id),
            'regular_total', v_regular_billing_count,
            'hourly_total', v_hourly_billing_count
        ),
        'existence_checks', json_build_object(
            'billing_category_exists', v_billing_category_exists,
            'unit_size_exists', v_unit_size_exists,
            'hourly_billing_exists', v_hourly_billing_category_id IS NOT NULL
        ),
        'matching_billing_categories', v_matching_billing_categories,
        'regular_billing', json_build_object(
            'bill_amount', v_regular_bill_amount,
            'sub_pay_amount', v_regular_sub_pay_amount,
            'profit_amount', v_regular_bill_amount - v_regular_sub_pay_amount,
            'raw_record', v_regular_billing_record,
            'record_count', v_regular_billing_count,
            'query_params', json_build_object(
                'property_id', v_property_id,
                'billing_category_id', v_billing_category_id,
                'unit_size_id', v_unit_size_id,
                'is_hourly', false
            )
        ),
        'hourly_billing', json_build_object(
            'bill_amount', v_hourly_bill_amount,
            'sub_pay_amount', v_hourly_sub_pay_amount,
            'profit_amount', v_hourly_bill_amount - v_hourly_sub_pay_amount,
            'raw_record', v_hourly_billing_record,
            'record_count', v_hourly_billing_count,
            'query_params', json_build_object(
                'property_id', v_property_id,
                'billing_category_id', v_billing_category_id,
                'unit_size_id', v_unit_size_id,
                'is_hourly', true
            )
        )
    );

    -- Build the final result
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
            'ap_email', p.ap_email
        ),
        'unit_size', json_build_object(
            'id', us.id,
            'label', us.unit_size_label
        ),
        'job_type', json_build_object(
            'id', jt.id,
            'name', jt.name
        ),
        'current_phase', json_build_object(
            'id', jp.id,
            'name', jp.name
        ),
        'work_order', (
            SELECT json_build_object(
                'id', wo.id,
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
                'additional_comments', wo.additional_comments,
                'is_active', wo.is_active
            )
            FROM work_orders wo
            LEFT JOIN job_categories jc ON jc.id = wo.job_category_id
            WHERE wo.job_id = j.id
            AND wo.is_active = true
        ),
        'billing_details', v_billing_details,
        'hourly_billing_details', v_hourly_billing_details,
        'extra_charges_details', v_extra_charges_details,
        'debug_billing_joins', v_debug_info
    )
    INTO v_result
    FROM jobs j
    LEFT JOIN properties p ON p.id = j.property_id
    LEFT JOIN unit_sizes us ON us.id = j.unit_size_id
    LEFT JOIN job_types jt ON jt.id = j.job_type_id
    LEFT JOIN job_phases jp ON jp.id = j.current_phase_id
    WHERE j.id = p_job_id;

    RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_job_details TO authenticated;

-- Enable the function for RPC
ALTER FUNCTION get_job_details(UUID) SET search_path = public;
