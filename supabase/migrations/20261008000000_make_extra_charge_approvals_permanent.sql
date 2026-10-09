-- Extra-charge customer approval links remain viewable for the life of the
-- job. Only preview links expire. Existing decisions and job phases are not
-- changed by this migration.

ALTER TABLE public.approval_tokens
  ALTER COLUMN expires_at DROP NOT NULL;

UPDATE public.approval_tokens
SET expires_at = NULL
WHERE approval_type = 'extra_charges'
  AND expires_at IS NOT NULL;

DROP POLICY IF EXISTS "Anyone can read valid approval tokens" ON public.approval_tokens;
DROP POLICY IF EXISTS "Anyone can read active or completed approval tokens" ON public.approval_tokens;

DROP POLICY IF EXISTS "Anyone can update approval tokens to mark as used" ON public.approval_tokens;
DROP POLICY IF EXISTS "Anyone can complete active approval tokens" ON public.approval_tokens;

-- Public pages validate through the service-backed validation function and
-- decide through narrowly scoped SECURITY DEFINER RPCs. Do not expose the
-- approval_tokens table itself to anonymous broad reads or writes.

-- Persist an in-app notification in the same transaction that records the
-- customer decision. Realtime clients display this as a slide-in and retain it
-- in the notification center. The transition guard prevents duplicates.
CREATE OR REPLACE FUNCTION public.notify_internal_users_of_approval_decision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile RECORD;
  v_work_order_num INTEGER;
  v_property_name TEXT;
  v_unit_number TEXT;
  v_amount NUMERIC;
  v_title TEXT;
  v_message TEXT;
BEGIN
  IF NEW.approval_type <> 'extra_charges'
    OR NEW.decision IS NULL
    OR OLD.decision IS NOT NULL
  THEN
    RETURN NEW;
  END IF;

  SELECT j.work_order_num, p.property_name, j.unit_number
    INTO v_work_order_num, v_property_name, v_unit_number
  FROM public.jobs j
  LEFT JOIN public.properties p ON p.id = j.property_id
  WHERE j.id = NEW.job_id;

  v_amount := CASE
    WHEN jsonb_typeof(NEW.extra_charges_data->'total') = 'number'
      THEN (NEW.extra_charges_data->>'total')::numeric
    ELSE NULL
  END;
  v_title := CASE WHEN NEW.decision = 'approved'
    THEN 'Extra charges approved'
    ELSE 'Extra charges declined — high priority'
  END;
  v_message := format(
    'WO-%s · %s · Unit %s%s',
    lpad(COALESCE(v_work_order_num, 0)::text, 6, '0'),
    COALESCE(v_property_name, 'Property'),
    COALESCE(v_unit_number, 'N/A'),
    CASE WHEN v_amount IS NOT NULL THEN format(' · $%s', to_char(v_amount, 'FM999999990.00')) ELSE '' END
  );

  FOR v_profile IN
    SELECT id
    FROM public.profiles
    WHERE role IN ('is_super_admin', 'admin', 'jg_management')
  LOOP
    INSERT INTO public.notifications (
      user_id, type, title, message, job_id, entity_id, is_read, metadata
    ) VALUES (
      v_profile.id,
      'other',
      v_title,
      v_message,
      NEW.job_id,
      NEW.job_id,
      false,
      jsonb_build_object(
        'event', 'extra_charge_approval_decision',
        'decision', NEW.decision,
        'priority', CASE WHEN NEW.decision = 'declined' THEN 'high' ELSE 'normal' END,
        'job_id', NEW.job_id,
        'approval_token_id', NEW.id,
        'route', format('/dashboard/jobs/%s', NEW.job_id)
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS approval_decision_admin_notifications ON public.approval_tokens;
CREATE TRIGGER approval_decision_admin_notifications
  AFTER UPDATE OF decision ON public.approval_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_internal_users_of_approval_decision();

-- Ensure approval-token changes can update the Pending Work Orders list live.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
    AND NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'approval_tokens'
    )
  THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.approval_tokens;
  END IF;
END
$$;
