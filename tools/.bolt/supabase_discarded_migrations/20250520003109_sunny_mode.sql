-- Create an admin user with a unique email
DO $$
DECLARE
  user_id uuid;
  admin_email text := 'admin@paintingbusiness.com';  -- Change this to your desired email
  admin_password text := 'AdminPassword123!';  -- Change this to your desired password
BEGIN
  -- Check if user already exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = admin_email) THEN
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
  ELSE
    RAISE NOTICE 'User with email % already exists', admin_email;
    
    -- Get the user ID
    SELECT id INTO user_id FROM auth.users WHERE email = admin_email;
    
    -- Update the profile to ensure admin role
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
    )
    ON CONFLICT (id) DO UPDATE
    SET role = 'admin';
    
    RAISE NOTICE 'Existing user updated to admin role';
  END IF;
END $$;