/*
  # File Management System Setup

  1. New Tables
    - `files` table for storing file metadata
      - `id` (uuid, primary key)
      - `name` (text, original filename)
      - `path` (text, storage path)
      - `size` (bigint, file size in bytes)
      - `type` (text, mime type)
      - `uploaded_by` (uuid, references auth.users)
      - `property_id` (uuid, optional reference to properties)
      - `job_id` (uuid, optional reference to jobs)
      - `folder_id` (uuid, self-reference for folder structure)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on files table
    - Add policies for:
      - Authenticated users can upload files
      - Users can view files they have access to
      - Users can update/delete their own files
      - Admins have full access
*/

-- Create files table
CREATE TABLE files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  path text NOT NULL,
  size bigint NOT NULL,
  type text NOT NULL,
  uploaded_by uuid REFERENCES auth.users NOT NULL,
  property_id uuid REFERENCES properties(id),
  job_id uuid REFERENCES jobs(id),
  folder_id uuid REFERENCES files(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_file_type CHECK (type ~ '^[a-zA-Z0-9]+/[a-zA-Z0-9\-\+\.]+$')
);

-- Create index for faster lookups
CREATE INDEX idx_files_property_id ON files(property_id);
CREATE INDEX idx_files_job_id ON files(job_id);
CREATE INDEX idx_files_folder_id ON files(folder_id);

-- Enable RLS
ALTER TABLE files ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable upload for authenticated users"
  ON files
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Enable read access for authenticated users"
  ON files
  FOR SELECT
  TO authenticated
  USING (
    -- Users can view files if:
    -- 1. They uploaded the file
    -- 2. They have access to the property (admin or property manager)
    -- 3. They have access to the job (admin, assigned to, or created by)
    uploaded_by = auth.uid() OR
    property_id IN (
      SELECT id FROM properties
      WHERE EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role = 'admin'
      )
    ) OR
    job_id IN (
      SELECT id FROM jobs
      WHERE created_by = auth.uid() OR
            EXISTS (
              SELECT 1 FROM profiles
              WHERE id = auth.uid() AND role = 'admin'
            )
    )
  );

CREATE POLICY "Enable update for file owners and admins"
  ON files
  FOR UPDATE
  TO authenticated
  USING (
    uploaded_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    uploaded_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Enable delete for file owners and admins"
  ON files
  FOR DELETE
  TO authenticated
  USING (
    uploaded_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create trigger function to update updated_at
CREATE OR REPLACE FUNCTION update_files_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER update_files_updated_at
  BEFORE UPDATE ON files
  FOR EACH ROW
  EXECUTE FUNCTION update_files_updated_at();

-- Create function to handle automatic folder creation for properties
CREATE OR REPLACE FUNCTION create_property_folder()
RETURNS TRIGGER AS $$
DECLARE
  v_folder_id uuid;
BEGIN
  -- Create root folder for property
  INSERT INTO files (
    name,
    path,
    size,
    type,
    uploaded_by,
    property_id
  ) VALUES (
    NEW.property_name,
    '/' || NEW.property_name,
    0,
    'folder/property',
    auth.uid(),
    NEW.id
  ) RETURNING id INTO v_folder_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for property folder creation
CREATE TRIGGER create_property_folder_trigger
  AFTER INSERT ON properties
  FOR EACH ROW
  EXECUTE FUNCTION create_property_folder();

-- Create function to handle automatic folder creation for jobs
CREATE OR REPLACE FUNCTION create_job_folder()
RETURNS TRIGGER AS $$
DECLARE
  v_property_folder_id uuid;
  v_job_folder_id uuid;
  v_work_order_num text;
BEGIN
  -- Get property folder ID
  SELECT id INTO v_property_folder_id
  FROM files
  WHERE property_id = NEW.property_id
    AND type = 'folder/property';

  -- Format work order number
  v_work_order_num := 'WO-' || LPAD(NEW.work_order_num::text, 6, '0');

  -- Create job folder under property folder
  INSERT INTO files (
    name,
    path,
    size,
    type,
    uploaded_by,
    property_id,
    job_id,
    folder_id
  ) VALUES (
    v_work_order_num,
    '/' || (SELECT property_name FROM properties WHERE id = NEW.property_id) || '/' || v_work_order_num,
    0,
    'folder/job',
    auth.uid(),
    NEW.property_id,
    NEW.id,
    v_property_folder_id
  ) RETURNING id INTO v_job_folder_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for job folder creation
CREATE TRIGGER create_job_folder_trigger
  AFTER INSERT ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION create_job_folder();