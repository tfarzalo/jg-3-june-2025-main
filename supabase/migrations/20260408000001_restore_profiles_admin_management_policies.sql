-- Restore predictable profiles RLS so admin/management users can manage
-- subcontractor profiles, including working_days and language_preference.

CREATE OR REPLACE FUNCTION public.is_admin_or_management()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_role_assignments ura
    JOIN public.user_roles ur ON ura.role_id = ur.id
    WHERE ura.user_id = auth.uid()
      AND ur.name IN ('Admin', 'JG Management', 'Super Admin')
  ) THEN
    RETURN TRUE;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'jg_management', 'is_super_admin')
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_language_preference_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() = NEW.id OR public.is_admin_or_management() THEN
    RETURN NEW;
  END IF;

  IF OLD.language_preference IS DISTINCT FROM NEW.language_preference THEN
    RAISE EXCEPTION 'Only admin, JG management, or super admin can update another user''s language preference';
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Authenticated SELECT on profiles" ON public.profiles;
  DROP POLICY IF EXISTS "Authenticated INSERT on profiles" ON public.profiles;
  DROP POLICY IF EXISTS "Authenticated UPDATE on profiles" ON public.profiles;
  DROP POLICY IF EXISTS "Authenticated DELETE on profiles" ON public.profiles;
  DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
  DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
  DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
  DROP POLICY IF EXISTS "profiles_delete_own" ON public.profiles;
  DROP POLICY IF EXISTS "profiles_read_all_authenticated" ON public.profiles;
  DROP POLICY IF EXISTS "profiles_update_own_only" ON public.profiles;
  DROP POLICY IF EXISTS "profiles_insert_own_only" ON public.profiles;
  DROP POLICY IF EXISTS "profiles_delete_own_only" ON public.profiles;
  DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
  DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
  DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
  DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
  DROP POLICY IF EXISTS "Enable read access for users" ON public.profiles;
  DROP POLICY IF EXISTS "Enable admin read access" ON public.profiles;
  DROP POLICY IF EXISTS "Enable update for users" ON public.profiles;
  DROP POLICY IF EXISTS "Enable admin update access" ON public.profiles;
  DROP POLICY IF EXISTS "Profiles full access for admin/management" ON public.profiles;
  DROP POLICY IF EXISTS "Profiles read own for subcontractors" ON public.profiles;
  DROP POLICY IF EXISTS "Allow read working_days for scheduling" ON public.profiles;
  DROP POLICY IF EXISTS "Allow update working_days for admins" ON public.profiles;
  DROP POLICY IF EXISTS "Users can read own availability" ON public.profiles;
  DROP POLICY IF EXISTS "Users can update own availability" ON public.profiles;
  DROP POLICY IF EXISTS "Admins can read all availability" ON public.profiles;
  DROP POLICY IF EXISTS "Admins can update availability" ON public.profiles;
END
$$;

CREATE POLICY "profiles_select_authenticated"
ON public.profiles
FOR SELECT
TO authenticated
USING (TRUE);

CREATE POLICY "profiles_insert_self_or_admin_management"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id OR public.is_admin_or_management());

CREATE POLICY "profiles_update_self_or_admin_management"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id OR public.is_admin_or_management())
WITH CHECK (auth.uid() = id OR public.is_admin_or_management());

CREATE POLICY "profiles_delete_admin_management"
ON public.profiles
FOR DELETE
TO authenticated
USING (public.is_admin_or_management());
