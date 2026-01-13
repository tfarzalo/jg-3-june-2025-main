-- Refresh activity log trigger wording to match UI (WO-######, property, unit, clear phase labels)

-- Recreate job creation trigger function with improved description
DROP TRIGGER IF EXISTS log_job_creation_trigger ON jobs;
DROP FUNCTION IF EXISTS trigger_log_job_creation();

CREATE OR REPLACE FUNCTION trigger_log_job_creation()
RETURNS TRIGGER AS $$
DECLARE
  v_work_order_label TEXT;
  v_property_name TEXT;
BEGIN
  SELECT format('WO-%s', lpad(NEW.work_order_num::text, 6, '0')) INTO v_work_order_label;
  SELECT property_name INTO v_property_name FROM properties WHERE id = NEW.property_id;

  PERFORM log_activity(
    'job',
    NEW.id,
    'created',
    format('%s created for Unit %s at %s',
      v_work_order_label,
      COALESCE(NEW.unit_number, 'Unknown Unit'),
      COALESCE(v_property_name, 'Unknown Property')
    ),
    jsonb_build_object(
      'work_order_label', v_work_order_label,
      'unit_number', NEW.unit_number,
      'property_id', NEW.property_id,
      'property_name', v_property_name
    ),
    NEW.created_by
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER log_job_creation_trigger
  AFTER INSERT ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION trigger_log_job_creation();

-- Recreate job phase change trigger function with improved description
DROP TRIGGER IF EXISTS log_job_phase_change_trigger ON job_phase_changes;
DROP FUNCTION IF EXISTS trigger_log_job_phase_change();

CREATE OR REPLACE FUNCTION trigger_log_job_phase_change()
RETURNS TRIGGER AS $$
DECLARE
  v_from_phase_name TEXT;
  v_to_phase_name TEXT;
  v_work_order_label TEXT;
  v_unit_number TEXT;
  v_property_name TEXT;
BEGIN
  SELECT job_phase_label INTO v_from_phase_name FROM job_phases WHERE id = NEW.from_phase_id;
  SELECT job_phase_label INTO v_to_phase_name FROM job_phases WHERE id = NEW.to_phase_id;

  SELECT format('WO-%s', lpad(work_order_num::text, 6, '0')),
         unit_number,
         p.property_name
  INTO v_work_order_label, v_unit_number, v_property_name
  FROM jobs j
  LEFT JOIN properties p ON p.id = j.property_id
  WHERE j.id = NEW.job_id;

  PERFORM log_activity(
    'job_phase_change',
    NEW.id,
    'phase_changed',
    format('%s • %s - Unit %s phase changed from %s to %s',
      v_work_order_label,
      COALESCE(v_property_name, 'Unknown Property'),
      COALESCE(v_unit_number, 'Unknown Unit'),
      COALESCE(v_from_phase_name, 'None'),
      COALESCE(v_to_phase_name, 'Unknown Phase')
    ),
    jsonb_build_object(
      'job_id', NEW.job_id,
      'from_phase_id', NEW.from_phase_id,
      'to_phase_id', NEW.to_phase_id,
      'from_phase_name', COALESCE(v_from_phase_name, 'None'),
      'to_phase_name', COALESCE(v_to_phase_name, 'Unknown Phase'),
      'work_order_label', v_work_order_label,
      'property_name', v_property_name,
      'unit_number', v_unit_number,
      'change_reason', NEW.change_reason
    ),
    NEW.changed_by
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER log_job_phase_change_trigger
  AFTER INSERT ON job_phase_changes
  FOR EACH ROW
  EXECUTE FUNCTION trigger_log_job_phase_change();
