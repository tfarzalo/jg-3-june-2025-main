-- Dedicated storage for property In-House Notes.
--
-- Historically, the UI reused property_callbacks for In-House Notes. That made
-- unitless callbacks and In-House Notes indistinguishable. This table creates a
-- real data boundary going forward.

CREATE TABLE IF NOT EXISTS public.property_in_house_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  note_date date NOT NULL,
  painter text,
  note text NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  source_callback_id uuid UNIQUE REFERENCES public.property_callbacks(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT property_in_house_notes_note_not_blank CHECK (length(btrim(note)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_property_in_house_notes_property_date
  ON public.property_in_house_notes (property_id, note_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_property_in_house_notes_created_by
  ON public.property_in_house_notes (created_by);

ALTER TABLE public.property_in_house_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Property in-house notes authenticated read" ON public.property_in_house_notes;
CREATE POLICY "Property in-house notes authenticated read"
  ON public.property_in_house_notes
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Property in-house notes internal insert" ON public.property_in_house_notes;
CREATE POLICY "Property in-house notes internal insert"
  ON public.property_in_house_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND role <> 'subcontractor'
    )
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "Property in-house notes internal update" ON public.property_in_house_notes;
CREATE POLICY "Property in-house notes internal update"
  ON public.property_in_house_notes
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND role <> 'subcontractor'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND role <> 'subcontractor'
    )
  );

DROP POLICY IF EXISTS "Property in-house notes internal delete" ON public.property_in_house_notes;
CREATE POLICY "Property in-house notes internal delete"
  ON public.property_in_house_notes
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND role <> 'subcontractor'
    )
  );

DROP TRIGGER IF EXISTS set_property_in_house_notes_updated_at ON public.property_in_house_notes;
CREATE TRIGGER set_property_in_house_notes_updated_at
  BEFORE UPDATE ON public.property_in_house_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_in_house_notes TO authenticated;

-- Legacy rows in property_callbacks are intentionally not auto-backfilled.
-- Some valid callbacks do not have a unit number, so blank unit_number is not a
-- reliable signal for historical In-House Notes. Known legacy In-House Notes can
-- be copied by id with source_callback_id populated, without deleting callbacks.
