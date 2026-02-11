-- Add RLS policies for language_preference field in profiles table
-- This ensures only admin/jg_management can edit another user's language_preference
-- while subcontractors can read their own

-- The existing policies already allow:
-- - All authenticated users to SELECT (read) profiles
-- - Users to UPDATE their own profiles
-- 
-- We need to add a specific check that prevents non-admin users from updating
-- language_preference for other users. Since the existing UPDATE policy allows
-- users to update their own profile, we'll add a column-level restriction.

-- Note: PostgreSQL doesn't support column-level RLS directly, so we'll use a trigger
-- to enforce this business rule.

-- Create a function to validate language_preference updates
CREATE OR REPLACE FUNCTION validate_language_preference_update()
RETURNS TRIGGER AS $$
DECLARE
  current_user_role text;
BEGIN
  -- Allow if user is updating their own profile
  IF auth.uid() = NEW.id THEN
    -- Users can update their own language_preference
    RETURN NEW;
  END IF;

  -- Check if current user is admin or jg_management
  SELECT role INTO current_user_role
  FROM profiles
  WHERE id = auth.uid();

  -- Allow if user is admin or jg_management
  IF current_user_role IN ('admin', 'jg_management') THEN
    RETURN NEW;
  END IF;

  -- If we get here, user is trying to update another user's language_preference
  -- without proper permissions. Preserve the old value.
  IF OLD.language_preference IS DISTINCT FROM NEW.language_preference THEN
    RAISE EXCEPTION 'Only admin or jg_management can update another user''s language preference';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS enforce_language_preference_permissions ON profiles;

-- Create trigger to enforce language_preference update permissions
CREATE TRIGGER enforce_language_preference_permissions
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION validate_language_preference_update();

-- Add comment for documentation
COMMENT ON FUNCTION validate_language_preference_update() IS 
  'Ensures only admin/jg_management can update another user''s language_preference field';

