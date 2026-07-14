-- Add a separate post-work-order phase before Quality Control.
-- Existing "Completed" remains the final Completed Jobs phase after QC.

INSERT INTO public.job_phases (
  job_phase_label,
  color_light_mode,
  color_dark_mode,
  sort_order,
  order_index
)
SELECT
  'Completed Work Orders',
  '#E0F2FE',
  '#0369A1',
  104,
  104
WHERE NOT EXISTS (
  SELECT 1
  FROM public.job_phases
  WHERE job_phase_label = 'Completed Work Orders'
);

-- Keep workflow display order explicit and non-destructive.
-- Job Request -> Work Order -> Pending Work Order -> Completed Work Orders
-- -> Quality Control -> Completed -> Invoicing -> Cancelled -> Archived.
UPDATE public.job_phases
SET
  sort_order = COALESCE(sort_order, 0) + 1000,
  order_index = COALESCE(order_index, 0) + 1000
WHERE job_phase_label IN (
  'Job Request',
  'Work Order',
  'Pending Work Order',
  'Completed Work Orders',
  'Quality Control',
  'Completed',
  'Invoicing',
  'Cancelled',
  'Archived'
);

UPDATE public.job_phases
SET
  sort_order = CASE job_phase_label
    WHEN 'Job Request' THEN 1
    WHEN 'Work Order' THEN 2
    WHEN 'Pending Work Order' THEN 3
    WHEN 'Completed Work Orders' THEN 4
    WHEN 'Quality Control' THEN 5
    WHEN 'Completed' THEN 6
    WHEN 'Invoicing' THEN 7
    WHEN 'Cancelled' THEN 8
    WHEN 'Archived' THEN 9
    ELSE sort_order
  END,
  order_index = CASE job_phase_label
    WHEN 'Job Request' THEN 1
    WHEN 'Work Order' THEN 2
    WHEN 'Pending Work Order' THEN 3
    WHEN 'Completed Work Orders' THEN 4
    WHEN 'Quality Control' THEN 5
    WHEN 'Completed' THEN 6
    WHEN 'Invoicing' THEN 7
    WHEN 'Cancelled' THEN 8
    WHEN 'Archived' THEN 9
    ELSE order_index
  END
WHERE job_phase_label IN (
  'Job Request',
  'Work Order',
  'Pending Work Order',
  'Completed Work Orders',
  'Quality Control',
  'Completed',
  'Invoicing',
  'Cancelled',
  'Archived'
);

CREATE OR REPLACE FUNCTION public.is_terminal_job_phase(p_phase_label text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(trim(p_phase_label), '') IN (
    'Completed Work Orders',
    'Quality Control',
    'Completed',
    'Invoicing',
    'Cancelled',
    'Archived'
  );
$$;
