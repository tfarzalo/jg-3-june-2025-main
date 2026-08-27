-- Align operational permissions so every authenticated non-subcontractor role
-- has the same app access as admin/super admin. Maintenance Mode and What's New
-- settings stay explicitly super-admin-only.

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
'Returns true for authenticated non-subcontractor users. Super-admin-only settings should use explicit is_super_admin checks.';

CREATE OR REPLACE FUNCTION public.is_admin_or_management()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_internal_admin_user();
$$;

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
GRANT EXECUTE ON FUNCTION public.is_admin_or_management() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_admin_settings() TO authenticated;

-- Quality Control uses a dedicated helper, so align that helper too.
CREATE OR REPLACE FUNCTION public.can_manage_quality_control()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_internal_admin_user();
$$;

GRANT EXECUTE ON FUNCTION public.can_manage_quality_control() TO authenticated;

-- Maintenance Mode is the primary app_config use today. All authenticated users
-- must still read it for the maintenance gate, but only SuperAdmin can change it.
DROP POLICY IF EXISTS "Admins can insert app config" ON public.app_config;
DROP POLICY IF EXISTS "Admins can update app config" ON public.app_config;
DROP POLICY IF EXISTS "Super admins can insert app config" ON public.app_config;
DROP POLICY IF EXISTS "Super admins can update app config" ON public.app_config;

CREATE POLICY "Super admins can insert app config"
  ON public.app_config
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'is_super_admin'
    )
  );

CREATE POLICY "Super admins can update app config"
  ON public.app_config
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'is_super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'is_super_admin'
    )
  );

-- Daily agenda email settings are operational admin settings.
DROP POLICY IF EXISTS "Admins can view all email settings" ON public.daily_email_settings;
DROP POLICY IF EXISTS "Admins can insert email settings" ON public.daily_email_settings;
DROP POLICY IF EXISTS "Admins can update email settings" ON public.daily_email_settings;
DROP POLICY IF EXISTS "Admins can delete email settings" ON public.daily_email_settings;
DROP POLICY IF EXISTS "Internal users can view all email settings" ON public.daily_email_settings;
DROP POLICY IF EXISTS "Internal users can insert email settings" ON public.daily_email_settings;
DROP POLICY IF EXISTS "Internal users can update email settings" ON public.daily_email_settings;
DROP POLICY IF EXISTS "Internal users can delete email settings" ON public.daily_email_settings;

CREATE POLICY "Internal users can view all email settings"
  ON public.daily_email_settings
  FOR SELECT
  TO authenticated
  USING (public.is_internal_admin_user());

CREATE POLICY "Internal users can insert email settings"
  ON public.daily_email_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_internal_admin_user());

CREATE POLICY "Internal users can update email settings"
  ON public.daily_email_settings
  FOR UPDATE
  TO authenticated
  USING (public.is_internal_admin_user())
  WITH CHECK (public.is_internal_admin_user());

CREATE POLICY "Internal users can delete email settings"
  ON public.daily_email_settings
  FOR DELETE
  TO authenticated
  USING (public.is_internal_admin_user());

DROP POLICY IF EXISTS "Admins can read config" ON public.daily_email_config;
DROP POLICY IF EXISTS "Admins can update config" ON public.daily_email_config;
DROP POLICY IF EXISTS "Internal users can read daily email config" ON public.daily_email_config;
DROP POLICY IF EXISTS "Internal users can update daily email config" ON public.daily_email_config;

CREATE POLICY "Internal users can read daily email config"
  ON public.daily_email_config
  FOR SELECT
  TO authenticated
  USING (public.is_internal_admin_user());

CREATE POLICY "Internal users can update daily email config"
  ON public.daily_email_config
  FOR UPDATE
  TO authenticated
  USING (public.is_internal_admin_user())
  WITH CHECK (public.is_internal_admin_user());

-- Contact activity should be fully manageable by internal users.
DROP POLICY IF EXISTS "Users can view contact notes for contacts they have access to" ON public.contact_notes;
DROP POLICY IF EXISTS "Users can insert contact notes for contacts they have access to" ON public.contact_notes;
DROP POLICY IF EXISTS "Users can update contact notes they created" ON public.contact_notes;
DROP POLICY IF EXISTS "Users can delete contact notes they created" ON public.contact_notes;
DROP POLICY IF EXISTS "Internal users can manage contact notes" ON public.contact_notes;

CREATE POLICY "Internal users can manage contact notes"
  ON public.contact_notes
  FOR ALL
  TO authenticated
  USING (public.is_internal_admin_user() OR created_by = auth.uid())
  WITH CHECK (public.is_internal_admin_user() OR created_by = auth.uid());

DROP POLICY IF EXISTS "Users can view contact communications for contacts they have access to" ON public.contact_communications;
DROP POLICY IF EXISTS "Users can insert contact communications for contacts they have access to" ON public.contact_communications;
DROP POLICY IF EXISTS "Users can update contact communications they created" ON public.contact_communications;
DROP POLICY IF EXISTS "Users can delete contact communications they created" ON public.contact_communications;
DROP POLICY IF EXISTS "Internal users can manage contact communications" ON public.contact_communications;

CREATE POLICY "Internal users can manage contact communications"
  ON public.contact_communications
  FOR ALL
  TO authenticated
  USING (public.is_internal_admin_user() OR created_by = auth.uid())
  WITH CHECK (public.is_internal_admin_user() OR created_by = auth.uid());

-- Sub assignment notification recipient settings are operational settings.
DROP POLICY IF EXISTS "Admins manage sub assignment recipients" ON public.sub_assignment_notification_recipients;
DROP POLICY IF EXISTS "Internal users manage sub assignment recipients" ON public.sub_assignment_notification_recipients;

CREATE POLICY "Internal users manage sub assignment recipients"
  ON public.sub_assignment_notification_recipients
  FOR ALL
  TO authenticated
  USING (public.is_internal_admin_user())
  WITH CHECK (public.is_internal_admin_user());

-- The legacy changelog is operational content; What's New entries remain
-- SuperAdmin-only through their existing dedicated policies.
DROP POLICY IF EXISTS "Admins can insert changelog entries" ON public.changelog;
DROP POLICY IF EXISTS "Admins can update changelog entries" ON public.changelog;
DROP POLICY IF EXISTS "Admins can delete changelog entries" ON public.changelog;
DROP POLICY IF EXISTS "Internal users can insert changelog entries" ON public.changelog;
DROP POLICY IF EXISTS "Internal users can update changelog entries" ON public.changelog;
DROP POLICY IF EXISTS "Internal users can delete changelog entries" ON public.changelog;

CREATE POLICY "Internal users can insert changelog entries"
  ON public.changelog
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_internal_admin_user());

CREATE POLICY "Internal users can update changelog entries"
  ON public.changelog
  FOR UPDATE
  TO authenticated
  USING (public.is_internal_admin_user())
  WITH CHECK (public.is_internal_admin_user());

CREATE POLICY "Internal users can delete changelog entries"
  ON public.changelog
  FOR DELETE
  TO authenticated
  USING (public.is_internal_admin_user());
