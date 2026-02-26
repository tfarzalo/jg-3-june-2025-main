-- =====================================================
-- Add Assignment Deadline Email Notification
-- =====================================================
-- This adds email notifications when jobs are assigned with deadline info

-- Update the assign_job_to_subcontractor function to include notification
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
  
  -- Send email notification (if email system is configured)
  -- This will be picked up by your email notification system
  BEGIN
    -- Try to insert into email queue if it exists
    INSERT INTO email_notifications (
      recipient_email,
      recipient_name,
      subject,
      body_html,
      body_text,
      template_name,
      template_data,
      created_at
    ) VALUES (
      v_subcontractor_email,
      v_subcontractor_name,
      format('Job Assignment: WO-%s - Response Required by 3:30 PM ET', lpad(v_work_order_num::text, 6, '0')),
      format('<h2>New Job Assignment</h2>
              <p>Hello %s,</p>
              <p>You have been assigned a new job:</p>
              <ul>
                <li><strong>Work Order:</strong> WO-%s</li>
                <li><strong>Property:</strong> %s</li>
                <li><strong>Deadline to Respond:</strong> <strong style="color: #d32f2f;">%s</strong></li>
              </ul>
              <p><strong>⚠️ IMPORTANT: You must accept or decline this job by %s.</strong></p>
              <p>If you do not respond by the deadline, the job will be automatically declined and may be assigned to another subcontractor.</p>
              <p><a href="%s/jobs/%s" style="background-color: #2196F3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block; margin-top: 10px;">View Job Details</a></p>
              <p>Thank you!</p>',
             v_subcontractor_name,
             lpad(v_work_order_num::text, 6, '0'),
             COALESCE(v_property_name, 'Property'),
             v_deadline_formatted,
             v_deadline_formatted,
             current_setting('app.settings.frontend_url', true),
             p_job_id),
      format('New Job Assignment

Hello %s,

You have been assigned a new job:
- Work Order: WO-%s
- Property: %s
- Deadline to Respond: %s

⚠️ IMPORTANT: You must accept or decline this job by %s.

If you do not respond by the deadline, the job will be automatically declined and may be assigned to another subcontractor.

View job details: %s/jobs/%s

Thank you!',
             v_subcontractor_name,
             lpad(v_work_order_num::text, 6, '0'),
             COALESCE(v_property_name, 'Property'),
             v_deadline_formatted,
             v_deadline_formatted,
             current_setting('app.settings.frontend_url', true),
             p_job_id),
      'job_assignment',
      json_build_object(
        'work_order_num', v_work_order_num,
        'property_name', v_property_name,
        'deadline', v_deadline_formatted,
        'job_id', p_job_id
      ),
      v_assigned_at
    );
  EXCEPTION
    WHEN undefined_table THEN
      -- Email notifications table doesn't exist, skip email
      NULL;
    WHEN OTHERS THEN
      -- Log error but don't fail the assignment
      RAISE WARNING 'Failed to queue email notification: %', SQLERRM;
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
'Assigns a job to a subcontractor, sets deadline to 3:30 PM ET, and sends email/in-app notification with deadline information.';

-- Success message
SELECT '✅ Assignment function updated with email notification including 3:30 PM ET deadline!' as status;
