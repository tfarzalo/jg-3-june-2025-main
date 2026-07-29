-- Hotfix for subcontractor work order submission after sprinkler form and
-- miscellaneous additional cost changes.
--
-- This is intentionally idempotent because production migration history is
-- currently out of sync with the local migration chain.

ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS sprinkler_form_left_in_unit boolean NOT NULL DEFAULT false;

ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS misc_additional_cost_items jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.work_orders.sprinkler_form_left_in_unit IS
  'Whether the subcontractor/admin indicated a sprinkler form was left in the unit.';

COMMENT ON COLUMN public.work_orders.misc_additional_cost_items IS
  'Line items for miscellaneous additional costs reported or edited on the work order. Each item includes id, description, price, and optional subPay.';

UPDATE public.work_orders
SET misc_additional_cost_items = jsonb_build_array(
  jsonb_build_object(
    'id', 'legacy-misc-additional-cost',
    'description', COALESCE(NULLIF(repair_description, ''), 'Miscellaneous additional cost'),
    'price', repair_cost
  )
)
WHERE repair_cost > 0
  AND (
    misc_additional_cost_items IS NULL
    OR jsonb_typeof(misc_additional_cost_items) <> 'array'
    OR jsonb_array_length(misc_additional_cost_items) = 0
  );

ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.work_orders;
DROP POLICY IF EXISTS "Enable read for authenticated users" ON public.work_orders;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.work_orders;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.work_orders;

CREATE POLICY "Enable insert for authenticated users"
ON public.work_orders
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Enable read for authenticated users"
ON public.work_orders
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Enable update for authenticated users"
ON public.work_orders
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Enable delete for authenticated users"
ON public.work_orders
FOR DELETE
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.files;
DROP POLICY IF EXISTS "Enable read for authenticated users" ON public.files;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.files;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.files;

CREATE POLICY "Enable insert for authenticated users"
ON public.files
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Enable read for authenticated users"
ON public.files
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Enable update for authenticated users"
ON public.files
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Enable delete for authenticated users"
ON public.files
FOR DELETE
TO authenticated
USING (true);

GRANT ALL ON public.work_orders TO authenticated;
GRANT ALL ON public.files TO authenticated;
GRANT ALL ON public.work_orders TO service_role;
GRANT ALL ON public.files TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'files_category_check') THEN
    ALTER TABLE public.files DROP CONSTRAINT files_category_check;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'valid_category') THEN
    ALTER TABLE public.files DROP CONSTRAINT valid_category;
  END IF;
END $$;

ALTER TABLE public.files
  ADD CONSTRAINT files_category_check
  CHECK (
    category IS NULL OR category IN (
      'property_files',
      'job_files',
      'before',
      'sprinkler',
      'sprinkler_form',
      'other',
      'before_images',
      'after_images',
      'sprinkler_images',
      'sprinkler_with_cover_images',
      'sprinkler_without_cover_images',
      'sprinkler_form_images',
      'other_files'
    )
  );

CREATE INDEX IF NOT EXISTS idx_files_sprinkler_form_uploads
  ON public.files(job_id, work_order_id, category)
  WHERE category IN ('sprinkler_form', 'sprinkler_form_images', 'sprinkler_images');

INSERT INTO storage.buckets (id, name, public)
VALUES ('files', 'files', true)
ON CONFLICT (id) DO UPDATE
SET public = true;

DROP POLICY IF EXISTS "Files bucket public read" ON storage.objects;
DROP POLICY IF EXISTS "Files bucket authenticated insert" ON storage.objects;
DROP POLICY IF EXISTS "Files bucket authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "Files bucket authenticated delete" ON storage.objects;

CREATE POLICY "Files bucket public read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'files');

CREATE POLICY "Files bucket authenticated insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'files');

CREATE POLICY "Files bucket authenticated update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'files')
WITH CHECK (bucket_id = 'files');

CREATE POLICY "Files bucket authenticated delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'files');

