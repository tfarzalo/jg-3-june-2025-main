-- Update create_user_folder to allow spaces in display name but sanitize storage path

-- Helper: normalize names for storage paths (removes apostrophes/quotes and
-- replaces non-alphanumeric characters with underscores).
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
    v_clean := regexp_replace(input_text, '[''’]', '', 'g');
    v_clean := regexp_replace(v_clean, '[^A-Za-z0-9\\- ]', '_', 'g');
    v_clean := regexp_replace(v_clean, '_{2,}', '_', 'g');
    v_clean := regexp_replace(v_clean, '\\s{2,}', ' ', 'g');
    v_clean := trim(BOTH ' ' FROM trim(BOTH '_' FROM v_clean));

    IF v_clean = '' THEN
        v_clean := 'folder_' || replace(gen_random_uuid()::TEXT, '-', '');
    END IF;
    
    -- Replace spaces with underscores for storage
    v_clean := replace(v_clean, ' ', '_');

    RETURN v_clean;
END;
$$;

-- Alias kept for existing callers (e.g., rename_folder)
CREATE OR REPLACE FUNCTION sanitize_for_storage(input_text TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT normalize_property_storage_name(input_text);
$$;

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
  
  -- Sanitize name for storage
  v_sanitized_name := sanitize_for_storage(p_name);
  
  -- Build paths
  IF p_parent_folder_id IS NULL THEN
    v_storage_path := '/' || v_sanitized_name;
    v_display_path := '/' || p_name;
  ELSE
    SELECT storage_path, display_path INTO v_parent_storage_path, v_parent_display_path 
    FROM files WHERE id = p_parent_folder_id;
    
    -- Fallback if parent paths are null
    IF v_parent_storage_path IS NULL THEN
        SELECT path INTO v_parent_storage_path FROM files WHERE id = p_parent_folder_id;
    END IF;
    IF v_parent_display_path IS NULL THEN
        SELECT name INTO v_parent_display_path FROM files WHERE id = p_parent_folder_id;
        v_parent_display_path := '/' || v_parent_display_path; -- Rough approximation if missing
    END IF;

    v_storage_path := v_parent_storage_path || '/' || v_sanitized_name;
    v_display_path := v_parent_display_path || '/' || p_name;
  END IF;
  
  -- Create folder
  INSERT INTO files (
    name, path, storage_path, display_path, type, uploaded_by, folder_id, size
  ) VALUES (
    p_name,
    v_storage_path, -- Use storage path as the unique path key
    v_storage_path,
    v_display_path,
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

GRANT EXECUTE ON FUNCTION normalize_property_storage_name(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION sanitize_for_storage(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_user_folder(TEXT, UUID) TO authenticated;
