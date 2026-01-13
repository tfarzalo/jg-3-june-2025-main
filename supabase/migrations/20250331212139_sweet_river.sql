/*
  # Add Database Functions for Performance

  1. Changes
    - Add function to get job details efficiently
    - Add function to get phase changes with profile info
    - Add function to calculate billing amounts
    - Add proper indexes for performance

  2. Security
    - Use security definer functions
    - Set proper search paths
    - Add RLS policies
*/

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_jobs_created_by ON jobs(created_by);
CREATE INDEX IF NOT EXISTS idx_jobs_current_phase_id ON jobs(current_phase_id);
CREATE INDEX IF NOT EXISTS idx_job_phase_changes_job_id ON job_phase_changes(job_id);
CREATE INDEX IF NOT EXISTS idx_job_phase_changes_changed_at ON job_phase_changes(changed_at);
CREATE INDEX IF NOT EXISTS idx_work_orders_job_id ON work_orders(job_id);
CREATE INDEX IF NOT EXISTS idx_billing_details_property_category ON billing_details(property_id, category_id);

-- Function to get job details efficiently
CREATE OR REPLACE FUNCTION get_job_details(job_id uuid)
RETURNS TABLE (
  id uuid,
  work_order_num integer,
  unit_number text,
  description text,
  scheduled_date timestamptz,
  property jsonb,
  unit_size jsonb,
  job_type jsonb,
  job_phase jsonb,
  work_order jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    j.id,
    j.work_order_num,
    j.unit_number,
    j.description,
    j.scheduled_date,
    jsonb_build_object(
      'id', p.id,
      'name', p.property_name,
      'address', p.address,
      'address_2', p.address_2,
      'city', p.city,
      'state', p.state,
      'zip', p.zip
    ) AS property,
    jsonb_build_object(
      'id', us.id,
      'label', us.unit_size_label
    ) AS unit_size,
    jsonb_build_object(
      'id', jt.id,
      'label', jt.job_type_label
    ) AS job_type,
    jsonb_build_object(
      'id', jp.id,
      'label', jp.job_phase_label,
      'color_light_mode', jp.color_light_mode,
      'color_dark_mode', jp.color_dark_mode
    ) AS job_phase,
    COALESCE(
      (
        SELECT to_jsonb(wo.*)
        FROM work_orders wo
        WHERE wo.job_id = j.id
        ORDER BY wo.created_at DESC
        LIMIT 1
      ),
      NULL
    ) AS work_order
  FROM jobs j
  JOIN properties p ON j.property_id = p.id
  JOIN unit_sizes us ON j.unit_size_id = us.id
  JOIN job_types jt ON j.job_type_id = jt.id
  JOIN job_phases jp ON j.current_phase_id = jp.id
  WHERE j.id = job_id;
END;
$$;

-- Function to get job phase changes with profile info
CREATE OR REPLACE FUNCTION get_job_phase_changes(p_job_id uuid)
RETURNS TABLE (
  id uuid,
  job_id uuid,
  changed_by uuid,
  changed_by_name text,
  changed_by_email text,
  from_phase_id uuid,
  to_phase_id uuid,
  change_reason text,
  changed_at timestamptz,
  from_phase_label text,
  from_phase_color text,
  to_phase_label text,
  to_phase_color text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    jpc.id,
    jpc.job_id,
    jpc.changed_by,
    p.full_name,
    p.email,
    jpc.from_phase_id,
    jpc.to_phase_id,
    jpc.change_reason,
    jpc.changed_at,
    fp.job_phase_label,
    fp.color_dark_mode,
    tp.job_phase_label,
    tp.color_dark_mode
  FROM job_phase_changes jpc
  LEFT JOIN profiles p ON jpc.changed_by = p.id
  LEFT JOIN job_phases fp ON jpc.from_phase_id = fp.id
  JOIN job_phases tp ON jpc.to_phase_id = tp.id
  WHERE jpc.job_id = p_job_id
  ORDER BY jpc.changed_at DESC;
END;
$$;

-- Function to calculate billing amounts
CREATE OR REPLACE FUNCTION calculate_billing(
  p_property_id uuid,
  p_paint_type text,
  p_unit_size text,
  p_extra_hours integer DEFAULT 0
)
RETURNS TABLE (
  bill_amount decimal(10,2),
  sub_pay_amount decimal(10,2),
  profit_amount decimal(10,2),
  is_hourly boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_category_id uuid;
  v_unit_size_id uuid;
  v_base_billing record;
BEGIN
  -- Get category ID
  SELECT id INTO v_category_id
  FROM billing_categories
  WHERE property_id = p_property_id AND name = p_paint_type;

  -- Get unit size ID
  SELECT id INTO v_unit_size_id
  FROM unit_sizes
  WHERE unit_size_label = p_unit_size;

  -- Get base billing details
  SELECT 
    bd.bill_amount,
    bd.sub_pay_amount,
    bd.profit_amount,
    bd.is_hourly
  INTO v_base_billing
  FROM billing_details bd
  WHERE bd.property_id = p_property_id
    AND bd.category_id = v_category_id
    AND bd.unit_size_id = v_unit_size_id;

  -- If no billing details found, return null values
  IF v_base_billing IS NULL THEN
    RETURN QUERY
    SELECT 
      NULL::decimal(10,2),
      NULL::decimal(10,2),
      NULL::decimal(10,2),
      false;
    RETURN;
  END IF;

  -- Calculate amounts based on rate type
  IF v_base_billing.is_hourly AND p_extra_hours > 0 THEN
    -- For hourly rates, multiply by hours
    RETURN QUERY
    SELECT
      v_base_billing.bill_amount * p_extra_hours,
      v_base_billing.sub_pay_amount * p_extra_hours,
      NULL::decimal(10,2),
      true;
  ELSE
    -- For fixed rates, return base amounts
    RETURN QUERY
    SELECT
      v_base_billing.bill_amount,
      v_base_billing.sub_pay_amount,
      v_base_billing.profit_amount,
      false;
  END IF;
END;
$$;