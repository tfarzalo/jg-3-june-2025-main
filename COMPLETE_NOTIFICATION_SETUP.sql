-- COMPLETE NOTIFICATION SYSTEM SETUP
-- This includes everything needed for the notification system to work
-- Apply this to your production database if the system is not set up

-- =============================================================================
-- PART 1: Create user_notifications table (if it doesn't exist)
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL,
  reference_id uuid,
  reference_type text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id ON user_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_is_read ON user_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_user_notifications_created_at ON user_notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_user_notifications_type ON user_notifications(type);

-- Enable RLS
ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own notifications" ON user_notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON user_notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications" ON user_notifications;

-- Create policies for user_notifications
CREATE POLICY "Users can view their own notifications"
  ON user_notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
  ON user_notifications
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own notifications"
  ON user_notifications
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- =============================================================================
-- PART 2: Create send_notification function
-- =============================================================================

CREATE OR REPLACE FUNCTION send_notification(
  p_user_id uuid,
  p_title text,
  p_message text,
  p_type text,
  p_reference_id uuid DEFAULT NULL,
  p_reference_type text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id uuid;
  v_notification_settings jsonb;
  v_should_send boolean := true;
BEGIN
  -- Check if user has disabled this notification type
  SELECT notification_settings INTO v_notification_settings
  FROM profiles
  WHERE id = p_user_id;
  
  IF v_notification_settings IS NOT NULL THEN
    CASE p_type
      WHEN 'job_phase_change' THEN
        v_should_send := COALESCE((v_notification_settings->>'job_phase_changes')::boolean, true);
      WHEN 'work_order' THEN
        v_should_send := COALESCE((v_notification_settings->>'work_orders')::boolean, true);
      WHEN 'callback' THEN
        v_should_send := COALESCE((v_notification_settings->>'callbacks')::boolean, true);
      WHEN 'system' THEN
        v_should_send := COALESCE((v_notification_settings->>'system_alerts')::boolean, true);
      ELSE
        v_should_send := true;
    END CASE;
  END IF;
  
  -- Only send notification if user has not disabled this type
  IF v_should_send THEN
    INSERT INTO user_notifications (
      user_id,
      title,
      message,
      type,
      reference_id,
      reference_type,
      is_read
    ) VALUES (
      p_user_id,
      p_title,
      p_message,
      p_type,
      p_reference_id,
      p_reference_type,
      false
    ) RETURNING id INTO v_notification_id;
    
    RETURN v_notification_id;
  ELSE
    RETURN NULL;
  END IF;
END;
$$;

-- =============================================================================
-- PART 3: Create notify_job_phase_change function (with self-exclusion)
-- =============================================================================

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
  
  -- Don't send notification to the user who made the change
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

-- =============================================================================
-- PART 4: Create trigger for job phase changes
-- =============================================================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS job_phase_change_notification ON job_phase_changes;

-- Create trigger for job phase changes
CREATE TRIGGER job_phase_change_notification
AFTER INSERT ON job_phase_changes
FOR EACH ROW
EXECUTE FUNCTION notify_job_phase_change();

-- =============================================================================
-- PART 5: Add comments for documentation
-- =============================================================================

COMMENT ON FUNCTION send_notification IS 
'Sends a notification to a user. Respects user notification preferences.';

COMMENT ON FUNCTION notify_job_phase_change IS 
'Sends notifications to admins and JG management when a job phase changes. 
Excludes the user who made the change from receiving a notification.';

COMMENT ON TABLE user_notifications IS
'Stores user notifications for the bell icon in the top bar.';

-- =============================================================================
-- SUCCESS MESSAGE
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Notification system setup complete!';
  RAISE NOTICE 'Tables created: user_notifications';
  RAISE NOTICE 'Functions created: send_notification, notify_job_phase_change';
  RAISE NOTICE 'Triggers created: job_phase_change_notification';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Test notification: SELECT send_notification(auth.uid(), ''Test'', ''This is a test'', ''system'', NULL, NULL);';
  RAISE NOTICE '2. Change a job phase to test the system';
  RAISE NOTICE '3. Check your bell icon for notifications';
END $$;
