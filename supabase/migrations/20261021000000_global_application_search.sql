-- Additive, permission-aware global application search.
-- SECURITY INVOKER is intentional: every branch remains subject to the
-- authenticated caller's existing row-level security policies.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE INDEX IF NOT EXISTS idx_global_search_jobs_unit_trgm
  ON public.jobs USING gin (lower(coalesce(unit_number, '')) extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_global_search_jobs_description_trgm
  ON public.jobs USING gin (lower(coalesce(description, '')) extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_global_search_properties_name_trgm
  ON public.properties USING gin (lower(coalesce(property_name, '')) extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_global_search_properties_address_trgm
  ON public.properties USING gin (lower(coalesce(address, '')) extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_global_search_profiles_name_trgm
  ON public.profiles USING gin (lower(coalesce(full_name, '')) extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_global_search_property_contacts_name_trgm
  ON public.property_contacts USING gin (lower(coalesce(name, '')) extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_global_search_files_name_trgm
  ON public.files USING gin (lower(coalesce(name, '')) extensions.gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.global_search_v2(
  p_query text,
  p_types text[] DEFAULT NULL,
  p_limit integer DEFAULT 60,
  p_offset integer DEFAULT 0,
  p_date_from timestamptz DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  result_type text,
  title text,
  subtitle text,
  description text,
  result_date timestamptz,
  tags text[],
  url text,
  matched_field text,
  relevance integer,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, extensions
AS $function$
  WITH params AS (
    SELECT lower(trim(regexp_replace(coalesce(p_query, ''), '\s+', ' ', 'g'))) AS q
  ), candidates AS (
    SELECT
      j.id::uuid,
      (CASE WHEN lower(coalesce(ph.job_phase_label, '')) = 'job request' THEN 'job_request' ELSE 'job' END)::text AS result_type,
      concat('WO-', lpad(j.work_order_num::text, 6, '0'), ' · Unit ', coalesce(j.unit_number, 'N/A'))::text AS title,
      concat_ws(' · ', pr.property_name, concat_ws(', ', pr.address, pr.city, pr.state, pr.zip))::text AS subtitle,
      j.description::text,
      j.created_at::timestamptz AS result_date,
      array_remove(ARRAY[ph.job_phase_label, jt.job_type_label, assignee.full_name], NULL)::text[] AS tags,
      ('/dashboard/jobs/' || j.id::text)::text AS url,
      CASE
        WHEN lower(concat('wo-', lpad(j.work_order_num::text, 6, '0'))) = p.q OR j.work_order_num::text = regexp_replace(p.q, '\D', '', 'g') THEN 'work order number'
        WHEN lower(coalesce(j.unit_number, '')) LIKE '%' || p.q || '%' THEN 'unit number'
        WHEN lower(coalesce(j.purchase_order, '')) LIKE '%' || p.q || '%' THEN 'purchase order'
        WHEN lower(coalesce(pr.property_name, '')) LIKE '%' || p.q || '%' THEN 'property name'
        WHEN lower(concat_ws(' ', pr.address, pr.city, pr.state, pr.zip)) LIKE '%' || p.q || '%' THEN 'property address'
        WHEN lower(coalesce(assignee.full_name, '')) LIKE '%' || p.q || '%' THEN 'subcontractor'
        WHEN lower(coalesce(ph.job_phase_label, '')) LIKE '%' || p.q || '%' THEN 'job phase'
        WHEN lower(coalesce(jt.job_type_label, '')) LIKE '%' || p.q || '%' THEN 'job type'
        ELSE 'job description'
      END::text AS matched_field,
      CASE
        WHEN lower(concat('wo-', lpad(j.work_order_num::text, 6, '0'))) = p.q OR j.work_order_num::text = regexp_replace(p.q, '\D', '', 'g') THEN 100
        WHEN lower(coalesce(j.purchase_order, '')) = p.q THEN 95
        WHEN lower(coalesce(pr.property_name, '')) = p.q THEN 90
        WHEN lower(coalesce(pr.property_name, '')) LIKE p.q || '%' THEN 80
        WHEN lower(coalesce(j.unit_number, '')) = p.q THEN 78
        ELSE 50
      END::integer AS relevance
    FROM public.jobs j
    CROSS JOIN params p
    JOIN public.properties pr ON pr.id = j.property_id
    LEFT JOIN public.profiles assignee ON assignee.id = j.assigned_to
    LEFT JOIN public.job_phases ph ON ph.id = j.current_phase_id
    LEFT JOIN public.job_types jt ON jt.id = j.job_type_id
    WHERE length(p.q) >= 3
      AND (p_types IS NULL OR 'job' = ANY(p_types) OR 'job_request' = ANY(p_types))
      AND lower(concat_ws(' ', j.work_order_num::text, 'wo-' || j.work_order_num::text,
        j.unit_number, j.purchase_order, j.description, pr.property_name, pr.address,
        pr.city, pr.state, pr.zip, assignee.full_name, assignee.email,
        ph.job_phase_label, jt.job_type_label)) LIKE '%' || p.q || '%'

    UNION ALL

    SELECT pr.id::uuid, 'property'::text, coalesce(pr.property_name, 'Unnamed Property')::text,
      concat_ws(', ', pr.address, pr.city, pr.state, pr.zip)::text,
      pmg.company_name::text, pr.created_at::timestamptz, ARRAY[pmg.company_name]::text[],
      ('/dashboard/properties/' || pr.id::text)::text,
      (CASE WHEN lower(coalesce(pr.property_name, '')) LIKE '%' || p.q || '%' THEN 'property name' ELSE 'property address' END)::text,
      (CASE WHEN lower(coalesce(pr.property_name, '')) = p.q THEN 100 WHEN lower(coalesce(pr.property_name, '')) LIKE p.q || '%' THEN 85 ELSE 55 END)::integer
    FROM public.properties pr
    CROSS JOIN params p
    LEFT JOIN public.property_management_groups pmg ON pmg.id = pr.property_management_group_id
    WHERE length(p.q) >= 3 AND (p_types IS NULL OR 'property' = ANY(p_types))
      AND lower(concat_ws(' ', pr.property_name, pr.address, pr.city, pr.state, pr.zip, pmg.company_name)) LIKE '%' || p.q || '%'

    UNION ALL

    SELECT wo.id::uuid, 'work_order'::text, concat('Work Order · WO-', lpad(j.work_order_num::text, 6, '0'))::text,
      concat_ws(' · ', pr.property_name, 'Unit ' || coalesce(j.unit_number, wo.unit_number))::text,
      coalesce(wo.additional_comments, wo.extra_charges_description)::text, wo.created_at::timestamptz,
      ARRAY[CASE WHEN wo.has_extra_charges THEN 'Extra Charges' END]::text[],
      ('/dashboard/jobs/' || j.id::text)::text, 'work order details'::text,
      (CASE WHEN j.work_order_num::text = regexp_replace(p.q, '\D', '', 'g') THEN 100 ELSE 60 END)::integer
    FROM public.work_orders wo
    CROSS JOIN params p
    JOIN public.jobs j ON j.id = wo.job_id
    JOIN public.properties pr ON pr.id = j.property_id
    LEFT JOIN public.profiles preparer ON preparer.id = wo.prepared_by
    WHERE length(p.q) >= 3 AND (p_types IS NULL OR 'work_order' = ANY(p_types))
      AND lower(concat_ws(' ', j.work_order_num::text, 'wo-' || j.work_order_num::text,
        wo.unit_number, wo.extra_charges_description,
        wo.additional_comments, pr.property_name, pr.address, preparer.full_name)) LIKE '%' || p.q || '%'

    UNION ALL

    SELECT pf.id::uuid, 'user'::text, coalesce(pf.full_name, 'Unnamed User')::text, pf.email::text,
      ('Role: ' || coalesce(pf.role, 'user'))::text, pf.created_at::timestamptz, ARRAY[pf.role]::text[],
      (CASE WHEN pf.role = 'subcontractor' THEN '/dashboard/users/subcontractors/' || pf.id::text ELSE '/dashboard/users' END)::text,
      (CASE WHEN lower(coalesce(pf.full_name, '')) LIKE '%' || p.q || '%' THEN 'name' ELSE 'email' END)::text,
      (CASE WHEN lower(coalesce(pf.full_name, '')) = p.q OR lower(pf.email) = p.q THEN 100 WHEN lower(coalesce(pf.full_name, '')) LIKE p.q || '%' THEN 85 ELSE 60 END)::integer
    FROM public.profiles pf CROSS JOIN params p
    WHERE length(p.q) >= 3 AND (p_types IS NULL OR 'user' = ANY(p_types))
      AND lower(concat_ws(' ', pf.full_name, pf.email, pf.role)) LIKE '%' || p.q || '%'

    UNION ALL

    SELECT pc.id::uuid, 'contact'::text, coalesce(pc.name, pc.email, 'Property Contact')::text,
      concat_ws(' · ', pr.property_name, pc.position)::text, concat_ws(' · ', pc.email, pc.secondary_email, pc.phone)::text,
      pc.created_at::timestamptz, ARRAY['Property Contact']::text[], ('/dashboard/properties/' || pr.id::text)::text,
      'property contact'::text, (CASE WHEN lower(coalesce(pc.name, '')) = p.q THEN 95 ELSE 65 END)::integer
    FROM public.property_contacts pc CROSS JOIN params p
    JOIN public.properties pr ON pr.id = pc.property_id
    WHERE length(p.q) >= 3 AND (p_types IS NULL OR 'contact' = ANY(p_types))
      AND lower(concat_ws(' ', pc.name, pc.position, pc.email, pc.secondary_email,
        regexp_replace(coalesce(pc.phone, ''), '\D', '', 'g'), pr.property_name)) LIKE '%' ||
        CASE WHEN p.q ~ '^\+?[0-9() .-]+$' THEN regexp_replace(p.q, '\D', '', 'g') ELSE p.q END || '%'

    UNION ALL

    SELECT c.id::uuid, 'contact'::text, trim(concat_ws(' ', c.first_name, c.last_name))::text,
      concat_ws(' · ', c.company, c.job_title)::text,
      concat_ws(' · ', c.email, c.phone, c.address::text)::text, c.created_at::timestamptz,
      coalesce(c.tags, ARRAY['Contact'])::text[], ('/dashboard/contacts/' || c.id::text)::text,
      'contact'::text, (CASE WHEN lower(trim(concat_ws(' ', c.first_name, c.last_name))) = p.q THEN 95 ELSE 60 END)::integer
    FROM public.contacts c CROSS JOIN params p
    WHERE length(p.q) >= 3 AND (p_types IS NULL OR 'contact' = ANY(p_types))
      AND lower(concat_ws(' ', c.first_name, c.last_name, c.email,
        regexp_replace(coalesce(c.phone, ''), '\D', '', 'g'), c.company,
        c.job_title, c.address::text, c.tags::text)) LIKE '%' ||
        CASE WHEN p.q ~ '^\+?[0-9() .-]+$' THEN regexp_replace(p.q, '\D', '', 'g') ELSE p.q END || '%'

    UNION ALL

    SELECT pmg.id::uuid, 'property_group'::text, pmg.company_name::text, coalesce(pmg.contact_name, 'No contact')::text,
      concat_ws(' · ', pmg.address, pmg.city, pmg.state, pmg.zip, pmg.contact_email, pmg.contact_phone)::text,
      pmg.created_at::timestamptz, ARRAY['Property Group']::text[], ('/dashboard/property-groups/' || pmg.id::text)::text,
      'property group'::text, (CASE WHEN lower(pmg.company_name) = p.q THEN 100 WHEN lower(pmg.company_name) LIKE p.q || '%' THEN 85 ELSE 55 END)::integer
    FROM public.property_management_groups pmg CROSS JOIN params p
    WHERE length(p.q) >= 3 AND (p_types IS NULL OR 'property_group' = ANY(p_types))
      AND (lower(concat_ws(' ', pmg.company_name, pmg.address, pmg.address_2, pmg.city,
        pmg.state, pmg.zip, pmg.contact_name, pmg.contact_email, pmg.contact_phone)) LIKE '%' || p.q || '%'
        OR EXISTS (SELECT 1 FROM public.properties pr WHERE pr.property_management_group_id = pmg.id
          AND lower(concat_ws(' ', pr.property_name, pr.address, pr.city, pr.state, pr.zip)) LIKE '%' || p.q || '%'))

    UNION ALL

    SELECT f.id::uuid, 'file'::text, f.name::text, concat_ws(' · ', pr.property_name, CASE WHEN j.id IS NOT NULL THEN 'WO-' || lpad(j.work_order_num::text, 6, '0') END)::text,
      concat_ws(' · ', f.path, f.type)::text, f.created_at::timestamptz, ARRAY[f.type]::text[],
      (CASE WHEN j.id IS NOT NULL THEN '/dashboard/files?job_id=' || j.id::text WHEN pr.id IS NOT NULL THEN '/dashboard/files?property_id=' || pr.id::text ELSE '/dashboard/files' END)::text,
      'file name'::text, (CASE WHEN lower(f.name) = p.q THEN 100 WHEN lower(f.name) LIKE p.q || '%' THEN 85 ELSE 50 END)::integer
    FROM public.files f CROSS JOIN params p
    LEFT JOIN public.jobs j ON j.id = f.job_id
    LEFT JOIN public.properties pr ON pr.id = coalesce(f.property_id, j.property_id)
    WHERE length(p.q) >= 3 AND (p_types IS NULL OR 'file' = ANY(p_types))
      AND f.type <> 'folder/directory'
      AND lower(concat_ws(' ', f.name, f.path, f.type, pr.property_name, j.work_order_num::text)) LIKE '%' || p.q || '%'

    UNION ALL

    SELECT a.id::uuid, 'activity'::text, a.action::text, coalesce(pf.full_name, 'System')::text, a.description::text,
      a.created_at::timestamptz, ARRAY[a.entity_type]::text[], '/dashboard/activity'::text, 'activity'::text, 40::integer
    FROM public.activity_log a CROSS JOIN params p
    LEFT JOIN public.profiles pf ON pf.id = a.changed_by
    WHERE length(p.q) >= 3 AND (p_types IS NULL OR 'activity' = ANY(p_types))
      AND lower(concat_ws(' ', a.action, a.description, a.entity_type, pf.full_name)) LIKE '%' || p.q || '%'
  ), ranked AS (
    SELECT c.*, count(*) OVER () AS total_count
    FROM candidates c
    WHERE p_date_from IS NULL OR c.result_date >= p_date_from
  )
  SELECT * FROM ranked
  ORDER BY relevance DESC, result_date DESC NULLS LAST, title
  LIMIT greatest(1, least(coalesce(p_limit, 60), 100))
  OFFSET greatest(0, coalesce(p_offset, 0));
$function$;

REVOKE ALL ON FUNCTION public.global_search_v2(text, text[], integer, integer, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.global_search_v2(text, text[], integer, integer, timestamptz) TO authenticated;
