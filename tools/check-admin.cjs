const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Get command line arguments
const args = process.argv.slice(2);
const email = args[0] || 'admin@paintingbusiness.com'; // Default email to check

// Create Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAdminUser() {
  try {
    console.log(`Checking user with email: ${email}`);
    
    // Check if user exists in auth.users
    const { data: authUser, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      throw authError;
    }
    
    const foundAuthUser = authUser.users.find(user => user.email === email);
    
    if (foundAuthUser) {
      console.log('User exists in auth system:');
      console.log(`  ID: ${foundAuthUser.id}`);
      console.log(`  Email: ${foundAuthUser.email}`);
      console.log(`  Created at: ${foundAuthUser.created_at}`);
      console.log(`  Email confirmed: ${foundAuthUser.email_confirmed_at ? 'Yes' : 'No'}`);
      
      // Check if profiles table exists
      try {
        // Check if user has a profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', foundAuthUser.id)
          .maybeSingle();
        
        if (profileError) {
          if (profileError.code === 'PGRST116') { // Not found
            console.log('User does not have a profile');
          } else if (profileError.code === '42P01') { // Table doesn't exist
            console.log('The profiles table does not exist yet. You need to run migrations first.');
          } else {
            throw profileError;
          }
        } else if (profile) {
          console.log('User has a profile:');
          console.log(`  Role: ${profile.role}`);
          console.log(`  Full name: ${profile.full_name}`);
          
          if (profile.role === 'admin') {
            console.log('\n✅ This user is an admin and should have full access to the system.');
          } else {
            console.log(`\n⚠️ This user has role "${profile.role}" but is not an admin.`);
            
            // Offer to update the role
            console.log('\nTo update this user to admin role, run:');
            console.log(`npm run create-admin ${email} YourPassword123!`);
          }
        }
      } catch (profileCheckError) {
        if (profileCheckError.code === '42P01') { // Table doesn't exist
          console.log('The profiles table does not exist yet. You need to run migrations first.');
        } else {
          throw profileCheckError;
        }
      }
    } else {
      console.log(`No user found with email: ${email}`);
      console.log('\nTo create an admin user, run:');
      console.log(`npm run create-admin ${email} YourPassword123!`);
    }
    
  } catch (error) {
    console.error('Error checking admin user:', error);
    
    if (error.code === 'PGRST116') {
      console.log('The profiles table exists but no profile found for this user.');
    } else if (error.code === '42P01') {
      console.log('The profiles table does not exist yet. You need to run migrations first.');
    }
  }
}

checkAdminUser();