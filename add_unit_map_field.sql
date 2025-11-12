-- Add unit_map_url field to properties table
-- This field will store the URL to property unit map images

-- Add the new column
ALTER TABLE properties 
ADD COLUMN unit_map_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN properties.unit_map_url IS 'URL to the property unit map image file';

-- Update RLS policies to include the new field
-- The existing RLS policies should automatically include this new field
-- since they use SELECT * or specific field lists

-- Verify the column was added
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'properties' 
AND column_name = 'unit_map_url';

-- Migration completed successfully!
SELECT 'Unit map URL field added to properties table successfully!' as status;
