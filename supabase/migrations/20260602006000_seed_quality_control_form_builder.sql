-- Add Form Builder field types and seed the starter JG Painting Pros QC form.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'valid_field_type'
      AND conrelid = 'public.lead_form_fields'::regclass
  ) THEN
    ALTER TABLE public.lead_form_fields DROP CONSTRAINT valid_field_type;
  END IF;
END $$;

ALTER TABLE public.lead_form_fields
  ADD CONSTRAINT valid_field_type
  CHECK (
    field_type IN (
      'text',
      'email',
      'phone',
      'textarea',
      'select',
      'radio',
      'checkbox',
      'number',
      'date',
      'url',
      'property_select',
      'unit_size_select',
      'media_upload',
      'score_matrix',
      'section_heading'
    )
  );

INSERT INTO storage.buckets (id, name, public)
VALUES ('lead-form-media', 'lead-form-media', true)
ON CONFLICT (id) DO UPDATE
SET public = true;

DROP POLICY IF EXISTS "Anyone can upload lead form media" ON storage.objects;
CREATE POLICY "Anyone can upload lead form media"
  ON storage.objects
  FOR INSERT
  TO public
  WITH CHECK (bucket_id = 'lead-form-media');

DROP POLICY IF EXISTS "Anyone can read lead form media" ON storage.objects;
CREATE POLICY "Anyone can read lead form media"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'lead-form-media');

DO $$
DECLARE
  v_actor_id uuid;
  v_form_id uuid;
BEGIN
  SELECT id
    INTO v_actor_id
  FROM public.profiles
  WHERE role IN ('admin', 'jg_management', 'is_super_admin')
  ORDER BY created_at NULLS LAST
  LIMIT 1;

  IF v_actor_id IS NULL THEN
    SELECT id
      INTO v_actor_id
    FROM public.profiles
    ORDER BY created_at NULLS LAST
    LIMIT 1;
  END IF;

  IF v_actor_id IS NULL THEN
    RAISE NOTICE 'Skipping QC form seed because no profile exists for lead_forms.created_by';
    RETURN;
  END IF;

  SELECT id
    INTO v_form_id
  FROM public.lead_forms
  WHERE name = 'JG Painting Pros Quality Control'
  LIMIT 1;

  IF v_form_id IS NULL THEN
    INSERT INTO public.lead_forms (
      name,
      description,
      is_active,
      success_message,
      redirect_url,
      created_by
    ) VALUES (
      'JG Painting Pros Quality Control',
      'Please fill out this form as complete as possible.',
      true,
      'Quality control form submitted successfully.',
      NULL,
      v_actor_id
    )
    RETURNING id INTO v_form_id;
  ELSE
    UPDATE public.lead_forms
    SET description = 'Please fill out this form as complete as possible.',
        success_message = 'Quality control form submitted successfully.',
        is_active = true,
        updated_at = now()
    WHERE id = v_form_id;

    DELETE FROM public.lead_form_fields
    WHERE form_id = v_form_id;
  END IF;

  INSERT INTO public.lead_form_fields (
    form_id,
    field_type,
    field_name,
    field_label,
    placeholder,
    is_required,
    options,
    validation_rules,
    sort_order
  ) VALUES
    (v_form_id, 'section_heading', 'general_information_section', 'General Information', '', false, '[]'::jsonb, '{}'::jsonb, 0),
    (v_form_id, 'text', 'painter_first_name', 'Painter First Name', 'First', true, '[]'::jsonb, '{}'::jsonb, 1),
    (v_form_id, 'text', 'painter_last_name', 'Painter Last Name', 'Last', true, '[]'::jsonb, '{}'::jsonb, 2),
    (v_form_id, 'date', 'date_painted', 'Date Painted', '', true, '[]'::jsonb, '{}'::jsonb, 3),
    (v_form_id, 'date', 'date_walked', 'Date Walked', '', false, '[]'::jsonb, '{}'::jsonb, 4),
    (v_form_id, 'property_select', 'property_id', 'Property', 'Select a property', true, '[]'::jsonb, '{}'::jsonb, 5),
    (v_form_id, 'text', 'unit_number', 'Unit #', 'Enter unit number', true, '[]'::jsonb, '{}'::jsonb, 6),
    (v_form_id, 'section_heading', 'unit_information_section', 'Unit Information', '', false, '[]'::jsonb, '{}'::jsonb, 7),
    (v_form_id, 'unit_size_select', 'unit_size_id', 'What Size?', 'Select a unit size', true, '[]'::jsonb, '{}'::jsonb, 8),
    (v_form_id, 'section_heading', 'comments_images_section', 'Comments and Images', '', false, '[]'::jsonb, '{}'::jsonb, 9),
    (v_form_id, 'textarea', 'comments', 'Comments', 'Enter comments', false, '[]'::jsonb, '{}'::jsonb, 10),
    (v_form_id, 'media_upload', 'media', 'Images / Media', 'Upload media', false, '[]'::jsonb, '{"max_files":10,"accept":"image/*"}'::jsonb, 11),
    (v_form_id, 'score_matrix', 'quality_score', 'Quality Score', '', true, '[]'::jsonb,
      '{
        "categories": [
          {"key":"surface_prep","label":"Surface prep and repairs","max":20},
          {"key":"coverage_finish","label":"Coverage and finish consistency","max":20},
          {"key":"cut_lines_edges","label":"Cut lines, edges, and detail work","max":15},
          {"key":"cleanliness","label":"Cleanliness, overspray, and site condition","max":15},
          {"key":"doors_trim_cabinets","label":"Doors, trim, cabinets, and specialty areas","max":10},
          {"key":"touchups","label":"Touch-ups needed / completion quality","max":10},
          {"key":"documentation","label":"Documentation and photo completeness","max":10}
        ],
        "total": 100
      }'::jsonb,
      12
    );
END
$$;
