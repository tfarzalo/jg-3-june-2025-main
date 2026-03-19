/*
  # Add App Config Table with Maintenance Mode

  1. New Table
    - `app_config`
      - `id` (uuid, primary key)
      - `key` (text, unique) — the setting name
      - `value` (jsonb) — the setting value
      - `updated_at` (timestamptz)
      - `updated_by` (uuid, references auth.users)

  2. Default Data
    - Insert default maintenance_mode row with enabled: false

  3. Security
    - Enable RLS
    - All authenticated users can SELECT (needed for the gate to work)
    - Only admin and is_super_admin roles can INSERT / UPDATE
*/

-- Create the app_config table
CREATE TABLE IF NOT EXISTS app_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read app config (required for the maintenance gate)
CREATE POLICY "Authenticated users can read app config"
  ON app_config
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can insert config rows
CREATE POLICY "Admins can insert app config"
  ON app_config
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'is_super_admin')
    )
  );

-- Only admins can update config rows
CREATE POLICY "Admins can update app config"
  ON app_config
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'is_super_admin')
    )
  );

-- Insert default maintenance_mode config row
INSERT INTO app_config (key, value)
VALUES (
  'maintenance_mode',
  '{"enabled": false, "message": "We are currently performing scheduled maintenance. We will be back shortly."}'
)
ON CONFLICT (key) DO NOTHING;

-- Add comment
COMMENT ON TABLE app_config IS 'Global application configuration key/value store. Used for feature flags and settings like maintenance mode.';
