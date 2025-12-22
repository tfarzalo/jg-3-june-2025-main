-- Migration: Convert unit_map_url to file upload system
-- This migration converts the unit_map_url TEXT field to a file reference system
-- where property unit maps are stored as files in the Supabase storage bucket

-- Step 0: Check files table structure and create if needed

-- First, ensure there are users in the auth.users table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users LIMIT 1) THEN
    RAISE EXCEPTION 'No users found in auth.users table. Please ensure you have at least one authenticated user before running this migration.';
  END IF;
END $$;

DO $$
BEGIN
  -- Check if files table exists and has required columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'files') THEN
    -- Create files table if it doesn't exist
    CREATE TABLE files (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      path text NOT NULL,
      size bigint NOT NULL DEFAULT 0,
      type text NOT NULL,
      uploaded_by uuid NOT NULL REFERENCES auth.users(id),
      property_id uuid REFERENCES properties(id),
      job_id uuid REFERENCES jobs(id),
      folder_id uuid REFERENCES files(id),
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );
    
    -- Create indexes
    CREATE INDEX idx_files_property_id ON files(property_id);
    CREATE INDEX idx_files_job_id ON files(job_id);
    CREATE INDEX idx_files_folder_id ON files(folder_id);
    CREATE INDEX idx_files_path ON files(path);
    
    -- Enable RLS
    ALTER TABLE files ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Create trigger function for updated_at (outside DO block)
CREATE OR REPLACE FUNCTION update_files_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger (outside DO block)
DROP TRIGGER IF EXISTS update_files_updated_at ON files;
CREATE TRIGGER update_files_updated_at
  BEFORE UPDATE ON files
  FOR EACH ROW
  EXECUTE FUNCTION update_files_updated_at();

-- Create basic RLS policies (outside DO block)
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON files;
CREATE POLICY "Enable insert for authenticated users" ON files
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Enable select for authenticated users" ON files;
CREATE POLICY "Enable select for authenticated users" ON files
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Enable update for file owners" ON files;
CREATE POLICY "Enable update for file owners" ON files
  FOR UPDATE TO authenticated USING (uploaded_by = auth.uid());

DROP POLICY IF EXISTS "Enable delete for file owners" ON files;
CREATE POLICY "Enable delete for file owners" ON files
  FOR DELETE TO authenticated USING (uploaded_by = auth.uid());

-- Step 1: Add new columns to properties table
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS unit_map_file_id uuid REFERENCES files(id),
ADD COLUMN IF NOT EXISTS unit_map_file_path text;

-- Step 2: Create property assets folder structure in files table
-- First, create the root property assets folder if it doesn't exist
-- We'll use the first authenticated user as the system user
DO $$
DECLARE
  v_system_user_id uuid;
BEGIN
  -- Get the first user from auth.users
  SELECT id INTO v_system_user_id FROM auth.users LIMIT 1;
  
  -- Create the Property Assets root folder if it doesn't exist
  INSERT INTO files (name, path, type, uploaded_by, folder_id, size, property_id, job_id)
  VALUES (
    'Property Assets',
    '/Property Assets',
    'folder/directory',
    v_system_user_id,
    NULL,
    0,
    NULL,
    NULL
  )
  ON CONFLICT (path) DO NOTHING;
END $$;

-- Step 3: Create a function to automatically create property asset folders
CREATE OR REPLACE FUNCTION create_property_asset_folders()
RETURNS TRIGGER AS $$
DECLARE
  v_property_assets_folder_id uuid;
  v_property_folder_id uuid;
  v_user_id uuid;
BEGIN
  -- Get the Property Assets folder ID
  SELECT id INTO v_property_assets_folder_id
  FROM files 
  WHERE path = '/Property Assets' 
  AND type = 'folder/directory';
  
  -- If the root folder doesn't exist, create it
  IF v_property_assets_folder_id IS NULL THEN
    INSERT INTO files (name, path, type, uploaded_by, folder_id, size, property_id, job_id)
    VALUES (
      'Property Assets',
      '/Property Assets',
      'folder/directory',
      auth.uid(),
      NULL,
      0,
      NULL,
      NULL
    )
    RETURNING id INTO v_property_assets_folder_id;
  END IF;

  -- Get current user ID, fall back to system user if not available
  BEGIN
    v_user_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    -- Use the first authenticated user as system user
    SELECT id INTO v_user_id FROM auth.users LIMIT 1;
    IF v_user_id IS NULL THEN
      RAISE EXCEPTION 'No users found in auth.users table';
    END IF;
  END;

  -- Create property-specific folder if it doesn't exist
  INSERT INTO files (name, path, type, uploaded_by, property_id, folder_id, size, job_id)
  VALUES (
    NEW.property_name || ' Assets',
    '/Property Assets/' || NEW.property_name,
    'folder/directory',
    v_user_id,
    NEW.id,
    v_property_assets_folder_id,
    0,
    NULL
  )
  ON CONFLICT (path) DO UPDATE SET
    name = EXCLUDED.name,
    updated_at = now()
  RETURNING id INTO v_property_folder_id;

  -- Log the folder creation
  RAISE NOTICE 'Created property assets folder: % (ID: %)', NEW.property_name, v_property_folder_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create trigger for new properties
DROP TRIGGER IF EXISTS trigger_create_property_asset_folders ON properties;
CREATE TRIGGER trigger_create_property_asset_folders
  AFTER INSERT ON properties
  FOR EACH ROW
  EXECUTE FUNCTION create_property_asset_folders();

-- Step 5: Create function to create folders for existing properties
CREATE OR REPLACE FUNCTION create_asset_folders_for_existing_properties()
RETURNS void AS $$
DECLARE
  v_property RECORD;
  v_property_assets_folder_id uuid;
  v_property_folder_id uuid;
  v_user_id uuid;
