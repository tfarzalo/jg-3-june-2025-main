-- Check if Resend API key is configured
SELECT current_setting('app.settings.resend_api_key', true) as resend_key_status;

-- Check daily email settings table
SELECT * FROM daily_email_settings WHERE enabled = true;

-- Check if there are any jobs for today
SELECT 
  work_order_num,
  scheduled_date,
  status,
  properties.property_name,
  profiles.full_name as assigned_to
FROM jobs
LEFT JOIN properties ON jobs.property_id = properties.id
LEFT JOIN profiles ON jobs.assigned_user_id = profiles.id
WHERE DATE(scheduled_date AT TIME ZONE 'America/New_York') = CURRENT_DATE
AND status != 'Cancelled'
LIMIT 10;
