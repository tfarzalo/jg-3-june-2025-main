-- Add missing subcontractor profile fields
-- This migration adds the fields that SubcontractorEditPage needs to function

-- Add basic subcontractor fields
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS company_name text;

-- Add comments for documentation
COMMENT ON COLUMN profiles.phone IS 'Phone number for subcontractor contact';
COMMENT ON COLUMN profiles.address IS 'Address for subcontractor';
COMMENT ON COLUMN profiles.company_name IS 'Company name for subcontractor';

-- Set default values for existing records (optional)
UPDATE profiles 
SET 
  phone = COALESCE(phone, ''),
  address = COALESCE(address, ''),
  company_name = COALESCE(company_name, '')
WHERE phone IS NULL OR address IS NULL OR company_name IS NULL;

-- Verify the columns were added
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('phone', 'address', 'company_name')
ORDER BY column_name;
