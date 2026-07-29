ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS repair_description text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.work_orders.repair_description IS
  'Subcontractor-entered description of repair work when a repair cost is reported on the work order.';
