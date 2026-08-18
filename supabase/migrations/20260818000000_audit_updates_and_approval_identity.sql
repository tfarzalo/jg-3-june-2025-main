-- Improve audit coverage for business record edits and preserve the
-- approver identity typed on public extra-charge approval forms.

CREATE OR REPLACE FUNCTION public.log_activity(
  p_entity_type TEXT,
  p_entity_id UUID,
  p_action TEXT,
  p_description TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_changed_by UUID DEFAULT auth.uid()
)
RETURNS UUID AS $$
DECLARE
  v_activity_id UUID;
BEGIN
  INSERT INTO public.activity_log (entity_type, entity_id, action, description, changed_by, metadata)
  VALUES (p_entity_type, p_entity_id, p_action, p_description, p_changed_by, p_metadata)
  RETURNING id INTO v_activity_id;

  RETURN v_activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.audit_field_label(p_field TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_field
    WHEN 'property_id' THEN 'Property'
    WHEN 'unit_number' THEN 'Unit'
    WHEN 'unit_size_id' THEN 'Unit Size'
    WHEN 'job_type_id' THEN 'Job Category'
    WHEN 'description' THEN 'Description'
    WHEN 'scheduled_date' THEN 'Scheduled Date'
    WHEN 'status' THEN 'Status'
    WHEN 'assigned_to' THEN 'Assigned Subcontractor'
    WHEN 'invoice_sent' THEN 'Invoice Sent'
    WHEN 'invoice_paid' THEN 'Invoice Paid'
    WHEN 'purchase_order' THEN 'Purchase Order'
    WHEN 'property_name' THEN 'Property Name'
    WHEN 'address' THEN 'Address'
    WHEN 'address_2' THEN 'Address Line 2'
    WHEN 'city' THEN 'City'
    WHEN 'state' THEN 'State'
    WHEN 'zip' THEN 'Zip'
    WHEN 'property_management_group_id' THEN 'Management Group'
    WHEN 'community_manager_name' THEN 'Community Manager'
    WHEN 'maintenance_supervisor_name' THEN 'Maintenance Supervisor'
    WHEN 'ap_name' THEN 'Accounts Payable Contact'
    WHEN 'primary_contact_name' THEN 'Primary Contact'
    WHEN 'prepared_by' THEN 'Prepared By'
    WHEN 'submission_date' THEN 'Submission Date'
    WHEN 'is_occupied' THEN 'Occupied'
    WHEN 'is_full_paint' THEN 'Full Paint'
    WHEN 'paint_type' THEN 'Paint Type'
    WHEN 'has_sprinklers' THEN 'Sprinklers'
    WHEN 'sprinklers_painted' THEN 'Sprinklers Painted'
    WHEN 'painted_ceilings' THEN 'Painted Ceilings'
    WHEN 'painted_patio' THEN 'Painted Patio'
    WHEN 'painted_garage' THEN 'Painted Garage'
    WHEN 'painted_cabinets' THEN 'Painted Cabinets'
    WHEN 'painted_crown_molding' THEN 'Painted Crown Molding'
    WHEN 'painted_front_door' THEN 'Painted Front Door'
    WHEN 'has_accent_wall' THEN 'Accent Wall'
    WHEN 'accent_wall_type' THEN 'Accent Wall Type'
    WHEN 'accent_wall_count' THEN 'Accent Wall Count'
    WHEN 'has_extra_charges' THEN 'Extra Charges'
    WHEN 'extra_charges_description' THEN 'Extra Charges Description'
    WHEN 'extra_charges_line_items' THEN 'Extra Charge Line Items'
    WHEN 'misc_additional_cost_items' THEN 'Miscellaneous Additional Costs'
    WHEN 'additional_services' THEN 'Additional Services'
    WHEN 'repair_cost' THEN 'Repair Cost'
    WHEN 'repair_description' THEN 'Repair Description'
    WHEN 'additional_comments' THEN 'Additional Comments'
    ELSE initcap(replace(p_field, '_', ' '))
  END;
$$;

CREATE OR REPLACE FUNCTION public.audit_business_record_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entity_type TEXT := TG_ARGV[0];
  v_old JSONB := to_jsonb(OLD);
  v_new JSONB := to_jsonb(NEW);
  v_ignored_fields TEXT[] := ARRAY['updated_at'];
  v_changed_fields TEXT[];
  v_field_labels TEXT;
  v_entity_id UUID;
  v_job_id UUID;
  v_property_id UUID;
  v_property_name TEXT;
  v_unit_number TEXT;
  v_work_order_num INTEGER;
  v_work_order_label TEXT;
  v_title TEXT;
  v_description TEXT;
  v_old_values JSONB;
  v_new_values JSONB;
BEGIN
  IF v_entity_type = 'job' THEN
    v_ignored_fields := v_ignored_fields || ARRAY['current_phase_id'];
  END IF;

  SELECT array_agg(key ORDER BY key)
  INTO v_changed_fields
  FROM jsonb_object_keys(v_new) AS key
  WHERE NOT key = ANY(v_ignored_fields)
    AND (v_old -> key) IS DISTINCT FROM (v_new -> key);

  IF v_changed_fields IS NULL OR array_length(v_changed_fields, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT string_agg(public.audit_field_label(field_name), ', ' ORDER BY field_name)
  INTO v_field_labels
  FROM unnest(v_changed_fields) AS field_name;

  SELECT COALESCE(jsonb_object_agg(field_name, v_old -> field_name), '{}'::jsonb)
  INTO v_old_values
  FROM unnest(v_changed_fields) AS field_name;

  SELECT COALESCE(jsonb_object_agg(field_name, v_new -> field_name), '{}'::jsonb)
  INTO v_new_values
  FROM unnest(v_changed_fields) AS field_name;

  v_entity_id := (v_new ->> 'id')::uuid;

  IF v_entity_type = 'job' THEN
    v_job_id := v_entity_id;
    v_property_id := NULLIF(v_new ->> 'property_id', '')::uuid;
    v_unit_number := v_new ->> 'unit_number';
    v_work_order_num := NULLIF(v_new ->> 'work_order_num', '')::integer;
  ELSIF v_entity_type = 'work_order' THEN
    v_job_id := NULLIF(v_new ->> 'job_id', '')::uuid;
    SELECT j.property_id, j.unit_number, j.work_order_num
    INTO v_property_id, v_unit_number, v_work_order_num
    FROM jobs j
    WHERE j.id = v_job_id;
  ELSIF v_entity_type = 'property' THEN
    v_property_id := v_entity_id;
    v_property_name := COALESCE(v_new ->> 'property_name', 'Property');
  END IF;

  IF v_property_id IS NOT NULL AND v_property_name IS NULL THEN
    SELECT p.property_name
    INTO v_property_name
    FROM properties p
    WHERE p.id = v_property_id;
  END IF;

  v_work_order_label := CASE
    WHEN v_work_order_num IS NOT NULL THEN format('WO-%s', lpad(v_work_order_num::text, 6, '0'))
    ELSE 'Job'
  END;

  v_title := CASE v_entity_type
    WHEN 'job' THEN 'Job details updated'
    WHEN 'work_order' THEN 'Work order details updated'
    WHEN 'property' THEN 'Property details updated'
    ELSE 'Record updated'
  END;

  v_description := CASE v_entity_type
    WHEN 'job' THEN format('%s - Unit %s at %s updated: %s',
      v_work_order_label,
      COALESCE(v_unit_number, 'Unknown Unit'),
      COALESCE(v_property_name, 'Unknown Property'),
      v_field_labels
    )
    WHEN 'work_order' THEN format('%s - Unit %s at %s work order updated: %s',
      v_work_order_label,
      COALESCE(v_unit_number, 'Unknown Unit'),
      COALESCE(v_property_name, 'Unknown Property'),
      v_field_labels
    )
    WHEN 'property' THEN format('Property "%s" updated: %s',
      COALESCE(v_property_name, 'Unknown Property'),
      v_field_labels
    )
    ELSE format('Record updated: %s', v_field_labels)
  END;

  PERFORM public.log_activity(
    v_entity_type,
    v_entity_id,
    'updated',
    v_description,
    jsonb_build_object(
      'event_type', v_entity_type || '_updated',
      'title', v_title,
      'changed_fields', to_jsonb(v_changed_fields),
      'field_labels', v_field_labels,
      'old_values', v_old_values,
      'new_values', v_new_values,
      'job_id', v_job_id,
      'property_id', v_property_id,
      'property_name', v_property_name,
      'unit_number', v_unit_number,
      'work_order_num', v_work_order_num,
      'work_order_label', v_work_order_label
    ),
    auth.uid()
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_jobs_update_trigger ON public.jobs;
CREATE TRIGGER audit_jobs_update_trigger
  AFTER UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_business_record_update('job');

DROP TRIGGER IF EXISTS audit_work_orders_update_trigger ON public.work_orders;
CREATE TRIGGER audit_work_orders_update_trigger
  AFTER UPDATE ON public.work_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_business_record_update('work_order');

DROP TRIGGER IF EXISTS audit_properties_update_trigger ON public.properties;
CREATE TRIGGER audit_properties_update_trigger
  AFTER UPDATE ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_business_record_update('property');

CREATE OR REPLACE FUNCTION public.trigger_log_job_phase_change()
RETURNS TRIGGER AS $$
DECLARE
  v_from_phase_name TEXT;
  v_to_phase_name TEXT;
  v_work_order_label TEXT;
  v_unit_number TEXT;
  v_property_name TEXT;
  v_external_actor_name TEXT;
  v_metadata JSONB;
BEGIN
  SELECT job_phase_label INTO v_from_phase_name FROM job_phases WHERE id = NEW.from_phase_id;
  SELECT job_phase_label INTO v_to_phase_name FROM job_phases WHERE id = NEW.to_phase_id;

  SELECT format('WO-%s', lpad(work_order_num::text, 6, '0')),
         unit_number,
         p.property_name
  INTO v_work_order_label, v_unit_number, v_property_name
  FROM jobs j
  LEFT JOIN properties p ON p.id = j.property_id
  WHERE j.id = NEW.job_id;

  SELECT (regexp_match(
    COALESCE(NEW.change_reason, ''),
    'extra charges (?:approved|declined|rejected)(?: manually)? by ([^.;-]+)',
    'i'
  ))[1]
  INTO v_external_actor_name;

  v_metadata := jsonb_build_object(
    'job_id', NEW.job_id,
    'from_phase_id', NEW.from_phase_id,
    'to_phase_id', NEW.to_phase_id,
    'from_phase_name', COALESCE(v_from_phase_name, 'None'),
    'to_phase_name', COALESCE(v_to_phase_name, 'Unknown Phase'),
    'work_order_label', v_work_order_label,
    'property_name', v_property_name,
    'unit_number', v_unit_number,
    'change_reason', NEW.change_reason
  );

  IF v_external_actor_name IS NOT NULL AND btrim(v_external_actor_name) <> '' THEN
    v_metadata := v_metadata || jsonb_build_object(
      'external_actor_name', btrim(v_external_actor_name),
      'actor_type', 'approval_recipient'
    );
  END IF;

  PERFORM log_activity(
    'job_phase_change',
    NEW.id,
    'phase_changed',
    format('%s • %s - Unit %s phase changed from %s to %s',
      v_work_order_label,
      COALESCE(v_property_name, 'Unknown Property'),
      COALESCE(v_unit_number, 'Unknown Unit'),
      COALESCE(v_from_phase_name, 'None'),
      COALESCE(v_to_phase_name, 'Unknown Phase')
    ),
    v_metadata,
    NEW.changed_by
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS log_job_phase_change_trigger ON public.job_phase_changes;
CREATE TRIGGER log_job_phase_change_trigger
  AFTER INSERT ON public.job_phase_changes
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_log_job_phase_change();

CREATE OR REPLACE VIEW public.notifications_view AS
SELECT *
FROM (
  SELECT DISTINCT ON (n.user_id, COALESCE(n.activity_log_id, n.id))
    n.*,
    COALESCE(al.metadata->>'external_actor_name', p.full_name) as creator_name,
    CASE
      WHEN al.metadata ? 'external_actor_name' THEN NULL
      ELSE p.email
    END as creator_email,
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

DROP FUNCTION IF EXISTS public.process_approval_token(VARCHAR);

CREATE OR REPLACE FUNCTION public.process_approval_token(
  p_token VARCHAR(255),
  p_approver_name TEXT DEFAULT NULL,
  p_approver_email TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_data RECORD;
  v_job_work_order_num INTEGER;
  v_work_order_phase_id UUID;
  v_current_phase_id UUID;
  v_system_user_id UUID;
  v_effective_approver_name TEXT;
  v_effective_approver_email TEXT;
BEGIN
  SELECT * INTO v_token_data
  FROM approval_tokens
  WHERE token = p_token
    AND used_at IS NULL
    AND expires_at > NOW();

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or expired approval token');
  END IF;

  v_effective_approver_name := COALESCE(NULLIF(trim(p_approver_name), ''), v_token_data.approver_name);
  v_effective_approver_email := COALESCE(NULLIF(trim(p_approver_email), ''), v_token_data.approver_email);

  SELECT work_order_num, current_phase_id
  INTO v_job_work_order_num, v_current_phase_id
  FROM jobs
  WHERE id = v_token_data.job_id;

  UPDATE approval_tokens
  SET used_at = NOW(),
      decision = 'approved',
      decision_at = NOW(),
      approver_name = v_effective_approver_name,
      approver_email = v_effective_approver_email
  WHERE token = p_token;

  SELECT id INTO v_work_order_phase_id
  FROM job_phases
  WHERE job_phase_label = 'Work Order'
  LIMIT 1;

  IF v_work_order_phase_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Work Order phase not found');
  END IF;

  UPDATE jobs
  SET current_phase_id = v_work_order_phase_id,
      updated_at = NOW()
  WHERE id = v_token_data.job_id;

  SELECT id INTO v_system_user_id
  FROM profiles
  WHERE role IN ('is_super_admin', 'admin', 'jg_management')
  ORDER BY
    CASE role
      WHEN 'is_super_admin' THEN 1
      WHEN 'admin' THEN 2
      WHEN 'jg_management' THEN 3
      ELSE 4
    END,
    created_at ASC
  LIMIT 1;

  IF v_system_user_id IS NULL THEN
    SELECT id INTO v_system_user_id
    FROM profiles
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  INSERT INTO job_phase_changes (
    job_id,
    changed_by,
    from_phase_id,
    to_phase_id,
    change_reason
  ) VALUES (
    v_token_data.job_id,
    v_system_user_id,
    v_current_phase_id,
    v_work_order_phase_id,
    format('Extra charges approved by %s', COALESCE(v_effective_approver_name, v_effective_approver_email, 'approval recipient'))
  );

  RETURN json_build_object(
    'success', true,
    'message', 'Approval processed successfully',
    'job_id', v_token_data.job_id,
    'work_order_num', v_job_work_order_num,
    'decision', 'approved',
    'approver_name', v_effective_approver_name,
    'approver_email', v_effective_approver_email
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', format('Database error: %s', SQLERRM));
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_approval_token(VARCHAR, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.process_approval_token(VARCHAR, TEXT, TEXT) TO authenticated;

DROP FUNCTION IF EXISTS public.process_decline_token(VARCHAR, TEXT);

CREATE OR REPLACE FUNCTION public.process_decline_token(
  p_token VARCHAR(255),
  p_decline_reason TEXT DEFAULT NULL,
  p_approver_name TEXT DEFAULT NULL,
  p_approver_email TEXT DEFAULT NULL
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
  v_system_user_id UUID;
  v_effective_approver_name TEXT;
  v_effective_approver_email TEXT;
BEGIN
  SELECT * INTO v_token_data
  FROM approval_tokens
  WHERE token = p_token
    AND used_at IS NULL
    AND expires_at > NOW();

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or expired approval token');
  END IF;

  v_effective_approver_name := COALESCE(NULLIF(trim(p_approver_name), ''), v_token_data.approver_name);
  v_effective_approver_email := COALESCE(NULLIF(trim(p_approver_email), ''), v_token_data.approver_email);

  SELECT work_order_num, current_phase_id
  INTO v_job_work_order_num, v_current_phase_id
  FROM jobs
  WHERE id = v_token_data.job_id;

  UPDATE approval_tokens
  SET used_at = NOW(),
      decision = 'declined',
      decision_at = NOW(),
      decline_reason = p_decline_reason,
      approver_name = v_effective_approver_name,
      approver_email = v_effective_approver_email
  WHERE token = p_token;

  SELECT id INTO v_system_user_id
  FROM profiles
  WHERE role IN ('is_super_admin', 'admin', 'jg_management')
  ORDER BY
    CASE role
      WHEN 'is_super_admin' THEN 1
      WHEN 'admin' THEN 2
      WHEN 'jg_management' THEN 3
      ELSE 4
    END,
    created_at ASC
  LIMIT 1;

  IF v_system_user_id IS NULL THEN
    SELECT id INTO v_system_user_id
    FROM profiles
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  INSERT INTO job_phase_changes (
    job_id,
    changed_by,
    from_phase_id,
    to_phase_id,
    change_reason
  ) VALUES (
    v_token_data.job_id,
    v_system_user_id,
    v_current_phase_id,
    v_current_phase_id,
    format('Extra charges declined by %s%s',
      COALESCE(v_effective_approver_name, v_effective_approver_email, 'approval recipient'),
      CASE
        WHEN p_decline_reason IS NOT NULL AND btrim(p_decline_reason) <> ''
        THEN format('. Reason: %s', p_decline_reason)
        ELSE ''
      END
    )
  );

  RETURN json_build_object(
    'success', true,
    'message', 'Extra charges declined successfully',
    'job_id', v_token_data.job_id,
    'work_order_num', v_job_work_order_num,
    'decision', 'declined',
    'approver_name', v_effective_approver_name,
    'approver_email', v_effective_approver_email
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', format('Database error: %s', SQLERRM));
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_decline_token(VARCHAR, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.process_decline_token(VARCHAR, TEXT, TEXT, TEXT) TO authenticated;
