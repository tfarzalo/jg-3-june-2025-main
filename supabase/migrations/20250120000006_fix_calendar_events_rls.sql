/*
  # Fix Calendar Events RLS Policies

  The calendar_events table is missing RLS policies, causing 403 Forbidden errors.
  This migration adds proper RLS policies for calendar events.

  1. Changes
    - Enable RLS on calendar_events table
    - Add policies for SELECT, INSERT, UPDATE, DELETE operations
    - Allow users to manage their own events
    - Allow admin/jg_management users to manage all events
*/

-- Enable RLS on calendar_events table
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "calendar_events_select_policy" ON calendar_events;
DROP POLICY IF EXISTS "calendar_events_insert_policy" ON calendar_events;
DROP POLICY IF EXISTS "calendar_events_update_policy" ON calendar_events;
DROP POLICY IF EXISTS "calendar_events_delete_policy" ON calendar_events;

-- Policy for SELECT operations
-- Users can read their own events, admin/jg_management can read all events
CREATE POLICY "calendar_events_select_policy"
ON calendar_events
FOR SELECT
TO authenticated
USING (
  created_by = auth.uid()
  OR created_by IS NULL  -- Allow system events (daily agenda)
  OR EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() 
    AND p.role IN ('admin', 'jg_management', 'is_super_admin')
  )
);

-- Policy for INSERT operations
-- Users can create events, admin/jg_management can create events for anyone
CREATE POLICY "calendar_events_insert_policy"
ON calendar_events
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() 
    AND p.role IN ('admin', 'jg_management', 'is_super_admin')
  )
);

-- Policy for UPDATE operations
-- Users can update their own events, admin/jg_management can update all events
CREATE POLICY "calendar_events_update_policy"
ON calendar_events
FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid()
  OR created_by IS NULL  -- Allow system events (daily agenda)
  OR EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() 
    AND p.role IN ('admin', 'jg_management', 'is_super_admin')
  )
)
WITH CHECK (
  created_by = auth.uid()
  OR created_by IS NULL  -- Allow system events (daily agenda)
  OR EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() 
    AND p.role IN ('admin', 'jg_management', 'is_super_admin')
  )
);

-- Policy for DELETE operations
-- Users can delete their own events, admin/jg_management can delete all events
CREATE POLICY "calendar_events_delete_policy"
ON calendar_events
FOR DELETE
TO authenticated
USING (
  created_by = auth.uid()
  OR created_by IS NULL  -- Allow system events (daily agenda)
  OR EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() 
    AND p.role IN ('admin', 'jg_management', 'is_super_admin')
  )
);

-- Add comments for documentation
COMMENT ON TABLE calendar_events IS 'Calendar events table with RLS policies for user access control';
