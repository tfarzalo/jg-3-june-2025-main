DROP TABLE IF EXISTS public.files CASCADE;

-- Create the files table
CREATE TABLE public.files (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    type text NOT NULL,
    folder_id uuid REFERENCES public.files(id) ON DELETE CASCADE,
    uploaded_by uuid REFERENCES auth.users(id) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    size bigint DEFAULT 0 NOT NULL,
    job_id uuid REFERENCES public.jobs(id),
    property_id uuid REFERENCES public.properties(id),

    -- Ensure names are unique within the same folder
    UNIQUE (folder_id, name)
);

-- Add indexes for performance
CREATE INDEX idx_files_folder_id ON public.files(folder_id);
CREATE INDEX idx_files_uploaded_by ON public.files(uploaded_by);
CREATE INDEX idx_files_job_id ON public.files(job_id);
CREATE INDEX idx_files_property_id ON public.files(property_id);

-- Enable Row Level Security
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

-- Policies

-- Allow authenticated users to view their own files and files within jobs/properties they can access (simplified for now to just uploaded_by)
CREATE POLICY "Allow users to view their own files" ON public.files
FOR SELECT
USING (auth.uid() = uploaded_by);

-- Allow authenticated users to insert files, setting uploaded_by to their uid
CREATE POLICY "Allow authenticated users to create files" ON public.files
FOR INSERT
WITH CHECK (auth.uid() = uploaded_by);

-- Allow users to update their own files
CREATE POLICY "Allow users to update their own files" ON public.files
FOR UPDATE
USING (auth.uid() = uploaded_by);

-- Allow users to delete their own files or folders
CREATE POLICY "Allow users to delete their own files" ON public.files
FOR DELETE
USING (auth.uid() = uploaded_by);

-- Optional: Allow authenticated users to view root level folders (where folder_id is null)
CREATE POLICY "Allow authenticated users to view root folders" ON public.files
FOR SELECT
USING (folder_id IS NULL AND auth.role() = 'authenticated');
