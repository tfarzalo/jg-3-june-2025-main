/*
  # Add editable titles for main property contacts

  Adds optional text columns to properties so Community Manager and Maintenance Supervisor titles can be customized.
*/

ALTER TABLE properties ADD COLUMN IF NOT EXISTS community_manager_title text;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS maintenance_supervisor_title text;

COMMENT ON COLUMN properties.community_manager_title IS 'Custom label for the primary manager contact card';
COMMENT ON COLUMN properties.maintenance_supervisor_title IS 'Custom label for the maintenance contact card';
