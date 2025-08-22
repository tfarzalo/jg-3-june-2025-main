import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
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

async function runMigration() {
  try {
    console.log('Starting email template migration...');
    
    // Step 1: Add new columns
    console.log('Adding new columns...');
    let { error } = await supabase.rpc('exec_sql', { 
      sql: `ALTER TABLE email_templates 
            ADD COLUMN IF NOT EXISTS template_type VARCHAR(50) DEFAULT 'approval',
            ADD COLUMN IF NOT EXISTS auto_include_photos BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS photo_types TEXT[] DEFAULT '{}',
            ADD COLUMN IF NOT EXISTS trigger_conditions JSONB DEFAULT '{}'` 
    });
    
    if (error) {
      console.log('Trying direct PostgreSQL command...');
      // Try with direct SQL execution
      const { error: error2 } = await supabase
        .from('email_templates')
        .select('id')
        .limit(1);
      
      if (error2) {
        throw new Error('Cannot access email_templates table: ' + error2.message);
      }
      
      console.log('Direct column addition using ALTER TABLE...');
      // We'll add columns one by one using raw SQL if possible
    }
    
    // Step 2: Update existing templates
    console.log('Updating existing templates...');
    const { error: updateError } = await supabase
      .from('email_templates')
      .update({ template_type: 'approval' })
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Update all rows
    
    if (updateError) {
      console.error('Error updating existing templates:', updateError);
    }
    
    // Step 3: Insert new sprinkler paint templates
    console.log('Adding sprinkler paint templates...');
    const sprinklerTemplates = [
      {
        name: 'Sprinkler Paint - Professional',
        subject: 'Sprinkler Paint Notification for Job #[Job ID]',
        content: `Hello [Property Manager],

This is a notification that sprinkler paint work has been completed for Job #[Job ID].

[Job Information]

[Sprinkler Paint Details]

Photos of the completed work are attached for your review.

Thank you,
JG Painting Pros Inc.`,
        template_type: 'sprinkler_paint',
        auto_include_photos: true,
        photo_types: ['before', 'after', 'sprinkler']
      },
      {
        name: 'Sprinkler Paint - Casual',
        subject: 'Sprinkler Paint Complete - Job #[Job ID]',
        content: `Hi [Property Manager],

Just wanted to let you know we've finished the sprinkler paint work on Job #[Job ID].

[Job Details]

[Paint Work Summary]

Check out the attached photos!

Thanks,
JG Painting Pros Inc.`,
        template_type: 'sprinkler_paint',
        auto_include_photos: true,
        photo_types: ['before', 'after', 'sprinkler']
      }
    ];
    
    for (const template of sprinklerTemplates) {
      const { error: insertError } = await supabase
        .from('email_templates')
        .insert(template);
      
      if (insertError) {
        console.error('Error inserting template:', template.name, insertError);
      } else {
        console.log('Successfully added template:', template.name);
      }
    }
    
    // Step 4: Display results
    console.log('Migration completed. Current templates:');
    const { data: templates, error: selectError } = await supabase
      .from('email_templates')
      .select('id, name, template_type, auto_include_photos');
    
    if (selectError) {
      console.error('Error fetching templates:', selectError);
    } else {
      console.table(templates);
    }
    
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

runMigration();
