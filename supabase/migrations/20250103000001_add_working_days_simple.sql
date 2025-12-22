-- Simple migration to add working_days column to profiles table
-- This approach avoids complex JSONB default values that might cause syntax errors

-- Step 1: Add the working_days column as nullable JSONB
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS working_days JSONB;

-- Step 2: Set default working days for existing subcontractors (Mon-Fri)
UPDATE profiles 
SET working_days = '{"monday": true, "tuesday": true, "wednesday": true, "thursday": true, "friday": true, "saturday": false, "sunday": false}'::jsonb
WHERE role = 'subcontractor' AND working_days IS NULL;

-- Step 3: Set default working days for all other users (Mon-Fri)
UPDATE profiles 
SET working_days = '{"monday": true, "tuesday": true, "wednesday": true, "thursday": true, "friday": true, "saturday": false, "sunday": false}'::jsonb
WHERE working_days IS NULL;

-- Step 4: Create index for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_working_days ON profiles USING GIN (working_days);

-- Step 5: Add comment for documentation
COMMENT ON COLUMN profiles.working_days IS 'JSON object storing user working days availability. Format: {"monday": boolean, "tuesday": boolean, etc.}';
