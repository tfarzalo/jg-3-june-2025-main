/*
  # Comprehensive Trigger Error Handling Fix

  ## Purpose
  Add defensive coding and error handling to ALL activity log trigger functions
  to prevent any of them from breaking core functionality.

  ## What This Does
  - Updates all trigger functions to handle NULL values
  - Adds exception handling to all triggers
  - Ensures triggers never block main operations
  - Preserves all logging functionality
*/

-- ========================================
-- FIX 1: Job Creation Trigger
-- ========================================
CREATE OR REPLACE FUNCTION trigger_log_job_creation()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM log_activity(
    'job',
    NEW.id,
    'created',
    format('Job %s created for unit %s', 
      COALESCE('JOB #' || NEW.work_order_num::TEXT, 'created'),
      COALESCE(NEW.unit_number, 'N/A')
    ),
    jsonb_build_object(
      'work_order_num', NEW.work_order_num,
      'unit_number', NEW.unit_number,
      'property_id', NEW.property_id
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to log job creation: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- FIX 2: Property Creation Trigger
-- ========================================
CREATE OR REPLACE FUNCTION trigger_log_property_creation()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM log_activity(
    'property',
    NEW.id,
    'created',
    format('Property "%s" created', COALESCE(NEW.name, 'Unnamed Property')),
    jsonb_build_object(
      'name', NEW.name,
      'city', NEW.city,
      'state', NEW.state
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to log property creation: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- FIX 3: Property Group Creation Trigger
-- ========================================
CREATE OR REPLACE FUNCTION trigger_log_property_group_creation()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM log_activity(
    'property_group',
    NEW.id,
    'created',
    format('Property group "%s" created', COALESCE(NEW.name, 'Unnamed Group')),
    jsonb_build_object(
      'name', NEW.name
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to log property group creation: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- FIX 4: Work Order Creation Trigger
-- ========================================
CREATE OR REPLACE FUNCTION trigger_log_work_order_creation()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM log_activity(
    'work_order',
    NEW.id,
    'created',
    format('Work order created for job %s', COALESCE(NEW.job_id::TEXT, 'unknown')),
    jsonb_build_object(
      'job_id', NEW.job_id,
      'unit_number', NEW.unit_number,
      'is_full_paint', NEW.is_full_paint
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to log work order creation: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- FIX 5: Callback Creation Trigger
-- ========================================
CREATE OR REPLACE FUNCTION trigger_log_callback_creation()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM log_activity(
    'callback',
    NEW.id,
    'created',
    format('Callback scheduled for %s', COALESCE(NEW.scheduled_date::TEXT, 'TBD')),
    jsonb_build_object(
      'job_id', NEW.job_id,
      'scheduled_date', NEW.scheduled_date,
      'reason', NEW.reason
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to log callback creation: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- FIX 6: Note Creation Trigger
-- ========================================
CREATE OR REPLACE FUNCTION trigger_log_note_creation()
RETURNS TRIGGER AS $$
DECLARE
  v_entity_type TEXT;
  v_entity_name TEXT;
BEGIN
  -- Determine entity type based on which foreign key is set
  IF NEW.job_id IS NOT NULL THEN
    v_entity_type := 'job';
    BEGIN
      SELECT format('Job #%s', COALESCE(work_order_num::TEXT, id::TEXT)) 
      INTO v_entity_name 
      FROM jobs 
      WHERE id = NEW.job_id;
    EXCEPTION WHEN OTHERS THEN
      v_entity_name := 'Unknown Job';
    END;
  ELSIF NEW.property_id IS NOT NULL THEN
    v_entity_type := 'property';
    BEGIN
      SELECT COALESCE(name, 'Unknown Property') 
      INTO v_entity_name 
      FROM properties 
      WHERE id = NEW.property_id;
    EXCEPTION WHEN OTHERS THEN
      v_entity_name := 'Unknown Property';
    END;
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
      'note_preview', LEFT(COALESCE(NEW.note_text, ''), 100)
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to log note creation: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- FIX 7: Contact Creation Trigger
-- ========================================
CREATE OR REPLACE FUNCTION trigger_log_contact_creation()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM log_activity(
    'contact',
    NEW.id,
    'created',
    format('Contact "%s" created', COALESCE(NEW.name, NEW.email, 'Unnamed Contact')),
    jsonb_build_object(
      'name', NEW.name,
      'email', NEW.email,
      'property_id', NEW.property_id
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to log contact creation: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- FIX 8: Job Phase Change Trigger
-- ========================================
CREATE OR REPLACE FUNCTION trigger_log_job_phase_change()
RETURNS TRIGGER AS $$
DECLARE
  v_from_phase_name TEXT;
  v_to_phase_name TEXT;
  v_job_info TEXT;
BEGIN
  -- Get phase names safely
  BEGIN
    SELECT label INTO v_from_phase_name FROM job_phases WHERE id = NEW.from_phase_id;
  EXCEPTION WHEN OTHERS THEN
    v_from_phase_name := NULL;
  END;
  
  BEGIN
    SELECT label INTO v_to_phase_name FROM job_phases WHERE id = NEW.to_phase_id;
  EXCEPTION WHEN OTHERS THEN
    v_to_phase_name := 'Unknown Phase';
  END;
  
  -- Get job info safely
  BEGIN
    SELECT format('Job #%s', COALESCE(work_order_num::TEXT, id::TEXT)) 
    INTO v_job_info 
    FROM jobs 
    WHERE id = NEW.job_id;
  EXCEPTION WHEN OTHERS THEN
    v_job_info := 'Unknown Job';
  END;
  
  PERFORM log_activity(
    'job_phase_change',
    NEW.id,
    'phase_changed',
    format('%s phase changed from %s to %s', 
      COALESCE(v_job_info, 'Unknown Job'),
      COALESCE(v_from_phase_name, 'none'),
      COALESCE(v_to_phase_name, 'unknown')
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
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to log job phase change: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- VERIFICATION
-- ========================================

SELECT 
  'All trigger functions updated with error handling' as status,
  'Triggers will no longer block main operations' as result,
  'Job creation and all other operations should now work' as expected_outcome;

-- Show all updated functions
SELECT 
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  'Updated with error handling' as status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname LIKE 'trigger_log_%'
ORDER BY p.proname;
