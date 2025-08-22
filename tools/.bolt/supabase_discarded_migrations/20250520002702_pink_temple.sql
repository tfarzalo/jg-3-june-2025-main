-- First, create the profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text,
  role text NOT NULL DEFAULT 'user',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated SELECT on profiles"
  ON profiles
  FOR SELECT
  TO public
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated INSERT on profiles"
  ON profiles
  FOR INSERT
  TO public
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated UPDATE on profiles"
  ON profiles
  FOR UPDATE
  TO public
  USING (auth.uid() = id OR EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  ))
  WITH CHECK (auth.uid() = id OR EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Authenticated DELETE on profiles"
  ON profiles
  FOR DELETE
  TO public
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  ));

-- Function to handle user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    COALESCE(new.raw_user_meta_data->>'role', 'user')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Now create an admin user
-- IMPORTANT: Replace the email and password below with your actual credentials before running
DO $$
DECLARE
  user_id uuid;
  admin_email text := 'YOUR_ADMIN_EMAIL@example.com';  -- CHANGE THIS
  admin_password text := 'YOUR_SECURE_PASSWORD_HERE';  -- CHANGE THIS
BEGIN
  -- Create the user in auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    uuid_generate_v4(),
    admin_email,
    crypt(admin_password, gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Admin User"}',
    now(),
    now()
  )
  RETURNING id INTO user_id;

  -- Create a profile for the user with admin role
  INSERT INTO profiles (
    id,
    email,
    full_name,
    role
  )
  VALUES (
    user_id,
    admin_email,  -- Using the variable defined above
    'Admin User',
    'admin'
  );
END $$;