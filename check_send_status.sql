-- Check if the email send was logged
SELECT 
  sent_at AT TIME ZONE 'America/New_York' as sent_at_et,
  recipient_count,
  success_count,
  failure_count,
  triggered_by,
  error_details
FROM daily_summary_log 
ORDER BY sent_at DESC 
LIMIT 3;

-- If no rows above, check if table is empty
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN 'Table is empty - email may not have been sent yet'
    ELSE 'Table has ' || COUNT(*) || ' rows'
  END as table_status
FROM daily_summary_log;
