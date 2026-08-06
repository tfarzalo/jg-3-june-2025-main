-- Keep the topbar bell focused on activity performed by other users.
-- Existing activity notifications authored by their recipient are removed, and
-- the feed view/trigger both enforce that rule going forward.

DELETE FROM notifications n
USING activity_log al
WHERE n.activity_log_id = al.id
  AND al.changed_by IS NOT NULL
  AND n.user_id = al.changed_by;

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'job',
    'property',
    'property_group',
    'work_order',
    'callback',
    'note',
    'job_phase_change',
    'contact',
    'file',
    'invoice',
    'email',
    'user',
    'other',
    'job_status_change',
    'new_job_request'
  ));

ALTER TABLE email_logs
  ADD COLUMN IF NOT EXISTS sent_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION log_email_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_work_order_label TEXT;
  v_unit_number TEXT;
  v_property_name TEXT;
  v_title TEXT;
BEGIN
  IF NEW.job_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT format('WO-%s', lpad(j.work_order_num::text, 6, '0')),
         j.unit_number,
         p.property_name
  INTO v_work_order_label, v_unit_number, v_property_name
  FROM jobs j
  LEFT JOIN properties p ON p.id = j.property_id
  WHERE j.id = NEW.job_id;

  v_title := CASE
    WHEN COALESCE(NEW.notification_type, NEW.template_type) = 'sub_assignment' THEN 'Assignment email sent'
    WHEN COALESCE(NEW.notification_type, NEW.template_type) = 'extra_charges' THEN 'Approval email sent'
    ELSE 'Email sent'
  END;

  PERFORM log_activity(
    'email',
    NEW.id,
    'sent',
    format('%s to %s%s',
      v_title,
      COALESCE(NEW.recipient_email, 'recipient'),
      CASE
        WHEN v_work_order_label IS NOT NULL
        THEN format(' for %s • %s - Unit %s',
          v_work_order_label,
          COALESCE(v_property_name, 'Unknown Property'),
          COALESCE(v_unit_number, 'Unknown Unit')
        )
        ELSE ''
      END
    ),
    jsonb_build_object(
      'job_id', NEW.job_id,
      'email_log_id', NEW.id,
      'event_type', 'email_sent',
      'title', v_title,
      'recipient_email', NEW.recipient_email,
      'cc_emails', NEW.cc_emails,
      'bcc_emails', NEW.bcc_emails,
      'subject', NEW.subject,
      'template_type', COALESCE(NEW.notification_type, NEW.template_type),
      'work_order_label', v_work_order_label,
      'property_name', v_property_name,
      'unit_number', v_unit_number
    ),
    NEW.sent_by
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS log_email_activity_trigger ON email_logs;
CREATE TRIGGER log_email_activity_trigger
  AFTER INSERT ON email_logs
  FOR EACH ROW
  EXECUTE FUNCTION log_email_activity();

CREATE OR REPLACE FUNCTION create_notifications_from_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_notification_title TEXT;
  v_notification_message TEXT;
  v_preference_key TEXT;
  v_user_record RECORD;
  v_creator_id UUID;
BEGIN
  v_creator_id := NEW.changed_by;

  CASE NEW.entity_type
    WHEN 'job' THEN
      v_notification_title := 'New Job Created';
      v_notification_message := NEW.description;
      v_preference_key := CASE
        WHEN NEW.action IN ('approved', 'rejected')
             AND (
               NEW.metadata ? 'decision'
               OR NEW.metadata ? 'subcontractor_id'
               OR NEW.description ILIKE '%assignment%'
             )
        THEN 'assignment_responses'
        WHEN NEW.action = 'created' THEN 'new_job_requests'
        ELSE 'system_alerts'
      END;
    WHEN 'property' THEN
      v_notification_title := 'New Property Created';
      v_notification_message := NEW.description;
      v_preference_key := 'properties';
    WHEN 'property_group' THEN
      v_notification_title := 'New Property Group Created';
      v_notification_message := NEW.description;
      v_preference_key := 'properties';
    WHEN 'work_order' THEN
      v_notification_title := 'New Work Order Created';
      v_notification_message := NEW.description;
      v_preference_key := 'work_order_submissions';
    WHEN 'callback' THEN
      v_notification_title := 'New Callback Scheduled';
      v_notification_message := NEW.description;
      v_preference_key := 'callbacks';
    WHEN 'note' THEN
      v_notification_title := 'New Note Added';
      v_notification_message := NEW.description;
      v_preference_key := 'notes';
    WHEN 'job_phase_change' THEN
      v_notification_title := CASE
        WHEN COALESCE(NEW.metadata->>'change_reason', NEW.description) ILIKE '%extra charges approved%'
          OR COALESCE(NEW.metadata->>'change_reason', NEW.description) ILIKE '%extra charges declined%'
          OR COALESCE(NEW.metadata->>'change_reason', NEW.description) ILIKE '%extra charges rejected%'
        THEN 'Approval Response'
        ELSE 'Job Phase Changed'
      END;
      v_notification_message := NEW.description;
      v_preference_key := CASE
        WHEN v_notification_title = 'Approval Response' THEN 'approval_responses'
        ELSE 'job_phase_changes'
      END;
    WHEN 'contact' THEN
      v_notification_title := 'New Contact Created';
      v_notification_message := NEW.description;
      v_preference_key := 'contacts';
    WHEN 'email' THEN
      v_notification_title := COALESCE(NEW.metadata->>'title', 'Email Sent');
      v_notification_message := NEW.description;
      v_preference_key := 'email_activity';
    WHEN 'file' THEN
      v_notification_title := COALESCE(NEW.metadata->>'title', 'File Activity');
      v_notification_message := NEW.description;
      v_preference_key := 'files';
    ELSE
      v_notification_title := COALESCE(NEW.metadata->>'title', 'New Activity');
      v_notification_message := NEW.description;
      v_preference_key := 'system_alerts';
  END CASE;

  FOR v_user_record IN
    SELECT id, notification_settings
    FROM profiles
    WHERE role IN ('admin', 'jg_management', 'is_super_admin', 'assistant_manager')
      AND (
        v_creator_id IS NULL
        OR id IS DISTINCT FROM v_creator_id
      )
      AND COALESCE(
        (notification_settings->>v_preference_key)::boolean,
        CASE
          WHEN v_preference_key = 'work_order_submissions'
          THEN (notification_settings->>'work_orders')::boolean
          ELSE NULL
        END,
        true
      ) = true
  LOOP
    INSERT INTO notifications (
      user_id,
      activity_log_id,
      title,
      message,
      type,
      entity_id,
      job_id,
      metadata
    ) VALUES (
      v_user_record.id,
      NEW.id,
      v_notification_title,
      v_notification_message,
      NEW.entity_type,
      NEW.entity_id,
      COALESCE(
        CASE
          WHEN NEW.metadata->>'job_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          THEN (NEW.metadata->>'job_id')::uuid
          ELSE NULL
        END,
        CASE WHEN NEW.entity_type = 'job' THEN NEW.entity_id ELSE NULL END
      ),
      NEW.metadata
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE VIEW notifications_view AS
SELECT *
FROM (
  SELECT DISTINCT ON (n.user_id, COALESCE(n.activity_log_id, n.id))
    n.*,
    p.full_name as creator_name,
    p.email as creator_email,
    al.action as activity_action,
    al.metadata as activity_metadata,
    al.changed_by as creator_id
  FROM notifications n
  LEFT JOIN activity_log al ON n.activity_log_id = al.id
  LEFT JOIN profiles p ON al.changed_by = p.id
  WHERE al.changed_by IS NULL
     OR n.user_id IS DISTINCT FROM al.changed_by
  ORDER BY n.user_id, COALESCE(n.activity_log_id, n.id), n.created_at DESC
) deduped
ORDER BY deduped.created_at DESC;
