/*
  # Rollback Activity Log and Notification System (WITHOUT DATA LOSS)

  ## Purpose
  This script safely disables the activity log and notification systems
  WITHOUT deleting any data or affecting existing functionality.

  ## What This Does
  1. Drops all triggers that log to activity_log
  2. Drops all triggers that create notifications
  3. Keeps all tables and data intact
  4. Keeps all functions intact (in case they're needed later)
  5. Allows system to function as it did before these features were added

  ## Safety
  - NO DATA IS DELETED
  - NO TABLES ARE DROPPED
  - Can be re-enabled by re-running the migration files
  - Job creation, updates, and all other operations will work normally
*/

-- ========================================
-- DISABLE ACTIVITY LOG TRIGGERS
-- ========================================

-- Drop trigger on jobs table
DROP TRIGGER IF EXISTS log_job_creation_trigger ON jobs;

-- Drop trigger on properties table
DROP TRIGGER IF EXISTS log_property_creation_trigger ON properties;

-- Drop trigger on property_management_groups table
DROP TRIGGER IF EXISTS log_property_group_creation_trigger ON property_management_groups;

-- Drop trigger on work_orders table
DROP TRIGGER IF EXISTS log_work_order_creation_trigger ON work_orders;

-- Drop trigger on callbacks table (if exists)
DROP TRIGGER IF EXISTS log_callback_creation_trigger ON callbacks;

-- Drop trigger on notes table (if exists)
DROP TRIGGER IF EXISTS log_note_creation_trigger ON notes;

-- Drop trigger on contacts table
DROP TRIGGER IF EXISTS log_contact_creation_trigger ON contacts;

-- Drop trigger on job_phase_changes table
DROP TRIGGER IF EXISTS log_job_phase_change_trigger ON job_phase_changes;

-- ========================================
-- DISABLE NOTIFICATION TRIGGERS
-- ========================================

-- Drop trigger on jobs table for notifications
DROP TRIGGER IF EXISTS trigger_notify_job_created ON jobs;
DROP TRIGGER IF EXISTS trigger_notify_job_updated ON jobs;

-- Drop trigger on properties table for notifications
DROP TRIGGER IF EXISTS trigger_notify_property_created ON properties;
DROP TRIGGER IF EXISTS trigger_notify_property_updated ON properties;

-- Drop trigger on property_management_groups table for notifications
DROP TRIGGER IF EXISTS trigger_notify_property_group_created ON property_management_groups;

-- Drop trigger on work_orders table for notifications
DROP TRIGGER IF EXISTS trigger_notify_work_order_created ON work_orders;

-- Drop trigger on job_phase_changes table for notifications
DROP TRIGGER IF EXISTS trigger_notify_phase_change ON job_phase_changes;

-- Drop trigger on callbacks table for notifications (if exists)
DROP TRIGGER IF EXISTS trigger_notify_callback_created ON callbacks;

-- Drop trigger on notes table for notifications (if exists)
DROP TRIGGER IF EXISTS trigger_notify_note_created ON notes;

-- Drop trigger on contacts table for notifications
DROP TRIGGER IF EXISTS trigger_notify_contact_created ON contacts;

-- ========================================
-- VERIFICATION
-- ========================================

-- Show remaining triggers on critical tables
SELECT 
  'VERIFICATION' as section,
  'Remaining triggers on jobs table' as description;

SELECT 
  t.tgname as trigger_name,
  'jobs' as table_name
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE c.relname = 'jobs'
  AND t.tgname NOT LIKE 'pg_%'
  AND t.tgname NOT LIKE 'RI_%';

SELECT 
  'VERIFICATION' as section,
  'Remaining triggers on properties table' as description;

SELECT 
  t.tgname as trigger_name,
  'properties' as table_name
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE c.relname = 'properties'
  AND t.tgname NOT LIKE 'pg_%'
  AND t.tgname NOT LIKE 'RI_%';

-- ========================================
-- STATUS REPORT
-- ========================================

SELECT 
  'ROLLBACK COMPLETE' as status,
  'All activity log and notification triggers have been disabled' as message,
  'No data has been deleted' as safety_note,
  'Tables activity_log and notifications still exist with all data' as data_status,
  'Job creation should now work normally' as expected_result;

-- Show what tables still exist
SELECT 
  'TABLE STATUS' as section,
  table_name,
  CASE 
    WHEN table_name = 'activity_log' THEN 'Contains all historical activity records'
    WHEN table_name = 'notifications' THEN 'Contains all notification records'
    ELSE 'Core system table'
  END as description
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('activity_log', 'notifications', 'jobs', 'properties')
ORDER BY table_name;
