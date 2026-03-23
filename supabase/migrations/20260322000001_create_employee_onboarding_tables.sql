CREATE OR REPLACE FUNCTION public.is_internal_employee_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'is_super_admin')
  );
$$;

CREATE TABLE IF NOT EXISTS public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  position_title text NOT NULL,
  start_date date NOT NULL,
  onboarding_packet_sent_at timestamptz,
  onboarding_packet_sent_by uuid REFERENCES auth.users(id),
  created_by uuid REFERENCES auth.users(id) NOT NULL DEFAULT auth.uid(),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employees_email ON public.employees (lower(email));
CREATE INDEX IF NOT EXISTS idx_employees_start_date ON public.employees (start_date DESC);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees admin select"
  ON public.employees
  FOR SELECT
  TO authenticated
  USING (public.is_internal_employee_admin());

CREATE POLICY "Employees admin insert"
  ON public.employees
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_internal_employee_admin());

CREATE POLICY "Employees admin update"
  ON public.employees
  FOR UPDATE
  TO authenticated
  USING (public.is_internal_employee_admin())
  WITH CHECK (public.is_internal_employee_admin());

CREATE POLICY "Employees admin delete"
  ON public.employees
  FOR DELETE
  TO authenticated
  USING (public.is_internal_employee_admin());

DROP TRIGGER IF EXISTS set_employees_updated_at ON public.employees;
CREATE TRIGGER set_employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.employee_form_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  form_key text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  token_preview text NOT NULL,
  expires_at timestamptz NOT NULL,
  sent_at timestamptz,
  last_opened_at timestamptz,
  invalidated_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT employee_form_tokens_form_key_check CHECK (
    form_key IN (
      'new-hire-paperwork',
      'new-hire-paperwork-1',
      'new-hire-paperwork-2',
      'new-hire-paperwork-3',
      'new-hire-paperwork-4',
      'new-hire-paperwork-5',
      'new-hire-paperwork-6',
      'new-hire-paperwork-7'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_employee_form_tokens_employee_form
  ON public.employee_form_tokens (employee_id, form_key, expires_at DESC);

ALTER TABLE public.employee_form_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employee form tokens admin select"
  ON public.employee_form_tokens
  FOR SELECT
  TO authenticated
  USING (public.is_internal_employee_admin());

CREATE POLICY "Employee form tokens admin insert"
  ON public.employee_form_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_internal_employee_admin());

CREATE POLICY "Employee form tokens admin update"
  ON public.employee_form_tokens
  FOR UPDATE
  TO authenticated
  USING (public.is_internal_employee_admin())
  WITH CHECK (public.is_internal_employee_admin());

CREATE POLICY "Employee form tokens admin delete"
  ON public.employee_form_tokens
  FOR DELETE
  TO authenticated
  USING (public.is_internal_employee_admin());

CREATE TABLE IF NOT EXISTS public.employee_form_pdf_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  form_key text NOT NULL,
  revision integer NOT NULL DEFAULT 1,
  storage_bucket text NOT NULL DEFAULT 'files',
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL DEFAULT 'application/pdf',
  byte_size bigint,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT employee_form_pdf_files_form_key_check CHECK (
    form_key IN (
      'new-hire-paperwork',
      'new-hire-paperwork-1',
      'new-hire-paperwork-2',
      'new-hire-paperwork-3',
      'new-hire-paperwork-4',
      'new-hire-paperwork-5',
      'new-hire-paperwork-6',
      'new-hire-paperwork-7'
    )
  ),
  CONSTRAINT employee_form_pdf_files_revision_positive CHECK (revision > 0)
);

CREATE INDEX IF NOT EXISTS idx_employee_form_pdf_files_employee_form
  ON public.employee_form_pdf_files (employee_id, form_key, created_at DESC);

ALTER TABLE public.employee_form_pdf_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employee PDF files admin select"
  ON public.employee_form_pdf_files
  FOR SELECT
  TO authenticated
  USING (public.is_internal_employee_admin());