BEGIN
  -- Get system user ID first
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No users found in auth.users table';
  END IF;

  -- Get the Property Assets folder ID
  SELECT id INTO v_property_assets_folder_id
  FROM files 
  WHERE path = '/Property Assets' 
  AND type = 'folder/directory';
  
  -- If the root folder doesn't exist, create it
  IF v_property_assets_folder_id IS NULL THEN
    INSERT INTO files (name, path, type, uploaded_by, folder_id, size, property_id, job_id)
    VALUES (
      'Property Assets',
      '/Property Assets',
      'folder/directory',
      v_user_id,
      NULL,
      0,
      NULL,
      NULL
    )
    RETURNING id INTO v_property_assets_folder_id;
  END IF;

  -- Create asset folders for all existing properties
  FOR v_property IN SELECT id, property_name FROM properties LOOP
    INSERT INTO files (name, path, type, uploaded_by, property_id, folder_id, size, job_id)
    VALUES (
      v_property.property_name || ' Assets',
      '/Property Assets/' || v_property.property_name,
      'folder/directory',
      v_user_id,
      v_property.id,
      v_property_assets_folder_id,
      0,
      NULL
    )
    ON CONFLICT (path) DO NOTHING;
  END LOOP;

  RAISE NOTICE 'Created asset folders for all existing properties';
END;
$$ LANGUAGE plpgsql;

-- Step 6: Execute the function for existing properties
SELECT create_asset_folders_for_existing_properties();

-- Step 7: Clean up the function
DROP FUNCTION create_asset_folders_for_existing_properties();

-- Step 8: Create a function to handle unit map file uploads
CREATE OR REPLACE FUNCTION handle_unit_map_upload(
  p_property_id uuid,
  p_file_name text,
  p_file_path text,
  p_file_size bigint,
  p_file_type text,
  p_uploaded_by uuid
)
RETURNS uuid AS $$
DECLARE
  v_file_id uuid;
  v_property_folder_id uuid;
BEGIN
  -- Get the property's asset folder ID
  SELECT id INTO v_property_folder_id
  FROM files 
  WHERE property_id = p_property_id 
  AND path LIKE '/Property Assets/%' 
  AND type = 'folder/directory'
  LIMIT 1;

  IF v_property_folder_id IS NULL THEN
    RAISE EXCEPTION 'Property asset folder not found for property ID: %', p_property_id;
  END IF;

  -- Create the file record
  INSERT INTO files (name, path, size, type, uploaded_by, property_id, folder_id)
  VALUES (
    p_file_name,
    p_file_path,
    p_file_size,
    p_file_type,
    p_uploaded_by,
    p_property_id,
    v_property_folder_id
  )
  RETURNING id INTO v_file_id;

  -- Update the property to reference this file
  UPDATE properties 
  SET 
    unit_map_file_id = v_file_id,
    unit_map_file_path = p_file_path
  WHERE id = p_property_id;

  RETURN v_file_id;
END;
$$ LANGUAGE plpgsql;

-- Step 9: Create a function to get unit map file information
CREATE OR REPLACE FUNCTION get_property_unit_map_info(p_property_id uuid)
RETURNS TABLE (
  file_id uuid,
  file_name text,
  file_path text,
  file_size bigint,
  file_type text,
  uploaded_by uuid,
  created_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    f.id,
    f.name,
    f.path,
    f.size,
    f.type,
    f.uploaded_by,
    f.created_at
  FROM files f
  WHERE f.id = (
    SELECT unit_map_file_id 
    FROM properties 
    WHERE id = p_property_id
  );
END;
$$ LANGUAGE plpgsql;

-- Step 10: Add comments for documentation
COMMENT ON COLUMN properties.unit_map_file_id IS 'Reference to the unit map file in the files table';
COMMENT ON COLUMN properties.unit_map_file_path IS 'Storage path to the unit map file in Supabase storage';
COMMENT ON FUNCTION handle_unit_map_upload IS 'Handles unit map file uploads and creates proper file records';
COMMENT ON FUNCTION get_property_unit_map_info IS 'Retrieves unit map file information for a property';

-- Step 11: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_properties_unit_map_file_id ON properties(unit_map_file_id);
CREATE INDEX IF NOT EXISTS idx_files_property_assets ON files(path) WHERE path LIKE '/Property Assets/%';

-- Step 12: Update RLS policies to ensure proper access to property asset files
-- Allow users to view files in property asset folders if they have access to the property

-- Drop existing policy if it exists to avoid conflicts
DROP POLICY IF EXISTS "Enable read access to property asset files" ON files;

-- Create new policy for property asset file access
CREATE POLICY "Enable read access to property asset files"
  ON files
  FOR SELECT
  TO authenticated
  USING (
    -- Allow access to files in property asset folders if user has access to the property
    (path LIKE '/Property Assets/%' AND property_id IN (
      SELECT id FROM properties
      WHERE EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
      )
    ))
    OR
    -- Allow access to files the user uploaded
    uploaded_by = auth.uid()
    OR
    -- Allow access to files in properties the user has access to
    property_id IN (
      SELECT id FROM properties
      WHERE EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
      )
    )
  );

-- Step 13: Verify the migration
SELECT 
  'Migration completed successfully!' as status,
  COUNT(*) as total_properties,
  COUNT(unit_map_file_id) as properties_with_unit_maps
FROM properties;

-- Step 14: Show the new folder structure
SELECT 
  'Property Assets folder structure created:' as info,
  path,
  name,
  type
FROM files 
WHERE path LIKE '/Property Assets%'
ORDER BY path;
