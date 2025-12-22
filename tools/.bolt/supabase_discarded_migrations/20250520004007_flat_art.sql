-- Create an admin user with a unique email
-- IMPORTANT: Change the email and password below before running this script
DO $$
DECLARE
  user_id uuid;
  admin_email text := 'admin@paintingbusiness.com';  -- Change this to your desired email
  admin_password text := 'AdminPassword123!';  -- Change this to your desired password
BEGIN
  -- First ensure the profiles table exists
  CREATE TABLE IF NOT EXISTS profiles (
    id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
    email text UNIQUE NOT NULL,
    full_name text,
    role text NOT NULL DEFAULT 'user',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  );

  -- Enable RLS if not already enabled
  ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

  -- Create policies if they don't exist
  DO $policies$ 
  BEGIN
    -- Drop existing policies to avoid conflicts
    DROP POLICY IF EXISTS "Authenticated SELECT on profiles" ON profiles;
    DROP POLICY IF EXISTS "Authenticated INSERT on profiles" ON profiles;
    DROP POLICY IF EXISTS "Authenticated UPDATE on profiles" ON profiles;
    DROP POLICY IF EXISTS "Authenticated DELETE on profiles" ON profiles;

    -- Create new policies
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
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Error creating policies: %', SQLERRM;
  END $policies$;

  -- Create or replace the trigger function
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

  -- Create the trigger if it doesn't exist
  DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

  -- Check if user already exists
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = admin_email) THEN
    RAISE NOTICE 'User with email % already exists', admin_email;
    
    -- Get the user ID
    SELECT id INTO user_id FROM auth.users WHERE email = admin_email;
    
    -- Update the profile to ensure admin role
    IF EXISTS (SELECT 1 FROM profiles WHERE id = user_id) THEN
      UPDATE profiles 
      SET role = 'admin' 
      WHERE id = user_id;
      RAISE NOTICE 'Updated existing profile to admin role';
    ELSE
      -- Create profile if it doesn't exist
      INSERT INTO profiles (
        id,
        email,
        full_name,
        role
      )
      VALUES (
        user_id,
        admin_email,
        'Admin User',
        'admin'
      );
      RAISE NOTICE 'Created new profile with admin role';
    END IF;
  ELSE
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
      admin_email,
      'Admin User',
      'admin'
    );
    
    RAISE NOTICE 'Admin user created successfully with email: %', admin_email;
  END IF;
END $$;

-- Verify the admin user was created
SELECT 
  au.id, 
  au.email, 
  p.role,
  au.created_at,
  au.email_confirmed_at
FROM auth.users au
JOIN profiles p ON au.id = p.id
WHERE p.role = 'admin';