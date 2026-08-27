-- Allow every authenticated non-subcontractor role to manage operational
-- Admin Settings for Job Categories, Unit Sizes, and related billing setup.
-- Maintenance Mode and What's New remain SuperAdmin-only through their
-- separate app_config / whats_new policies and UI guards.

CREATE OR REPLACE FUNCTION public.is_internal_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role IS NOT NULL
      AND role <> 'subcontractor'
  );
$$;

COMMENT ON FUNCTION public.is_internal_admin_user() IS
'Returns true for authenticated non-subcontractor users.';

CREATE OR REPLACE FUNCTION public.can_manage_admin_settings()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_internal_admin_user();
$$;

GRANT EXECUTE ON FUNCTION public.is_internal_admin_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_admin_settings() TO authenticated;

-- Unit Sizes
DROP POLICY IF EXISTS "Unit sizes full access for admin/management" ON public.unit_sizes;
DROP POLICY IF EXISTS "Unit sizes read for subcontractors" ON public.unit_sizes;
DROP POLICY IF EXISTS "unit_sizes_select_authenticated" ON public.unit_sizes;
DROP POLICY IF EXISTS "unit_sizes_modify_admin_only" ON public.unit_sizes;
DROP POLICY IF EXISTS "unit_sizes_modify_admin_settings_roles" ON public.unit_sizes;
DROP POLICY IF EXISTS "unit_sizes_internal_users_manage" ON public.unit_sizes;

ALTER TABLE public.unit_sizes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "unit_sizes_select_authenticated"
ON public.unit_sizes
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "unit_sizes_internal_users_manage"
ON public.unit_sizes
FOR ALL
TO authenticated
USING (public.is_internal_admin_user())
WITH CHECK (public.is_internal_admin_user());

-- Job Categories
DROP POLICY IF EXISTS "Allow authenticated users to create job categories" ON public.job_categories;
DROP POLICY IF EXISTS "Allow authenticated users to view all job categories" ON public.job_categories;
DROP POLICY IF EXISTS "Allow authenticated users to update job categories" ON public.job_categories;
DROP POLICY IF EXISTS "Allow authenticated users to delete job categories" ON public.job_categories;
DROP POLICY IF EXISTS "Authenticated users can view job_categories" ON public.job_categories;
DROP POLICY IF EXISTS "Authenticated users can insert job_categories" ON public.job_categories;
DROP POLICY IF EXISTS "Authenticated users can update job_categories" ON public.job_categories;
DROP POLICY IF EXISTS "Authenticated users can delete job_categories" ON public.job_categories;
DROP POLICY IF EXISTS "job_categories_select_authenticated" ON public.job_categories;
DROP POLICY IF EXISTS "job_categories_modify_admin_only" ON public.job_categories;
DROP POLICY IF EXISTS "job_categories_modify_admin_settings_roles" ON public.job_categories;
DROP POLICY IF EXISTS "job_categories_internal_users_manage" ON public.job_categories;

ALTER TABLE public.job_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "job_categories_select_authenticated"
ON public.job_categories
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "job_categories_internal_users_manage"
ON public.job_categories
FOR ALL
TO authenticated
USING (public.is_internal_admin_user())
WITH CHECK (public.is_internal_admin_user());

-- Related billing setup tables touched when categories are renamed, created,
-- hidden, or connected to property/unit-size pricing.
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.billing_categories;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.billing_categories;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.billing_categories;
DROP POLICY IF EXISTS "Users can create billing categories" ON public.billing_categories;
DROP POLICY IF EXISTS "Users can update billing categories" ON public.billing_categories;
DROP POLICY IF EXISTS "Users can delete billing categories" ON public.billing_categories;
DROP POLICY IF EXISTS "Billing categories insert access" ON public.billing_categories;
DROP POLICY IF EXISTS "Billing categories update access" ON public.billing_categories;
DROP POLICY IF EXISTS "Billing categories delete access" ON public.billing_categories;
DROP POLICY IF EXISTS "billing_categories_read_all" ON public.billing_categories;
DROP POLICY IF EXISTS "billing_categories_select_authenticated" ON public.billing_categories;
DROP POLICY IF EXISTS "billing_categories_modify_admin_settings_roles" ON public.billing_categories;
DROP POLICY IF EXISTS "billing_categories_internal_users_manage" ON public.billing_categories;

