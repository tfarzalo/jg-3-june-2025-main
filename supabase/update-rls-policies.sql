-- Update RLS Policies for Admin and Management Users
-- This script grants full permissions to admin and jg_management users

-- Helper function to check if user is admin or management (in public schema)
CREATE OR REPLACE FUNCTION public.is_admin_or_management()
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if user has admin or management role through user_role_assignments
  RETURN EXISTS (
    SELECT 1 
    FROM public.user_role_assignments ura
    JOIN public.user_roles ur ON ura.role_id = ur.id
    WHERE ura.user_id = auth.uid() 
    AND ur.name IN ('Admin', 'JG Management')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is subcontractor (in public schema)
CREATE OR REPLACE FUNCTION public.is_subcontractor()
RETURNS BOOLEAN AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;
  
  RETURN EXISTS (
    SELECT 1 
    FROM public.user_role_assignments ura
    JOIN public.user_roles ur ON ura.role_id = ur.id
    WHERE ura.user_id = auth.uid() 
    AND ur.name = 'Subcontractor'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update policies for each table

-- Profiles table
DROP POLICY IF EXISTS "Profiles full access for admin/management" ON profiles;
DROP POLICY IF EXISTS "Profiles read own for subcontractors" ON profiles;

CREATE POLICY "Profiles full access for admin/management" ON profiles
  FOR ALL USING (public.is_admin_or_management());

CREATE POLICY "Profiles read own for subcontractors" ON profiles
  FOR SELECT USING (public.is_subcontractor() AND id = auth.uid());

-- Jobs table
DROP POLICY IF EXISTS "Jobs full access for admin/management" ON jobs;
DROP POLICY IF EXISTS "Jobs limited access for subcontractors" ON jobs;

CREATE POLICY "Jobs full access for admin/management" ON jobs
  FOR ALL USING (public.is_admin_or_management());

CREATE POLICY "Jobs limited access for subcontractors" ON jobs
  FOR SELECT USING (public.is_subcontractor());

-- Properties table
DROP POLICY IF EXISTS "Properties full access for admin/management" ON properties;
DROP POLICY IF EXISTS "Properties read for subcontractors" ON properties;

CREATE POLICY "Properties full access for admin/management" ON properties
  FOR ALL USING (public.is_admin_or_management());

CREATE POLICY "Properties read for subcontractors" ON properties
  FOR SELECT USING (public.is_subcontractor());

-- Property Management Groups table
DROP POLICY IF EXISTS "PMG full access for admin/management" ON property_management_groups;
DROP POLICY IF EXISTS "PMG read for subcontractors" ON property_management_groups;

CREATE POLICY "PMG full access for admin/management" ON property_management_groups
  FOR ALL USING (public.is_admin_or_management());

CREATE POLICY "PMG read for subcontractors" ON property_management_groups
  FOR SELECT USING (public.is_subcontractor());

-- Work Orders table
DROP POLICY IF EXISTS "Work orders full access for admin/management" ON work_orders;
DROP POLICY IF EXISTS "Work orders limited for subcontractors" ON work_orders;

CREATE POLICY "Work orders full access for admin/management" ON work_orders
  FOR ALL USING (public.is_admin_or_management());

CREATE POLICY "Work orders limited for subcontractors" ON work_orders
  FOR SELECT USING (public.is_subcontractor());

-- Files table
DROP POLICY IF EXISTS "Files full access for admin/management" ON files;
DROP POLICY IF EXISTS "Files limited for subcontractors" ON files;

CREATE POLICY "Files full access for admin/management" ON files
  FOR ALL USING (public.is_admin_or_management());

CREATE POLICY "Files limited for subcontractors" ON files
  FOR SELECT USING (public.is_subcontractor());

-- Job Types table
DROP POLICY IF EXISTS "Job types full access for admin/management" ON job_types;
DROP POLICY IF EXISTS "Job types read for subcontractors" ON job_types;

CREATE POLICY "Job types full access for admin/management" ON job_types
  FOR ALL USING (public.is_admin_or_management());

CREATE POLICY "Job types read for subcontractors" ON job_types
  FOR SELECT USING (public.is_subcontractor());

-- Job Phases table
DROP POLICY IF EXISTS "Job phases full access for admin/management" ON job_phases;
DROP POLICY IF EXISTS "Job phases read for subcontractors" ON job_phases;

CREATE POLICY "Job phases full access for admin/management" ON job_phases
  FOR ALL USING (public.is_admin_or_management());

CREATE POLICY "Job phases read for subcontractors" ON job_phases
  FOR SELECT USING (public.is_subcontractor());

-- Unit Sizes table
DROP POLICY IF EXISTS "Unit sizes full access for admin/management" ON unit_sizes;
DROP POLICY IF EXISTS "Unit sizes read for subcontractors" ON unit_sizes;

CREATE POLICY "Unit sizes full access for admin/management" ON unit_sizes
  FOR ALL USING (public.is_admin_or_management());

CREATE POLICY "Unit sizes read for subcontractors" ON unit_sizes
  FOR SELECT USING (public.is_subcontractor());

-- User Role Assignments table
DROP POLICY IF EXISTS "URA full access for admin/management" ON user_role_assignments;
DROP POLICY IF EXISTS "URA read own for subcontractors" ON user_role_assignments;

CREATE POLICY "URA full access for admin/management" ON user_role_assignments
  FOR ALL USING (public.is_admin_or_management());

CREATE POLICY "URA read own for subcontractors" ON user_role_assignments
  FOR SELECT USING (public.is_subcontractor() AND user_id = auth.uid());

-- User Roles table
DROP POLICY IF EXISTS "User roles full access for admin/management" ON user_roles;
DROP POLICY IF EXISTS "User roles read for subcontractors" ON user_roles;

CREATE POLICY "User roles full access for admin/management" ON user_roles
  FOR ALL USING (public.is_admin_or_management());

CREATE POLICY "User roles read for subcontractors" ON user_roles
  FOR SELECT USING (public.is_subcontractor());
