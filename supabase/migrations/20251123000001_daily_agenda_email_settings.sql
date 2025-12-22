/*
  # Daily Agenda Email Settings

  1. New Table
    - `daily_email_settings` 
      - Stores which users should receive daily agenda emails
      - Links to profiles table
  
  2. Security
    - Enable RLS
    - Only admins can manage settings
*/

-- Create daily_email_settings table
CREATE TABLE IF NOT EXISTS daily_email_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE daily_email_settings ENABLE ROW LEVEL SECURITY;

-- Create policies (admin-only access)
CREATE POLICY "Admins can view all email settings"
  ON daily_email_settings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

CREATE POLICY "Admins can insert email settings"
  ON daily_email_settings
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update email settings"
  ON daily_email_settings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete email settings"
  ON daily_email_settings
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Create index for performance
CREATE INDEX idx_daily_email_settings_user_id ON daily_email_settings(user_id);
CREATE INDEX idx_daily_email_settings_enabled ON daily_email_settings(enabled) WHERE enabled = true;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_daily_email_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_daily_email_settings_timestamp
  BEFORE UPDATE ON daily_email_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_email_settings_updated_at();
