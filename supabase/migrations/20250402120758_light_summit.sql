-- Create user_notifications table
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

-- Add notification_settings column to profiles table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'notification_settings'
  ) THEN
    ALTER TABLE profiles ADD COLUMN notification_settings jsonb;
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id ON user_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_is_read ON user_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_user_notifications_created_at ON user_notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_user_notifications_type ON user_notifications(type);

-- Enable RLS
ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;

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

-- Create function to send notification to user
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
        v_should_send := (v_notification_settings->>'job_phase_changes')::boolean;
      WHEN 'work_order' THEN
        v_should_send := (v_notification_settings->>'work_orders')::boolean;
      WHEN 'callback' THEN
        v_should_send := (v_notification_settings->>'callbacks')::boolean;
      WHEN 'system' THEN
        v_should_send := (v_notification_settings->>'system_alerts')::boolean;
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

-- Create trigger function to send notifications on job phase changes
CREATE OR REPLACE FUNCTION notify_job_phase_change()
RETURNS TRIGGER AS $$
DECLARE
  v_job_record record;
  v_from_phase text;
  v_to_phase text;
  v_property_name text;
  v_unit_number text;
  v_admin_users uuid[];
  v_jg_management_users uuid[];
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
  
  -- Send notification to job creator
  PERFORM send_notification(
    NEW.changed_by,
    'Job Phase Changed',
    'Job at ' || v_property_name || ' Unit ' || v_unit_number || ' changed from ' || v_from_phase || ' to ' || v_to_phase,
    'job_phase_change',
    NEW.job_id,
    'job'
  );
  
  -- Get admin users and send notifications
  FOR v_admin_id IN 
    SELECT id FROM profiles WHERE role = 'admin'
  LOOP
    -- Don't send duplicate notification to the user who made the change
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
  
  -- Get JG Management users and send notifications
  FOR v_jg_management_id IN 
    SELECT id FROM profiles WHERE role = 'jg_management'
  LOOP
    -- Don't send duplicate notification to the user who made the change
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

-- Create trigger for job phase changes
CREATE TRIGGER job_phase_change_notification
AFTER INSERT ON job_phase_changes
FOR EACH ROW
EXECUTE FUNCTION notify_job_phase_change();

-- Create trigger function to send notifications on work order creation
CREATE OR REPLACE FUNCTION notify_work_order_creation()
RETURNS TRIGGER AS $$
DECLARE
  v_job_record record;
  v_property_name text;
  v_unit_number text;
  v_admin_id uuid;
  v_jg_management_id uuid;
BEGIN
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
  
  -- Send notification to work order creator
  PERFORM send_notification(
    NEW.prepared_by,
    'Work Order Created',
    'Work order for ' || v_property_name || ' Unit ' || v_unit_number || ' has been created',
    'work_order',
    NEW.job_id,
    'job'
  );
  
  -- Get admin users and send notifications
  FOR v_admin_id IN 
    SELECT id FROM profiles WHERE role = 'admin'
  LOOP
    -- Don't send duplicate notification to the user who created the work order
    IF v_admin_id != NEW.prepared_by THEN
      PERFORM send_notification(
        v_admin_id,
        'Work Order Created',
        'Work order for ' || v_property_name || ' Unit ' || v_unit_number || ' has been created',
        'work_order',
        NEW.job_id,
        'job'
      );
    END IF;
  END LOOP;
  
  -- Get JG Management users and send notifications
  FOR v_jg_management_id IN 
    SELECT id FROM profiles WHERE role = 'jg_management'
  LOOP
    -- Don't send duplicate notification to the user who created the work order
    IF v_jg_management_id != NEW.prepared_by THEN
      PERFORM send_notification(
        v_jg_management_id,
        'Work Order Created',
        'Work order for ' || v_property_name || ' Unit ' || v_unit_number || ' has been created',
        'work_order',
        NEW.job_id,
        'job'
      );
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for work order creation
CREATE TRIGGER work_order_creation_notification
AFTER INSERT ON work_orders
FOR EACH ROW
EXECUTE FUNCTION notify_work_order_creation();

-- Create trigger function to send notifications on property callbacks
CREATE OR REPLACE FUNCTION notify_property_callback()
RETURNS TRIGGER AS $$
DECLARE
  v_property_name text;
  v_admin_id uuid;
  v_jg_management_id uuid;
BEGIN
  -- Get property name
  SELECT property_name INTO v_property_name
  FROM properties
  WHERE id = NEW.property_id;
  
  -- Send notification to callback creator
  PERFORM send_notification(
    NEW.posted_by,
    'Property Callback Added',
    'Callback for ' || v_property_name || ' Unit ' || NEW.unit_number || ' has been scheduled for ' || NEW.callback_date,
    'callback',
    NEW.property_id,
    'property'
  );
  
  -- Get admin users and send notifications
  FOR v_admin_id IN 
    SELECT id FROM profiles WHERE role = 'admin'
  LOOP
    -- Don't send duplicate notification to the user who created the callback
    IF v_admin_id != NEW.posted_by THEN
      PERFORM send_notification(
        v_admin_id,
        'Property Callback Added',
        'Callback for ' || v_property_name || ' Unit ' || NEW.unit_number || ' has been scheduled for ' || NEW.callback_date,
        'callback',
        NEW.property_id,
        'property'
      );
    END IF;
  END LOOP;
  
  -- Get JG Management users and send notifications
  FOR v_jg_management_id IN 
    SELECT id FROM profiles WHERE role = 'jg_management'
  LOOP
    -- Don't send duplicate notification to the user who created the callback
    IF v_jg_management_id != NEW.posted_by THEN
      PERFORM send_notification(
        v_jg_management_id,
        'Property Callback Added',
        'Callback for ' || v_property_name || ' Unit ' || NEW.unit_number || ' has been scheduled for ' || NEW.callback_date,
        'callback',
        NEW.property_id,
        'property'
      );
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for property callbacks
CREATE TRIGGER property_callback_notification
AFTER INSERT ON property_callbacks
FOR EACH ROW
EXECUTE FUNCTION notify_property_callback();

-- Insert some sample notifications for testing
DO $$ 
DECLARE
  v_admin_id uuid;
BEGIN
  -- Get an admin user ID
  SELECT id INTO v_admin_id
  FROM profiles
  WHERE role = 'admin'
  LIMIT 1;
  
  IF v_admin_id IS NOT NULL THEN
    -- Insert sample notifications
    INSERT INTO user_notifications (
      user_id,
      title,
      message,
      type,
      is_read
    ) VALUES 
    (v_admin_id, 'Welcome to Paint Manager Pro', 'Thank you for using our application. This is a sample notification.', 'system', false),
    (v_admin_id, 'New Feature Available', 'Check out our new notification system!', 'system', false),
    (v_admin_id, 'System Maintenance', 'The system will be down for maintenance on Sunday at 2 AM EST.', 'alert', false);
  END IF;
END $$;