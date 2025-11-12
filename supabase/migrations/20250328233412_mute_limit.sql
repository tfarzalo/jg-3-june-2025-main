/*
  # File System Setup

  1. New Tables
    - `files`
      - `id` (uuid, primary key)
      - `name` (text)
      - `path` (text)
      - `size` (bigint)
      - `type` (text)
      - `uploaded_by` (uuid, references users)
      - `property_id` (uuid, references properties)
      - `job_id` (uuid, references jobs)
      - `folder_id` (uuid, self-reference for folder hierarchy)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `files` table
    - Add policies for authenticated users to:
      - Upload new files
      - Delete their own files
    - Add special policies for admin users

  3. Storage
    - Create files bucket
    - Set up storage policies
*/

-- Create files table if it doesn't exist
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS files (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    path text NOT NULL,
    size bigint NOT NULL,
    type text NOT NULL,
    uploaded_by uuid NOT NULL REFERENCES users(id),
    property_id uuid REFERENCES properties(id),
    job_id uuid REFERENCES jobs(id),
    folder_id uuid REFERENCES files(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT valid_file_type CHECK (type ~ '^[a-zA-Z0-9]+/[a-zA-Z0-9\-\+\.]+$')
  );
EXCEPTION
  WHEN duplicate_table THEN
    NULL;
END $$;

-- Create indexes if they don't exist
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_files_property_id ON files(property_id);
  CREATE INDEX IF NOT EXISTS idx_files_job_id ON files(job_id);
  CREATE INDEX IF NOT EXISTS idx_files_folder_id ON files(folder_id);
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;

-- Enable RLS
ALTER TABLE files ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DO $$ BEGIN
  DROP POLICY IF EXISTS "Enable upload for authenticated users" ON files;
  DROP POLICY IF EXISTS "Enable delete for file owners and admins" ON files;
  DROP POLICY IF EXISTS "Enable update for file owners and admins" ON files;
END $$;

-- Create policies
CREATE POLICY "Enable upload for authenticated users"
  ON files
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Enable delete for file owners and admins"
  ON files
  FOR DELETE
  TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Enable update for file owners and admins"
  ON files
  FOR UPDATE
  TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    uploaded_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Create or replace trigger function
CREATE OR REPLACE FUNCTION update_files_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate trigger to ensure clean state
DROP TRIGGER IF EXISTS update_files_updated_at ON files;
CREATE TRIGGER update_files_updated_at
  BEFORE UPDATE ON files
  FOR EACH ROW
  EXECUTE FUNCTION update_files_updated_at();

-- Create storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('files', 'files', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing storage policies to avoid conflicts
DO $$ BEGIN
  DROP POLICY IF EXISTS "Enable read access for all users" ON storage.objects;
  DROP POLICY IF EXISTS "Enable upload for authenticated users" ON storage.objects;
  DROP POLICY IF EXISTS "Enable delete for file owners and admins" ON storage.objects;
END $$;

-- Set up storage policies
CREATE POLICY "Enable read access for all users"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'files');

CREATE POLICY "Enable upload for authenticated users"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'files');

CREATE POLICY "Enable delete for file owners and admins"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = (storage.foldername(name))[1]::uuid
    OR EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.role = 'admin'
    )
  );