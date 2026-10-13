-- Customer extra-charge approval requests are governed by request/job state,
-- never by a response timer. Keep both historical and future records aligned,
-- and remove obsolete deadline promises from every approval-capable template.

BEGIN;

UPDATE public.approval_tokens
SET expires_at = NULL
WHERE approval_type = 'extra_charges'
  AND expires_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.enforce_nonexpiring_customer_approval()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF NEW.approval_type = 'extra_charges' THEN
    NEW.expires_at := NULL;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS enforce_nonexpiring_customer_approval
ON public.approval_tokens;

CREATE TRIGGER enforce_nonexpiring_customer_approval
BEFORE INSERT OR UPDATE OF approval_type, expires_at
ON public.approval_tokens
FOR EACH ROW
EXECUTE FUNCTION public.enforce_nonexpiring_customer_approval();

ALTER TABLE public.approval_tokens
  DROP CONSTRAINT IF EXISTS approval_tokens_customer_requests_do_not_expire;

ALTER TABLE public.approval_tokens
  ADD CONSTRAINT approval_tokens_customer_requests_do_not_expire
  CHECK (approval_type <> 'extra_charges' OR expires_at IS NULL);

UPDATE public.email_templates
SET body = btrim(
  regexp_replace(
    regexp_replace(
      body,
      '(?is)(<p[^>]*>\s*)?If\s+we\s+do\s+not\s+receive\s+a\s+response\s+within\s+15\s+minutes,?\s*we\s+will\s+proceed\s+with\s+the\s+additional\s+work\s+to\s+avoid\s+project\s+delays\.?\s*(</p>)?',
      'Please review the additional charges and respond using the link below. Work associated with these additional charges will proceed after approval is received.',
      'g'
    ),
    '(?is)(<p[^>]*>\s*)?[^<.!?]*(15\s+minutes|15-minute)[^<.!?]*[.!?]\s*(</p>)?',
    '',
    'g'
  )
)
WHERE body ~* '(15\s+minutes|15-minute)';

COMMENT ON CONSTRAINT approval_tokens_customer_requests_do_not_expire
ON public.approval_tokens IS
  'Customer extra-charge approval requests remain available until completed, superseded, invalidated, cancelled, or made inapplicable by job state.';

COMMIT;
