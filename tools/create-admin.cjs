const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Get command line arguments
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node create-admin.cjs <email> <password>');
  process.exit(1);
}

const email = args[0];
const password = args[1];

// Create Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // This should be in your .env file

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createAdminUser() {
  try {
    console.log(`Creating/updating admin user with email: ${email}`);
    
    // Check if user already exists
    const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      throw listError;
    }
    
    const existingUser = existingUsers.users.find(user => user.email === email);
    let userId;
    
    if (existingUser) {
      console.log('User already exists, updating password and role');
      userId = existingUser.id;
      
      // Update password if provided
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        userId,
        { password }
      );
      
      if (updateError) {
        throw updateError;
      }
      
      console.log('User password updated successfully');
    } else {
      // Create the user
      const { data: userData, error: userError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      
      if (userError) {
        throw userError;
      }
      
      console.log('User created successfully');
      userId = userData.user.id;
    }
    
    // Check if profiles table exists
    try {
      // Try to check if the profiles table exists
      const { count, error: countError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });
      
      if (countError && countError.code === '42P01') {
        // Table doesn't exist, create it
        console.log('Profiles table does not exist, creating it...');
        
        const createTableSQL = `
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
        `;
        
        // Execute the SQL to create the profiles table
        const { error: sqlError } = await supabase.rpc('pgbouncer_exec', { query: createTableSQL });
        
        if (sqlError) {
          throw sqlError;
        }
        
        console.log('Profiles table created successfully');
      }
    } catch (tableCheckError) {
      console.error('Error checking/creating profiles table:', tableCheckError);
      // Continue anyway, as we'll try to upsert the profile
    }
    
    // Create or update the user's profile with admin role
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        email: email,
        role: 'admin',
        full_name: 'Admin User'
      });
    
    if (profileError) {
      if (profileError.code === '42P01') {
        console.error('Profiles table does not exist. Please run migrations first.');
      } else {
        throw profileError;
      }
    } else {
      console.log('User role set to admin successfully');
      console.log('Admin user creation/update complete!');
    }
    
  } catch (error) {
    console.error('Error creating/updating admin user:', error);
  }
}

createAdminUser();