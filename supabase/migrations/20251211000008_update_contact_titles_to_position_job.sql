/*
  # Set contact titles to Position / Job

  - Standardizes the labels for community manager and maintenance supervisor to "Position / Job"
  - Updates existing rows that still use the legacy labels or are empty
  - Sets defaults so new rows inherit the Position / Job label when not provided
*/

ALTER TABLE properties ALTER COLUMN community_manager_title SET DEFAULT 'Position / Job';
ALTER TABLE properties ALTER COLUMN maintenance_supervisor_title SET DEFAULT 'Position / Job';

UPDATE properties
SET community_manager_title = 'Position / Job'
WHERE community_manager_title IS NULL
   OR community_manager_title = ''
   OR community_manager_title = 'Community Manager';

UPDATE properties
SET maintenance_supervisor_title = 'Position / Job'
WHERE maintenance_supervisor_title IS NULL
   OR maintenance_supervisor_title = ''
   OR maintenance_supervisor_title = 'Maintenance Supervisor';
