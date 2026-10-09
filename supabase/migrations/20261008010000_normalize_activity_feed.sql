-- Provide one paginated activity feed over the two canonical history tables.
-- Existing history is retained; only future duplicate phase-change mirrors stop.

ALTER TABLE public.activity_log
  ADD COLUMN IF NOT EXISTS actor_name_snapshot text,
  ADD COLUMN IF NOT EXISTS actor_email_snapshot text;

CREATE INDEX IF NOT EXISTS idx_activity_log_metadata_job_id
  ON public.activity_log ((metadata ->> 'job_id'))
  WHERE metadata ? 'job_id';

CREATE OR REPLACE FUNCTION public.capture_activity_actor_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.changed_by IS NOT NULL
     AND (NEW.actor_name_snapshot IS NULL OR NEW.actor_email_snapshot IS NULL) THEN
    SELECT COALESCE(NEW.actor_name_snapshot, p.full_name),
           COALESCE(NEW.actor_email_snapshot, p.email)
      INTO NEW.actor_name_snapshot, NEW.actor_email_snapshot
      FROM public.profiles p
     WHERE p.id = NEW.changed_by;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS capture_activity_actor_snapshot_trigger ON public.activity_log;
CREATE TRIGGER capture_activity_actor_snapshot_trigger
  BEFORE INSERT ON public.activity_log
  FOR EACH ROW EXECUTE FUNCTION public.capture_activity_actor_snapshot();

-- Phase changes already have a complete canonical row. Do not copy future rows
-- into activity_log; the feed below reads job_phase_changes directly.
DROP TRIGGER IF EXISTS log_job_phase_change_trigger ON public.job_phase_changes;

CREATE OR REPLACE FUNCTION public.get_activity_feed(
  p_limit integer DEFAULT 150,
  p_before_at timestamptz DEFAULT NULL,
  p_before_key text DEFAULT NULL,
  p_date_from timestamptz DEFAULT NULL,
  p_phase_labels text[] DEFAULT NULL,
  p_user_ids uuid[] DEFAULT NULL,
  p_search text DEFAULT NULL
)
RETURNS TABLE (
  event_key text,
  source text,
  title text,
  description text,
  action text,
  entity_type text,
  job_id uuid,
  actor_user_id uuid,
  actor_name text,
  occurred_at timestamptz,
  from_phase_id uuid,
  to_phase_id uuid,
  from_phase_label text,
  from_phase_color text,
  to_phase_label text,
  to_phase_color text,
  work_order_num integer,
  unit_number text,
  property_id uuid,
  property_name text,
  change_reason text,
  metadata jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 150), 1), 150);
