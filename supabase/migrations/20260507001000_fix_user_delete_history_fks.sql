-- Make user deletion preserve historical subcontractor labels before profile rows disappear.

ALTER TABLE public.jobs
  DROP CONSTRAINT IF EXISTS jobs_assigned_to_fkey;

ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_assigned_to_fkey
  FOREIGN KEY (assigned_to)
  REFERENCES public.profiles(id)
  ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.preserve_profile_delete_history()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_deleted_at timestamptz := now();
  v_name text := COALESCE(OLD.full_name, OLD.email, 'Deleted user');
BEGIN
  UPDATE public.jobs
  SET assigned_to_name_snapshot = COALESCE(assigned_to_name_snapshot, v_name),
      assigned_to_email_snapshot = COALESCE(assigned_to_email_snapshot, OLD.email),
      assigned_to_deleted_at = COALESCE(assigned_to_deleted_at, v_deleted_at),
      assigned_to = NULL
  WHERE assigned_to = OLD.id;

  UPDATE public.properties
  SET preferred_subcontractor_a_name_snapshot = COALESCE(preferred_subcontractor_a_name_snapshot, v_name),
      preferred_subcontractor_a_email_snapshot = COALESCE(preferred_subcontractor_a_email_snapshot, OLD.email),
      preferred_subcontractor_a_deleted_at = COALESCE(preferred_subcontractor_a_deleted_at, v_deleted_at),
      preferred_subcontractor_a_id = NULL
  WHERE preferred_subcontractor_a_id = OLD.id;

  UPDATE public.properties
  SET preferred_subcontractor_b_name_snapshot = COALESCE(preferred_subcontractor_b_name_snapshot, v_name),
      preferred_subcontractor_b_email_snapshot = COALESCE(preferred_subcontractor_b_email_snapshot, OLD.email),
      preferred_subcontractor_b_deleted_at = COALESCE(preferred_subcontractor_b_deleted_at, v_deleted_at),
      preferred_subcontractor_b_id = NULL
  WHERE preferred_subcontractor_b_id = OLD.id;

  UPDATE public.properties
  SET preferred_subcontractor_c_name_snapshot = COALESCE(preferred_subcontractor_c_name_snapshot, v_name),
      preferred_subcontractor_c_email_snapshot = COALESCE(preferred_subcontractor_c_email_snapshot, OLD.email),
      preferred_subcontractor_c_deleted_at = COALESCE(preferred_subcontractor_c_deleted_at, v_deleted_at),
      preferred_subcontractor_c_id = NULL
  WHERE preferred_subcontractor_c_id = OLD.id;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trigger_preserve_profile_delete_history ON public.profiles;

CREATE TRIGGER trigger_preserve_profile_delete_history
BEFORE DELETE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.preserve_profile_delete_history();
