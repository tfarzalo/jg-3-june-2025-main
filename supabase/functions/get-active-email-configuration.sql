-- Function to get the active email configuration
CREATE OR REPLACE FUNCTION get_active_email_configuration()
RETURNS TABLE (
  id UUID,
  from_email VARCHAR(255),
  from_name VARCHAR(255),
  default_bcc_emails TEXT[],
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ec.id,
    ec.from_email,
    ec.from_name,
    ec.default_bcc_emails,
    ec.is_active,
    ec.created_at,
    ec.updated_at
  FROM email_configurations ec
  WHERE ec.is_active = true
  ORDER BY ec.created_at DESC
  LIMIT 1;
END;
$$;
