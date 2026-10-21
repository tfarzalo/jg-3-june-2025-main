-- Future-only, additive save path for miscellaneous additional costs.
-- This migration does not update, migrate, or delete any existing job/work-order rows.

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
  v_description text := '';
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
    IF btrim(COALESCE(v_item->>'description', '')) <> '' THEN
      v_description := concat_ws('; ', NULLIF(v_description, ''), btrim(v_item->>'description'));
    END IF;
  END LOOP;

  UPDATE public.work_orders
  SET misc_additional_cost_items = p_items,
      repair_cost = round(v_bill, 2),
      repair_description = NULLIF(v_description, '')
  WHERE id = p_work_order_id
    AND job_id = p_job_id
  RETURNING id INTO v_work_order_id;

  IF v_work_order_id IS NULL THEN
    RAISE EXCEPTION 'Matching work order was not found or is not editable';
  END IF;

  UPDATE public.jobs
  SET repair_amount = round(v_bill, 2),
      repair_sub_pay = round(v_sub_pay, 2)
  WHERE id = p_job_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Matching job was not found or is not editable';
  END IF;

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
  'Atomically saves future misc-cost edits across jobs and work_orders. An empty JSON array explicitly clears the related amounts. Does not alter historical rows unless invoked for a deliberate user save.';
