/*
  Update create_job RPC function to accept and store is_occupied field
  
  This allows the job request form to set occupancy status at job creation.
*/

DROP FUNCTION IF EXISTS create_job(uuid, text, uuid, uuid, text, date, uuid, text);
DROP FUNCTION IF EXISTS create_job(uuid, text, uuid, uuid, text, date, uuid, text, boolean);

CREATE OR REPLACE FUNCTION create_job(
  p_property_id uuid,
  p_unit_number text,
  p_unit_size_id uuid,
  p_job_type_id uuid,
  p_description text,
  p_scheduled_date date,
  p_job_category_id uuid DEFAULT NULL,
  p_purchase_order text DEFAULT NULL,
  p_is_occupied boolean DEFAULT false
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_id uuid;
  v_job_phase_id uuid;
  v_job_details json;
  v_user_id uuid;
  v_scheduled_date timestamptz;
BEGIN
  BEGIN
    v_user_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    SELECT id INTO v_user_id 
    FROM auth.users 
    WHERE role = 'admin' 
    ORDER BY created_at ASC 
    LIMIT 1;
    
    IF v_user_id IS NULL THEN
      SELECT id INTO v_user_id 
      FROM auth.users 
      ORDER BY created_at ASC 
      LIMIT 1;
      
      IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No system user found for job creation';
      END IF;
    END IF;
  END;

  v_scheduled_date := (p_scheduled_date::text || ' 00:00:00 America/New_York')::timestamptz;

  SELECT id INTO v_job_phase_id
  FROM job_phases
  WHERE job_phase_label = 'Job Request';

  IF v_job_phase_id IS NULL THEN
    RAISE EXCEPTION 'Job Request phase not found';
  END IF;

  INSERT INTO jobs (
    property_id,
    unit_number,
    unit_size_id,
    job_type_id,
    job_category_id,
    purchase_order,
    is_occupied,
    description,
    scheduled_date,
    created_by,
    status,
    current_phase_id
  ) VALUES (
    p_property_id,
    p_unit_number,
    p_unit_size_id,
    p_job_type_id,
    p_job_category_id,
    p_purchase_order,
    p_is_occupied,
    p_description,
    v_scheduled_date,
    v_user_id,
    'Open',
    v_job_phase_id
  )
  RETURNING id INTO v_job_id;

  INSERT INTO job_phase_changes (
    job_id,
    changed_by,
    from_phase_id,
    to_phase_id,
    change_reason
  ) VALUES (
    v_job_id,
    v_user_id,
    NULL,
    v_job_phase_id,
    'Initial job request creation'
  );

  SELECT json_build_object(
    'id', j.id,
    'work_order_num', j.work_order_num,
    'status', j.status,
    'property', json_build_object(
      'id', p.id,
      'name', p.property_name,
      'address', p.address,
      'address_2', p.address_2,
      'city', p.city,
      'state', p.state,
      'zip', p.zip
    ),
    'unit_number', j.unit_number,
    'purchase_order', j.purchase_order,
    'is_occupied', j.is_occupied,
    'unit_size', json_build_object(
      'id', us.id,
      'label', us.unit_size_label
    ),
    'job_type', json_build_object(
      'id', jt.id,
      'label', jt.job_type_label
    ),
    'job_category', CASE 
      WHEN j.job_category_id IS NOT NULL THEN json_build_object(
        'id', jc.id,
        'name', jc.name
      )
      ELSE NULL
    END,
    'description', j.description,
    'scheduled_date', j.scheduled_date,
    'created_at', j.created_at,
    'job_phase', json_build_object(
      'id', jp.id,
      'label', jp.job_phase_label,
      'color_light_mode', jp.color_light_mode,
      'color_dark_mode', jp.color_dark_mode
    )
  ) INTO v_job_details
  FROM jobs j
  JOIN properties p ON p.id = j.property_id
  JOIN unit_sizes us ON us.id = j.unit_size_id
  JOIN job_types jt ON jt.id = j.job_type_id
  JOIN job_phases jp ON jp.id = j.current_phase_id
  LEFT JOIN job_categories jc ON jc.id = j.job_category_id
  WHERE j.id = v_job_id;

  RETURN v_job_details;
END;
$$;
