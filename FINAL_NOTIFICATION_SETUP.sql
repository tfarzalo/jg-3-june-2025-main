-- FIXED NOTIFICATION SETUP FOR YOUR TABLE STRUCTURE
-- Your user_notifications table has: id, user_id, message, read, created_at
-- This migration adds missing columns and sets up the notification system

-- =============================================================================
-- PART 1: Add missing columns to user_notifications table
-- =============================================================================

-- Add title column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_notifications' AND column_name = 'title'
  ) THEN
    ALTER TABLE user_notifications ADD COLUMN title text;
    RAISE NOTICE '✅ Added title column';
  END IF;
END $$;

-- Add type column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_notifications' AND column_name = 'type'
  ) THEN
    ALTER TABLE user_notifications ADD COLUMN type text;
    RAISE NOTICE '✅ Added type column';
  END IF;
END $$;

-- Add reference_id column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_notifications' AND column_name = 'reference_id'
  ) THEN
    ALTER TABLE user_notifications ADD COLUMN reference_id uuid;
    RAISE NOTICE '✅ Added reference_id column';
  END IF;
END $$;

-- Add reference_type column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_notifications' AND column_name = 'reference_type'
  ) THEN
    ALTER TABLE user_notifications ADD COLUMN reference_type text;
    RAISE NOTICE '✅ Added reference_type column';
  END IF;
END $$;

-- =============================================================================
-- PART 2: Create send_notification function (using 'read' column)
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
      read  -- Using 'read' instead of 'is_read'
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
-- PART 5: Create indexes for better performance
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id ON user_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_read ON user_notifications(read);
CREATE INDEX IF NOT EXISTS idx_user_notifications_created_at ON user_notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_user_notifications_type ON user_notifications(type);

-- =============================================================================
-- PART 6: Test the system
-- =============================================================================

DO $$
DECLARE
  v_test_notification_id uuid;
BEGIN
  -- Test if the function works
  SELECT send_notification(
    auth.uid(),
    '✅ System Test',
    'If you see this in your bell icon, the notification system is working perfectly!',
    'system',
    NULL,
    NULL
  ) INTO v_test_notification_id;
  
  IF v_test_notification_id IS NOT NULL THEN
    RAISE NOTICE '✅ Notification system setup complete!';
    RAISE NOTICE '✅ Test notification created with ID: %', v_test_notification_id;
    RAISE NOTICE '';
    RAISE NOTICE '🔔 CHECK YOUR BELL ICON NOW - You should see the test notification!';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Check your bell icon for the test notification';
    RAISE NOTICE '2. Have a colleague change a job phase';
    RAISE NOTICE '3. You should see their notification (but not your own changes)';
  ELSE
    RAISE NOTICE '⚠️  Notification was not created';
    RAISE NOTICE 'This might be because your notification settings disabled this type';
  END IF;
END $$;

-- =============================================================================
-- VERIFICATION
-- =============================================================================

-- Show the notification that was just created
SELECT 
  id,
  title,
  message,
  type,
  read,
  created_at
FROM user_notifications
WHERE user_id = auth.uid()
ORDER BY created_at DESC
LIMIT 1;
