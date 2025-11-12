-- Fix get_upload_folder to return UUID instead of TEXT
-- This fixes the "invalid input syntax for type uuid" error

DROP FUNCTION IF EXISTS get_upload_folder(UUID, UUID, TEXT);

CREATE OR REPLACE FUNCTION get_upload_folder(
    p_property_id UUID,
    p_job_id UUID,
    p_folder_type TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_property_name TEXT;
    v_work_order_num INTEGER;
    v_property_folder_id UUID;
    v_work_orders_folder_id UUID;
    v_wo_folder_id UUID;
    v_target_folder_id UUID;
    v_sanitized_property_name TEXT;
    v_folder_name TEXT;
BEGIN
    -- Get property name
    SELECT property_name INTO v_property_name
    FROM properties
    WHERE id = p_property_id;
    
    IF v_property_name IS NULL THEN
        RAISE EXCEPTION 'Property not found: %', p_property_id;
    END IF;
    
    -- Sanitize property name for folder path
    v_sanitized_property_name := regexp_replace(v_property_name, '[^a-zA-Z0-9\s-]', '', 'g');
    v_sanitized_property_name := regexp_replace(v_sanitized_property_name, '\s+', ' ', 'g');
    v_sanitized_property_name := trim(v_sanitized_property_name);
    
    -- STEP 1: Ensure property root folder exists
    v_property_folder_id := ensure_folder_exists(
        '/' || v_sanitized_property_name,
        NULL,
        p_property_id,
        NULL
    );
    
    -- For property files (unit maps, etc.)
    IF p_folder_type = 'property_files' THEN
        v_target_folder_id := ensure_folder_exists(
            '/' || v_sanitized_property_name || '/Property Files',
            v_property_folder_id,
            p_property_id,
            NULL
        );
        
        RETURN v_target_folder_id;
    END IF;
    
    -- For work order files
    IF p_job_id IS NOT NULL THEN
        -- Get work order number
        SELECT work_order_num INTO v_work_order_num
        FROM jobs
        WHERE id = p_job_id;
        
        IF v_work_order_num IS NULL THEN
            RAISE EXCEPTION 'Job not found or missing work_order_num: %', p_job_id;
        END IF;
        
        -- STEP 2: Ensure Work Orders folder exists
        v_work_orders_folder_id := ensure_folder_exists(
            '/' || v_sanitized_property_name || '/Work Orders',
            v_property_folder_id,
            p_property_id,
            NULL
        );
        
        -- STEP 3: Ensure specific work order folder exists
        v_wo_folder_id := ensure_folder_exists(
            '/' || v_sanitized_property_name || '/Work Orders/WO-' || LPAD(v_work_order_num::text, 6, '0'),
            v_work_orders_folder_id,
            p_property_id,
            p_job_id
        );
        
        -- STEP 4: Determine target folder based on type
        CASE p_folder_type
            WHEN 'before' THEN
                v_folder_name := 'Before Images';
            WHEN 'sprinkler' THEN
                v_folder_name := 'Sprinkler Images';
            WHEN 'other' THEN
                v_folder_name := 'Other Files';
            ELSE
                v_folder_name := 'Other Files';
        END CASE;
        
        v_target_folder_id := ensure_folder_exists(
            '/' || v_sanitized_property_name || '/Work Orders/WO-' || 
            LPAD(v_work_order_num::text, 6, '0') || '/' || v_folder_name,
            v_wo_folder_id,
            p_property_id,
            p_job_id
        );
        
        RETURN v_target_folder_id;
    END IF;
    
    RAISE EXCEPTION 'Invalid folder type or missing job_id: %', p_folder_type;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_upload_folder(UUID, UUID, TEXT) TO authenticated;

-- Verify the function
DO $$
BEGIN
    RAISE NOTICE 'get_upload_folder function updated to return UUID';
    RAISE NOTICE 'Function is ready for use';
END $$;
