import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Create Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testSprinklerQuery() {
  try {
    console.log('Testing sprinkler template query...');
    
    // This is the exact query from NotificationEmailModal
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .eq('trigger_phase', 'sprinkler_paint')
      .eq('template_type', 'notification')
      .single();

    if (error) {
      console.error('Query error:', error);
    } else {
      console.log('Query successful!');
      console.log('Template found:', {
        id: data.id,
        name: data.name,
        subject: data.subject,
        template_type: data.template_type,
        trigger_phase: data.trigger_phase
      });
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testSprinklerQuery();
