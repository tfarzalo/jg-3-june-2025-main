-- Deduplicate notification feed items and improve work order activity log wording

-- 1) Override work order creation activity log to use WO-###### label (not UUID)
DROP TRIGGER IF EXISTS log_work_order_creation_trigger ON work_orders;
DROP FUNCTION IF EXISTS trigger_log_work_order_creation();

CREATE OR REPLACE FUNCTION trigger_log_work_order_creation()
RETURNS TRIGGER AS $$
DECLARE
  v_work_order_label TEXT;
  v_unit_number TEXT;
  v_property_name TEXT;
BEGIN
  SELECT format('WO-%s', lpad(j.work_order_num::text, 6, '0')),
         COALESCE(j.unit_number, NEW.unit_number),
         p.property_name
  INTO v_work_order_label, v_unit_number, v_property_name
  FROM jobs j
  LEFT JOIN properties p ON p.id = j.property_id
  WHERE j.id = NEW.job_id;

  IF NOT FOUND THEN
    v_work_order_label := 'WO-??????';
    v_unit_number := NEW.unit_number;
    v_property_name := NULL;
  END IF;

  PERFORM log_activity(
    'work_order',
    NEW.id,
    'created',
    format('%s • %s - Unit %s new work order created',
      COALESCE(v_work_order_label, 'WO-??????'),
      COALESCE(v_property_name, 'Unknown Property'),
      COALESCE(v_unit_number, 'Unknown Unit')
    ),
    jsonb_build_object(
      'job_id', NEW.job_id,
      'work_order_id', NEW.id,
      'work_order_label', v_work_order_label,
      'property_name', v_property_name,
      'unit_number', v_unit_number
    ),
    NEW.prepared_by
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER log_work_order_creation_trigger
  AFTER INSERT ON work_orders
  FOR EACH ROW
  EXECUTE FUNCTION trigger_log_work_order_creation();

-- 2) Deduplicate notifications in the bell feed (per user + activity_log_id)
CREATE OR REPLACE VIEW notifications_view AS
SELECT *
FROM (
  SELECT DISTINCT ON (n.user_id, COALESCE(n.activity_log_id, n.id))
    n.*,
    p.full_name as creator_name,
    p.email as creator_email,
    al.action as activity_action,
    al.metadata as activity_metadata
  FROM notifications n
  LEFT JOIN activity_log al ON n.activity_log_id = al.id
  LEFT JOIN profiles p ON al.changed_by = p.id
  ORDER BY n.user_id, COALESCE(n.activity_log_id, n.id), n.created_at DESC
) deduped
ORDER BY deduped.created_at DESC;
