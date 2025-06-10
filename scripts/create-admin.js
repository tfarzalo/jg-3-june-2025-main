const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Get command line arguments
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node create-admin.js <email> <password>');
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
    console.log(`Creating admin user with email: ${email}`);
    
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
    
    // Update the user's role to admin
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: userData.user.id,
        email: userData.user.email,
        role: 'admin',
        full_name: 'Admin User'
      });
    
    if (profileError) {
      throw profileError;
    }
    
    console.log('User role set to admin successfully');
    console.log('Admin user creation complete!');
    
  } catch (error) {
    console.error('Error creating admin user:', error);
  }
}

createAdminUser();