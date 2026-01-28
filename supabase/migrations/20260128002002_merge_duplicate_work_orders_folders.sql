-- Merge duplicate "Work Orders" folders per property (non-destructive)
-- Keeps most recently used Work Orders folder per property, re-parents children, deletes dupes.

DO $$
BEGIN
  WITH work_orders_folders AS (
    SELECT
      id,
      property_id,
      COALESCE(updated_at, created_at) AS ts
    FROM files
    WHERE type = 'folder/directory'
      AND name = 'Work Orders'
      AND property_id IS NOT NULL
  ),
  ranked AS (
    SELECT
      id,
      property_id,
      ts,
      ROW_NUMBER() OVER (PARTITION BY property_id ORDER BY ts DESC, id DESC) AS rn
    FROM work_orders_folders
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

  WITH work_orders_folders AS (
    SELECT
      id,
      property_id,
      COALESCE(updated_at, created_at) AS ts
    FROM files
    WHERE type = 'folder/directory'
      AND name = 'Work Orders'
      AND property_id IS NOT NULL
  ),
  ranked AS (
    SELECT
      id,
      property_id,
      ts,
      ROW_NUMBER() OVER (PARTITION BY property_id ORDER BY ts DESC, id DESC) AS rn
    FROM work_orders_folders
  ),
  dupes AS (
    SELECT id
    FROM ranked
    WHERE rn > 1
  )
  DELETE FROM files
  WHERE id IN (SELECT id FROM dupes);
END $$;
