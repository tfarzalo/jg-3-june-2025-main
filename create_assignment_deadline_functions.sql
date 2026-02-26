-- =====================================================
-- Step 2: Create Assignment Deadline Functions
-- =====================================================
-- Run this SECOND (after add_assignment_deadline_columns.sql)
-- Purpose: Create all database functions for assignment deadline management

-- =====================================================
-- Function 1: Calculate Assignment Deadline
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_assignment_deadline(p_assigned_at TIMESTAMPTZ)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
AS $$
DECLARE
  v_assigned_et TIMESTAMP;
  v_deadline_et TIMESTAMP;
  v_day_of_week INT;
BEGIN
  -- Convert assigned timestamp to Eastern Time (without timezone)
  v_assigned_et := (p_assigned_at AT TIME ZONE 'America/New_York')::TIMESTAMP;
  
  -- Get the date portion in ET and set time to 3:30 PM (15:30)
  v_deadline_et := date_trunc('day', v_assigned_et) + INTERVAL '15 hours 30 minutes';
  
  -- Check if assigned time is already past 3:30 PM ET
  IF v_assigned_et >= v_deadline_et THEN
    -- Move deadline to next day at 3:30 PM ET
    v_deadline_et := v_deadline_et + INTERVAL '1 day';
    
    -- Get day of week (0 = Sunday, 6 = Saturday)
    v_day_of_week := EXTRACT(DOW FROM v_deadline_et);
    
    -- If next day is Saturday, move to Monday
    IF v_day_of_week = 6 THEN
      v_deadline_et := v_deadline_et + INTERVAL '2 days';
    -- If next day is Sunday, move to Monday  
    ELSIF v_day_of_week = 0 THEN
      v_deadline_et := v_deadline_et + INTERVAL '1 day';
    END IF;
  ELSE
    -- Deadline is today at 3:30 PM ET
    -- But check if today is weekend
    v_day_of_week := EXTRACT(DOW FROM v_deadline_et);
    
    -- If today is Saturday, move to Monday
    IF v_day_of_week = 6 THEN
      v_deadline_et := v_deadline_et + INTERVAL '2 days';
    -- If today is Sunday, move to Monday
    ELSIF v_day_of_week = 0 THEN
      v_deadline_et := v_deadline_et + INTERVAL '1 day';
    END IF;
  END IF;
  
  -- Convert the ET timestamp back to UTC with proper timezone handling
  -- This creates a timestamptz from the ET time, treating it as if it's in America/New_York
  RETURN timezone('America/New_York', v_deadline_et);
END;
$$;

COMMENT ON FUNCTION calculate_assignment_deadline IS 
'Calculates assignment deadline as 3:30 PM ET on the day assigned. 
If assigned after 3:30 PM ET or on weekend, moves to next business day at 3:30 PM ET.
Input and output are in UTC, but calculation is done in ET timezone.';


