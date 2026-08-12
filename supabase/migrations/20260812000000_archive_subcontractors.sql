-- Archive state for subcontractors.
-- Active users have archived_at IS NULL. Archived users remain in profiles so
-- historical job/profile joins can still resolve until permanent deletion.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS restored_at timestamptz,
  ADD COLUMN IF NOT EXISTS restored_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_role_active
  ON public.profiles(role, archived_at)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_archived_at
  ON public.profiles(archived_at)
  WHERE archived_at IS NOT NULL;

COMMENT ON COLUMN public.profiles.archived_at IS
  'When set, the user is hidden from active workflows and should not be able to log in.';

COMMENT ON COLUMN public.profiles.archived_by IS
  'Management user who archived this profile.';

COMMENT ON COLUMN public.profiles.restored_at IS
  'Most recent time this profile was restored from archive.';

COMMENT ON COLUMN public.profiles.restored_by IS
  'Management user who most recently restored this profile.';
