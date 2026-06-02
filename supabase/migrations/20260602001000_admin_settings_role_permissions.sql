-- Align admin settings write permissions across Super Admin, Admin, JG Management, and Assistant Manager.

CREATE OR REPLACE FUNCTION public.can_manage_admin_settings()
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
      AND role IN ('is_super_admin', 'admin', 'jg_management', 'assistant_manager')
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_manage_admin_settings() TO authenticated;

-- Unit Sizes
DROP POLICY IF EXISTS "Unit sizes full access for admin/management" ON public.unit_sizes;
DROP POLICY IF EXISTS "Unit sizes read for subcontractors" ON public.unit_sizes;
DROP POLICY IF EXISTS "unit_sizes_select_authenticated" ON public.unit_sizes;
DROP POLICY IF EXISTS "unit_sizes_modify_admin_only" ON public.unit_sizes;
DROP POLICY IF EXISTS "unit_sizes_modify_admin_settings_roles" ON public.unit_sizes;

ALTER TABLE public.unit_sizes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "unit_sizes_select_authenticated"
ON public.unit_sizes
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "unit_sizes_modify_admin_settings_roles"
ON public.unit_sizes
FOR ALL
TO authenticated
USING (public.can_manage_admin_settings())
WITH CHECK (public.can_manage_admin_settings());

-- Job Types
DROP POLICY IF EXISTS "Job types full access for admin/management" ON public.job_types;
DROP POLICY IF EXISTS "Job types read for subcontractors" ON public.job_types;
DROP POLICY IF EXISTS "job_types_select_authenticated" ON public.job_types;
DROP POLICY IF EXISTS "job_types_modify_admin_only" ON public.job_types;
DROP POLICY IF EXISTS "job_types_modify_admin_settings_roles" ON public.job_types;

ALTER TABLE public.job_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "job_types_select_authenticated"
ON public.job_types
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "job_types_modify_admin_settings_roles"
ON public.job_types
FOR ALL
TO authenticated
USING (public.can_manage_admin_settings())
WITH CHECK (public.can_manage_admin_settings());

-- Job/Billing Categories
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

ALTER TABLE public.job_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "job_categories_select_authenticated"
ON public.job_categories
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "job_categories_modify_admin_settings_roles"
ON public.job_categories
FOR ALL
TO authenticated
USING (public.can_manage_admin_settings())
WITH CHECK (public.can_manage_admin_settings());

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

ALTER TABLE public.billing_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "billing_categories_select_authenticated"
ON public.billing_categories
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "billing_categories_modify_admin_settings_roles"
ON public.billing_categories
FOR ALL
TO authenticated
USING (public.can_manage_admin_settings())
WITH CHECK (public.can_manage_admin_settings());

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

ALTER TABLE public.billing_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "billing_details_select_authenticated"
ON public.billing_details
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "billing_details_modify_admin_settings_roles"
ON public.billing_details
FOR ALL
TO authenticated
USING (public.can_manage_admin_settings())
WITH CHECK (public.can_manage_admin_settings());

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
  IF NOT public.can_manage_admin_settings() THEN
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
