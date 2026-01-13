-- Align activity logging and notifications with approval/decline/pending flows
-- - Preserve actor (changed_by) even for system-triggered events
-- - Ensure decline path mirrors approval changed_by fallback

-- 1) Update log_activity to accept explicit changed_by
DROP FUNCTION IF EXISTS log_activity(TEXT, UUID, TEXT, TEXT, JSONB);

CREATE OR REPLACE FUNCTION log_activity(
  p_entity_type TEXT,
  p_entity_id UUID,
  p_action TEXT,
  p_description TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_changed_by UUID DEFAULT auth.uid()
)
RETURNS UUID AS $$
DECLARE
  v_activity_id UUID;
BEGIN
  INSERT INTO activity_log (entity_type, entity_id, action, description, changed_by, metadata)
  VALUES (p_entity_type, p_entity_id, p_action, p_description, p_changed_by, p_metadata)
  RETURNING id INTO v_activity_id;
  RETURN v_activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2) Pass changed_by through the job phase change trigger
-- Drop existing trigger before replacing function to avoid dependency errors
DROP TRIGGER IF EXISTS log_job_phase_change_trigger ON job_phase_changes;
DROP FUNCTION IF EXISTS trigger_log_job_phase_change();

CREATE OR REPLACE FUNCTION trigger_log_job_phase_change()
RETURNS TRIGGER AS $$
DECLARE
  v_from_phase_name TEXT;
  v_to_phase_name TEXT;
  v_job_number TEXT;
  v_unit_number TEXT;
  v_property_name TEXT;
BEGIN
  SELECT job_phase_label INTO v_from_phase_name FROM job_phases WHERE id = NEW.from_phase_id;
  SELECT job_phase_label INTO v_to_phase_name FROM job_phases WHERE id = NEW.to_phase_id;
  SELECT format('WO-%s', lpad(work_order_num::text, 6, '0')),
         unit_number,
         p.property_name
  INTO v_job_number, v_unit_number, v_property_name
  FROM jobs j
  LEFT JOIN properties p ON p.id = j.property_id
  WHERE j.id = NEW.job_id;

  PERFORM log_activity(
    'job_phase_change',
    NEW.id,
    'phase_changed',
    format('%s • %s - Unit %s phase changed from %s to %s',
      v_job_number,
      COALESCE(v_property_name, 'Unknown Property'),
      COALESCE(v_unit_number, 'Unknown Unit'),
      COALESCE(v_from_phase_name, 'none'),
      COALESCE(v_to_phase_name, 'Unknown Phase')
    ),
    jsonb_build_object(
      'job_id', NEW.job_id,
      'from_phase_id', NEW.from_phase_id,
      'to_phase_id', NEW.to_phase_id,
      'from_phase_name', COALESCE(v_from_phase_name, 'none'),
      'to_phase_name', COALESCE(v_to_phase_name, 'Unknown Phase'),
      'work_order_label', v_job_number,
      'property_name', v_property_name,
      'unit_number', v_unit_number,
      'change_reason', NEW.change_reason
    ),
    NEW.changed_by
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Re-attach trigger to ensure updated function is used
CREATE TRIGGER log_job_phase_change_trigger
  AFTER INSERT ON job_phase_changes
  FOR EACH ROW
  EXECUTE FUNCTION trigger_log_job_phase_change();

-- 3) Mirror changed_by fallback for decline path
DROP FUNCTION IF EXISTS public.process_decline_token(VARCHAR, TEXT);

CREATE OR REPLACE FUNCTION public.process_decline_token(
  p_token VARCHAR(255),
  p_decline_reason TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_data RECORD;
  v_job_work_order_num INTEGER;
  v_current_phase_id UUID;
  v_current_phase_label TEXT;
  v_system_user_id UUID;
BEGIN
  SELECT * INTO v_token_data
  FROM approval_tokens
  WHERE token = p_token
    AND used_at IS NULL
    AND expires_at > NOW();

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Invalid or expired approval token'
    );
  END IF;

  SELECT j.work_order_num, j.current_phase_id, jp.job_phase_label
  INTO v_job_work_order_num, v_current_phase_id, v_current_phase_label
  FROM jobs j
  LEFT JOIN job_phases jp ON jp.id = j.current_phase_id
  WHERE j.id = v_token_data.job_id;

  UPDATE approval_tokens
  SET used_at = NOW(),
      decision = 'declined',
      decision_at = NOW(),
      decline_reason = p_decline_reason
  WHERE token = p_token;

  -- Choose system user fallback to satisfy NOT NULL on changed_by
  SELECT id INTO v_system_user_id
  FROM profiles
  WHERE role IN ('admin', 'jg_management')
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_system_user_id IS NULL THEN
    SELECT id INTO v_system_user_id
    FROM profiles
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  INSERT INTO job_phase_changes (
    job_id,
    changed_by,
    from_phase_id,
    to_phase_id,
    change_reason
  ) VALUES (
    v_token_data.job_id,
    v_system_user_id,
    v_current_phase_id,
    v_current_phase_id,
    format('Extra charges declined by %s%s',
           COALESCE(v_token_data.approver_name, v_token_data.approver_email),
           CASE WHEN p_decline_reason IS NOT NULL AND p_decline_reason != ''
                THEN format('. Reason: %s', p_decline_reason)
                ELSE ''
           END)
  );

  RETURN json_build_object(
    'success', true,
    'message', 'Extra charges declined successfully',
    'job_id', v_token_data.job_id,
    'work_order_num', v_job_work_order_num,
    'decision', 'declined'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', format('Database error: %s', SQLERRM)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_decline_token(VARCHAR, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.process_decline_token(VARCHAR, TEXT) TO authenticated;

COMMENT ON FUNCTION public.process_decline_token(VARCHAR, TEXT) IS
  'Processes decline action from approval email link, logs phase change with system user fallback for changed_by, does not advance phase.';
