-- Apply this migration in Supabase SQL Editor
-- This fixes the relationship issue between daily_email_settings and profiles

-- Fix daily_email_settings table to have proper foreign key relationship with profiles

-- First, ensure the table exists with the correct structure
CREATE TABLE IF NOT EXISTS daily_email_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- If the table already exists but missing the foreign key, add it
DO $$
BEGIN
  -- Drop the old constraint if it exists (in case it was named differently)
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'daily_email_settings_user_id_fkey'
  ) THEN
    ALTER TABLE daily_email_settings DROP CONSTRAINT daily_email_settings_user_id_fkey;
  END IF;
  
  -- Add the foreign key constraint
  ALTER TABLE daily_email_settings
    ADD CONSTRAINT daily_email_settings_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES profiles(id) 
    ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN
    -- Foreign key already exists, skip
    NULL;
END $$;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_daily_email_settings_user_id ON daily_email_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_email_settings_enabled ON daily_email_settings(enabled);

-- Enable RLS
ALTER TABLE daily_email_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view their own email settings" ON daily_email_settings;
CREATE POLICY "Users can view their own email settings"
  ON daily_email_settings
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all email settings" ON daily_email_settings;
CREATE POLICY "Admins can view all email settings"
  ON daily_email_settings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update all email settings" ON daily_email_settings;
CREATE POLICY "Admins can update all email settings"
  ON daily_email_settings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Grant permissions
GRANT ALL ON daily_email_settings TO authenticated;
GRANT ALL ON daily_email_settings TO service_role;

-- Create a helper function to get enabled email recipients
-- This avoids PostgREST relationship issues
CREATE OR REPLACE FUNCTION get_enabled_email_recipients()
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text
) 
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    des.user_id,
    p.email,
    p.full_name
  FROM daily_email_settings des
  INNER JOIN profiles p ON p.id = des.user_id
  WHERE des.enabled = true
  AND p.email IS NOT NULL;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_enabled_email_recipients() TO authenticated;
GRANT EXECUTE ON FUNCTION get_enabled_email_recipients() TO service_role;

-- Comment
COMMENT ON TABLE daily_email_settings IS 'Stores per-user settings for daily agenda email delivery';
COMMENT ON FUNCTION get_enabled_email_recipients() IS 'Returns list of users with daily email enabled and valid email addresses';
