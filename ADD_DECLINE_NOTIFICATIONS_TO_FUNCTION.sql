-- =====================================================
-- UPDATED: process_decline_token with Notifications
-- =====================================================
-- This version adds user_notifications (matching approval flow)
-- It uses the EXISTING user_notifications table structure
-- NO new tables are created
-- =====================================================

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
  v_property_name TEXT;
  v_unit_number TEXT;
  v_result JSON;
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

  -- Get the work order number, current phase, and property details
  SELECT 
    j.work_order_num, 
    j.current_phase_id, 
    jp.job_phase_label,
    COALESCE((v_token_data.extra_charges_data->'job_details'->>'property_name'), p.property_name),
    COALESCE((v_token_data.extra_charges_data->'job_details'->>'unit_number'), j.unit_number)
  INTO v_job_work_order_num, v_current_phase_id, v_current_phase_label, v_property_name, v_unit_number
  FROM jobs j
  LEFT JOIN job_phases jp ON jp.id = j.current_phase_id
  LEFT JOIN properties p ON p.id = j.property_id
  WHERE j.id = v_token_data.job_id;

  -- Mark token as used with decline decision
  UPDATE approval_tokens
  SET used_at = NOW(),
      decision = 'declined',
      decision_at = NOW(),
      decline_reason = p_decline_reason
  WHERE token = p_token;

  -- Create notifications for admin and management users
  -- This uses the EXISTING user_notifications table (same as approval function)
  INSERT INTO user_notifications (
    user_id,
    title,
    message,
    type,
    reference_id,
    reference_type,
    is_read,
    created_at
  )
  SELECT 
    p.id,
    'Extra Charges Declined',
    format('Extra charges for Job #%s at %s Unit %s have been declined by %s%s', 
           v_job_work_order_num::text,
           COALESCE(v_property_name, 'Unknown Property'),
           COALESCE(v_unit_number, 'Unknown Unit'),
           COALESCE(v_token_data.approver_name, v_token_data.approver_email),
           CASE 
             WHEN p_decline_reason IS NOT NULL AND p_decline_reason != '' 
             THEN '. Reason: ' || p_decline_reason
             ELSE ''
           END),
    'decline',
    v_token_data.job_id,
    'job',
    false,
    NOW()
  FROM profiles p
  WHERE p.role IN ('admin', 'jg_management')
    OR LOWER(p.role) ILIKE '%admin%'
    OR LOWER(p.role) ILIKE '%management%';

  -- Build success response
  v_result := json_build_object(
    'success', true,
    'message', 'Extra Charges have been declined',
    'job_id', v_token_data.job_id,
    'work_order_num', v_job_work_order_num,
    'current_phase', v_current_phase_label,
    'decision', 'declined',
    'decline_reason', p_decline_reason
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.process_decline_token(VARCHAR, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.process_decline_token(VARCHAR, TEXT) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.process_decline_token(VARCHAR, TEXT) IS 
  'Processes decline action from approval email link. Marks Extra Charges as declined and creates notifications for admin/management users using the existing user_notifications table.';

-- Verify
SELECT 
  'Function updated with notifications!' as status,
  routine_name,
  pg_get_function_arguments(p.oid) as arguments
FROM information_schema.routines r
JOIN pg_proc p ON p.proname = r.routine_name
WHERE routine_schema = 'public'
  AND routine_name = 'process_decline_token';

-- =====================================================
-- VERIFICATION: Check that user_notifications table exists
-- =====================================================
SELECT 
  'Verification: user_notifications table exists' as check_result,
  COUNT(*) as column_count
FROM information_schema.columns
WHERE table_name = 'user_notifications';

-- This should return column_count > 0 if table exists
