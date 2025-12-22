-- Function to notify relevant users about job status changes
CREATE OR REPLACE FUNCTION notify_job_status_change()
RETURNS TRIGGER AS $$
DECLARE
  affected_users UUID[];
  current_user_id UUID;
BEGIN
  -- Get the current user making the change
  current_user_id := auth.uid();
  
  -- Get all users who should be notified about this job
  -- This includes admins, management, and assigned subcontractors
  SELECT ARRAY_AGG(DISTINCT p.id)
  INTO affected_users
  FROM profiles p
  WHERE p.role IN ('admin', 'is_super_admin', 'jg_management', 'subcontractor')
  AND p.id != current_user_id;  -- Exclude the user making the change
  
  -- Create notifications for all affected users
  IF affected_users IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, message, job_id)
    SELECT 
      user_id,
      'job_status_change',
      'Job Status Updated',
      'Job #' || NEW.id || ' status changed to ' || NEW.status,
      NEW.id
    FROM unnest(affected_users) AS user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to notify relevant users about new job requests
CREATE OR REPLACE FUNCTION notify_new_job_request()
RETURNS TRIGGER AS $$
DECLARE
  affected_users UUID[];
  current_user_id UUID;
BEGIN
  -- Get the current user making the change
  current_user_id := auth.uid();
  
  -- Get all users who should be notified about new jobs
  -- This includes admins and management
  SELECT ARRAY_AGG(DISTINCT p.id)
  INTO affected_users
  FROM profiles p
  WHERE p.role IN ('admin', 'is_super_admin', 'jg_management')
  AND p.id != current_user_id;  -- Exclude the user making the change
  
  -- Create notifications for all affected users
  IF affected_users IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, message, job_id)
    SELECT 
      user_id,
      'new_job_request',
      'New Job Request',
      'A new job request has been created',
      NEW.id
    FROM unnest(affected_users) AS user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for job status changes and new job requests
DROP TRIGGER IF EXISTS on_job_status_change ON jobs;
CREATE TRIGGER on_job_status_change
  AFTER UPDATE OF status ON jobs
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION notify_job_status_change();

DROP TRIGGER IF EXISTS on_new_job_request ON jobs;
CREATE TRIGGER on_new_job_request
  AFTER INSERT ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_job_request(); 