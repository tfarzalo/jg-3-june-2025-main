-- OUTBOUND EMAIL SIZE REPORT
-- Read-only. Requires 20261005000001_add_outbound_email_size_metrics.sql.

SELECT
  created_at,
  provider,
  status,
  subject,
  to_emails,
  attachment_count,
  image_attachment_count,
  round(attachment_bytes / 1024.0, 1) AS raw_attachment_kb,
  round(estimated_encoded_attachment_bytes / 1024.0, 1) AS encoded_attachment_kb,
  round(html_bytes / 1024.0, 1) AS html_kb,
  round(text_bytes / 1024.0, 1) AS text_kb,
  round(estimated_message_bytes / 1024.0, 1) AS estimated_message_kb,
  round(estimated_message_bytes / 1048576.0, 2) AS estimated_message_mb,
  size_warnings,
  attachment_metadata,
  provider_message_id,
  last_error
FROM public.outbound_email_sends
ORDER BY created_at DESC
LIMIT 200;
