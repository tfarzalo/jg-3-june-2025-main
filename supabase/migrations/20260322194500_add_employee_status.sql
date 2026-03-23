ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS employee_status text NOT NULL DEFAULT 'not_hired';

ALTER TABLE public.employees
  DROP CONSTRAINT IF EXISTS employees_employee_status_check;

ALTER TABLE public.employees
  ADD CONSTRAINT employees_employee_status_check
  CHECK (employee_status IN ('hired', 'not_hired', 'terminated', 'on_leave'));
