CREATE OR REPLACE FUNCTION create_approval_request(
    p_job_id UUID,
    p_approval_type TEXT,
    p_user_id UUID,
    p_approver_email TEXT,
    p_approver_name TEXT,
    p_template_id UUID,
    p_included_sections JSONB,
    p_email_subject TEXT,
    p_email_body TEXT,
    p_email_signature TEXT
)
RETURNS TABLE (
    approval_id UUID,
    token_id UUID,
    token TEXT,
    expires_at TIMESTAMPTZ
) AS $$
DECLARE
    v_approval_id UUID;
    v_token_id UUID;
    v_token TEXT;
    v_expires_at TIMESTAMPTZ;
BEGIN
    -- Insert into approvals table
    INSERT INTO approvals (job_id, approval_type, requested_by, status, approver_email, approver_name, template_id, included_sections, email_subject, email_body, email_signature)
    VALUES (p_job_id, p_approval_type, p_user_id, 'pending', p_approver_email, p_approver_name, p_template_id, p_included_sections, p_email_subject, p_email_body, p_email_signature)
    RETURNING id INTO v_approval_id;

    -- Insert into approval_tokens table
    INSERT INTO approval_tokens (approval_id, job_id, approval_type, sent_to, status)
    VALUES (v_approval_id, p_job_id, p_approval_type, p_approver_email, 'pending')
    RETURNING id, token, expires_at INTO v_token_id, v_token, v_expires_at;

    -- Return the new IDs, token, and expiration
    RETURN QUERY SELECT v_approval_id, v_token_id, v_token, v_expires_at;
END;
$$ LANGUAGE plpgsql;
