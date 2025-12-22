-- Create activity_log table for tracking all entity creation and updates
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('job', 'property', 'property_group', 'work_order', 'callback', 'note', 'job_phase_change', 'contact', 'file', 'invoice', 'user', 'other')),
  entity_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted', 'phase_changed', 'assigned', 'completed', 'cancelled', 'approved', 'rejected', 'other')),
  description TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX idx_activity_log_entity_type ON activity_log(entity_type);
CREATE INDEX idx_activity_log_entity_id ON activity_log(entity_id);
CREATE INDEX idx_activity_log_changed_by ON activity_log(changed_by);
CREATE INDEX idx_activity_log_created_at ON activity_log(created_at DESC);
CREATE INDEX idx_activity_log_action ON activity_log(action);

-- Enable RLS
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read activity logs (for transparency)
CREATE POLICY "Anyone can view activity logs"
  ON activity_log
  FOR SELECT
  USING (true);

-- Policy: Authenticated users can insert activity logs
CREATE POLICY "Authenticated users can insert activity logs"
  ON activity_log
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Create function to log activity
CREATE OR REPLACE FUNCTION log_activity(
  p_entity_type TEXT,
  p_entity_id UUID,
  p_action TEXT,
  p_description TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  v_activity_id UUID;
BEGIN
  INSERT INTO activity_log (entity_type, entity_id, action, description, changed_by, metadata)
  VALUES (p_entity_type, p_entity_id, p_action, p_description, auth.uid(), p_metadata)
  RETURNING id INTO v_activity_id;
  
  RETURN v_activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger function to log job creation
CREATE OR REPLACE FUNCTION trigger_log_job_creation()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM log_activity(
    'job',
    NEW.id,
    'created',
    format('Job #%s created for unit %s', NEW.work_order_num, NEW.unit_number),
    jsonb_build_object(
      'work_order_num', NEW.work_order_num,
      'unit_number', NEW.unit_number,
      'property_id', NEW.property_id
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger function to log property creation
CREATE OR REPLACE FUNCTION trigger_log_property_creation()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM log_activity(
    'property',
    NEW.id,
    'created',
    format('Property "%s" created', NEW.name),
    jsonb_build_object(
      'name', NEW.name,
      'city', NEW.city,
      'state', NEW.state
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger function to log property group creation
CREATE OR REPLACE FUNCTION trigger_log_property_group_creation()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM log_activity(
    'property_group',
    NEW.id,
    'created',
    format('Property group "%s" created', NEW.name),
    jsonb_build_object(
      'name', NEW.name
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger function to log work order creation
CREATE OR REPLACE FUNCTION trigger_log_work_order_creation()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM log_activity(
    'work_order',
    NEW.id,
    'created',
    format('Work order created for job %s', NEW.job_id),
    jsonb_build_object(
      'job_id', NEW.job_id,
      'unit_number', NEW.unit_number,
      'is_full_paint', NEW.is_full_paint
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger function to log callback creation
CREATE OR REPLACE FUNCTION trigger_log_callback_creation()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM log_activity(
    'callback',
    NEW.id,
    'created',
    format('Callback scheduled for %s', NEW.scheduled_date::DATE),
    jsonb_build_object(
      'job_id', NEW.job_id,
      'scheduled_date', NEW.scheduled_date,
      'reason', NEW.reason
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger function to log note creation
CREATE OR REPLACE FUNCTION trigger_log_note_creation()
RETURNS TRIGGER AS $$
DECLARE
  v_entity_type TEXT;
  v_entity_name TEXT;
BEGIN
  -- Determine entity type based on which foreign key is set
  IF NEW.job_id IS NOT NULL THEN
    v_entity_type := 'job';
    SELECT format('Job #%s', work_order_num) INTO v_entity_name FROM jobs WHERE id = NEW.job_id;
  ELSIF NEW.property_id IS NOT NULL THEN
    v_entity_type := 'property';
    SELECT name INTO v_entity_name FROM properties WHERE id = NEW.property_id;
  ELSE
    v_entity_type := 'other';
    v_entity_name := 'Unknown entity';
  END IF;
  
  PERFORM log_activity(
    'note',
    NEW.id,
    'created',
    format('Note added to %s', v_entity_name),
    jsonb_build_object(
      'entity_type', v_entity_type,
      'job_id', NEW.job_id,
      'property_id', NEW.property_id,
      'note_preview', LEFT(NEW.note_text, 100)
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger function to log contact creation
CREATE OR REPLACE FUNCTION trigger_log_contact_creation()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM log_activity(
    'contact',
    NEW.id,
    'created',
    format('Contact "%s" created', COALESCE(NEW.name, NEW.email)),
    jsonb_build_object(
      'name', NEW.name,
      'email', NEW.email,
      'property_id', NEW.property_id
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger function to log job phase changes
CREATE OR REPLACE FUNCTION trigger_log_job_phase_change()
RETURNS TRIGGER AS $$
DECLARE
  v_from_phase_name TEXT;
  v_to_phase_name TEXT;
  v_job_info TEXT;
BEGIN
  -- Get phase names
  SELECT label INTO v_from_phase_name FROM job_phases WHERE id = NEW.from_phase_id;
  SELECT label INTO v_to_phase_name FROM job_phases WHERE id = NEW.to_phase_id;
  
  -- Get job info
  SELECT format('Job #%s', work_order_num) INTO v_job_info FROM jobs WHERE id = NEW.job_id;
  
  PERFORM log_activity(
    'job_phase_change',
    NEW.id,
    'phase_changed',
    format('%s phase changed from %s to %s', 
      v_job_info,
      COALESCE(v_from_phase_name, 'none'),
      v_to_phase_name
    ),
    jsonb_build_object(
      'job_id', NEW.job_id,
      'from_phase_id', NEW.from_phase_id,
      'to_phase_id', NEW.to_phase_id,
      'from_phase_name', v_from_phase_name,
      'to_phase_name', v_to_phase_name,
      'change_reason', NEW.change_reason
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach triggers to tables
-- Jobs
DROP TRIGGER IF EXISTS log_job_creation_trigger ON jobs;
CREATE TRIGGER log_job_creation_trigger
  AFTER INSERT ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION trigger_log_job_creation();

-- Properties
DROP TRIGGER IF EXISTS log_property_creation_trigger ON properties;
CREATE TRIGGER log_property_creation_trigger
  AFTER INSERT ON properties
  FOR EACH ROW
  EXECUTE FUNCTION trigger_log_property_creation();

-- Property Management Groups
DROP TRIGGER IF EXISTS log_property_group_creation_trigger ON property_management_groups;
CREATE TRIGGER log_property_group_creation_trigger
  AFTER INSERT ON property_management_groups
  FOR EACH ROW
  EXECUTE FUNCTION trigger_log_property_group_creation();

-- Work Orders
DROP TRIGGER IF EXISTS log_work_order_creation_trigger ON work_orders;
CREATE TRIGGER log_work_order_creation_trigger
  AFTER INSERT ON work_orders
  FOR EACH ROW
  EXECUTE FUNCTION trigger_log_work_order_creation();

-- Callbacks (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'callbacks') THEN
    DROP TRIGGER IF EXISTS log_callback_creation_trigger ON callbacks;
    CREATE TRIGGER log_callback_creation_trigger
      AFTER INSERT ON callbacks
      FOR EACH ROW
      EXECUTE FUNCTION trigger_log_callback_creation();
  END IF;
END $$;

-- Notes (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notes') THEN
    DROP TRIGGER IF EXISTS log_note_creation_trigger ON notes;
    CREATE TRIGGER log_note_creation_trigger
      AFTER INSERT ON notes
      FOR EACH ROW
      EXECUTE FUNCTION trigger_log_note_creation();
  END IF;
END $$;

-- Contacts
DROP TRIGGER IF EXISTS log_contact_creation_trigger ON contacts;
CREATE TRIGGER log_contact_creation_trigger
  AFTER INSERT ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION trigger_log_contact_creation();

-- Job Phase Changes
DROP TRIGGER IF EXISTS log_job_phase_change_trigger ON job_phase_changes;
CREATE TRIGGER log_job_phase_change_trigger
  AFTER INSERT ON job_phase_changes
  FOR EACH ROW
  EXECUTE FUNCTION trigger_log_job_phase_change();

-- Create view for easy activity querying with user names
CREATE OR REPLACE VIEW activity_log_view AS
SELECT 
  al.*,
  p.full_name as changed_by_name,
  p.email as changed_by_email
FROM activity_log al
LEFT JOIN profiles p ON al.changed_by = p.id
ORDER BY al.created_at DESC;
