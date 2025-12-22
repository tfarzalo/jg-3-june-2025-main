-- Extend existing notifications table (don't recreate it)
-- The table already exists from migration 20250402101141_add_notifications.sql

-- Add new columns if they don't exist
DO $$ 
BEGIN
  -- Add activity_log_id column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='notifications' AND column_name='activity_log_id') THEN
    ALTER TABLE notifications ADD COLUMN activity_log_id UUID REFERENCES activity_log(id) ON DELETE CASCADE;
  END IF;

  -- Add entity_id column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='notifications' AND column_name='entity_id') THEN
    ALTER TABLE notifications ADD COLUMN entity_id UUID;
  END IF;

  -- Add metadata column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='notifications' AND column_name='metadata') THEN
    ALTER TABLE notifications ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
  END IF;

  -- Rename 'read' to 'is_read' for consistency (if 'read' exists and 'is_read' doesn't)
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name='notifications' AND column_name='read')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name='notifications' AND column_name='is_read') THEN
    ALTER TABLE notifications RENAME COLUMN "read" TO is_read;
  END IF;
END $$;

-- Update type check constraint to include new types
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
  CHECK (type IN ('job', 'property', 'property_group', 'work_order', 'callback', 'note', 'job_phase_change', 'contact', 'file', 'invoice', 'user', 'other', 'job_status_change', 'new_job_request'));

-- Create additional indexes for new columns
CREATE INDEX IF NOT EXISTS idx_notifications_activity_log_id ON notifications(activity_log_id);
CREATE INDEX IF NOT EXISTS idx_notifications_entity_id ON notifications(entity_id);

-- Make job_id nullable since not all notifications will have a job
ALTER TABLE notifications ALTER COLUMN job_id DROP NOT NULL;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "System can insert notifications" ON notifications;

-- Policy: Users can only view their own notifications
CREATE POLICY "Users can view their own notifications"
  ON notifications
  FOR SELECT
  USING (user_id = auth.uid());

-- Policy: Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications"
  ON notifications
  FOR UPDATE
  USING (user_id = auth.uid());

-- Policy: System can insert notifications for any user
CREATE POLICY "System can insert notifications"
  ON notifications
  FOR INSERT
  WITH CHECK (true);

-- Function to create notifications for activity
CREATE OR REPLACE FUNCTION create_notifications_from_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_notification_title TEXT;
  v_notification_message TEXT;
  v_user_record RECORD;
  v_creator_id UUID;
BEGIN
  -- Get the user who created the activity
  v_creator_id := NEW.changed_by;
  
  -- Build notification title and message based on entity type
  CASE NEW.entity_type
    WHEN 'job' THEN
      v_notification_title := 'New Job Created';
      v_notification_message := NEW.description;
    WHEN 'property' THEN
      v_notification_title := 'New Property Created';
      v_notification_message := NEW.description;
    WHEN 'property_group' THEN
      v_notification_title := 'New Property Group Created';
      v_notification_message := NEW.description;
    WHEN 'work_order' THEN
      v_notification_title := 'New Work Order Created';
      v_notification_message := NEW.description;
    WHEN 'callback' THEN
      v_notification_title := 'New Callback Scheduled';
      v_notification_message := NEW.description;
    WHEN 'note' THEN
      v_notification_title := 'New Note Added';
      v_notification_message := NEW.description;
    WHEN 'job_phase_change' THEN
      v_notification_title := 'Job Phase Changed';
      v_notification_message := NEW.description;
    WHEN 'contact' THEN
      v_notification_title := 'New Contact Created';
      v_notification_message := NEW.description;
    ELSE
      v_notification_title := 'New Activity';
      v_notification_message := NEW.description;
  END CASE;
  
  -- Create notifications for all admin and management users (except the creator)
  FOR v_user_record IN 
    SELECT id 
    FROM profiles 
    WHERE role IN ('admin', 'jg_management')
    AND id != COALESCE(v_creator_id, '00000000-0000-0000-0000-000000000000'::uuid)
  LOOP
    INSERT INTO notifications (
      user_id,
      activity_log_id,
      title,
      message,
      type,
      entity_id,
      job_id,
      metadata
    ) VALUES (
      v_user_record.id,
      NEW.id,
      v_notification_title,
      v_notification_message,
      NEW.entity_type,
      NEW.entity_id,
      CASE WHEN NEW.entity_type = 'job' THEN NEW.entity_id ELSE NULL END, -- Only set job_id if it's a job
      NEW.metadata
    );
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create notifications from activity log
DROP TRIGGER IF EXISTS create_notifications_from_activity_trigger ON activity_log;
CREATE TRIGGER create_notifications_from_activity_trigger
  AFTER INSERT ON activity_log
  FOR EACH ROW
  EXECUTE FUNCTION create_notifications_from_activity();

-- Function to mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE notifications
  SET is_read = true
  WHERE id = p_notification_id
  AND user_id = auth.uid();
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark all notifications as read for current user
CREATE OR REPLACE FUNCTION mark_all_notifications_read()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE notifications
  SET is_read = true
  WHERE user_id = auth.uid()
  AND is_read = false;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create view for easy notification querying
CREATE OR REPLACE VIEW notifications_view AS
SELECT 
  n.*,
  p.full_name as creator_name,
  p.email as creator_email,
  al.action as activity_action,
  al.metadata as activity_metadata
FROM notifications n
LEFT JOIN activity_log al ON n.activity_log_id = al.id
LEFT JOIN profiles p ON al.changed_by = p.id
ORDER BY n.created_at DESC;