BEGIN
  IF NOT public.is_internal_admin_user() THEN
    RAISE EXCEPTION 'Not authorized to view the global activity feed';
  END IF;

  RETURN QUERY
  WITH events AS (
    SELECT
      'phase:' || c.id::text AS event_key,
      'phase_change'::text AS source,
      CASE
        WHEN c.change_reason ILIKE '%extra charges approved%' THEN 'Extra charges approved'
        WHEN c.change_reason ILIKE ANY (ARRAY['%extra charges declined%', '%extra charges rejected%']) THEN 'Extra charges declined'
        ELSE 'Job phase changed'
      END AS title,
      COALESCE(c.change_reason, format('Phase changed from %s to %s', fp.job_phase_label, tp.job_phase_label)) AS description,
      'phase_changed'::text AS action,
      'job_phase_change'::text AS entity_type,
      c.job_id,
      c.changed_by AS actor_user_id,
      COALESCE(
        (regexp_match(c.change_reason, 'extra charges (?:approved|declined|rejected) by ([^.;-]+)', 'i'))[1],
        pr.full_name,
        'System'
      ) AS actor_name,
      c.changed_at AS occurred_at,
      c.from_phase_id,
      c.to_phase_id,
      fp.job_phase_label AS from_phase_label,
      fp.color_dark_mode AS from_phase_color,
      tp.job_phase_label AS to_phase_label,
      tp.color_dark_mode AS to_phase_color,
      j.work_order_num,
      j.unit_number,
      j.property_id,
      prop.property_name,
      c.change_reason,
      '{}'::jsonb AS metadata
    FROM public.job_phase_changes c
    JOIN public.jobs j ON j.id = c.job_id
    LEFT JOIN public.job_phases fp ON fp.id = c.from_phase_id
    LEFT JOIN public.job_phases tp ON tp.id = c.to_phase_id
    LEFT JOIN public.properties prop ON prop.id = j.property_id
    LEFT JOIN public.profiles pr ON pr.id = c.changed_by

    UNION ALL

    SELECT
      'activity:' || a.id::text,
      'activity_log'::text,
      COALESCE(a.metadata ->> 'title', initcap(replace(a.entity_type, '_', ' ')) || ' ' || initcap(a.action)),
      a.description,
      a.action,
      a.entity_type,
      CASE
        WHEN COALESCE(a.metadata ->> 'job_id', '') ~* '^[0-9a-f-]{36}$' THEN (a.metadata ->> 'job_id')::uuid
        WHEN a.entity_type = 'job' THEN a.entity_id
        ELSE NULL
      END,
      a.changed_by,
      COALESCE(a.actor_name_snapshot, pr.full_name, 'System'),
      a.created_at,
      NULL::uuid,
      NULL::uuid,
      NULL::text,
      NULL::text,
      NULL::text,
      NULL::text,
      COALESCE(j.work_order_num, CASE WHEN COALESCE(a.metadata ->> 'work_order_num', '') ~ '^\d+$' THEN (a.metadata ->> 'work_order_num')::integer END),
      COALESCE(j.unit_number, a.metadata ->> 'unit_number'),
      j.property_id,
      COALESCE(prop.property_name, a.metadata ->> 'property_name'),
      NULL::text,
      COALESCE(a.metadata, '{}'::jsonb)
    FROM public.activity_log a
    LEFT JOIN public.profiles pr ON pr.id = a.changed_by
    LEFT JOIN public.jobs j ON j.id = CASE
      WHEN COALESCE(a.metadata ->> 'job_id', '') ~* '^[0-9a-f-]{36}$' THEN (a.metadata ->> 'job_id')::uuid
      WHEN a.entity_type = 'job' THEN a.entity_id
      ELSE NULL
    END
    LEFT JOIN public.properties prop ON prop.id = j.property_id
    WHERE a.entity_type <> 'job_phase_change'
  )
  SELECT e.*
  FROM events e
  WHERE (p_date_from IS NULL OR e.occurred_at >= p_date_from)
    AND (p_user_ids IS NULL OR cardinality(p_user_ids) = 0 OR e.actor_user_id = ANY(p_user_ids))
    AND (p_phase_labels IS NULL OR cardinality(p_phase_labels) = 0 OR e.to_phase_label = ANY(p_phase_labels))
    AND (
      NULLIF(btrim(p_search), '') IS NULL
      OR concat_ws(' ', e.title, e.description, e.actor_name, e.property_name,
           e.unit_number, e.work_order_num::text, e.from_phase_label, e.to_phase_label)
           ILIKE '%' || btrim(p_search) || '%'
    )
    AND (p_before_at IS NULL OR (e.occurred_at, e.event_key) < (p_before_at, p_before_key))
  ORDER BY e.occurred_at DESC, e.event_key DESC
  LIMIT v_limit + 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_activity_feed(integer, timestamptz, text, timestamptz, text[], uuid[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_activity_feed(integer, timestamptz, text, timestamptz, text[], uuid[], text) TO authenticated;

-- Notifications should represent actionable events, not every audit row.
CREATE OR REPLACE FUNCTION public.create_actionable_notifications_from_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user record;
  v_title text;
BEGIN
  IF NOT (
    (NEW.entity_type = 'job' AND NEW.action = 'created') OR
    (NEW.entity_type = 'work_order' AND NEW.action = 'created') OR
    NEW.entity_type IN ('callback', 'note') OR
    (NEW.entity_type = 'job' AND NEW.action IN ('approved', 'rejected'))
  ) THEN
    RETURN NEW;
  END IF;

  v_title := CASE
    WHEN NEW.entity_type = 'job' THEN 'New Job Request'
    WHEN NEW.entity_type = 'work_order' THEN 'New Work Order Submitted'
    WHEN NEW.entity_type = 'callback' THEN 'Callback Scheduled'
    WHEN NEW.entity_type = 'note' THEN 'New Note Added'
    ELSE 'Action Required'
  END;

  FOR v_user IN
    SELECT id FROM public.profiles
    WHERE role IN ('is_super_admin', 'admin', 'jg_management')
      AND id IS DISTINCT FROM NEW.changed_by
  LOOP
    INSERT INTO public.notifications
      (user_id, activity_log_id, title, message, type, entity_id, job_id, metadata)
    VALUES
      (v_user.id, NEW.id, v_title, NEW.description, NEW.entity_type, NEW.entity_id,
       CASE WHEN NEW.entity_type = 'job' THEN NEW.entity_id
            WHEN COALESCE(NEW.metadata ->> 'job_id', '') ~* '^[0-9a-f-]{36}$'
              THEN (NEW.metadata ->> 'job_id')::uuid
            ELSE NULL END,
       NEW.metadata);
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_notifications_from_activity_trigger ON public.activity_log;
CREATE TRIGGER create_notifications_from_activity_trigger
  AFTER INSERT ON public.activity_log
  FOR EACH ROW EXECUTE FUNCTION public.create_actionable_notifications_from_activity();

-- Realtime invalidation lets open Activity pages update without polling or a
-- browser refresh. Ignore duplicate-object errors on already-published tables.
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_log; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.job_phase_changes; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
