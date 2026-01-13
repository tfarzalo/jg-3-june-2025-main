-- Fix work order notification to show WO-###### instead of job UUID

CREATE OR REPLACE FUNCTION notify_work_order_created()
RETURNS TRIGGER AS $$
DECLARE
  v_job_record RECORD;
  v_property_name text;
  v_unit_number text;
  v_work_order_num text;
  v_admin_id uuid;
  v_jg_management_id uuid;
  v_creator_id uuid;
BEGIN
  -- Get the creator of the work order (user who triggered this)
  v_creator_id := auth.uid();
  
  -- Get job details including work order number
  SELECT 
    j.unit_number,
    j.work_order_num,
    p.property_name
  INTO v_job_record
  FROM jobs j
  JOIN properties p ON p.id = j.property_id
  WHERE j.id = NEW.job_id;
  
  v_property_name := v_job_record.property_name;
  v_unit_number := v_job_record.unit_number;
  v_work_order_num := 'WO-' || LPAD(v_job_record.work_order_num::TEXT, 6, '0');
  
  -- Get admin users and send notifications (excluding the creator)
  FOR v_admin_id IN 
    SELECT id FROM profiles WHERE role = 'admin'
  LOOP
    -- Don't send notification to the user who created the work order
    IF v_admin_id != v_creator_id THEN
      PERFORM send_notification(
        v_admin_id,
        'New Work Order',
        'Work order ' || v_work_order_num || ' created for ' || v_property_name || ' Unit ' || v_unit_number,
        'work_order',
        NEW.job_id,
        'job'
      );
    END IF;
  END LOOP;
  
  -- Get JG Management users and send notifications (excluding the creator)
  FOR v_jg_management_id IN 
    SELECT id FROM profiles WHERE role = 'jg_management'
  LOOP
    -- Don't send notification to the user who created the work order
    IF v_jg_management_id != v_creator_id THEN
      PERFORM send_notification(
        v_jg_management_id,
        'New Work Order',
        'Work order ' || v_work_order_num || ' created for ' || v_property_name || ' Unit ' || v_unit_number,
        'work_order',
        NEW.job_id,
        'job'
      );
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION notify_work_order_created() IS 'Send notifications when a work order is created, showing WO-###### number';
