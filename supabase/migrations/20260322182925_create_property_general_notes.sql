CREATE OR REPLACE FUNCTION public.is_internal_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'is_super_admin')
  );
$$;

CREATE TABLE IF NOT EXISTS public.property_general_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  topic text NOT NULL,
  note_content text NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT property_general_notes_topic_not_blank CHECK (length(btrim(topic)) > 0),
  CONSTRAINT property_general_notes_content_not_blank CHECK (length(btrim(note_content)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_property_general_notes_property_id_created_at
  ON public.property_general_notes (property_id, created_at DESC);

ALTER TABLE public.property_general_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Property general notes authenticated read" ON public.property_general_notes;
CREATE POLICY "Property general notes authenticated read"
  ON public.property_general_notes
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Property general notes admin insert" ON public.property_general_notes;
CREATE POLICY "Property general notes admin insert"
  ON public.property_general_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_internal_admin_user()
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "Property general notes admin update" ON public.property_general_notes;
CREATE POLICY "Property general notes admin update"
  ON public.property_general_notes
  FOR UPDATE
  TO authenticated
  USING (public.is_internal_admin_user())
  WITH CHECK (public.is_internal_admin_user());

DROP POLICY IF EXISTS "Property general notes admin delete" ON public.property_general_notes;
CREATE POLICY "Property general notes admin delete"
  ON public.property_general_notes
  FOR DELETE
  TO authenticated
  USING (public.is_internal_admin_user());

DROP TRIGGER IF EXISTS set_property_general_notes_updated_at ON public.property_general_notes;
CREATE TRIGGER set_property_general_notes_updated_at
  BEFORE UPDATE ON public.property_general_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_general_notes TO authenticated;
