-- Fix notification system to exclude self-triggered activities
-- This ensures users don't get notifications for their own actions

-- Update the notify_job_phase_change function to NOT send notifications to the user who made the change
CREATE OR REPLACE FUNCTION notify_job_phase_change()
RETURNS TRIGGER AS $$
DECLARE
  v_job_record record;
  v_from_phase text;
  v_to_phase text;
  v_property_name text;
  v_unit_number text;
  v_admin_id uuid;
  v_jg_management_id uuid;
BEGIN
  -- Get job details
  SELECT 
    j.unit_number,
    fp.job_phase_label AS from_phase_label,
    tp.job_phase_label AS to_phase_label,
    p.property_name
  INTO v_job_record
  FROM jobs j
  LEFT JOIN job_phases fp ON fp.id = NEW.from_phase_id
  JOIN job_phases tp ON tp.id = NEW.to_phase_id
  JOIN properties p ON p.id = j.property_id
  WHERE j.id = NEW.job_id;
  
  v_from_phase := COALESCE(v_job_record.from_phase_label, 'New Job');
  v_to_phase := v_job_record.to_phase_label;
  v_property_name := v_job_record.property_name;
  v_unit_number := v_job_record.unit_number;
  
  -- REMOVED: Don't send notification to the user who made the change
  -- The user who triggered this action doesn't need a notification about their own action
  
  -- Get admin users and send notifications (excluding the user who made the change)
  FOR v_admin_id IN 
    SELECT id FROM profiles WHERE role = 'admin'
  LOOP
    -- Don't send notification to the user who made the change
    IF v_admin_id != NEW.changed_by THEN
      PERFORM send_notification(
        v_admin_id,
        'Job Phase Changed',
        'Job at ' || v_property_name || ' Unit ' || v_unit_number || ' changed from ' || v_from_phase || ' to ' || v_to_phase,
        'job_phase_change',
        NEW.job_id,
        'job'
      );
    END IF;
  END LOOP;
  
  -- Get JG Management users and send notifications (excluding the user who made the change)
  FOR v_jg_management_id IN 
    SELECT id FROM profiles WHERE role = 'jg_management'
  LOOP
    -- Don't send notification to the user who made the change
    IF v_jg_management_id != NEW.changed_by THEN
      PERFORM send_notification(
        v_jg_management_id,
        'Job Phase Changed',
        'Job at ' || v_property_name || ' Unit ' || v_unit_number || ' changed from ' || v_from_phase || ' to ' || v_to_phase,
        'job_phase_change',
        NEW.job_id,
        'job'
      );
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update the notify_work_order_creation function similarly
CREATE OR REPLACE FUNCTION notify_work_order_creation()
RETURNS TRIGGER AS $$
DECLARE
  v_job_record record;
  v_property_name text;
  v_unit_number text;
  v_admin_id uuid;
  v_jg_management_id uuid;
  v_creator_id uuid;
BEGIN
  -- Get the creator of the work order (user who triggered this)
  v_creator_id := auth.uid();
  
  -- Get job details
  SELECT 
    j.unit_number,
    p.property_name
  INTO v_job_record
  FROM jobs j
  JOIN properties p ON p.id = j.property_id
  WHERE j.id = NEW.job_id;
  
  v_property_name := v_job_record.property_name;
  v_unit_number := v_job_record.unit_number;
  
  -- Get admin users and send notifications (excluding the creator)
  FOR v_admin_id IN 
    SELECT id FROM profiles WHERE role = 'admin'
  LOOP
    -- Don't send notification to the user who created the work order
    IF v_admin_id != v_creator_id THEN
      PERFORM send_notification(
        v_admin_id,
        'New Work Order',
        'New work order created for ' || v_property_name || ' Unit ' || v_unit_number,
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
        'New work order created for ' || v_property_name || ' Unit ' || v_unit_number,
        'work_order',
        NEW.job_id,
        'job'
      );
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update the notify_new_job_request function similarly if it exists
CREATE OR REPLACE FUNCTION notify_new_job_request()
RETURNS TRIGGER AS $$
DECLARE
  v_admin_id uuid;
  v_jg_management_id uuid;
  v_creator_id uuid;
BEGIN
  -- Get the creator of the job request
  v_creator_id := auth.uid();
  
  -- Get admin users and send notifications (excluding the creator)
  FOR v_admin_id IN 
    SELECT id FROM profiles WHERE role = 'admin'
  LOOP
    -- Don't send notification to the user who created the job request
    IF v_admin_id != v_creator_id THEN
      PERFORM send_notification(
        v_admin_id,
        'New Job Request',
        'A new job request has been created',
        'job_request',
        NEW.id,
        'job'
      );
    END IF;
  END LOOP;
  
  -- Get JG Management users and send notifications (excluding the creator)
  FOR v_jg_management_id IN 
    SELECT id FROM profiles WHERE role = 'jg_management'
  LOOP
    -- Don't send notification to the user who created the job request
    IF v_jg_management_id != v_creator_id THEN
      PERFORM send_notification(
        v_jg_management_id,
        'New Job Request',
        'A new job request has been created',
        'job_request',
        NEW.id,
        'job'
      );
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add comment for documentation
COMMENT ON FUNCTION notify_job_phase_change() IS 
'Sends notifications to admins and JG management when a job phase changes. 
Excludes the user who made the change from receiving a notification.';

COMMENT ON FUNCTION notify_work_order_creation() IS 
'Sends notifications to admins and JG management when a work order is created. 
Excludes the user who created the work order from receiving a notification.';

COMMENT ON FUNCTION notify_new_job_request() IS 
'Sends notifications to admins and JG management when a job request is created. 
Excludes the user who created the request from receiving a notification.';
