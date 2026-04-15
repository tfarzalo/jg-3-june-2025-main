CREATE TABLE IF NOT EXISTS public.whats_new_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  icon_name text NOT NULL DEFAULT 'sparkles',
  badge_label text,
  is_published boolean NOT NULL DEFAULT true,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id),
  updated_by uuid REFERENCES public.profiles(id)
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_seen_whats_new_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_whats_new_entries_published
  ON public.whats_new_entries(is_published, updated_at DESC);

ALTER TABLE public.whats_new_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "published_whats_new_visible_to_authenticated" ON public.whats_new_entries;
CREATE POLICY "published_whats_new_visible_to_authenticated"
ON public.whats_new_entries
FOR SELECT
TO authenticated
USING (is_published = true OR EXISTS (
  SELECT 1
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND p.role = 'is_super_admin'
));

DROP POLICY IF EXISTS "super_admin_manage_whats_new_insert" ON public.whats_new_entries;
CREATE POLICY "super_admin_manage_whats_new_insert"
ON public.whats_new_entries
FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
  SELECT 1
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND p.role = 'is_super_admin'
));

DROP POLICY IF EXISTS "super_admin_manage_whats_new_update" ON public.whats_new_entries;
CREATE POLICY "super_admin_manage_whats_new_update"
ON public.whats_new_entries
FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND p.role = 'is_super_admin'
))
WITH CHECK (EXISTS (
  SELECT 1
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND p.role = 'is_super_admin'
));

DROP POLICY IF EXISTS "super_admin_manage_whats_new_delete" ON public.whats_new_entries;
CREATE POLICY "super_admin_manage_whats_new_delete"
ON public.whats_new_entries
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND p.role = 'is_super_admin'
));

CREATE OR REPLACE FUNCTION public.update_whats_new_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_whats_new_updated_at_trigger ON public.whats_new_entries;
CREATE TRIGGER update_whats_new_updated_at_trigger
  BEFORE UPDATE ON public.whats_new_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_whats_new_updated_at();
