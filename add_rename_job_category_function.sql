-- Migration: Add rename_job_category RPC function
-- Purpose: Safely rename job categories while maintaining FK integrity with billing_categories
-- Date: February 10, 2026

-- Drop function if exists (for safe redeployment)
DROP FUNCTION IF EXISTS public.rename_job_category(uuid, text);

-- Create the rename function
CREATE OR REPLACE FUNCTION public.rename_job_category(
  p_category_id uuid,
  p_new_name text
)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  sort_order integer,
  is_default boolean,
  is_system boolean,
  is_hidden boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_name text;
  v_user_role text;
  v_is_system boolean;
  v_is_default boolean;
  v_existing_id uuid;
BEGIN
  -- 1. Check user permissions
  SELECT role INTO v_user_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_user_role NOT IN ('admin', 'jg_management') THEN
    RAISE EXCEPTION 'Permission denied. Only admins can rename job categories.'
      USING ERRCODE = '42501';
  END IF;

  -- 2. Validate and clean input
  p_new_name := trim(p_new_name);
  
  IF p_new_name = '' OR p_new_name IS NULL THEN
    RAISE EXCEPTION 'Category name cannot be empty.'
      USING ERRCODE = '22023';
  END IF;

  -- 3. Get existing category and validate it exists
  SELECT 
    jc.name, 
    jc.is_system, 
    jc.is_default
  INTO v_old_name, v_is_system, v_is_default
  FROM public.job_categories jc
  WHERE jc.id = p_category_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job category not found.'
      USING ERRCODE = '22023';
  END IF;

  -- 4. Check if category is protected (system categories cannot be renamed)
  IF v_is_system THEN
    RAISE EXCEPTION 'System categories cannot be renamed.'
      USING ERRCODE = '22023';
  END IF;

  -- 5. Check for duplicate name (case-insensitive)
  SELECT jc.id INTO v_existing_id
  FROM public.job_categories jc
  WHERE lower(jc.name) = lower(p_new_name)
    AND jc.id != p_category_id
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'A category with the name "%" already exists.', p_new_name
      USING ERRCODE = '23505';
  END IF;

  -- 6. Update billing_categories (FK references job_categories.name)
  -- This must happen BEFORE updating job_categories to maintain FK integrity
  UPDATE public.billing_categories
  SET name = p_new_name
  WHERE name = v_old_name;

  -- 7. Update job_categories
  UPDATE public.job_categories
  SET 
    name = p_new_name,
    updated_at = now()
  WHERE id = p_category_id;

  -- 8. Return the updated category
  RETURN QUERY
  SELECT 
    jc.id,
    jc.name,
    jc.description,
    jc.sort_order,
    jc.is_default,
    jc.is_system,
    jc.is_hidden,
    jc.created_at,
    jc.updated_at
  FROM public.job_categories jc
  WHERE jc.id = p_category_id;
END;
$$;

-- Grant execute permissions to authenticated users
-- (The function itself checks role internally)
GRANT EXECUTE ON FUNCTION public.rename_job_category(uuid, text) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.rename_job_category(uuid, text) IS 
'Safely renames a job category and updates all related billing_categories. 
Only admins/jg_management can execute. System categories cannot be renamed.
Validates for duplicate names (case-insensitive) and maintains FK integrity.';
