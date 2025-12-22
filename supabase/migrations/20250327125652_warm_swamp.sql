/*
  # Fix Jobs Table Permissions

  1. Changes
    - Drop existing policies
    - Create new policies using auth.uid()
    - Ensure proper access control for jobs and related tables
    
  2. Security
    - Enable RLS
    - Add policies for CRUD operations
    - Use auth.uid() instead of accessing users table directly
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.jobs;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.jobs;
DROP POLICY IF EXISTS "Enable update for job owners and admins" ON public.jobs;

-- Create new policies for jobs table that use auth.uid() directly
CREATE POLICY "Enable insert for authenticated users only"
ON public.jobs
FOR INSERT
TO authenticated
WITH CHECK (
  CASE 
    WHEN created_by IS NULL THEN true  -- Allow null created_by
    WHEN created_by = auth.uid() THEN true  -- Allow if created_by matches current user
    ELSE false
  END
);

CREATE POLICY "Enable read access for authenticated users"
ON public.jobs
FOR SELECT
TO authenticated
USING (
  created_by = auth.uid() OR 
  assigned_to = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Enable update for job owners and admins"
ON public.jobs
FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid() OR 
  assigned_to = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  created_by = auth.uid() OR 
  assigned_to = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Ensure RLS is enabled
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;