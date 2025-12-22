-- Add working_days column to profiles table for subcontractor availability
-- This column will store a JSON object with boolean values for each day of the week

-- First, check if the profiles table exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'profiles') THEN
        RAISE EXCEPTION 'Table "profiles" does not exist. Please ensure the profiles table is created first.';
    END IF;
END $$;

-- Add the working_days column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'working_days'
    ) THEN
        ALTER TABLE profiles ADD COLUMN working_days JSONB;
        
        -- Set default values for the new column
        UPDATE profiles 
        SET working_days = '{"monday": true, "tuesday": true, "wednesday": true, "thursday": true, "friday": true, "saturday": false, "sunday": false}'::jsonb
        WHERE working_days IS NULL;
        
        -- Now set the default constraint
        ALTER TABLE profiles 
        ALTER COLUMN working_days SET DEFAULT '{"monday": true, "tuesday": true, "wednesday": true, "thursday": true, "friday": true, "saturday": false, "sunday": false}'::jsonb;
    END IF;
END $$;

-- Add a comment to document the column
COMMENT ON COLUMN profiles.working_days IS 'JSON object storing subcontractor working days availability. Format: {"monday": boolean, "tuesday": boolean, etc.}';

-- Create an index on working_days for better query performance (if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_indexes 
        WHERE indexname = 'idx_profiles_working_days'
    ) THEN
        CREATE INDEX idx_profiles_working_days ON profiles USING GIN (working_days);
    END IF;
END $$;

-- Update existing subcontractors to have default working days (Mon-Fri)
UPDATE profiles 
SET working_days = '{"monday": true, "tuesday": true, "wednesday": true, "thursday": true, "friday": true, "saturday": false, "sunday": false}'::jsonb
WHERE role = 'subcontractor' AND (working_days IS NULL OR working_days = '{}'::jsonb);

-- Add RLS policy to allow users to read working_days for scheduling purposes
-- This allows the Sub Scheduler to filter subcontractors based on availability
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_policies 
        WHERE policyname = 'Allow read working_days for scheduling'
    ) THEN
        CREATE POLICY "Allow read working_days for scheduling" ON profiles
        FOR SELECT USING (
            role = 'subcontractor' OR 
            auth.uid() IN (
                SELECT id FROM profiles WHERE role IN ('admin', 'jg_management')
            )
        );
    END IF;
END $$;

-- Add RLS policy to allow admins and JG management to update working_days
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_policies 
        WHERE policyname = 'Allow update working_days for admins'
    ) THEN
        CREATE POLICY "Allow update working_days for admins" ON profiles
        FOR UPDATE USING (
            auth.uid() IN (
                SELECT id FROM profiles WHERE role IN ('admin', 'jg_management')
            )
        );
    END IF;
END $$;
