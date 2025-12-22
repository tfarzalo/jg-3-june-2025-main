-- COMPREHENSIVE FIX SCRIPT
-- Run this entire script to fix the table, policies, and constraints.

-- 1. Ensure 'files' table exists
CREATE TABLE IF NOT EXISTS files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    type TEXT,
    size BIGINT,
    folder_id UUID,
    property_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- 2. Enable RLS
ALTER TABLE files ENABLE ROW LEVEL SECURITY;

-- 3. Safely recreate policies (Drop first to avoid "already exists" error)
DROP POLICY IF EXISTS "Authenticated users can view files" ON files;
CREATE POLICY "Authenticated users can view files" ON files FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert files" ON files;
CREATE POLICY "Authenticated users can insert files" ON files FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update files" ON files;
CREATE POLICY "Authenticated users can update files" ON files FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can delete files" ON files;
CREATE POLICY "Authenticated users can delete files" ON files FOR DELETE TO authenticated USING (true);

-- 4. FIX THE SAVE ERROR: Remove restrictive file type constraint
ALTER TABLE files DROP CONSTRAINT IF EXISTS valid_file_type;
-- Add a lenient check (must have a type string)
ALTER TABLE files ADD CONSTRAINT valid_file_type CHECK (length(type) > 0);

-- 5. Ensure Storage Bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('files', 'files', false)
ON CONFLICT (id) DO NOTHING;

-- 6. Safely recreate Storage Policies
DROP POLICY IF EXISTS "Authenticated Select" ON storage.objects;
CREATE POLICY "Authenticated Select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'files');

DROP POLICY IF EXISTS "Authenticated Insert" ON storage.objects;
CREATE POLICY "Authenticated Insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'files');

DROP POLICY IF EXISTS "Authenticated Update" ON storage.objects;
CREATE POLICY "Authenticated Update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'files');

DROP POLICY IF EXISTS "Authenticated Delete" ON storage.objects;
CREATE POLICY "Authenticated Delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'files');
