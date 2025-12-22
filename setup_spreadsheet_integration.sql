-- 1. Create the 'files' table if it doesn't exist
-- This table tracks metadata for files stored in Supabase Storage
CREATE TABLE IF NOT EXISTS files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    type TEXT,
    size BIGINT,
    folder_id UUID, -- Optional: link to a folders table if you have one
    property_id UUID, -- Optional: link to properties table
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- 2. Enable Row Level Security (RLS) on the files table
ALTER TABLE files ENABLE ROW LEVEL SECURITY;

-- 3. Create policies for the 'files' table (Adjust based on your security model)
-- Allow authenticated users to view all files (or restrict as needed)
CREATE POLICY "Authenticated users can view files" ON files
    FOR SELECT TO authenticated USING (true);

-- Allow authenticated users to insert files
CREATE POLICY "Authenticated users can insert files" ON files
    FOR INSERT TO authenticated WITH CHECK (true);

-- Allow authenticated users to update their own files (or all files if shared)
CREATE POLICY "Authenticated users can update files" ON files
    FOR UPDATE TO authenticated USING (true);

-- Allow authenticated users to delete files
CREATE POLICY "Authenticated users can delete files" ON files
    FOR DELETE TO authenticated USING (true);

-- 4. Ensure the 'files' bucket exists in Supabase Storage
INSERT INTO storage.buckets (id, name, public)
VALUES ('files', 'files', false)
ON CONFLICT (id) DO NOTHING;

-- 5. Set up Storage Policies for the 'files' bucket
-- These ensure users can actually upload/download the binary data

-- Allow public read access (optional, remove if strict privacy needed)
-- CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'files');

-- Allow authenticated access
CREATE POLICY "Authenticated Select" ON storage.objects
    FOR SELECT TO authenticated USING (bucket_id = 'files');

CREATE POLICY "Authenticated Insert" ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (bucket_id = 'files');

CREATE POLICY "Authenticated Update" ON storage.objects
    FOR UPDATE TO authenticated USING (bucket_id = 'files');

CREATE POLICY "Authenticated Delete" ON storage.objects
    FOR DELETE TO authenticated USING (bucket_id = 'files');
