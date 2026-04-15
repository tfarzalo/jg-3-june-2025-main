ALTER TABLE public.whats_new_entries
  ADD COLUMN IF NOT EXISTS display_order integer,
  ADD COLUMN IF NOT EXISTS icon_color text NOT NULL DEFAULT 'sky',
  ADD COLUMN IF NOT EXISTS include_super_admin boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'whats_new_entries_icon_color_check'
  ) THEN
    ALTER TABLE public.whats_new_entries
      ADD CONSTRAINT whats_new_entries_icon_color_check
      CHECK (icon_color IN ('sky', 'violet', 'emerald', 'amber', 'rose', 'slate'));
  END IF;
END
$$;

WITH ranked AS (
  SELECT id, row_number() OVER (ORDER BY updated_at ASC, created_at ASC, id ASC) AS seq
  FROM public.whats_new_entries
)
UPDATE public.whats_new_entries w
SET display_order = ranked.seq
FROM ranked
WHERE w.id = ranked.id
  AND w.display_order IS NULL;

ALTER TABLE public.whats_new_entries
  ALTER COLUMN display_order SET DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_whats_new_entries_display_order
  ON public.whats_new_entries(display_order ASC, updated_at DESC);
