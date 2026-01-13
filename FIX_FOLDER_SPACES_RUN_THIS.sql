-- ============================================================================
-- FIX: Allow spaces in folder names (Robust Version)
-- ============================================================================

-- 1. Ensure storage_path and display_path columns exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'files' AND column_name = 'display_path'
    ) THEN
        ALTER TABLE files ADD COLUMN display_path TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'files' AND column_name = 'storage_path'
    ) THEN
        ALTER TABLE files ADD COLUMN storage_path TEXT;
    END IF;
END $$;

-- Update existing records if needed
UPDATE files
SET 
    display_path = COALESCE(display_path, path),
    storage_path = COALESCE(storage_path, path)
WHERE display_path IS NULL OR storage_path IS NULL;

-- 2. Create helper function for sanitizing storage names
CREATE OR REPLACE FUNCTION normalize_property_storage_name(input_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_clean TEXT;
BEGIN
    IF input_text IS NULL THEN
        RETURN '';
    END IF;

    -- Strip straight/curly apostrophes, allow spaces, normalize other symbols
    -- We keep spaces temporarily to allow them to be replaced by underscores cleanly
    v_clean := regexp_replace(input_text, '[''’]', '', 'g');
    -- FIX: Use a safer regex that won't be interpreted as an invalid range
    -- Matches anything that is NOT: a-z, A-Z, 0-9, space, hyphen
    v_clean := regexp_replace(v_clean, '[^a-zA-Z0-9\s-]', '_', 'g');
    v_clean := regexp_replace(v_clean, '_{2,}', '_', 'g');
    v_clean := regexp_replace(v_clean, '\\s{2,}', ' ', 'g');
    v_clean := trim(BOTH ' ' FROM trim(BOTH '_' FROM v_clean));

    IF v_clean = '' THEN
        v_clean := 'folder_' || replace(gen_random_uuid()::TEXT, '-', '');
    END IF;
    
    -- Replace spaces with underscores for storage path safety
    v_clean := replace(v_clean, ' ', '_');

    RETURN v_clean;
END;
$$;

-- 3. Create alias if it doesn't exist
CREATE OR REPLACE FUNCTION sanitize_for_storage(input_text TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT normalize_property_storage_name(input_text);
$$;

-- 4. Update the create_user_folder function
CREATE OR REPLACE FUNCTION create_user_folder(
  p_name text,
  p_parent_folder_id uuid DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_folder_id uuid;
  v_storage_path text;
  v_display_path text;
  v_parent_storage_path text;
  v_parent_display_path text;
  v_sanitized_name text;
  v_user_id uuid;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id FROM auth.users LIMIT 1;
  END IF;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No authenticated user found';
  END IF;
  
  -- Sanitize name for storage (replaces spaces with underscores)
  v_sanitized_name := sanitize_for_storage(p_name);
  
  -- Build paths
  IF p_parent_folder_id IS NULL THEN
    v_storage_path := '/' || v_sanitized_name;
    v_display_path := '/' || p_name;
  ELSE
    SELECT storage_path, display_path INTO v_parent_storage_path, v_parent_display_path 
    FROM files WHERE id = p_parent_folder_id;
    
    -- Fallback if parent paths are null (use path/name if display/storage paths missing)
    IF v_parent_storage_path IS NULL THEN
        SELECT path INTO v_parent_storage_path FROM files WHERE id = p_parent_folder_id;
    END IF;
    IF v_parent_display_path IS NULL THEN
        SELECT name INTO v_parent_display_path FROM files WHERE id = p_parent_folder_id;
        v_parent_display_path := '/' || v_parent_display_path;
    END IF;

    -- Handle case where even fallbacks failed (shouldn't happen for valid parent)
    IF v_parent_storage_path IS NULL OR v_parent_display_path IS NULL THEN
       RAISE EXCEPTION 'Parent folder not found or invalid';
    END IF;

    v_storage_path := v_parent_storage_path || '/' || v_sanitized_name;
    v_display_path := v_parent_display_path || '/' || p_name;
  END IF;
  
  -- Create folder
  INSERT INTO files (
    name, path, storage_path, display_path, type, uploaded_by, folder_id, size
  ) VALUES (
    p_name,         -- Original name (e.g., "My Folder")
    v_storage_path, -- Sanitized path (e.g., "/My_Folder")
    v_storage_path, -- storage_path matches path
    v_display_path, -- Display path (e.g., "/My Folder")
    'folder/directory',
    v_user_id,
    p_parent_folder_id,
    0
  )
  ON CONFLICT (path) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    uploaded_by = EXCLUDED.uploaded_by,
    folder_id = EXCLUDED.folder_id,
    storage_path = EXCLUDED.storage_path,
    display_path = EXCLUDED.display_path
  RETURNING id INTO v_folder_id;
  
  RETURN v_folder_id;
END;
$$ LANGUAGE plpgsql;

-- 5. Grant permissions
GRANT EXECUTE ON FUNCTION normalize_property_storage_name(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION sanitize_for_storage(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_user_folder(TEXT, UUID) TO authenticated;
