-- ============================================================================
-- FIX: Permission denied for schema cron
-- The trigger function needs SECURITY DEFINER to access cron schema
-- ============================================================================

-- Drop and recreate the function with SECURITY DEFINER
DROP FUNCTION IF EXISTS update_daily_email_cron_schedule() CASCADE;

CREATE OR REPLACE FUNCTION update_daily_email_cron_schedule()
RETURNS TRIGGER 
SECURITY DEFINER  -- ← This allows the function to access cron schema
SET search_path = public, cron
AS $func$
DECLARE
  hour_val INTEGER;
  minute_val INTEGER;
  cron_expr TEXT;
  cron_command TEXT;
BEGIN
  -- Extract hour and minute from the time
  hour_val := EXTRACT(HOUR FROM NEW.send_time_utc);
  minute_val := EXTRACT(MINUTE FROM NEW.send_time_utc);
  
  -- Build cron expression (minute hour * * *)
  cron_expr := minute_val || ' ' || hour_val || ' * * *';
  
  -- Build the command to execute
  cron_command := 'SELECT net.http_post(url := (SELECT value FROM cron_config WHERE key = ''supabase_url'') || ''/functions/v1/daily-agenda-cron-trigger'', headers := jsonb_build_object(''Content-Type'', ''application/json'', ''Authorization'', ''Bearer '' || (SELECT value FROM cron_config WHERE key = ''cron_secret'')), body := jsonb_build_object(''triggered_by'', ''pg_cron'', ''timestamp'', now())) as request_id;';
  
  -- Unschedule existing job (if exists)
  BEGIN
    PERFORM cron.unschedule('daily-agenda-email-cron');
  EXCEPTION WHEN OTHERS THEN
    -- Job might not exist yet, that's OK
    NULL;
  END;
  
  -- Reschedule with new time
  PERFORM cron.schedule(
    'daily-agenda-email-cron',
    cron_expr,
    cron_command
  );
  
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

-- Recreate the trigger
DROP TRIGGER IF EXISTS trigger_update_cron_schedule ON daily_email_config;

CREATE TRIGGER trigger_update_cron_schedule
  AFTER UPDATE ON daily_email_config
  FOR EACH ROW
  WHEN (OLD.send_time_utc IS DISTINCT FROM NEW.send_time_utc)
  EXECUTE FUNCTION update_daily_email_cron_schedule();

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check function was created with SECURITY DEFINER
SELECT 
  proname as function_name,
  prosecdef as is_security_definer,
  CASE 
    WHEN prosecdef THEN '✅ SECURITY DEFINER enabled'
    ELSE '❌ Not SECURITY DEFINER'
  END as status
FROM pg_proc 
WHERE proname = 'update_daily_email_cron_schedule';

-- Check trigger was recreated
SELECT 
  tgname as trigger_name,
  CASE tgenabled
    WHEN 'O' THEN '✅ Trigger enabled'
    ELSE '❌ Trigger disabled'
  END as status
FROM pg_trigger 
WHERE tgname = 'trigger_update_cron_schedule';

-- ============================================================================
-- TEST IT
-- ============================================================================
-- Now try updating the time again in the admin UI
-- It should work without permission errors!
-- ============================================================================
