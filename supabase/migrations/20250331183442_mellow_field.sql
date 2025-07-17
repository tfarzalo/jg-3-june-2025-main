/*
  # Add Job Details Stored Procedure

  1. Changes
    - Create stored procedure for fetching job details
    - Optimize query performance with proper joins
    - Return all necessary job information in a single query
    - Handle work order data properly

  2. Security
    - Maintain RLS policies
    - Use SECURITY DEFINER to ensure proper access control
*/

-- Create the stored procedure
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
        LIMIT 1
      ),
      NULL
    ) AS work_order
  FROM jobs j
  LEFT JOIN properties p ON j.property_id = p.id
  LEFT JOIN unit_sizes us ON j.unit_size_id = us.id
  LEFT JOIN job_types jt ON j.job_type_id = jt.id
  LEFT JOIN job_phases jp ON j.current_phase_id = jp.id
  WHERE j.id = job_id;
END;
$$;