CREATE POLICY "Employee PDF files admin insert"
  ON public.employee_form_pdf_files
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_internal_employee_admin());

CREATE POLICY "Employee PDF files admin update"
  ON public.employee_form_pdf_files
  FOR UPDATE
  TO authenticated
  USING (public.is_internal_employee_admin())
  WITH CHECK (public.is_internal_employee_admin());

CREATE POLICY "Employee PDF files admin delete"
  ON public.employee_form_pdf_files
  FOR DELETE
  TO authenticated
  USING (public.is_internal_employee_admin());

CREATE TABLE IF NOT EXISTS public.employee_form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  form_key text NOT NULL,
  form_title text NOT NULL,
  status text NOT NULL DEFAULT 'not_sent',
  sent_at timestamptz,
  submitted_at timestamptz,
  completed_at timestamptz,
  form_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  form_structure_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_token_id uuid REFERENCES public.employee_form_tokens(id) ON DELETE SET NULL,
  latest_pdf_file_id uuid REFERENCES public.employee_form_pdf_files(id) ON DELETE SET NULL,
  pdf_revision integer NOT NULL DEFAULT 0,
  last_saved_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT employee_form_submissions_employee_form_unique UNIQUE (employee_id, form_key),
  CONSTRAINT employee_form_submissions_status_check CHECK (
    status IN ('not_sent', 'sent', 'submitted', 'complete')
  ),
  CONSTRAINT employee_form_submissions_form_key_check CHECK (
    form_key IN (
      'new-hire-paperwork',
      'new-hire-paperwork-1',
      'new-hire-paperwork-2',
      'new-hire-paperwork-3',
      'new-hire-paperwork-4',
      'new-hire-paperwork-5',
      'new-hire-paperwork-6',
      'new-hire-paperwork-7'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_employee_form_submissions_employee
  ON public.employee_form_submissions (employee_id, status);

ALTER TABLE public.employee_form_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employee form submissions admin select"
  ON public.employee_form_submissions
  FOR SELECT
  TO authenticated
  USING (public.is_internal_employee_admin());

CREATE POLICY "Employee form submissions admin insert"
  ON public.employee_form_submissions
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_internal_employee_admin());

CREATE POLICY "Employee form submissions admin update"
  ON public.employee_form_submissions
  FOR UPDATE
  TO authenticated
  USING (public.is_internal_employee_admin())
  WITH CHECK (public.is_internal_employee_admin());

CREATE POLICY "Employee form submissions admin delete"
  ON public.employee_form_submissions
  FOR DELETE
  TO authenticated
  USING (public.is_internal_employee_admin());

DROP TRIGGER IF EXISTS set_employee_form_submissions_updated_at ON public.employee_form_submissions;
CREATE TRIGGER set_employee_form_submissions_updated_at
  BEFORE UPDATE ON public.employee_form_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.seed_employee_form_submissions()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.employee_form_submissions (
    employee_id,
    form_key,
    form_title,
    status
  )
  VALUES
    (NEW.id, 'new-hire-paperwork', 'New Hire Paperwork', 'not_sent'),
    (NEW.id, 'new-hire-paperwork-1', 'New Hire Paperwork 1', 'not_sent'),
    (NEW.id, 'new-hire-paperwork-2', 'New Hire Paperwork 2', 'not_sent'),
    (NEW.id, 'new-hire-paperwork-3', 'New Hire Paperwork 3', 'not_sent'),
    (NEW.id, 'new-hire-paperwork-4', 'New Hire Paperwork 4', 'not_sent'),
    (NEW.id, 'new-hire-paperwork-5', 'New Hire Paperwork 5', 'not_sent'),
    (NEW.id, 'new-hire-paperwork-6', 'New Hire Paperwork 6', 'not_sent'),
    (NEW.id, 'new-hire-paperwork-7', 'New Hire Paperwork 7', 'not_sent');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS seed_employee_forms_after_insert ON public.employees;
CREATE TRIGGER seed_employee_forms_after_insert
  AFTER INSERT ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_employee_form_submissions();