ALTER TABLE public.billing_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "billing_categories_select_authenticated"
ON public.billing_categories
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "billing_categories_internal_users_manage"
ON public.billing_categories
FOR ALL
TO authenticated
USING (public.is_internal_admin_user())
WITH CHECK (public.is_internal_admin_user());

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.billing_details;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.billing_details;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.billing_details;
DROP POLICY IF EXISTS "Users can create billing details" ON public.billing_details;
DROP POLICY IF EXISTS "Users can update billing details" ON public.billing_details;
DROP POLICY IF EXISTS "Users can delete billing details" ON public.billing_details;
DROP POLICY IF EXISTS "Billing details insert access" ON public.billing_details;
DROP POLICY IF EXISTS "Billing details update access" ON public.billing_details;
DROP POLICY IF EXISTS "Billing details delete access" ON public.billing_details;
DROP POLICY IF EXISTS "billing_details_read_all" ON public.billing_details;
DROP POLICY IF EXISTS "billing_details_select_authenticated" ON public.billing_details;
DROP POLICY IF EXISTS "billing_details_modify_admin_settings_roles" ON public.billing_details;
DROP POLICY IF EXISTS "billing_details_internal_users_manage" ON public.billing_details;

ALTER TABLE public.billing_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "billing_details_select_authenticated"
ON public.billing_details
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "billing_details_internal_users_manage"
ON public.billing_details
FOR ALL
TO authenticated
USING (public.is_internal_admin_user())
WITH CHECK (public.is_internal_admin_user());

DROP FUNCTION IF EXISTS public.rename_job_category(uuid, text);

CREATE OR REPLACE FUNCTION public.rename_job_category(
  p_category_id uuid,
  p_new_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_name text;
  v_trimmed_name text := btrim(p_new_name);
  v_is_system boolean;
BEGIN
  IF NOT public.is_internal_admin_user() THEN
    RAISE EXCEPTION 'You do not have permission to rename categories'
      USING ERRCODE = '42501';
  END IF;

  IF v_trimmed_name = '' THEN
    RAISE EXCEPTION 'Category name cannot be empty'
      USING ERRCODE = '22023';
  END IF;

  SELECT name, COALESCE(is_system, false)
  INTO v_old_name, v_is_system
  FROM public.job_categories
  WHERE id = p_category_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Category not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_is_system THEN
    RAISE EXCEPTION 'System categories cannot be renamed'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.job_categories
    WHERE id <> p_category_id
      AND lower(name) = lower(v_trimmed_name)
      AND COALESCE(is_hidden, false) = false
  ) THEN
    RAISE EXCEPTION 'A category with that name already exists'
      USING ERRCODE = '23505';
  END IF;

  UPDATE public.job_categories
  SET name = v_trimmed_name
  WHERE id = p_category_id;

  UPDATE public.billing_categories
  SET name = v_trimmed_name
  WHERE name = v_old_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rename_job_category(uuid, text) TO authenticated;

DROP FUNCTION IF EXISTS public.rename_unit_size(uuid, text);

CREATE OR REPLACE FUNCTION public.rename_unit_size(
  p_unit_size_id uuid,
  p_new_label text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trimmed_label text := btrim(p_new_label);
  v_current_label text;
BEGIN
  IF NOT public.is_internal_admin_user() THEN
    RAISE EXCEPTION 'You do not have permission to rename unit sizes'
      USING ERRCODE = '42501';
  END IF;

  IF v_trimmed_label = '' THEN
    RAISE EXCEPTION 'Unit size label cannot be empty'
      USING ERRCODE = '22023';
  END IF;

  SELECT unit_size_label
  INTO v_current_label
  FROM public.unit_sizes
  WHERE id = p_unit_size_id;

  IF v_current_label IS NULL THEN
    RAISE EXCEPTION 'Unit size not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF lower(v_current_label) = lower(v_trimmed_label) THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.unit_sizes
    WHERE id <> p_unit_size_id
      AND lower(unit_size_label) = lower(v_trimmed_label)
  ) THEN
    RAISE EXCEPTION 'A unit size with that label already exists'
      USING ERRCODE = '23505';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'jobs'
      AND column_name = 'unit_size_label_snapshot'
  ) THEN
    UPDATE public.jobs
    SET unit_size_label_snapshot = v_current_label
    WHERE unit_size_id = p_unit_size_id
      AND NULLIF(btrim(COALESCE(unit_size_label_snapshot, '')), '') IS NULL;
  END IF;

  UPDATE public.unit_sizes
  SET unit_size_label = v_trimmed_label
  WHERE id = p_unit_size_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rename_unit_size(uuid, text) TO authenticated;
