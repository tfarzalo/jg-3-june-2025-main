-- Extend terminal job phases to include Invoicing.
-- Invoicing now triggers snapshot creation and serves frozen data,
-- matching the same behaviour as Completed and Archived.
-- This allows Completed → Invoicing transitions to carry frozen snapshot state
-- while still showing the Reopen Job button on Invoicing and Archived phases.

CREATE OR REPLACE FUNCTION public.is_terminal_job_phase(p_phase_label text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(trim(p_phase_label), '') IN ('Completed', 'Invoicing', 'Archived');
$$;
