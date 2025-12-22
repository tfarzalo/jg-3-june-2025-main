-- Cleanup script to fix view conflicts
-- Run this first if you're still getting view column errors

-- Drop all views that might be causing conflicts
DROP VIEW IF EXISTS all_contacts_view CASCADE;
DROP VIEW IF EXISTS lead_management_view CASCADE;

-- Check what views exist
SELECT viewname, definition 
FROM pg_views 
WHERE viewname LIKE '%contact%' OR viewname LIKE '%lead%';
