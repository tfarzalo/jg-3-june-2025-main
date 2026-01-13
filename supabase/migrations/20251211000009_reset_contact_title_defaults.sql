/*
  # Reset contact title defaults

  - Sets defaults back to role-specific labels when no input is provided
  - Cleans existing rows that still have the generic Position / Job placeholder or are blank
*/

ALTER TABLE properties ALTER COLUMN community_manager_title SET DEFAULT 'Community Manager';
ALTER TABLE properties ALTER COLUMN maintenance_supervisor_title SET DEFAULT 'Maintenance Supervisor';

UPDATE properties
SET community_manager_title = 'Community Manager'
WHERE community_manager_title IS NULL
   OR community_manager_title = ''
   OR community_manager_title = 'Position / Job';

UPDATE properties
SET maintenance_supervisor_title = 'Maintenance Supervisor'
WHERE maintenance_supervisor_title IS NULL
   OR maintenance_supervisor_title = ''
   OR maintenance_supervisor_title = 'Position / Job';
