-- Keep the intended approval-link recipient separate from the person who
-- actually submits the approval or decline decision.

ALTER TABLE public.approval_tokens
  ADD COLUMN IF NOT EXISTS decision_maker_name TEXT,
  ADD COLUMN IF NOT EXISTS decision_maker_email TEXT;

COMMENT ON COLUMN public.approval_tokens.approver_name IS
  'Name of the intended recipient when the approval link was created.';
COMMENT ON COLUMN public.approval_tokens.approver_email IS
  'Email of the intended recipient when the approval link was created.';
COMMENT ON COLUMN public.approval_tokens.decision_maker_name IS
  'Name entered by the person who submitted the approval or decline.';
COMMENT ON COLUMN public.approval_tokens.decision_maker_email IS
  'Email entered by the person who submitted the approval or decline.';

-- Existing completed decisions stored the submitting identity in the legacy
-- approver fields. Preserve that identity in the new audit fields.
UPDATE public.approval_tokens
SET decision_maker_name = COALESCE(decision_maker_name, approver_name),
    decision_maker_email = COALESCE(decision_maker_email, approver_email)
WHERE decision IS NOT NULL;

CREATE OR REPLACE FUNCTION public.capture_approval_decision_maker()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.decision IS NULL AND NEW.decision IN ('approved', 'declined') THEN
    NEW.decision_maker_name := COALESCE(
      NULLIF(btrim(NEW.decision_maker_name), ''),
      NULLIF(btrim(NEW.approver_name), ''),
      NULLIF(btrim(OLD.approver_name), '')
    );
    NEW.decision_maker_email := lower(COALESCE(
      NULLIF(btrim(NEW.decision_maker_email), ''),
      NULLIF(btrim(NEW.approver_email), ''),
      NULLIF(btrim(OLD.approver_email), '')
    ));

    IF NEW.decision_maker_name IS NULL THEN
      RAISE EXCEPTION 'Approver name is required';
    END IF;
    IF NEW.decision_maker_email IS NULL
       OR NEW.decision_maker_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
      RAISE EXCEPTION 'A valid approver email is required';
    END IF;

    -- Current approval RPCs write the submitted identity into approver_*.
    -- Retain the original recipient in those legacy columns while recording
    -- the submitted identity in decision_maker_*.
    NEW.approver_name := OLD.approver_name;
    NEW.approver_email := OLD.approver_email;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS capture_approval_decision_maker_trigger
  ON public.approval_tokens;

CREATE TRIGGER capture_approval_decision_maker_trigger
BEFORE UPDATE OF decision, approver_name, approver_email,
  decision_maker_name, decision_maker_email
ON public.approval_tokens
FOR EACH ROW
EXECUTE FUNCTION public.capture_approval_decision_maker();

CREATE INDEX IF NOT EXISTS approval_tokens_decision_maker_email_idx
  ON public.approval_tokens (decision_maker_email)
  WHERE decision_maker_email IS NOT NULL;
