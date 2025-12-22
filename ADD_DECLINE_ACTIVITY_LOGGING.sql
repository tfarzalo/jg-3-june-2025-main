-- =====================================================
-- COMPLETE DECLINE FUNCTIONALITY WITH ACTIVITY LOGGING
-- =====================================================
-- This migration adds activity logging and internal notifications
-- for Extra Charges decline workflow
-- =====================================================

-- Step 1: Drop and recreate the process_decline_token function with activity logging
DROP FUNCTION IF EXISTS public.process_decline_token(VARCHAR, TEXT);

CREATE OR REPLACE FUNCTION public.process_decline_token(
  p_token VARCHAR(255),
  p_decline_reason TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_data RECORD;
  v_job_work_order_num INTEGER;
  v_current_phase_id UUID;
  v_current_phase_label TEXT;
  v_activity_id UUID;
  v_notification_id UUID;
  v_result JSON;
  v_approver_name TEXT;
  v_approver_email TEXT;
BEGIN
  -- Get the approval token data
  SELECT * INTO v_token_data
  FROM approval_tokens
  WHERE token = p_token
    AND used_at IS NULL
    AND expires_at > NOW();

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Invalid or expired approval token'
    );
  END IF;

  -- Get the work order number and current phase for the job
  SELECT j.work_order_num, j.current_phase_id, jp.job_phase_label
  INTO v_job_work_order_num, v_current_phase_id, v_current_phase_label
  FROM jobs j
  LEFT JOIN job_phases jp ON jp.id = j.current_phase_id
  WHERE j.id = v_token_data.job_id;

  -- Get approver details
  v_approver_name := v_token_data.approver_name;
  v_approver_email := v_token_data.approver_email;

  -- Mark token as used with decline decision
  UPDATE approval_tokens
  SET used_at = NOW(),
      decision = 'declined',
      decision_at = NOW(),
      decline_reason = p_decline_reason
  WHERE token = p_token;

  -- Log the decline activity
  INSERT INTO activity_log (
    entity_type,
    entity_id,
    action,
    description,
    changed_by,
    metadata
  ) VALUES (
    'job',
    v_token_data.job_id,
    'rejected',
    format('Extra Charges declined by %s for Job #%s', 
      COALESCE(v_approver_name, v_approver_email, 'External User'),
      v_job_work_order_num
    ),
    NULL, -- External user, no auth.uid()
    jsonb_build_object(
      'work_order_num', v_job_work_order_num,
      'declined_by_name', v_approver_name,
      'declined_by_email', v_approver_email,
      'decline_reason', p_decline_reason,
      'approval_type', v_token_data.approval_type,
      'token', p_token,
      'phase_remained_at', v_current_phase_label
    )
  ) RETURNING id INTO v_activity_id;

  -- Create application-level notification for admins
  INSERT INTO notifications (
    type,
    title,
    message,
    recipient_id,
    entity_type,
    entity_id,
    activity_log_id,
    metadata
  )
  SELECT 
    'extra_charges_declined',
    format('Extra Charges Declined - Job #%s', v_job_work_order_num),
    format('%s declined extra charges for Job #%s%s',
      COALESCE(v_approver_name, v_approver_email, 'Property representative'),
      v_job_work_order_num,
      CASE 
        WHEN p_decline_reason IS NOT NULL AND p_decline_reason != '' 
        THEN '. Reason: ' || p_decline_reason
        ELSE ''
      END
    ),
    u.id,
    'job',
    v_token_data.job_id,
    v_activity_id,
    jsonb_build_object(
      'work_order_num', v_job_work_order_num,
      'declined_by_name', v_approver_name,
      'declined_by_email', v_approver_email,
      'decline_reason', p_decline_reason,
      'job_id', v_token_data.job_id
    )
  FROM auth.users u
  JOIN profiles p ON p.id = u.id
  WHERE LOWER(p.role) IN ('admin', 'management', 'jg management')
  RETURNING id INTO v_notification_id;

  -- Build success response
  v_result := json_build_object(
    'success', true,
    'message', 'Extra Charges have been declined',
    'job_id', v_token_data.job_id,
    'work_order_num', v_job_work_order_num,
    'current_phase', v_current_phase_label,
    'decision', 'declined',
    'decline_reason', p_decline_reason,
    'activity_logged', true,
    'activity_id', v_activity_id,
    'notifications_sent', true
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'An error occurred: ' || SQLERRM
    );
END;
$$;

-- Step 2: Grant permissions
GRANT EXECUTE ON FUNCTION public.process_decline_token(VARCHAR, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.process_decline_token(VARCHAR, TEXT) TO authenticated;

-- Step 3: Add comment
COMMENT ON FUNCTION public.process_decline_token(VARCHAR, TEXT) IS 
  'Processes decline action from approval email link. Marks Extra Charges as declined, logs activity, and sends notifications to admins.';

-- Step 4: Verify the function
SELECT 
  'Function updated with activity logging!' as status,
  routine_name,
  pg_get_function_arguments(p.oid) as arguments
FROM information_schema.routines r
JOIN pg_proc p ON p.proname = r.routine_name
WHERE routine_schema = 'public'
  AND routine_name = 'process_decline_token';

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check activity_log table exists and has correct structure
SELECT 
  'Activity log table check' as check_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'activity_log'
  AND column_name IN ('entity_type', 'entity_id', 'action', 'description', 'changed_by', 'metadata')
ORDER BY column_name;

-- Check notifications table exists
SELECT 
  'Notifications table check' as check_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'notifications'
  AND column_name IN ('type', 'title', 'message', 'activity_log_id', 'entity_type', 'entity_id')
ORDER BY column_name;

-- =====================================================
-- TESTING QUERIES (Run after applying fix)
-- =====================================================

-- After a decline is processed, check the activity log:
/*
SELECT 
  al.*,
  al.metadata->>'declined_by_name' as declined_by,
  al.metadata->>'decline_reason' as reason
FROM activity_log al
WHERE entity_type = 'job' 
  AND action = 'rejected'
ORDER BY created_at DESC
LIMIT 5;
*/

-- Check notifications created:
/*
SELECT 
  n.*,
  p.email as recipient_email,
  p.full_name as recipient_name
FROM notifications n
JOIN profiles p ON p.id = n.recipient_id
WHERE n.type = 'extra_charges_declined'
ORDER BY n.created_at DESC
LIMIT 10;
*/

-- Check approval tokens with decline data:
/*
SELECT 
  at.token,
  at.decision,
  at.decision_at,
  at.decline_reason,
  at.approver_name,
  at.approver_email,
  j.work_order_num
FROM approval_tokens at
JOIN jobs j ON j.id = at.job_id
WHERE at.decision = 'declined'
ORDER BY at.decision_at DESC
LIMIT 5;
*/
