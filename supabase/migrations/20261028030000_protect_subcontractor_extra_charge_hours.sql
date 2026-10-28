-- Work orders are insert-only for subcontractors. Internal users retain the
-- existing edit workflow, including Bill Hours and Sub Pay Hours in Job Details.
-- Subcontractor inserts are canonicalized so client-supplied billing controls,
-- rates, amounts, and display metadata cannot be trusted.

CREATE OR REPLACE FUNCTION public.protect_subcontractor_extra_charge_hours()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item jsonb;
  v_items jsonb := '[]'::jsonb;
  v_quantity numeric;
  v_property_id uuid;
  v_bill_rate numeric;
  v_sub_rate numeric;
  v_is_hourly boolean;
  v_category_id uuid;
  v_category_name text;
  v_detail_name text;
BEGIN
  -- Service/backend operations have no end-user identity and retain their
  -- explicitly privileged behavior. Known internal users also retain the
  -- administrative work-order workflow. Every other authenticated identity
  -- is treated as untrusted/fail-closed.
  IF auth.uid() IS NULL OR public.is_internal_admin_user() THEN
    RETURN NEW;
  END IF;

  IF NEW.extra_charges_line_items IS NULL THEN
    RETURN NEW;
  END IF;

  IF jsonb_typeof(NEW.extra_charges_line_items) <> 'array' THEN
    RAISE EXCEPTION 'Extra charge line items must be an array';
  END IF;

  SELECT j.property_id
    INTO v_property_id
  FROM public.jobs j
  WHERE j.id = NEW.job_id;

  IF v_property_id IS NULL THEN
    RAISE EXCEPTION 'Work order job must have a property';
  END IF;

  FOR v_item IN
    SELECT value FROM jsonb_array_elements(NEW.extra_charges_line_items)
  LOOP
    IF jsonb_typeof(v_item) <> 'object' THEN
      RAISE EXCEPTION 'Each extra charge line item must be an object';
    END IF;

    IF jsonb_typeof(v_item->'quantity') <> 'number' THEN
      RAISE EXCEPTION 'Extra charge quantity must be a number';
    END IF;

    v_quantity := (v_item->>'quantity')::numeric;
    IF v_quantity <= 0 OR v_quantity > 1000 THEN
      RAISE EXCEPTION 'Extra charge quantity must be greater than 0 and no more than 1000';
    END IF;

    IF v_item ? 'notes' AND jsonb_typeof(v_item->'notes') <> 'string' THEN
      RAISE EXCEPTION 'Extra charge notes must be text';
    END IF;

    IF length(COALESCE(v_item->>'notes', '')) > 500 THEN
      RAISE EXCEPTION 'Extra charge notes must be 500 characters or less';
    END IF;

    SELECT
      COALESCE(bd.bill_amount, 0),
      COALESCE(bd.sub_pay_amount, 0),
      COALESCE(bd.is_hourly, false),
      bc.id,
      bc.name,
      COALESCE(us.unit_size_label, 'Standard')
    INTO
      v_bill_rate,
      v_sub_rate,
      v_is_hourly,
      v_category_id,
      v_category_name,
      v_detail_name
    FROM public.billing_details bd
    JOIN public.billing_categories bc ON bc.id = bd.category_id
    LEFT JOIN public.unit_sizes us ON us.id = bd.unit_size_id
    WHERE bd.id::text = v_item->>'detailId'
      AND bd.property_id = v_property_id
      AND bc.property_id = v_property_id
      AND bc.is_extra_charge IS TRUE
      AND bc.archived_at IS NULL
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invalid extra charge billing detail for this property';
    END IF;

    v_item := (
      v_item
      - 'billHours'
      - 'subPayHours'
      - 'hoursEditedAt'
      - 'hoursEditedBy'
      - 'hoursEditedByName'
      - 'description'
    ) || jsonb_build_object(
      'categoryId', v_category_id::text,
      'categoryName', v_category_name,
      'detailName', v_detail_name,
      'isHourly', v_is_hourly,
      'customizeHours', false,
      'jobBillingCategory', 'owner',
      'notes', COALESCE(v_item->>'notes', ''),
      'billRate', v_bill_rate,
      'subRate', v_sub_rate,
      'calculatedBillAmount', round(v_quantity * v_bill_rate, 2),
      'calculatedSubAmount', round(v_quantity * v_sub_rate, 2)
    );

    v_items := v_items || jsonb_build_array(v_item);
  END LOOP;

  NEW.extra_charges_line_items := v_items;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_subcontractor_extra_charge_hours_trigger
  ON public.work_orders;

CREATE TRIGGER protect_subcontractor_extra_charge_hours_trigger
BEFORE INSERT ON public.work_orders
FOR EACH ROW
EXECUTE FUNCTION public.protect_subcontractor_extra_charge_hours();

-- Reflect the product rule in authorization: subcontractors submit once and
-- contact management for later changes. This also prevents direct API edits.
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.work_orders;
DROP POLICY IF EXISTS "Internal users can update work orders" ON public.work_orders;

CREATE POLICY "Internal users can update work orders"
ON public.work_orders
FOR UPDATE
TO authenticated
USING (public.is_internal_admin_user())
WITH CHECK (public.is_internal_admin_user());

REVOKE ALL ON FUNCTION public.protect_subcontractor_extra_charge_hours() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.protect_subcontractor_extra_charge_hours() FROM authenticated;
REVOKE ALL ON FUNCTION public.protect_subcontractor_extra_charge_hours() FROM service_role;

COMMENT ON FUNCTION public.protect_subcontractor_extra_charge_hours() IS
  'Canonicalizes extra-charge billing fields on untrusted work-order inserts; invoked only by its trigger.';
