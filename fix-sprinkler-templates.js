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

async function fixSprinklerTemplates() {
  try {
    console.log('Checking email_templates table structure...');
    
    // First, check if the trigger_phase column exists
    const { data: columns, error: columnsError } = await supabase
      .rpc('sql', { 
        query: `
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = 'email_templates' 
          ORDER BY ordinal_position;
        `
      });

    if (columnsError) {
      // Try direct query instead
      const { data: templates, error: templatesError } = await supabase
        .from('email_templates')
        .select('*')
        .limit(1);
      
      if (templatesError) {
        console.error('Error querying templates:', templatesError);
        return;
      }
      
      console.log('Sample template structure:', Object.keys(templates[0] || {}));
    } else {
      console.log('Table columns:', columns);
    }

    // Check if sprinkler templates exist
    console.log('Checking for existing sprinkler templates...');
    const { data: existingTemplates, error: checkError } = await supabase
      .from('email_templates')
      .select('*')
      .ilike('name', '%sprinkler%');

    if (checkError) {
      console.error('Error checking templates:', checkError);
      return;
    }

    console.log('Existing sprinkler templates:', existingTemplates);

    // If no sprinkler templates exist, create them
    if (!existingTemplates || existingTemplates.length === 0) {
      console.log('Creating sprinkler templates...');
      
      const sprinklerTemplates = [
        {
          name: 'Sprinkler Paint - Professional',
          subject: 'Sprinkler Paint Notification for Job #{{job_number}}',
          content: `Hello {{property_name}},

This is a notification that sprinkler paint work has been completed for Job #{{job_number}}.

Property: {{property_address}}
Unit: {{unit_number}}

Sprinkler Paint Details:
Work has been completed and photos are attached for your review.

Thank you,
JG Painting Pros Inc.`,
          template_type: 'notification',
          trigger_phase: 'sprinkler_paint',
          auto_include_photos: true,
          photo_types: ['before', 'after', 'sprinkler']
        },
        {
          name: 'Sprinkler Paint - Casual',
          subject: 'Sprinkler Paint Complete - Job #{{job_number}}',
          content: `Hi {{property_name}},

Just wanted to let you know we've finished the sprinkler paint work on Job #{{job_number}}.

Property: {{property_address}}
Unit: {{unit_number}}

Check out the attached photos!

Thanks,
JG Painting Pros Inc.`,
          template_type: 'notification',
          trigger_phase: 'sprinkler_paint',
          auto_include_photos: true,
          photo_types: ['before', 'after', 'sprinkler']
        }
      ];

      for (const template of sprinklerTemplates) {
        console.log(`Creating template: ${template.name}`);
        const { error } = await supabase
          .from('email_templates')
          .insert(template);

        if (error) {
          console.error(`Error creating template ${template.name}:`, error);
        } else {
          console.log(`✓ Created template: ${template.name}`);
        }
      }
    } else {
      console.log('Sprinkler templates already exist');
    }

    console.log('Done!');
  } catch (error) {
    console.error('Error:', error);
  }
}

fixSprinklerTemplates();
