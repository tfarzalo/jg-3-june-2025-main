-- Permanently remove legacy expiration behavior from customer extra-charge
-- approval records. Safe to rerun. Preview tokens may remain time-limited.

BEGIN;

ALTER TABLE public.approval_tokens
  ALTER COLUMN expires_at DROP NOT NULL;

-- This intentionally includes completed, declined, invalidated, archived, and
-- formerly expired records so their historical pages cannot display or regain
-- a legacy response deadline.
UPDATE public.approval_tokens
SET expires_at = NULL
WHERE approval_type = 'extra_charges'
  AND expires_at IS NOT NULL;

-- The original cleanup routine deleted any token 30 days after its expiration.
-- Preserve customer approval records indefinitely and limit cleanup to
-- explicitly temporary token types, such as approval-page previews.
CREATE OR REPLACE FUNCTION public.cleanup_expired_approval_tokens()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.approval_tokens
  WHERE approval_type <> 'extra_charges'
    AND expires_at IS NOT NULL
    AND expires_at < NOW() - INTERVAL '30 days';
END;
$$;

COMMENT ON FUNCTION public.cleanup_expired_approval_tokens() IS
  'Deletes old temporary approval tokens only; permanent extra-charge customer approval records are retained.';

COMMIT;
