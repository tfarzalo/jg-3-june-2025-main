-- Keep customer and internal extra-charge decisions atomic while avoiding the
-- repeated notification-table scans that can exceed the public RPC timeout.
-- This migration only adds an index and replaces function definitions; it
-- does not update or delete any existing business or notification records.

BEGIN;

CREATE INDEX IF NOT EXISTS idx_notifications_extra_charge_decision_token_user
  ON public.notifications (user_id, ((metadata ->> 'approval_token_id')))
  WHERE metadata ->> 'event' = 'extra_charge_approval_decision'
    AND metadata ? 'approval_token_id';

CREATE OR REPLACE FUNCTION public.notify_internal_users_of_approval_decision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_work_order_num integer;
  v_property_name text;
  v_unit_number text;
  v_amount numeric;
  v_title text;
  v_message text;
BEGIN
  IF NEW.approval_type <> 'extra_charges'
    OR NEW.decision IS NULL
    OR (TG_OP = 'UPDATE' AND OLD.decision IS NOT NULL)
  THEN
    RETURN NEW;
  END IF;

  SELECT j.work_order_num, p.property_name, j.unit_number
  INTO v_work_order_num, v_property_name, v_unit_number
  FROM public.jobs j
  LEFT JOIN public.properties p ON p.id = j.property_id
  WHERE j.id = NEW.job_id;

  v_amount := CASE
    WHEN jsonb_typeof(NEW.extra_charges_data -> 'total') = 'number'
      THEN (NEW.extra_charges_data ->> 'total')::numeric
    ELSE NULL
  END;

  v_title := CASE
    WHEN NEW.decision = 'approved' THEN 'Extra charges approved'
    ELSE 'Extra charges declined — high priority'
  END;

  v_message := format(
    'WO-%s · %s · Unit %s%s',
    lpad(COALESCE(v_work_order_num, 0)::text, 6, '0'),
    COALESCE(v_property_name, 'Property'),
    COALESCE(v_unit_number, 'N/A'),
    CASE
      WHEN v_amount IS NOT NULL
        THEN format(' · $%s', to_char(v_amount, 'FM999999990.00'))
      ELSE ''
    END
  );

  -- Insert every applicable admin notification in one operation. The partial
  -- index above makes the idempotency check independent of table growth.
  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    message,
    job_id,
    entity_id,
    is_read,
    metadata
  )
  SELECT
    profile.id,
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
  FROM public.profiles profile
  WHERE profile.role IN ('is_super_admin', 'admin', 'jg_management')
    AND NOT EXISTS (
      SELECT 1
      FROM public.notifications existing
      WHERE existing.user_id = profile.id
        AND existing.metadata ->> 'event' = 'extra_charge_approval_decision'
        AND existing.metadata ->> 'approval_token_id' = NEW.id::text
    );

  RETURN NEW;
END;
$function$;

-- Grant additional headroom only to these decision functions. Unrelated
-- anonymous and authenticated database operations retain their current limits.
ALTER FUNCTION public.process_approval_token(character varying, text, text)
  SET statement_timeout = '15s';

ALTER FUNCTION public.process_decline_token(character varying, text, text, text)
  SET statement_timeout = '15s';

ALTER FUNCTION public.approve_extra_charges_manually(uuid)
  SET statement_timeout = '15s';

COMMIT;

