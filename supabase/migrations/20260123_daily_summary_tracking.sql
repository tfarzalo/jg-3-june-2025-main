-- Migration: Daily Summary Email Tracking
-- Created: 2026-01-23
-- Purpose: Add tracking table for daily summary email sends

-- Table to track when daily summaries were sent
CREATE TABLE IF NOT EXISTS daily_summary_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  recipient_count INTEGER NOT NULL,
  success_count INTEGER NOT NULL,
  failure_count INTEGER NOT NULL,
  triggered_by TEXT NOT NULL, -- 'manual', 'cron', 'test'
  error_details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying recent runs
CREATE INDEX IF NOT EXISTS idx_daily_summary_log_sent_at ON daily_summary_log(sent_at DESC);

-- Enable RLS
ALTER TABLE daily_summary_log ENABLE ROW LEVEL SECURITY;

-- Only service role can read/write (admins can view in SQL editor)
CREATE POLICY "Service role can manage logs" ON daily_summary_log
  FOR ALL 
  USING (auth.role() = 'service_role');

-- Grant permissions
GRANT ALL ON daily_summary_log TO service_role;

-- Add comment
COMMENT ON TABLE daily_summary_log IS 'Tracks daily summary email sending history for monitoring and debugging';
