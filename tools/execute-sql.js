import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// Create Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function executeSql() {
  try {
    // Read the SQL file
    const sql = fs.readFileSync('supabase/setup-job-phases.sql', 'utf8');
    
    console.log('Executing SQL script...');
    
    // Execute the SQL
    const { error } = await supabase.rpc('pgbouncer_exec', { query: sql });
    
    if (error) {
      throw error;
    }
    
    console.log('SQL script executed successfully');
    
  } catch (error) {
    console.error('Error executing SQL script:', error);
  }
}

executeSql();