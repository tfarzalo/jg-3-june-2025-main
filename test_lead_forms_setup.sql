-- Test script to verify lead forms and contacts setup
-- Run this in Supabase SQL Editor after applying the migration

-- Test 1: Check if all tables exist
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('lead_forms', 'lead_form_fields', 'leads', 'lead_statuses', 'contacts')
ORDER BY table_name;

-- Test 2: Check lead statuses were created
SELECT 
  name,
  description,
  color,
  sort_order,
  is_active
FROM lead_statuses 
ORDER BY sort_order;

-- Test 3: Check RLS policies are enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('lead_forms', 'lead_form_fields', 'leads', 'lead_statuses', 'contacts');

-- Test 4: Check if view exists
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'lead_management_view';

-- Test 5: Test creating a sample form (admin only)
-- This will only work if you're logged in as an admin
INSERT INTO lead_forms (name, description, success_message, is_active, created_by)
VALUES (
  'Test Contact Form',
  'A sample contact form for testing',
  'Thank you for contacting us!',
  true,
  (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1)
) RETURNING id, name;

-- Test 6: Test adding fields to the form (admin only)
-- Replace the form_id with the actual ID from the previous query
INSERT INTO lead_form_fields (form_id, field_type, field_name, field_label, placeholder, is_required, sort_order)
VALUES 
  ((SELECT id FROM lead_forms WHERE name = 'Test Contact Form' LIMIT 1), 'text', 'first_name', 'First Name', 'Enter your first name', true, 0),
  ((SELECT id FROM lead_forms WHERE name = 'Test Contact Form' LIMIT 1), 'text', 'last_name', 'Last Name', 'Enter your last name', true, 1),
  ((SELECT id FROM lead_forms WHERE name = 'Test Contact Form' LIMIT 1), 'email', 'email', 'Email Address', 'Enter your email', true, 2),
  ((SELECT id FROM lead_forms WHERE name = 'Test Contact Form' LIMIT 1), 'phone', 'phone', 'Phone Number', 'Enter your phone number', false, 3),
  ((SELECT id FROM lead_forms WHERE name = 'Test Contact Form' LIMIT 1), 'textarea', 'message', 'Message', 'Tell us about your project', false, 4)
RETURNING field_name, field_label, field_type;

-- Test 7: Test submitting a lead (public access)
-- This simulates a form submission
INSERT INTO leads (form_id, status_id, form_data, source_url, ip_address, user_agent)
VALUES (
  (SELECT id FROM lead_forms WHERE name = 'Test Contact Form' LIMIT 1),
  (SELECT id FROM lead_statuses WHERE name = 'New Lead' LIMIT 1),
  '{"first_name": "John", "last_name": "Doe", "email": "john.doe@example.com", "phone": "555-1234", "message": "I need a quote for painting my house"}',
  'https://example.com/contact',
  '192.168.1.1'::inet,
  'Mozilla/5.0 (Test Browser)'
) RETURNING id, form_data;

-- Test 8: Check if contact was automatically created
SELECT 
  c.first_name,
  c.last_name,
  c.email,
  c.phone,
  l.status_id,
  ls.name as status_name
FROM contacts c
JOIN leads l ON c.lead_id = l.id
JOIN lead_statuses ls ON l.status_id = ls.id
WHERE c.first_name = 'John' AND c.last_name = 'Doe';

-- Test 9: Test the lead management view
SELECT 
  lead_id,
  form_name,
  status_name,
  first_name,
  last_name,
  email,
  lead_created_at
FROM lead_management_view
WHERE first_name = 'John' AND last_name = 'Doe';

-- Test 10: Clean up test data
-- Uncomment these lines to clean up after testing
-- DELETE FROM contacts WHERE first_name = 'John' AND last_name = 'Doe';
-- DELETE FROM leads WHERE form_data->>'first_name' = 'John';
-- DELETE FROM lead_form_fields WHERE form_id = (SELECT id FROM lead_forms WHERE name = 'Test Contact Form');
-- DELETE FROM lead_forms WHERE name = 'Test Contact Form';
