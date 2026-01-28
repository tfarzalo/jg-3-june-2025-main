-- View the successful logs
SELECT 
  sent_at AT TIME ZONE 'America/New_York' as sent_at_et,
  recipient_count,
  success_count,
  failure_count,
  triggered_by,
  CASE 
    WHEN error_details IS NULL THEN '✓ No errors'
    ELSE error_details::text
  END as status
FROM daily_summary_log 
ORDER BY sent_at DESC;
