ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS misc_additional_cost_items jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.work_orders.misc_additional_cost_items IS
  'Line items for miscellaneous additional costs reported or edited on the work order. Each item includes id, description, and price.';

UPDATE public.work_orders
SET misc_additional_cost_items = jsonb_build_array(
  jsonb_build_object(
    'id', 'legacy-misc-additional-cost',
    'description', COALESCE(NULLIF(repair_description, ''), 'Miscellaneous additional cost'),
    'price', repair_cost
  )
)
WHERE repair_cost > 0
  AND (
    misc_additional_cost_items IS NULL
    OR jsonb_typeof(misc_additional_cost_items) <> 'array'
    OR jsonb_array_length(misc_additional_cost_items) = 0
  );
