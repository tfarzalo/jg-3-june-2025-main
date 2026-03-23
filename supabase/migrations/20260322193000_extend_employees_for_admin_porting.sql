ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS interview_date date,
  ADD COLUMN IF NOT EXISTS hire_date date,
  ADD COLUMN IF NOT EXISTS internal_office_notes text,
  ADD COLUMN IF NOT EXISTS linked_subcontractor_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_linked_subcontractor_profile_id
  ON public.employees (linked_subcontractor_profile_id)
  WHERE linked_subcontractor_profile_id IS NOT NULL;
