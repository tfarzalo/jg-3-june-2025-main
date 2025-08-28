-- Add last_seen column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen timestamptz;

-- Enable RLS if not already enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- READ: Allow everyone with read access to select last_seen
-- (This assumes you already have a read policy, but if not, uncomment the following:)
-- CREATE POLICY "profiles: read" ON public.profiles FOR SELECT USING (true);

-- WRITE: User can update only their own row (specifically last_seen)
CREATE POLICY "profiles: self-update last_seen" ON public.profiles 
FOR UPDATE 
USING (auth.uid() = id) 
WITH CHECK (auth.uid() = id);

-- Note: If you need to create a basic read policy, uncomment this:
-- CREATE POLICY "profiles: read" ON public.profiles FOR SELECT USING (true);
