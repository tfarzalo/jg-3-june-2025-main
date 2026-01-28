-- Fix merge duplicate property folders (CTE scope) and rerun safely
-- Non-destructive to storage objects; only re-parents DB folder/file rows.

DO $$
DECLARE
  v_properties_root_id uuid;
BEGIN
  SELECT id INTO v_properties_root_id
  FROM files
  WHERE name = 'Properties'
    AND folder_id IS NULL
    AND type = 'folder/directory'
  ORDER BY created_at DESC
  LIMIT 1;

  WITH candidates AS (
    SELECT
      id,
      property_id,
      COALESCE(updated_at, created_at) AS ts
    FROM files
    WHERE type = 'folder/directory'
      AND property_id IS NOT NULL
      AND job_id IS NULL
      AND work_order_id IS NULL
      AND (folder_id IS NULL OR folder_id IS NOT DISTINCT FROM v_properties_root_id)
      AND name NOT IN ('Work Orders', 'Property Files', 'Job Files', 'Before Images', 'Sprinkler Images', 'Other Files')
  ),
  ranked AS (
    SELECT
      id,
      property_id,
      ts,
      ROW_NUMBER() OVER (PARTITION BY property_id ORDER BY ts DESC, id DESC) AS rn
    FROM candidates
  ),
  keepers AS (
    SELECT id, property_id
    FROM ranked
    WHERE rn = 1
  ),
  dupes AS (
    SELECT id, property_id
    FROM ranked
    WHERE rn > 1
  )
  UPDATE files f
  SET folder_id = k.id
  FROM dupes d
  JOIN keepers k ON k.property_id = d.property_id
  WHERE f.folder_id = d.id;

  WITH candidates AS (
    SELECT
      id,
      property_id,
      COALESCE(updated_at, created_at) AS ts
    FROM files
    WHERE type = 'folder/directory'
      AND property_id IS NOT NULL
      AND job_id IS NULL
      AND work_order_id IS NULL
      AND (folder_id IS NULL OR folder_id IS NOT DISTINCT FROM v_properties_root_id)
      AND name NOT IN ('Work Orders', 'Property Files', 'Job Files', 'Before Images', 'Sprinkler Images', 'Other Files')
  ),
  ranked AS (
    SELECT
      id,
      property_id,
      ts,
      ROW_NUMBER() OVER (PARTITION BY property_id ORDER BY ts DESC, id DESC) AS rn
    FROM candidates
  ),
  dupes AS (
    SELECT id
    FROM ranked
    WHERE rn > 1
  )
  DELETE FROM files
  WHERE id IN (SELECT id FROM dupes);
END $$;
