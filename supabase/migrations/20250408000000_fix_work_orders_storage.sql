/*
  # Fix Work Orders Storage Access

  1. Changes
    - Create work_orders storage bucket
    - Add RLS policies for work_orders bucket
    - Allow authenticated users to upload/read/delete work order files

  2. Security
    - Maintains RLS security model
    - Allows authenticated users to manage work order files
*/

-- Create storage bucket for work orders if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('work_orders', 'work_orders', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing storage policies to avoid conflicts
DO $$ BEGIN
  DROP POLICY IF EXISTS "Work order files are publicly accessible" ON storage.objects;
  DROP POLICY IF EXISTS "Users can upload work order files" ON storage.objects;
  DROP POLICY IF EXISTS "Users can update work order files" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete work order files" ON storage.objects;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create storage policies for work_orders bucket
CREATE POLICY "Work order files are publicly accessible"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'work_orders');

CREATE POLICY "Users can upload work order files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'work_orders');

CREATE POLICY "Users can update work order files"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'work_orders');

CREATE POLICY "Users can delete work order files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'work_orders'); 