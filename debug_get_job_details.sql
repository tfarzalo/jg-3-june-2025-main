-- Debug version of get_job_details to see what's happening
CREATE OR REPLACE FUNCTION debug_get_job_details(p_job_id UUID)
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
    v_job_category_name TEXT;
    v_billing_category_exists BOOLEAN;
    v_unit_size_exists BOOLEAN;
    v_regular_billing_record JSON;
    v_regular_bill_amount NUMERIC;
    v_regular_sub_pay_amount NUMERIC;
BEGIN
    -- Get the property_id, category_id, and unit_size_id for the job
    SELECT 
        j.property_id,
        wo.job_category_id,
        j.unit_size_id,
        jc.name as job_category_name
    INTO 
        v_property_id,
        v_category_id,
        v_unit_size_id,
        v_job_category_name
    FROM jobs j
    LEFT JOIN work_orders wo ON wo.job_id = j.id AND wo.is_active = true
    LEFT JOIN job_categories jc ON jc.id = wo.job_category_id
    WHERE j.id = p_job_id;

    -- Get the most recently created billing category for regular billing
    SELECT id INTO v_billing_category_id
    FROM billing_categories
    WHERE name = v_job_category_name
    AND property_id = v_property_id
    ORDER BY created_at DESC
    LIMIT 1;

    -- Check if billing category exists
    v_billing_category_exists := v_billing_category_id IS NOT NULL;

    -- Check if unit size exists
    SELECT EXISTS (
        SELECT 1 FROM unit_sizes WHERE id = v_unit_size_id
    ) INTO v_unit_size_exists;

    -- Get regular billing record
    IF v_billing_category_exists AND v_unit_size_exists THEN
        SELECT json_build_object(
            'id', bd.id,
            'bill_amount', bd.bill_amount,
            'sub_pay_amount', bd.sub_pay_amount,
            'property_id', bd.property_id,
            'category_id', bd.category_id,
            'unit_size_id', bd.unit_size_id,
            'is_hourly', bd.is_hourly
        ) INTO v_regular_billing_record
        FROM billing_details bd
        WHERE bd.property_id = v_property_id
        AND bd.category_id = v_billing_category_id
        AND bd.unit_size_id = v_unit_size_id
        AND bd.is_hourly = false
        ORDER BY bd.created_at DESC
        LIMIT 1;
    END IF;

    -- Set billing amounts
    v_regular_bill_amount := COALESCE((v_regular_billing_record->>'bill_amount')::numeric, 0);
    v_regular_sub_pay_amount := COALESCE((v_regular_billing_record->>'sub_pay_amount')::numeric, 0);

    -- Build the result with debug info
    v_result := json_build_object(
        'job_id', p_job_id,
        'property_id', v_property_id,
        'category_id', v_category_id,
        'unit_size_id', v_unit_size_id,
        'job_category_name', v_job_category_name,
        'billing_category_id', v_billing_category_id,
        'billing_category_exists', v_billing_category_exists,
        'unit_size_exists', v_unit_size_exists,
        'regular_billing_record', v_regular_billing_record,
        'regular_bill_amount', v_regular_bill_amount,
        'regular_sub_pay_amount', v_regular_sub_pay_amount
    );

    RETURN v_result;
END;
$$;

-- Test the function
SELECT debug_get_job_details('c2b8a552-609e-497d-9c88-db80b3406fe9'::uuid);