CREATE OR REPLACE FUNCTION public.get_upload_folder(
    p_property_id uuid,
    p_job_id uuid,
    p_folder_type text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_property_name text;
    v_work_order_num integer;
    v_properties_root_id uuid;
    v_property_folder_id uuid;
    v_work_orders_folder_id uuid;
    v_wo_folder_id uuid;
    v_target_folder_id uuid;
    v_sanitized_property_name text;
    v_folder_name text;
BEGIN
    SELECT property_name INTO v_property_name
    FROM public.properties
    WHERE id = p_property_id;

    IF v_property_name IS NULL THEN
        RAISE EXCEPTION 'Property not found: %', p_property_id;
    END IF;

    v_sanitized_property_name := regexp_replace(v_property_name, '[^a-zA-Z0-9\s\-]', '', 'g');
    v_sanitized_property_name := regexp_replace(v_sanitized_property_name, '\s+', ' ', 'g');
    v_sanitized_property_name := trim(v_sanitized_property_name);

    v_properties_root_id := public.get_or_create_root_folder('Properties');
    PERFORM public.get_or_create_root_folder('JG Docs and Info');

    v_property_folder_id := public.ensure_folder_exists(
        '/' || v_sanitized_property_name,
        v_properties_root_id,
        p_property_id,
        NULL
    );

    UPDATE public.files
    SET folder_id = v_properties_root_id
    WHERE id = v_property_folder_id
      AND (folder_id IS NULL OR folder_id != v_properties_root_id);

    IF p_folder_type IN ('property_files', 'property-files') THEN
        v_target_folder_id := public.ensure_folder_exists(
            '/' || v_sanitized_property_name || '/Property Files',
            v_property_folder_id,
            p_property_id,
            NULL
        );
        RETURN v_target_folder_id;
    END IF;

    IF p_job_id IS NULL THEN
        RAISE EXCEPTION 'job_id is required for folder type: %', p_folder_type;
    END IF;

    SELECT work_order_num INTO v_work_order_num
    FROM public.jobs
    WHERE id = p_job_id;

    IF v_work_order_num IS NULL THEN
        RAISE EXCEPTION 'Job not found or missing work_order_num: %', p_job_id;
    END IF;

    v_work_orders_folder_id := public.ensure_folder_exists(
        '/' || v_sanitized_property_name || '/Work Orders',
        v_property_folder_id,
        p_property_id,
        NULL
    );

    v_wo_folder_id := public.ensure_folder_exists(
        '/' || v_sanitized_property_name || '/Work Orders/WO-' || lpad(v_work_order_num::text, 6, '0'),
        v_work_orders_folder_id,
        p_property_id,
        p_job_id
    );

    CASE p_folder_type
        WHEN 'before'                         THEN v_folder_name := 'Before Images';
        WHEN 'before_images'                  THEN v_folder_name := 'Before Images';
        WHEN 'after'                          THEN v_folder_name := 'After Images';
        WHEN 'after_images'                   THEN v_folder_name := 'After Images';
        WHEN 'sprinkler'                      THEN v_folder_name := 'Sprinkler Images with Cover';
        WHEN 'sprinkler_images'               THEN v_folder_name := 'Sprinkler Images with Cover';
        WHEN 'sprinkler_with_cover'           THEN v_folder_name := 'Sprinkler Images with Cover';
        WHEN 'sprinkler_with_cover_images'    THEN v_folder_name := 'Sprinkler Images with Cover';
        WHEN 'sprinkler_without_cover'        THEN v_folder_name := 'Sprinkler Images without Cover';
        WHEN 'sprinkler_without_cover_images' THEN v_folder_name := 'Sprinkler Images without Cover';
        WHEN 'sprinkler_form'                 THEN v_folder_name := 'Sprinkler Form Images';
        WHEN 'sprinkler_form_images'          THEN v_folder_name := 'Sprinkler Form Images';
        WHEN 'other'                          THEN v_folder_name := 'Other Files';
        WHEN 'other_files'                    THEN v_folder_name := 'Other Files';
        WHEN 'job_files'                      THEN v_folder_name := 'Job Files';
        WHEN 'job-files'                      THEN v_folder_name := 'Job Files';
        ELSE v_folder_name := 'Other Files';
    END CASE;

    v_target_folder_id := public.ensure_folder_exists(
        '/' || v_sanitized_property_name || '/Work Orders/WO-' ||
            lpad(v_work_order_num::text, 6, '0') || '/' || v_folder_name,
        v_wo_folder_id,
        p_property_id,
        p_job_id
    );

    RETURN v_target_folder_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_upload_folder(uuid, uuid, text) TO authenticated;