-- =====================================================
-- Function 2: Assign Job to Subcontractor
-- =====================================================
CREATE OR REPLACE FUNCTION assign_job_to_subcontractor(
  p_job_id UUID,
  p_subcontractor_id UUID,
  p_assigned_by UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_assigned_at TIMESTAMPTZ;
  v_deadline TIMESTAMPTZ;
  v_subcontractor_name TEXT;
  v_subcontractor_email TEXT;
  v_work_order_num INTEGER;
  v_property_name TEXT;
  v_deadline_formatted TEXT;
  v_result JSON;
BEGIN
  -- Get current timestamp
  v_assigned_at := NOW();
  
  -- Calculate deadline using helper function
  v_deadline := calculate_assignment_deadline(v_assigned_at);
  
  -- Format deadline for notification
  v_deadline_formatted := to_char(v_deadline AT TIME ZONE 'America/New_York', 'Mon DD, YYYY at 3:30 PM ET');
  
  -- Get subcontractor details
  SELECT u.full_name, u.email
  INTO v_subcontractor_name, v_subcontractor_email
  FROM users u
  WHERE u.id = p_subcontractor_id;
  
  IF v_subcontractor_name IS NULL THEN
    v_subcontractor_name := 'Unknown Subcontractor';
  END IF;
  
  -- Get job details
  SELECT j.work_order_num, p.name
  INTO v_work_order_num, v_property_name
  FROM jobs j
  LEFT JOIN properties p ON j.property_id = p.id
  WHERE j.id = p_job_id;
  
  -- Update job with assignment details
  UPDATE jobs
  SET 
    assigned_to = p_subcontractor_id,
    assigned_at = v_assigned_at,
    assignment_deadline = v_deadline,
    status = 'pending',
    updated_at = v_assigned_at
  WHERE id = p_job_id;
  
  -- Log activity
  INSERT INTO job_activity_logs (
    job_id,
    user_id,
    action,
    description,
    created_at
  ) VALUES (
    p_job_id,
    p_assigned_by,
    'job_assigned',
    format('Job assigned to %s - Must respond by 3:30 PM ET on %s', 
           v_subcontractor_name,
           to_char(v_deadline AT TIME ZONE 'America/New_York', 'Mon DD, YYYY')),
    v_assigned_at
  );
  
  -- Create in-app notification
  BEGIN
    INSERT INTO user_notifications (
      user_id,
      title,
      message,
      type,
      link,
      created_at
    ) VALUES (
      p_subcontractor_id,
      format('New Job Assignment: WO-%s', lpad(v_work_order_num::text, 6, '0')),
      format('You have been assigned work order #%s at %s. You must accept or decline this job by %s.',
             lpad(v_work_order_num::text, 6, '0'),
             COALESCE(v_property_name, 'Property'),
             v_deadline_formatted),
      'job_assignment',
      format('/jobs/%s', p_job_id),
      v_assigned_at
    );
  EXCEPTION
    WHEN undefined_table THEN NULL;
    WHEN OTHERS THEN RAISE WARNING 'Failed to create notification: %', SQLERRM;
  END;
  
  -- Return result
  SELECT json_build_object(
    'success', true,
    'job_id', p_job_id,
    'work_order_num', v_work_order_num,
    'subcontractor_id', p_subcontractor_id,
    'subcontractor_name', v_subcontractor_name,
    'assigned_at', v_assigned_at,
    'deadline', v_deadline,
    'deadline_et', v_deadline_formatted,
    'message', format('Job WO-%s assigned to %s. Deadline: %s', 
                     lpad(v_work_order_num::text, 6, '0'),
                     v_subcontractor_name, 
                     v_deadline_formatted)
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION assign_job_to_subcontractor IS 
'Assigns a job to a subcontractor and sets assignment deadline to 3:30 PM ET same day (or next business day if assigned after 3:30 PM).';


-- =====================================================
-- Function 3: Accept Job Assignment
-- =====================================================
CREATE OR REPLACE FUNCTION accept_job_assignment(
  p_job_id UUID,
  p_subcontractor_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_subcontractor_name TEXT;
  v_work_order_num INTEGER;
  v_result JSON;
BEGIN
  -- Verify this subcontractor is assigned to this job
  IF NOT EXISTS (
    SELECT 1 FROM jobs 
    WHERE id = p_job_id 
    AND assigned_to = p_subcontractor_id
    AND assignment_status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Job not found, not assigned to you, or already responded to';
  END IF;
  
  -- Get subcontractor name and work order number
  SELECT 
    p.full_name,
    j.work_order_num
  INTO v_subcontractor_name, v_work_order_num
  FROM profiles p
  CROSS JOIN jobs j
  WHERE p.id = p_subcontractor_id
  AND j.id = p_job_id;
  
  IF v_subcontractor_name IS NULL THEN
    v_subcontractor_name := 'Unknown Subcontractor';
  END IF;
  
  -- Update job
  UPDATE jobs
  SET 
    assignment_status = 'accepted',
    assignment_deadline = NULL, -- Clear deadline once accepted
    updated_at = NOW()
  WHERE id = p_job_id;
  
  -- Log activity
  INSERT INTO job_activity_logs (
    job_id,
    user_id,
    action,
    description,
    created_at
  ) VALUES (
    p_job_id,
    p_subcontractor_id,
    'assignment_accepted',
    format('Job assignment accepted by %s', v_subcontractor_name),
    NOW()
  );
  
  SELECT json_build_object(
    'success', true,
    'job_id', p_job_id,
    'work_order_num', v_work_order_num,
    'status', 'accepted',
    'message', format('Job WO-%s accepted successfully', lpad(v_work_order_num::text, 6, '0'))
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION accept_job_assignment IS 
'Allows subcontractor to accept a pending job assignment. Clears deadline and updates status to accepted.';


-- =====================================================
-- Function 4: Decline Job Assignment
-- =====================================================
CREATE OR REPLACE FUNCTION decline_job_assignment(
  p_job_id UUID,
  p_subcontractor_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_subcontractor_name TEXT;
  v_work_order_num INTEGER;
  v_result JSON;
BEGIN
  -- Verify this subcontractor is assigned to this job
  IF NOT EXISTS (
    SELECT 1 FROM jobs 
    WHERE id = p_job_id 
    AND assigned_to = p_subcontractor_id
    AND assignment_status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Job not found, not assigned to you, or already responded to';
  END IF;
  
  -- Get subcontractor name and work order number
  SELECT 
    p.full_name,
    j.work_order_num
  INTO v_subcontractor_name, v_work_order_num
  FROM profiles p
  CROSS JOIN jobs j
  WHERE p.id = p_subcontractor_id
  AND j.id = p_job_id;
  
  IF v_subcontractor_name IS NULL THEN
    v_subcontractor_name := 'Unknown Subcontractor';
  END IF;
  
  -- Update job - return to unassigned pool
  UPDATE jobs
  SET 
    assignment_status = 'declined',
    assigned_to = NULL,
    assigned_at = NULL,
    assignment_deadline = NULL,
    updated_at = NOW()
  WHERE id = p_job_id;
  
  -- Log activity
  INSERT INTO job_activity_logs (
    job_id,
    user_id,
    action,
    description,
    created_at
  ) VALUES (
    p_job_id,
    p_subcontractor_id,
    'assignment_declined',
    format('Job assignment declined by %s%s', 
           v_subcontractor_name,
           CASE WHEN p_reason IS NOT NULL AND p_reason != '' 
                THEN format(' - Reason: %s', p_reason) 
                ELSE '' 
           END),
    NOW()
  );
  
  SELECT json_build_object(
    'success', true,
    'job_id', p_job_id,
    'work_order_num', v_work_order_num,
    'status', 'declined',
    'message', format('Job WO-%s declined and returned to unassigned pool', lpad(v_work_order_num::text, 6, '0'))
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION decline_job_assignment IS 
'Allows subcontractor to decline a pending job assignment. Returns job to unassigned pool.';


-- =====================================================
-- Function 5: Auto-Decline Expired Assignments
-- =====================================================
CREATE OR REPLACE FUNCTION auto_decline_expired_assignments()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_expired_job RECORD;
  v_count INTEGER := 0;
  v_job_ids UUID[] := ARRAY[]::UUID[];
  v_details JSONB[] := ARRAY[]::JSONB[];
BEGIN
  -- Find all jobs with expired deadlines
  FOR v_expired_job IN
    SELECT 
      j.id,
      j.assigned_to as subcontractor_id,
      j.work_order_num,
      j.assignment_deadline,
      COALESCE(p.full_name, 'Unknown Subcontractor') as subcontractor_name,
      prop.property_name
    FROM jobs j
    LEFT JOIN profiles p ON j.assigned_to = p.id
    LEFT JOIN properties prop ON j.property_id = prop.id
    WHERE j.assignment_status = 'pending'
    AND j.assignment_deadline < NOW()
    ORDER BY j.assignment_deadline ASC
  LOOP
    -- Update job - return to unassigned pool
    UPDATE jobs
    SET 
      assignment_status = 'auto_declined',
      assigned_to = NULL,
      assigned_at = NULL,
      assignment_deadline = NULL,
      updated_at = NOW()
    WHERE id = v_expired_job.id;
    
    -- Log activity (use subcontractor_id as user if available, otherwise use system)
    INSERT INTO job_activity_logs (
      job_id,
      user_id,
      action,
      description,
      created_at
    ) VALUES (
      v_expired_job.id,
      v_expired_job.subcontractor_id,
      'assignment_auto_declined',
      format('Job auto-declined - %s did not respond by 3:30 PM ET deadline (expired at %s)', 
             v_expired_job.subcontractor_name,
             to_char(v_expired_job.assignment_deadline AT TIME ZONE 'America/New_York', 'Mon DD, YYYY at HH12:MI PM')),
      NOW()
    );
    
    v_count := v_count + 1;
    v_job_ids := array_append(v_job_ids, v_expired_job.id);
    v_details := array_append(v_details, jsonb_build_object(
      'job_id', v_expired_job.id,
      'work_order_num', v_expired_job.work_order_num,
      'subcontractor_name', v_expired_job.subcontractor_name,
      'property_name', v_expired_job.property_name,
      'deadline_was', v_expired_job.assignment_deadline
    ));
  END LOOP;
  
  RETURN json_build_object(
    'success', true,
    'auto_declined_count', v_count,
    'job_ids', v_job_ids,
    'details', v_details,
    'processed_at', NOW()
  );
END;
$$;

COMMENT ON FUNCTION auto_decline_expired_assignments IS 
'Finds all jobs with assignment_status=pending and deadline past NOW(), 
auto-declines them, returns them to unassigned pool, and logs activity.
Should be called via cron job every 5 minutes.';


-- =====================================================
-- Verification Queries
-- =====================================================

-- Test calculate_assignment_deadline function
SELECT 
  'Test 1: Assigned at 9:00 AM ET' as test_case,
  calculate_assignment_deadline(TIMESTAMP '2026-02-25 14:00:00+00') as deadline_utc,
  (calculate_assignment_deadline(TIMESTAMP '2026-02-25 14:00:00+00') AT TIME ZONE 'America/New_York')::timestamp as deadline_et;

SELECT 
  'Test 2: Assigned at 3:15 PM ET' as test_case,
  calculate_assignment_deadline(TIMESTAMP '2026-02-25 20:15:00+00') as deadline_utc,
  (calculate_assignment_deadline(TIMESTAMP '2026-02-25 20:15:00+00') AT TIME ZONE 'America/New_York')::timestamp as deadline_et;

SELECT 
  'Test 3: Assigned at 4:00 PM ET' as test_case,
  calculate_assignment_deadline(TIMESTAMP '2026-02-25 21:00:00+00') as deadline_utc,
  (calculate_assignment_deadline(TIMESTAMP '2026-02-25 21:00:00+00') AT TIME ZONE 'America/New_York')::timestamp as deadline_et;

-- Show summary of functions created
SELECT 
  routine_name,
  routine_type,
  data_type as return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE '%assignment%'
ORDER BY routine_name;

-- Success message
SELECT 'All assignment deadline functions created successfully!' as status;
