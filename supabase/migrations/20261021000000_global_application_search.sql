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
      j.id,
      CASE WHEN lower(coalesce(ph.job_phase_label, '')) = 'job request' THEN 'job_request' ELSE 'job' END AS result_type,
      concat('WO-', lpad(j.work_order_num::text, 6, '0'), ' · Unit ', coalesce(j.unit_number, 'N/A')) AS title,
      concat_ws(' · ', pr.property_name, concat_ws(', ', pr.address, pr.city, pr.state, pr.zip)) AS subtitle,
      j.description,
      j.created_at AS result_date,
      array_remove(ARRAY[ph.job_phase_label, jt.job_type_label, assignee.full_name], NULL) AS tags,
      '/dashboard/jobs/' || j.id::text AS url,
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
      END AS matched_field,
      CASE
        WHEN lower(concat('wo-', lpad(j.work_order_num::text, 6, '0'))) = p.q OR j.work_order_num::text = regexp_replace(p.q, '\D', '', 'g') THEN 100
        WHEN lower(coalesce(j.purchase_order, '')) = p.q THEN 95
        WHEN lower(coalesce(pr.property_name, '')) = p.q THEN 90
        WHEN lower(coalesce(pr.property_name, '')) LIKE p.q || '%' THEN 80
        WHEN lower(coalesce(j.unit_number, '')) = p.q THEN 78
        ELSE 50
      END AS relevance
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

    SELECT pr.id, 'property', coalesce(pr.property_name, 'Unnamed Property'),
      concat_ws(', ', pr.address, pr.city, pr.state, pr.zip),
      pmg.company_name, pr.created_at, ARRAY[pmg.company_name],
      '/dashboard/properties/' || pr.id::text,
      CASE WHEN lower(coalesce(pr.property_name, '')) LIKE '%' || p.q || '%' THEN 'property name' ELSE 'property address' END,
      CASE WHEN lower(coalesce(pr.property_name, '')) = p.q THEN 100 WHEN lower(coalesce(pr.property_name, '')) LIKE p.q || '%' THEN 85 ELSE 55 END
    FROM public.properties pr
    CROSS JOIN params p
    LEFT JOIN public.property_management_groups pmg ON pmg.id = pr.property_management_group_id
    WHERE length(p.q) >= 3 AND (p_types IS NULL OR 'property' = ANY(p_types))
      AND lower(concat_ws(' ', pr.property_name, pr.address, pr.city, pr.state, pr.zip, pmg.company_name)) LIKE '%' || p.q || '%'

    UNION ALL

    SELECT wo.id, 'work_order', concat('Work Order · WO-', lpad(j.work_order_num::text, 6, '0')),
      concat_ws(' · ', pr.property_name, 'Unit ' || coalesce(j.unit_number, wo.unit_number)),
      coalesce(wo.additional_comments, wo.extra_charges_description), wo.created_at,
      ARRAY[CASE WHEN wo.has_extra_charges THEN 'Extra Charges' END],
      '/dashboard/jobs/' || j.id::text, 'work order details',
      CASE WHEN j.work_order_num::text = regexp_replace(p.q, '\D', '', 'g') THEN 100 ELSE 60 END
    FROM public.work_orders wo
    CROSS JOIN params p
    JOIN public.jobs j ON j.id = wo.job_id
    JOIN public.properties pr ON pr.id = j.property_id
    LEFT JOIN public.profiles preparer ON preparer.id = wo.prepared_by
    WHERE length(p.q) >= 3 AND (p_types IS NULL OR 'work_order' = ANY(p_types))
      AND lower(concat_ws(' ', j.work_order_num::text, 'wo-' || j.work_order_num::text,
        wo.unit_number, wo.paint_type, wo.extra_charges_description,
        wo.additional_comments, pr.property_name, pr.address, preparer.full_name)) LIKE '%' || p.q || '%'

    UNION ALL

    SELECT pf.id, 'user', coalesce(pf.full_name, 'Unnamed User'), pf.email,
      'Role: ' || coalesce(pf.role, 'user'), pf.created_at, ARRAY[pf.role],
      CASE WHEN pf.role = 'subcontractor' THEN '/dashboard/users/subcontractors/' || pf.id::text ELSE '/dashboard/users' END,
      CASE WHEN lower(coalesce(pf.full_name, '')) LIKE '%' || p.q || '%' THEN 'name' ELSE 'email' END,
      CASE WHEN lower(coalesce(pf.full_name, '')) = p.q OR lower(pf.email) = p.q THEN 100 WHEN lower(coalesce(pf.full_name, '')) LIKE p.q || '%' THEN 85 ELSE 60 END
    FROM public.profiles pf CROSS JOIN params p
    WHERE length(p.q) >= 3 AND (p_types IS NULL OR 'user' = ANY(p_types))
      AND lower(concat_ws(' ', pf.full_name, pf.email, pf.role)) LIKE '%' || p.q || '%'

    UNION ALL

    SELECT pc.id, 'contact', coalesce(pc.name, pc.email, 'Property Contact'),
      concat_ws(' · ', pr.property_name, pc.position), concat_ws(' · ', pc.email, pc.secondary_email, pc.phone),
      pc.created_at, ARRAY['Property Contact'], '/dashboard/properties/' || pr.id::text,
      'property contact', CASE WHEN lower(coalesce(pc.name, '')) = p.q THEN 95 ELSE 65 END
    FROM public.property_contacts pc CROSS JOIN params p
    JOIN public.properties pr ON pr.id = pc.property_id
    WHERE length(p.q) >= 3 AND (p_types IS NULL OR 'contact' = ANY(p_types))
      AND lower(concat_ws(' ', pc.name, pc.position, pc.email, pc.secondary_email,
        regexp_replace(coalesce(pc.phone, ''), '\D', '', 'g'), pr.property_name)) LIKE '%' ||
        CASE WHEN p.q ~ '^\+?[0-9() .-]+$' THEN regexp_replace(p.q, '\D', '', 'g') ELSE p.q END || '%'

    UNION ALL

    SELECT c.id, 'contact', trim(concat_ws(' ', c.first_name, c.last_name)),
      concat_ws(' · ', c.company, c.job_title),
      concat_ws(' · ', c.email, c.phone, c.address::text), c.created_at,
      coalesce(c.tags, ARRAY['Contact']), '/dashboard/contacts/' || c.id::text,
      'contact', CASE WHEN lower(trim(concat_ws(' ', c.first_name, c.last_name))) = p.q THEN 95 ELSE 60 END
    FROM public.contacts c CROSS JOIN params p
    WHERE length(p.q) >= 3 AND (p_types IS NULL OR 'contact' = ANY(p_types))
      AND lower(concat_ws(' ', c.first_name, c.last_name, c.email,
        regexp_replace(coalesce(c.phone, ''), '\D', '', 'g'), c.company,
        c.job_title, c.address::text, c.tags::text)) LIKE '%' ||
        CASE WHEN p.q ~ '^\+?[0-9() .-]+$' THEN regexp_replace(p.q, '\D', '', 'g') ELSE p.q END || '%'

    UNION ALL

    SELECT pmg.id, 'property_group', pmg.company_name, coalesce(pmg.contact_name, 'No contact'),
      concat_ws(' · ', pmg.address, pmg.city, pmg.state, pmg.zip, pmg.contact_email, pmg.contact_phone),
      pmg.created_at, ARRAY['Property Group'], '/dashboard/property-groups/' || pmg.id::text,
      'property group', CASE WHEN lower(pmg.company_name) = p.q THEN 100 WHEN lower(pmg.company_name) LIKE p.q || '%' THEN 85 ELSE 55 END
    FROM public.property_management_groups pmg CROSS JOIN params p
    WHERE length(p.q) >= 3 AND (p_types IS NULL OR 'property_group' = ANY(p_types))
      AND (lower(concat_ws(' ', pmg.company_name, pmg.address, pmg.address_2, pmg.city,
        pmg.state, pmg.zip, pmg.contact_name, pmg.contact_email, pmg.contact_phone)) LIKE '%' || p.q || '%'
        OR EXISTS (SELECT 1 FROM public.properties pr WHERE pr.property_management_group_id = pmg.id
          AND lower(concat_ws(' ', pr.property_name, pr.address, pr.city, pr.state, pr.zip)) LIKE '%' || p.q || '%'))

    UNION ALL

    SELECT f.id, 'file', f.name, concat_ws(' · ', pr.property_name, CASE WHEN j.id IS NOT NULL THEN 'WO-' || lpad(j.work_order_num::text, 6, '0') END),
      concat_ws(' · ', f.path, f.type), f.created_at, ARRAY[f.type],
      CASE WHEN j.id IS NOT NULL THEN '/dashboard/files?job_id=' || j.id::text WHEN pr.id IS NOT NULL THEN '/dashboard/files?property_id=' || pr.id::text ELSE '/dashboard/files' END,
      'file name', CASE WHEN lower(f.name) = p.q THEN 100 WHEN lower(f.name) LIKE p.q || '%' THEN 85 ELSE 50 END
    FROM public.files f CROSS JOIN params p
    LEFT JOIN public.jobs j ON j.id = f.job_id
    LEFT JOIN public.properties pr ON pr.id = coalesce(f.property_id, j.property_id)
    WHERE length(p.q) >= 3 AND (p_types IS NULL OR 'file' = ANY(p_types))
      AND f.type <> 'folder/directory'
      AND lower(concat_ws(' ', f.name, f.path, f.type, pr.property_name, j.work_order_num::text)) LIKE '%' || p.q || '%'

    UNION ALL

    SELECT a.id, 'activity', a.action, coalesce(pf.full_name, 'System'), a.description,
      a.created_at, ARRAY[a.entity_type], '/dashboard/activity', 'activity', 40
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
