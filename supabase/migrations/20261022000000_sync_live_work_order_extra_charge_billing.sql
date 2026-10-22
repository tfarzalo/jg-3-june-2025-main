-- Keep mutable work orders aligned with their property's current extra-charge
-- billing configuration. Snapshot-backed jobs are intentionally excluded so
-- historical financial records remain immutable.

CREATE OR REPLACE FUNCTION public.sync_live_work_orders_for_billing_detail(
  p_billing_detail_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  live_work_order record;
  caller_id uuid := auth.uid();
  original_claim_sub text := current_setting('request.jwt.claim.sub', true);
BEGIN
  FOR live_work_order IN
    SELECT wo.id, wo.extra_charges_line_items, j.created_by
    FROM public.work_orders AS wo
    JOIN public.jobs AS j ON j.id = wo.job_id
    WHERE COALESCE(j.historical_data_mode, 'live') = 'live'
      AND jsonb_typeof(wo.extra_charges_line_items) = 'array'
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements(wo.extra_charges_line_items) AS existing_item(value)
        WHERE existing_item.value->>'detailId' = p_billing_detail_id::text
      )
  LOOP
    -- Database-driven reconciliation has no authenticated request. Supplying
    -- the job creator lets existing phase/approval triggers retain a valid,
    -- attributable audit trail. Interactive edits keep the real caller.
    IF caller_id IS NULL AND live_work_order.created_by IS NOT NULL THEN
      PERFORM set_config('request.jwt.claim.sub', live_work_order.created_by::text, true);
    END IF;

    UPDATE public.work_orders AS wo
    SET extra_charges_line_items = (
      SELECT jsonb_agg(
        CASE
          WHEN item.value->>'detailId' = bd.id::text THEN
            CASE
              WHEN bd.is_hourly THEN item.value
              ELSE item.value - 'billHours' - 'subPayHours'
            END
            || jsonb_build_object(
              'billRate', bd.bill_amount,
              'subRate', bd.sub_pay_amount,
              'isHourly', bd.is_hourly,
              'customizeHours',
                bd.is_hourly
                AND lower(COALESCE(item.value->>'customizeHours', 'false')) IN ('true', 't', '1', 'yes'),
              'calculatedBillAmount',
                bd.bill_amount * CASE
                  WHEN bd.is_hourly
                    AND lower(COALESCE(item.value->>'customizeHours', 'false')) IN ('true', 't', '1', 'yes')
                    AND NULLIF(item.value->>'billHours', '') IS NOT NULL
                  THEN (item.value->>'billHours')::numeric
                  ELSE COALESCE(NULLIF(item.value->>'quantity', '')::numeric, 0)
                END,
              'calculatedSubAmount',
                bd.sub_pay_amount * CASE
                  WHEN bd.is_hourly
                    AND lower(COALESCE(item.value->>'customizeHours', 'false')) IN ('true', 't', '1', 'yes')
                    AND NULLIF(item.value->>'subPayHours', '') IS NOT NULL
                  THEN (item.value->>'subPayHours')::numeric
                  ELSE COALESCE(NULLIF(item.value->>'quantity', '')::numeric, 0)
                END
            )
          ELSE item.value
        END
        ORDER BY item.ordinality
      )
      FROM jsonb_array_elements(live_work_order.extra_charges_line_items)
        WITH ORDINALITY AS item(value, ordinality)
      CROSS JOIN public.billing_details AS bd
      WHERE bd.id = p_billing_detail_id
    )
    WHERE wo.id = live_work_order.id;
  END LOOP;

  IF caller_id IS NULL THEN
    PERFORM set_config('request.jwt.claim.sub', COALESCE(original_claim_sub, ''), true);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_live_work_orders_for_billing_detail(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.sync_live_work_orders_after_billing_detail_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.sync_live_work_orders_for_billing_detail(NEW.id);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_live_work_orders_after_billing_detail_change() FROM PUBLIC;

DROP TRIGGER IF EXISTS trigger_sync_live_work_orders_after_billing_detail_change
  ON public.billing_details;

CREATE TRIGGER trigger_sync_live_work_orders_after_billing_detail_change
AFTER UPDATE OF bill_amount, sub_pay_amount, is_hourly
ON public.billing_details
FOR EACH ROW
WHEN (
  OLD.bill_amount IS DISTINCT FROM NEW.bill_amount
  OR OLD.sub_pay_amount IS DISTINCT FROM NEW.sub_pay_amount
  OR OLD.is_hourly IS DISTINCT FROM NEW.is_hourly
)
EXECUTE FUNCTION public.sync_live_work_orders_after_billing_detail_change();

-- Reconcile existing live work orders once at deployment time. This repairs
-- records such as WO-010916 whose catalog entry changed before this trigger
-- existed, without touching any static/snapshot-backed job.
DO $$
DECLARE
  detail_id uuid;
BEGIN
  FOR detail_id IN
    SELECT DISTINCT bd.id
    FROM public.billing_details AS bd
    JOIN public.work_orders AS wo
      ON jsonb_typeof(wo.extra_charges_line_items) = 'array'
    JOIN public.jobs AS j
      ON j.id = wo.job_id
     AND COALESCE(j.historical_data_mode, 'live') = 'live'
    WHERE EXISTS (
      SELECT 1
      FROM jsonb_array_elements(wo.extra_charges_line_items) AS existing_item(value)
      WHERE existing_item.value->>'detailId' = bd.id::text
    )
  LOOP
    PERFORM public.sync_live_work_orders_for_billing_detail(detail_id);
  END LOOP;
END;
$$;
