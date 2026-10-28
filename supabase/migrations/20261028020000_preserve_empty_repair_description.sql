-- Keep empty miscellaneous-cost descriptions compatible with the existing
-- NOT NULL work_orders.repair_description contract.

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
  NEW.repair_description := COALESCE(NULLIF(v_description, ''), '');

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_job_misc_costs_from_work_order() FROM PUBLIC;

COMMENT ON FUNCTION public.sync_job_misc_costs_from_work_order() IS
  'Normalizes structured miscellaneous costs into non-null legacy work-order fields without mutating job billing.';
