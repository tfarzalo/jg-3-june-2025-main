-- Verify and fix the property asset folder trigger
-- This script checks if the trigger is working properly and recreates it if needed

-- First, let's check if the trigger exists
SELECT 
  'Trigger status:' as info,
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'trigger_create_property_asset_folders';

-- Check if the function exists
SELECT 
  'Function status:' as info,
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines 
WHERE routine_name = 'create_property_asset_folders';

-- If the trigger is missing or not working, let's recreate it
DO $$
BEGIN
  -- Drop existing trigger if it exists
  DROP TRIGGER IF EXISTS trigger_create_property_asset_folders ON properties;
  
  -- Recreate the trigger
  CREATE TRIGGER trigger_create_property_asset_folders
    AFTER INSERT ON properties
    FOR EACH ROW
    EXECUTE FUNCTION create_property_asset_folders();
    
  RAISE NOTICE 'Recreated trigger_create_property_asset_folders';
END $$;

-- Test the trigger by inserting a test property (optional - uncomment if you want to test)
-- INSERT INTO properties (property_name, address, city, state, zip) 
-- VALUES ('TEST PROPERTY - DELETE ME', '123 Test St', 'Test City', 'TS', '12345');

-- Verify the trigger is now active
SELECT 
  'Trigger verification:' as info,
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'trigger_create_property_asset_folders';

-- Check the current folder structure
SELECT 
  'Current folder structure:' as info,
  path,
  name,
  type,
  property_id
FROM files 
WHERE path LIKE '/Property Assets%'
ORDER BY path;
