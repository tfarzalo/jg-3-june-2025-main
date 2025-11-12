-- Fix property creation issue by removing problematic trigger
-- This trigger was causing "invalid input syntax for type uuid: 'system'" errors

-- Drop the trigger that creates property folders automatically
DROP TRIGGER IF EXISTS trigger_create_property_folder ON properties;

-- We can re-enable folder creation later with a better implementation
-- For now, this allows property creation to work properly

-- Note: This means property folders won't be created automatically
-- but properties can be created without errors
