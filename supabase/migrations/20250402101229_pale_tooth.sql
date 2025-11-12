/*
  # Create User Roles and Permissions

  1. New Tables
    - `user_roles` - Defines available roles in the system
    - `role_permissions` - Defines permissions for each role
    - `user_role_assignments` - Maps users to roles

  2. Security
    - Enable RLS on all tables
    - Add policies for proper access control
    - Only admins can manage roles and permissions
*/

-- Create user_roles table
CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create role_permissions table
CREATE TABLE IF NOT EXISTS role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES user_roles(id) ON DELETE CASCADE,
  resource text NOT NULL,
  action text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(role_id, resource, action)
);

-- Create user_role_assignments table
CREATE TABLE IF NOT EXISTS user_role_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES user_roles(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES profiles(id),
  assigned_at timestamptz DEFAULT now(),
  UNIQUE(user_id, role_id)
);

-- Enable RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_role_assignments ENABLE ROW LEVEL SECURITY;

-- Create policies for user_roles
CREATE POLICY "Admins can manage user roles"
  ON user_roles
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "All users can view roles"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (true);

-- Create policies for role_permissions
CREATE POLICY "Admins can manage role permissions"
  ON role_permissions
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "All users can view role permissions"
  ON role_permissions
  FOR SELECT
  TO authenticated
  USING (true);

-- Create policies for user_role_assignments
CREATE POLICY "Admins can manage user role assignments"
  ON user_role_assignments
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can view their own role assignments"
  ON user_role_assignments
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Insert default roles
INSERT INTO user_roles (name, description)
VALUES 
  ('Admin', 'Full access to all system features'),
  ('JG Management', 'Access to management features'),
  ('Subcontractor', 'Limited access to assigned jobs')
ON CONFLICT (name) DO NOTHING;

-- Insert default permissions for Admin role
DO $$ 
DECLARE
  v_admin_role_id uuid;
BEGIN
  SELECT id INTO v_admin_role_id FROM user_roles WHERE name = 'Admin';
  
  IF v_admin_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, resource, action)
    VALUES
      (v_admin_role_id, '*', '*')
    ON CONFLICT (role_id, resource, action) DO NOTHING;
  END IF;
END $$;

-- Insert default permissions for JG Management role
DO $$ 
DECLARE
  v_mgmt_role_id uuid;
BEGIN
  SELECT id INTO v_mgmt_role_id FROM user_roles WHERE name = 'JG Management';
  
  IF v_mgmt_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, resource, action)
    VALUES
      (v_mgmt_role_id, 'jobs', 'read'),
      (v_mgmt_role_id, 'jobs', 'create'),
      (v_mgmt_role_id, 'jobs', 'update'),
      (v_mgmt_role_id, 'properties', 'read'),
      (v_mgmt_role_id, 'properties', 'create'),
      (v_mgmt_role_id, 'properties', 'update'),
      (v_mgmt_role_id, 'work_orders', 'read'),
      (v_mgmt_role_id, 'work_orders', 'create'),
      (v_mgmt_role_id, 'work_orders', 'update'),
      (v_mgmt_role_id, 'files', 'read'),
      (v_mgmt_role_id, 'files', 'create'),
      (v_mgmt_role_id, 'files', 'update'),
      (v_mgmt_role_id, 'files', 'delete')
    ON CONFLICT (role_id, resource, action) DO NOTHING;
  END IF;
END $$;

-- Insert default permissions for Subcontractor role
DO $$ 
DECLARE
  v_sub_role_id uuid;
BEGIN
  SELECT id INTO v_sub_role_id FROM user_roles WHERE name = 'Subcontractor';
  
  IF v_sub_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, resource, action)
    VALUES
      (v_sub_role_id, 'jobs', 'read'),
      (v_sub_role_id, 'work_orders', 'read'),
      (v_sub_role_id, 'calendar', 'read')
    ON CONFLICT (role_id, resource, action) DO NOTHING;
  END IF;
END $$;

-- Create function to check if user has permission
CREATE OR REPLACE FUNCTION has_permission(
  p_user_id uuid,
  p_resource text,
  p_action text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_permission boolean;
BEGIN
  -- Check if user is admin (admins have all permissions)
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_user_id AND role = 'admin'
  ) INTO v_has_permission;
  
  IF v_has_permission THEN
    RETURN true;
  END IF;
  
  -- Check specific permission
  SELECT EXISTS (
    SELECT 1
    FROM user_role_assignments ura
    JOIN role_permissions rp ON ura.role_id = rp.role_id
    WHERE ura.user_id = p_user_id
    AND (
      (rp.resource = p_resource AND rp.action = p_action) OR
      (rp.resource = p_resource AND rp.action = '*') OR
      (rp.resource = '*' AND rp.action = '*')
    )
  ) INTO v_has_permission;
  
  RETURN v_has_permission;
END;
$$;