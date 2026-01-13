-- Update get_job_details function to use a dynamic approach for work_order data
-- This avoids manually redeclaring every field and ensures we capture the submitting user correctly

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
    v_work_order JSON;
    v_property JSON;
    v_unit_size JSON;
    v_job_type JSON;
    v_job_phase JSON;
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

    -- Get regular billing details
    SELECT 
        json_build_object(
            'bill_amount', bd.bill_amount,
            'sub_pay_amount', bd.sub_pay_amount,
            'profit_amount', bd.bill_amount - bd.sub_pay_amount,
            'is_hourly', bd.is_hourly,
            'display_order', 1,
            'section_name', 'Regular Billing',
            'debug', json_build_object(
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

    -- Get hourly billing details
    SELECT 
        json_build_object(
            'bill_amount', bd.bill_amount,
            'sub_pay_amount', bd.sub_pay_amount,
            'profit_amount', bd.bill_amount - bd.sub_pay_amount,
            'is_hourly', bd.is_hourly,
            'display_order', 2,
            'section_name', 'Hourly Billing',
            'debug', json_build_object(
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

    -- Extract amounts
    v_regular_bill_amount := COALESCE((v_regular_billing_record->>'bill_amount')::NUMERIC, 0);
    v_regular_sub_pay_amount := COALESCE((v_regular_billing_record->>'sub_pay_amount')::NUMERIC, 0);
    v_hourly_bill_amount := CASE WHEN v_hourly_billing_record IS NOT NULL THEN (v_hourly_billing_record->>'bill_amount')::NUMERIC ELSE NULL END;
    v_hourly_sub_pay_amount := CASE WHEN v_hourly_billing_record IS NOT NULL THEN (v_hourly_billing_record->>'sub_pay_amount')::NUMERIC ELSE NULL END;

    -- Get all matching billing categories for debugging
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

    -- Build regular billing details
    v_billing_details := CASE 
        WHEN v_regular_billing_record IS NOT NULL THEN
            json_build_object(
                'bill_amount', v_regular_bill_amount,
                'sub_pay_amount', v_regular_sub_pay_amount,
                'profit_amount', v_regular_bill_amount - v_regular_sub_pay_amount,
                'is_hourly', false,
                'display_order', 1,
                'section_name', 'Regular Billing',
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
        WHEN v_extra_charges_hours > 0 THEN
            json_build_object(
                'description', v_extra_charges_description,
                'hours', v_extra_charges_hours,
                'hourly_rate', COALESCE(v_hourly_bill_amount, 40),
                'sub_pay_rate', COALESCE(v_hourly_sub_pay_amount, 25),
                'bill_amount', v_extra_charges_hours * COALESCE(v_hourly_bill_amount, 40),
                'sub_pay_amount', v_extra_charges_hours * COALESCE(v_hourly_sub_pay_amount, 25),
                'profit_amount', v_extra_charges_hours * (COALESCE(v_hourly_bill_amount, 40) - COALESCE(v_hourly_sub_pay_amount, 25)),
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
            'description', v_extra_charges_description,
            'hourly_bill_amount', v_hourly_bill_amount,
            'conditions_met', (v_extra_charges_hours > 0),
            'extra_charges_details_exists', (v_extra_charges_hours > 0),
            'using_default_rates', (v_hourly_bill_amount IS NULL),
            'hourly_bill_amount_value', v_hourly_bill_amount,
            'hourly_sub_pay_amount_value', v_hourly_sub_pay_amount
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

    -- =========================================================================================
    -- SIMPLIFIED WORK ORDER FETCHING
    -- Instead of manually listing every field, we select the whole row as JSONB
    -- and then overlay the computed fields. This is robust against schema changes.
    -- =========================================================================================
    SELECT 
        to_jsonb(wo.*) || 
        jsonb_build_object(
            'job_category', jc.name,
            'submitted_by_name', COALESCE(u.full_name, u.email, 'System User'),
            'created_at', wo.submission_date  -- Ensure created_at is available for the UI
        )
    INTO v_work_order
    FROM work_orders wo
    LEFT JOIN job_categories jc ON jc.id = wo.job_category_id
    LEFT JOIN profiles u ON u.id = wo.prepared_by
    WHERE wo.job_id = p_job_id
    AND wo.is_active = true;

    -- Get property data separately
    SELECT json_build_object(
        'id', p.id,
        'name', p.property_name,
        'address', p.address,
        'address_2', p.address_2,
        'city', p.city,
        'state', p.state,
        'zip', p.zip,
        'ap_email', p.ap_email,
        'quickbooks_number', p.quickbooks_number
    )
    INTO v_property
    FROM properties p
    WHERE p.id = v_property_id;

    -- Get unit size data separately
    SELECT json_build_object(
        'id', us.id,
        'label', us.unit_size_label
    )
    INTO v_unit_size
    FROM unit_sizes us
    WHERE us.id = v_unit_size_id;

    -- Get job type data separately
    SELECT json_build_object(
        'id', jt.id,
        'label', jt.job_type_label
    )
    INTO v_job_type
    FROM job_types jt
    JOIN jobs j ON j.job_type_id = jt.id
    WHERE j.id = p_job_id;

    -- Get job phase data separately with colors
    SELECT json_build_object(
        'id', jp.id,
        'label', jp.job_phase_label,
        'color_light_mode', jp.color_light_mode,
        'color_dark_mode', jp.color_dark_mode
    )
    INTO v_job_phase
    FROM job_phases jp
    JOIN jobs j ON j.current_phase_id = jp.id
    WHERE j.id = p_job_id;

    -- Build the final result
    SELECT json_build_object(
        'id', j.id,
        'work_order_num', j.work_order_num,
        'unit_number', j.unit_number,
        'description', j.description,
        'scheduled_date', j.scheduled_date,
        'assigned_to', j.assigned_to,
        'property', v_property,
        'unit_size', v_unit_size,
        'job_type', v_job_type,
        'job_phase', v_job_phase,
        'work_order', v_work_order,
        'billing_details', v_billing_details,
        'hourly_billing_details', v_hourly_billing_details,
        'extra_charges_details', v_extra_charges_details,
        'debug_billing_joins', v_debug_info
    )
    INTO v_result
    FROM jobs j
    WHERE j.id = p_job_id;

    RETURN v_result;
END;
$$;
