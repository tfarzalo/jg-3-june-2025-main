-- Simple migration to add profile availability fields
-- This approach avoids policy conflicts and uses safer SQL syntax

-- Step 1: Add availability column for days of the week
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS availability JSONB;

-- Step 2: Add additional profile enhancement fields
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS preferred_contact_method text DEFAULT 'email',
ADD COLUMN IF NOT EXISTS emergency_contact_name text,
ADD COLUMN IF NOT EXISTS emergency_contact_phone text,
ADD COLUMN IF NOT EXISTS emergency_contact_relationship text,
ADD COLUMN IF NOT EXISTS address_line_1 text,
ADD COLUMN IF NOT EXISTS address_line_2 text,
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS state text,
ADD COLUMN IF NOT EXISTS zip_code text,
ADD COLUMN IF NOT EXISTS country text DEFAULT 'USA',
ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'America/New_York',
ADD COLUMN IF NOT EXISTS language_preference text DEFAULT 'en',
ADD COLUMN IF NOT EXISTS communication_preferences JSONB DEFAULT '{"email_notifications": true, "sms_notifications": false, "push_notifications": true}'::jsonb,
ADD COLUMN IF NOT EXISTS professional_info JSONB DEFAULT '{"skills": [], "certifications": [], "experience_years": 0, "specializations": []}'::jsonb,
ADD COLUMN IF NOT EXISTS social_media JSONB DEFAULT '{"linkedin": null, "website": null, "other": null}'::jsonb,
ADD COLUMN IF NOT EXISTS notes text,
ADD COLUMN IF NOT EXISTS last_profile_update timestamptz DEFAULT now();

-- Step 3: Set default availability for existing users (Mon-Fri)
UPDATE profiles 
SET availability = '{"monday": true, "tuesday": true, "wednesday": true, "thursday": true, "friday": true, "saturday": false, "sunday": false}'::jsonb
WHERE availability IS NULL;

-- Step 4: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_availability ON profiles USING GIN (availability);
CREATE INDEX IF NOT EXISTS idx_profiles_communication_preferences ON profiles USING GIN (communication_preferences);
CREATE INDEX IF NOT EXISTS idx_profiles_professional_info ON profiles USING GIN (professional_info);
CREATE INDEX IF NOT EXISTS idx_profiles_social_media ON profiles USING GIN (social_media);

-- Step 5: Add comments for documentation
COMMENT ON COLUMN profiles.availability IS 'JSON object storing user availability for days of the week. Format: {"monday": boolean, "tuesday": boolean, etc.}';
COMMENT ON COLUMN profiles.preferred_contact_method IS 'Preferred method of contact: email, phone, sms';
COMMENT ON COLUMN profiles.emergency_contact_name IS 'Name of emergency contact person';
COMMENT ON COLUMN profiles.emergency_contact_phone IS 'Phone number of emergency contact';
COMMENT ON COLUMN profiles.emergency_contact_relationship IS 'Relationship to emergency contact';
COMMENT ON COLUMN profiles.address_line_1 IS 'Primary address line';
COMMENT ON COLUMN profiles.address_line_2 IS 'Secondary address line (apt, suite, etc.)';
COMMENT ON COLUMN profiles.city IS 'City name';
COMMENT ON COLUMN profiles.state IS 'State or province';
COMMENT ON COLUMN profiles.zip_code IS 'ZIP or postal code';
COMMENT ON COLUMN profiles.country IS 'Country name';
COMMENT ON COLUMN profiles.timezone IS 'User timezone for scheduling';
COMMENT ON COLUMN profiles.language_preference IS 'Preferred language (ISO 639-1 code)';
COMMENT ON COLUMN profiles.communication_preferences IS 'JSON object storing communication preferences';
COMMENT ON COLUMN profiles.professional_info IS 'JSON object storing professional information';
COMMENT ON COLUMN profiles.social_media IS 'JSON object storing social media links';
COMMENT ON COLUMN profiles.notes IS 'Additional notes about the user';
COMMENT ON COLUMN profiles.last_profile_update IS 'Timestamp of last profile update';

-- Step 6: Create a function to update last_profile_update timestamp
CREATE OR REPLACE FUNCTION update_profile_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_profile_update = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Create trigger to automatically update timestamp
DROP TRIGGER IF EXISTS trigger_update_profile_timestamp ON profiles;
CREATE TRIGGER trigger_update_profile_timestamp
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_timestamp();

-- Note: RLS policies are already handled by existing policies in the profiles table
-- The new columns will inherit the existing SELECT and UPDATE policies
