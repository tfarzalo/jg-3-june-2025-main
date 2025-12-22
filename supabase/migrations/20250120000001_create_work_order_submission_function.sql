-- Create function to handle work order submission with automatic job phase advancement
-- This function runs with SECURITY DEFINER to bypass RLS policies for subcontractors

CREATE OR REPLACE FUNCTION submit_work_order_with_phase_advancement(
  p_job_id UUID,
  p_work_order_data JSONB,
  p_has_extra_charges BOOLEAN DEFAULT FALSE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_work_order_id UUID;
  v_target_phase_id UUID;
  v_current_phase_id UUID;
  v_current_phase_label TEXT;
  v_job_record RECORD;
  v_result JSON;
BEGIN
  -- Get current job details and phase
  SELECT 
    j.id,
    j.current_phase_id,
    jp.job_phase_label
  INTO v_job_record
  FROM jobs j
  LEFT JOIN job_phases jp ON j.current_phase_id = jp.id
  WHERE j.id = p_job_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Job not found'
    );
  END IF;
  
  v_current_phase_id := v_job_record.current_phase_id;
  v_current_phase_label := v_job_record.job_phase_label;
  
  -- Only advance phase if job is currently in "Job Request" phase
  IF TRIM(v_current_phase_label) = 'Job Request' THEN
    -- Get target phase based on extra charges
    SELECT id INTO v_target_phase_id
    FROM job_phases
    WHERE job_phase_label = CASE 
      WHEN p_has_extra_charges THEN 'Pending Work Order'
      ELSE 'Work Order'
    END;
    
    IF v_target_phase_id IS NULL THEN
      RETURN json_build_object(
        'success', false,
        'error', 'Target phase not found'
      );
    END IF;
    
    -- Update job phase
    UPDATE jobs
    SET 
      current_phase_id = v_target_phase_id,
      updated_at = NOW()
    WHERE id = p_job_id;
    
    -- Create job phase change record
    INSERT INTO job_phase_changes (
      job_id,
      changed_by,
      from_phase_id,
      to_phase_id,
      change_reason
    ) VALUES (
      p_job_id,
      auth.uid(),
      v_current_phase_id,
      v_target_phase_id,
      CASE 
        WHEN p_has_extra_charges THEN 'Work order created with extra charges - job advanced from Job Request'
        ELSE 'Work order created - job advanced from Job Request'
      END
    );
  END IF;
  
  -- Insert the work order
  INSERT INTO work_orders (
    job_id,
    unit_number,
    unit_size,
    job_category_id,
    painted_ceilings,
    ceiling_mode,
    ceiling_display_label,
    individual_ceiling_count,
    ceiling_billing_detail_id,
    has_accent_wall,
    accent_wall_type,
    accent_wall_count,
    accent_wall_billing_detail_id,
    has_extra_charges,
    extra_charges_description,
    extra_hours,
    additional_comments,
    prepared_by,
    ceiling_billing_detail_id,
    accent_wall_billing_detail_id,
    bill_amount,
    sub_pay_amount,
    profit_amount,
    is_hourly
  ) VALUES (
    p_job_id,
    (p_work_order_data->>'unit_number')::TEXT,
    (p_work_order_data->>'unit_size')::TEXT,
    (p_work_order_data->>'job_category_id')::UUID,
    (p_work_order_data->>'painted_ceilings')::BOOLEAN,
    (p_work_order_data->>'ceiling_mode')::TEXT,
    (p_work_order_data->>'ceiling_display_label')::TEXT,
    (p_work_order_data->>'individual_ceiling_count')::INTEGER,
    (p_work_order_data->>'ceiling_billing_detail_id')::UUID,
    (p_work_order_data->>'has_accent_wall')::BOOLEAN,
    (p_work_order_data->>'accent_wall_type')::TEXT,
    (p_work_order_data->>'accent_wall_count')::INTEGER,
    (p_work_order_data->>'accent_wall_billing_detail_id')::UUID,
    (p_work_order_data->>'has_extra_charges')::BOOLEAN,
    (p_work_order_data->>'extra_charges_description')::TEXT,
    (p_work_order_data->>'extra_hours')::INTEGER,
    (p_work_order_data->>'additional_comments')::TEXT,
    (p_work_order_data->>'prepared_by')::TEXT,
    (p_work_order_data->>'ceiling_billing_detail_id')::UUID,
    (p_work_order_data->>'accent_wall_billing_detail_id')::UUID,
    (p_work_order_data->>'bill_amount')::NUMERIC,
    (p_work_order_data->>'sub_pay_amount')::NUMERIC,
    (p_work_order_data->>'profit_amount')::NUMERIC,
    (p_work_order_data->>'is_hourly')::BOOLEAN
  )
  RETURNING id INTO v_work_order_id;
  
  -- Return success with work order ID
  RETURN json_build_object(
    'success', true,
    'work_order_id', v_work_order_id,
    'phase_advanced', TRIM(v_current_phase_label) = 'Job Request',
    'new_phase_id', v_target_phase_id
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;
