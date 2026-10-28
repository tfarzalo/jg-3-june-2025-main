-- Keep subcontractor work-order saves independent from job billing workflows.
-- This is a forward-only behavior change: it does not backfill or rewrite data.

CREATE OR REPLACE FUNCTION public.sync_job_misc_costs_from_work_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_bill numeric := 0;
  v_description text := '';
  v_price_text text;
BEGIN
  IF jsonb_typeof(NEW.misc_additional_cost_items) <> 'array' THEN
    RAISE EXCEPTION 'Miscellaneous additional cost items must be a JSON array';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(NEW.misc_additional_cost_items)
  LOOP
    IF jsonb_typeof(v_item) <> 'object' THEN
      RAISE EXCEPTION 'Each miscellaneous additional cost item must be an object';
    END IF;

    v_price_text := COALESCE(v_item->>'price', v_item->>'billAmount', '0');
    IF v_price_text !~ '^[0-9]+([.][0-9]+)?$' THEN
      RAISE EXCEPTION 'Miscellaneous additional cost bill amounts must be non-negative numbers';
    END IF;

    v_bill := v_bill + v_price_text::numeric;
    IF btrim(COALESCE(v_item->>'description', '')) <> '' THEN
      v_description := concat_ws('; ', NULLIF(v_description, ''), btrim(v_item->>'description'));
    END IF;
  END LOOP;

  NEW.repair_cost := round(v_bill, 2);
  NEW.repair_description := NULLIF(v_description, '');

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_job_misc_costs_from_work_order() FROM PUBLIC;

COMMENT ON FUNCTION public.sync_job_misc_costs_from_work_order() IS
  'Normalizes structured miscellaneous costs into legacy work-order fields without mutating job billing.';

CREATE OR REPLACE FUNCTION public.save_misc_additional_costs(
  p_job_id uuid,
  p_work_order_id uuid,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_bill numeric := 0;
  v_sub_pay numeric := 0;
  v_work_order_id uuid;
BEGIN
  IF jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'Miscellaneous additional cost items must be a JSON array';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    IF jsonb_typeof(v_item) <> 'object' THEN
      RAISE EXCEPTION 'Each miscellaneous additional cost item must be an object';
    END IF;
    IF COALESCE(v_item->>'price', '') !~ '^[0-9]+([.][0-9]+)?$'
       OR (v_item->>'subPay' IS NOT NULL AND v_item->>'subPay' !~ '^[0-9]+([.][0-9]+)?$') THEN
      RAISE EXCEPTION 'Miscellaneous additional cost amounts must be non-negative numbers';
    END IF;

    v_bill := v_bill + (v_item->>'price')::numeric;
    v_sub_pay := v_sub_pay + COALESCE((v_item->>'subPay')::numeric, 0);
  END LOOP;

  UPDATE public.work_orders
  SET misc_additional_cost_items = p_items
  WHERE id = p_work_order_id
    AND job_id = p_job_id
  RETURNING id INTO v_work_order_id;

  IF v_work_order_id IS NULL THEN
    RAISE EXCEPTION 'Matching work order was not found or is not editable';
  END IF;

  -- This remains atomic with the work-order update, but avoids firing job
  -- update workflows when the calculated billing values have not changed.
  UPDATE public.jobs
  SET repair_amount = round(v_bill, 2),
      repair_sub_pay = round(v_sub_pay, 2)
  WHERE id = p_job_id
    AND (
      repair_amount IS DISTINCT FROM round(v_bill, 2)
      OR repair_sub_pay IS DISTINCT FROM round(v_sub_pay, 2)
    );

  RETURN jsonb_build_object(
    'job_id', p_job_id,
    'work_order_id', p_work_order_id,
    'item_count', jsonb_array_length(p_items),
    'bill_total', round(v_bill, 2),
    'sub_pay_total', round(v_sub_pay, 2)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_misc_additional_costs(uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_misc_additional_costs(uuid, uuid, jsonb) TO authenticated;

COMMENT ON FUNCTION public.save_misc_additional_costs(uuid, uuid, jsonb) IS
  'Atomically saves admin-reviewed miscellaneous costs and updates job billing only when totals change. An empty array explicitly clears related amounts.';
