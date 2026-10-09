-- Supabase projects may grant function execution to API roles through default
-- privileges. Explicitly remove direct API access from trigger-only/internal
-- cumulative-approval helpers. Installed triggers continue to execute normally.

REVOKE ALL ON FUNCTION public.approval_customer_line_items(jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.approval_customer_misc_items(jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.approval_customer_work_order_signature(
  jsonb, jsonb, boolean, text, numeric, numeric, text
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_extra_charge_approval_outdated(uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.require_reapproval_after_extra_charge_change()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.require_reapproval_after_job_misc_change()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_internal_users_of_approval_decision()
  FROM PUBLIC, anon, authenticated;

-- These two RPCs are intentionally callable by signed-in office users; each
-- still performs its own internal-admin authorization check.
REVOKE ALL ON FUNCTION public.create_or_refresh_approval_token(
  uuid, text, text, text, jsonb, boolean
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_or_refresh_approval_token(
  uuid, text, text, text, jsonb, boolean
) TO authenticated;

REVOKE ALL ON FUNCTION public.approve_extra_charges_manually(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_extra_charges_manually(uuid)
  TO authenticated;
