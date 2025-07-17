-- Create email_logs table to track notification emails
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID REFERENCES jobs(id),
  recipient_email TEXT NOT NULL,
  cc_emails TEXT,
  bcc_emails TEXT,
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  notification_type TEXT,
  template_id UUID REFERENCES email_templates(id),
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_email_logs_job_id ON email_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at);
CREATE INDEX IF NOT EXISTS idx_email_logs_notification_type ON email_logs(notification_type);
