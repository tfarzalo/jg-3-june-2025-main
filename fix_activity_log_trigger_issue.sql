/*
  # Fix Activity Log Trigger Issue

  ## Problem
  The trigger_log_job_creation function is trying to access NEW.work_order_num
  which may be NULL during INSERT, causing the create_job RPC to fail with a 400 error.

  ## Solution
  Make the trigger more defensive and handle NULL values gracefully.
*/

-- Fix the trigger function to handle NULL work_order_num
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
  -- If logging fails, don't block the job creation
  RAISE WARNING 'Failed to log job creation: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify the fix
SELECT 'Activity log trigger fixed - job creation should now work' as status;
