-- Temporarily disable the trigger that creates folders
-- This will allow property creation to succeed while we clear the constraint cache

ALTER TABLE properties DISABLE TRIGGER property_create_folders_trigger;

-- You can re-enable it later with:
-- ALTER TABLE properties ENABLE TRIGGER property_create_folders_trigger;
