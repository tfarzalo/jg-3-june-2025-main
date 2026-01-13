-- Identify and clean duplicate '/Properties/...' folder trees
-- This script standardizes files.path/storage_path to the canonical sanitized form
-- and re-associates child folders/files to the canonical work order folder ids.

WITH wo AS (
  SELECT
    j.id AS job_id,
    p.id AS property_id,
    p.property_name,
    'WO-' || LPAD(j.work_order_num::TEXT, 6, '0') AS wo_name,
    (SELECT id FROM files
     WHERE property_id = p.id
       AND job_id = j.id
       AND type = 'folder/directory'
       AND name = 'WO-' || LPAD(j.work_order_num::TEXT, 6, '0')
     ORDER BY created_at
     LIMIT 1) AS canonical_wo_folder_id,
    (SELECT id FROM files
     WHERE path = '/Properties/' || p.property_name || '/Work Orders/' ||
                  'WO-' || LPAD(j.work_order_num::TEXT, 6, '0')
       AND type = 'folder/directory'
     ORDER BY created_at
     LIMIT 1) AS legacy_wo_folder_id
  FROM jobs j
  JOIN properties p ON p.id = j.property_id
)
UPDATE files f
SET folder_id = wo.canonical_wo_folder_id
FROM wo
WHERE f.folder_id = wo.legacy_wo_folder_id
  AND wo.legacy_wo_folder_id IS NOT NULL
  AND wo.canonical_wo_folder_id IS NOT NULL;

WITH wo AS (
  SELECT
    j.id AS job_id,
    p.id AS property_id,
    p.property_name,
    'WO-' || LPAD(j.work_order_num::TEXT, 6, '0') AS wo_name,
    (SELECT id FROM files
     WHERE property_id = p.id
       AND job_id = j.id
       AND type = 'folder/directory'
       AND name = 'WO-' || LPAD(j.work_order_num::TEXT, 6, '0')
     ORDER BY created_at
     LIMIT 1) AS canonical_wo_folder_id,
    (SELECT id FROM files
     WHERE path = '/Properties/' || p.property_name || '/Work Orders/' ||
                  'WO-' || LPAD(j.work_order_num::TEXT, 6, '0')
       AND type = 'folder/directory'
     ORDER BY created_at
     LIMIT 1) AS legacy_wo_folder_id
  FROM jobs j
  JOIN properties p ON p.id = j.property_id
)
DELETE FROM files f
USING wo
WHERE f.id = wo.legacy_wo_folder_id
  AND wo.legacy_wo_folder_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM files c WHERE c.folder_id = f.id
  );

WITH pf AS (
  SELECT
    p.id AS property_id,
    p.property_name,
    (SELECT property_files_folder_id
     FROM create_property_folder_structure(p.id, p.property_name)) AS canonical_pf_folder_id,
    (SELECT id FROM files
     WHERE path = '/Properties/' || p.property_name || '/Property Files'
       AND type = 'folder/directory'
     ORDER BY created_at
     LIMIT 1) AS legacy_pf_folder_id
  FROM properties p
)
UPDATE files f
SET folder_id = pf.canonical_pf_folder_id
FROM pf
WHERE f.folder_id = pf.legacy_pf_folder_id
  AND pf.legacy_pf_folder_id IS NOT NULL;

WITH pf AS (
  SELECT
    p.id AS property_id,
    p.property_name,
    (SELECT property_files_folder_id
     FROM create_property_folder_structure(p.id, p.property_name)) AS canonical_pf_folder_id,
    (SELECT id FROM files
     WHERE path = '/Properties/' || p.property_name || '/Property Files'
       AND type = 'folder/directory'
     ORDER BY created_at
     LIMIT 1) AS legacy_pf_folder_id
  FROM properties p
)
DELETE FROM files f
USING pf
WHERE f.id = pf.legacy_pf_folder_id
  AND pf.legacy_pf_folder_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM files c WHERE c.folder_id = f.id
  );
