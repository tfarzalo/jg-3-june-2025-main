import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';

// Load env vars
const envConfig = dotenv.parse(fs.readFileSync('.env'));
const dbUrl = "postgres://postgres:postgres@127.0.0.1:54322/postgres"; // Local fallback
// Wait, we are on a remote project?
// The user has .env with VITE_SUPABASE_URL.
// The DB is likely remote.
// We need the connection string.
// Usually Supabase connection string is: postgres://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
// I don't have the password.
// BUT, the user's environment has a local postgres running?
// The environment info says: "Working directory: .../jg-3-june-2025-main-main"
// And I saw "npx supabase db reset" commands.
// This suggests a LOCAL Supabase instance.
// If it's local, the password is usually 'postgres' or 'your-super-secret-and-long-postgres-password'.
// And port 54322.

// Let's try connecting to local DB.
const client = new pg.Client({
  connectionString: "postgres://postgres:postgres@127.0.0.1:54322/postgres",
});

async function run() {
  try {
    await client.connect();
    console.log("Connected to database!");

    // Read the SQL file
    const sql = fs.readFileSync('FINAL_FIX_ALL_FOLDER_LOGIC.sql', 'utf8');
    
    // Execute
    await client.query(sql);
    console.log("SQL executed successfully!");
    
    // Verify
    const res = await client.query(`
        SELECT pg_get_functiondef(p.oid) 
        FROM pg_proc p 
        WHERE p.proname = 'create_job_folder'
    `);
    console.log("Function definition:");
    console.log(res.rows[0].pg_get_functiondef);
    
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

run();
