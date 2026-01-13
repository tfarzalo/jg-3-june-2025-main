-- Simple update to add created_at and prepared_by username to get_job_details
-- This only modifies the work_order JSON section - SAFE and minimal change
--
-- Fields confirmed to exist in work_orders table:
-- ✅ created_at (timestamp with time zone)
-- ✅ prepared_by (uuid) - references the user who created the work order

-- BEFORE running this, backup the current function:
-- SELECT pg_get_functiondef('get_job_details(uuid)'::regprocedure);

-- This script creates a new version of get_job_details with ONLY the work_order section updated
-- Everything else remains exactly the same as v8

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

    -- Get regular billing details (is_hourly = false)
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

    -- Get hourly billing details (is_hourly = true)
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

    -- Extract amounts from billing records
    IF v_regular_billing_record IS NOT NULL THEN
        BEGIN
            v_regular_bill_amount := (v_regular_billing_record->>'bill_amount')::NUMERIC;
            v_regular_sub_pay_amount := (v_regular_billing_record->>'sub_pay_amount')::NUMERIC;
        EXCEPTION WHEN OTHERS THEN
            v_regular_bill_amount := 0;
            v_regular_sub_pay_amount := 0;
        END;
    ELSE
        v_regular_bill_amount := 0;
        v_regular_sub_pay_amount := 0;
    END IF;

    IF v_hourly_billing_record IS NOT NULL THEN
        BEGIN
            v_hourly_bill_amount := (v_hourly_billing_record->>'bill_amount')::NUMERIC;
            v_hourly_sub_pay_amount := (v_hourly_billing_record->>'sub_pay_amount')::NUMERIC;
        EXCEPTION WHEN OTHERS THEN
            v_hourly_bill_amount := 0;
            v_hourly_sub_pay_amount := 0;
        END;
    ELSE
        v_hourly_bill_amount := 0;
        v_hourly_sub_pay_amount := 0;
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
    WHERE bc.name = v_job_category_name;

    -- Build billing details
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
                    'property_id', v_property_id,
                    'billing_category_id', v_billing_category_id,
                    'billing_category_name', v_billing_category_name,
                    'unit_size_id', v_unit_size_id,
                    'job_category_name', v_job_category_name,
                    'bill_amount', v_regular_bill_amount,
                    'sub_pay_amount', v_regular_sub_pay_amount,
                    'raw_record', v_regular_billing_record,
                    'record_count', v_regular_billing_count,
                    'billing_category_exists', v_billing_category_exists,
                    'unit_size_exists', v_unit_size_exists,
                    'matching_billing_categories', v_matching_billing_categories,
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

    -- ============================================================================
    -- UPDATED SECTION: Get work order data with timestamp and submitted_by
    -- This is the ONLY section that changed from v8
    -- ============================================================================
    SELECT json_build_object(
        'id', wo.id,
        'submission_date', wo.submission_date,
        'created_at', wo.created_at,                                    -- NEW: Timestamp field
        'submitted_by_name', COALESCE(u.full_name, u.email, 'System'), -- NEW: Username field
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
    INTO v_work_order
    FROM work_orders wo
    LEFT JOIN job_categories jc ON jc.id = wo.job_category_id
    LEFT JOIN profiles u ON u.id = wo.prepared_by                      -- NEW: Join to get username
    WHERE wo.job_id = p_job_id
    AND wo.is_active = true;
    -- ============================================================================
    -- END OF UPDATED SECTION
    -- ============================================================================

    -- Get property data separately
    SELECT json_build_object(
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
    )
    INTO v_property
    FROM properties p
    WHERE p.id = v_property_id;

    -- Get unit size data
    SELECT json_build_object(
        'id', us.id,
        'label', us.unit_size_label
    )
    INTO v_unit_size
    FROM unit_sizes us
    WHERE us.id = v_unit_size_id;

    -- Get job type data
    SELECT json_build_object(
        'id', jt.id,
        'label', jt.label
    )
    INTO v_job_type
    FROM job_types jt
    JOIN jobs j ON j.job_type_id = jt.id
    WHERE j.id = p_job_id;

    -- Get job phase data
    SELECT json_build_object(
        'id', jp.id,
        'label', jp.label,
        'color_light_mode', jp.color_light_mode,
        'color_dark_mode', jp.color_dark_mode
    )
    INTO v_job_phase
    FROM job_phases jp
    JOIN jobs j ON j.job_phase_id = jp.id
    WHERE j.id = p_job_id;

    -- Build the final result
    SELECT json_build_object(
        'id', j.id,
        'work_order_num', j.work_order_num,
        'unit_number', j.unit_number,
        'description', j.description,
        'scheduled_date', j.scheduled_date,
        'assigned_to', j.assigned_to,
        'assigned_to_name', u.full_name,
        'assignment_status', j.assignment_status,
        'assignment_decision_at', j.assignment_decision_at,
        'declined_reason_code', j.declined_reason_code,
        'declined_reason_text', j.declined_reason_text,
        'property', v_property,
        'unit_size', v_unit_size,
        'job_type', v_job_type,
        'job_phase', v_job_phase,
        'job_category', json_build_object(
            'id', jc.id,
            'name', jc.name,
            'description', jc.description
        ),
        'work_order', v_work_order,
        'billing_details', v_billing_details,
        'hourly_billing_details', v_hourly_billing_details,
        'extra_charges_details', v_extra_charges_details,
        'debug', v_debug_info,
        'invoice_sent', j.invoice_sent,
        'invoice_paid', j.invoice_paid,
        'invoice_sent_date', j.invoice_sent_date,
        'invoice_paid_date', j.invoice_paid_date
    )
    INTO v_result
    FROM jobs j
    LEFT JOIN job_categories jc ON jc.id = j.job_category_id
    LEFT JOIN profiles u ON u.id = j.assigned_to
    WHERE j.id = p_job_id;

    RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_job_details(UUID) TO authenticated;

-- Verification query - run this after applying to test:
-- SELECT (work_order->>'created_at') as created_at,
--        (work_order->>'submitted_by_name') as submitted_by
-- FROM (SELECT get_job_details('your-job-id-here'::uuid) as result) r,
--      LATERAL jsonb_path_query(result::jsonb, '$.work_order') as work_order;
