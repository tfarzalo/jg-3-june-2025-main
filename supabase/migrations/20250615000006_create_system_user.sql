-- Create system user for automatic calendar events
-- This user will be used to create daily agenda summary events

-- Insert system user into auth.users (if not exists)
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'system@example.com',
  crypt('system-password', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '{"provider": "system", "providers": ["system"]}',
  '{"name": "System User", "role": "admin"}',
  false,
  '',
  '',
  '',
  ''
) ON CONFLICT (id) DO NOTHING;

-- Insert system user profile
INSERT INTO public.profiles (
  id,
  full_name,
  email,
  role,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'System User',
  'system@example.com',
  'admin',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Create calendar token for system user
INSERT INTO public.calendar_tokens (
  user_id,
  token,
  created_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000000',
  NOW()
) ON CONFLICT (user_id) DO NOTHING;
