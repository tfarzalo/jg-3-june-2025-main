-- Additive message-size telemetry for outbound email.
-- Reporting only: this migration does not limit, reject, resize, or compress files.

ALTER TABLE public.outbound_email_sends
  ADD COLUMN IF NOT EXISTS html_bytes bigint NOT NULL DEFAULT 0 CHECK (html_bytes >= 0),
  ADD COLUMN IF NOT EXISTS text_bytes bigint NOT NULL DEFAULT 0 CHECK (text_bytes >= 0),
  ADD COLUMN IF NOT EXISTS image_attachment_count integer NOT NULL DEFAULT 0 CHECK (image_attachment_count >= 0),
  ADD COLUMN IF NOT EXISTS estimated_encoded_attachment_bytes bigint NOT NULL DEFAULT 0
    CHECK (estimated_encoded_attachment_bytes >= 0),
  ADD COLUMN IF NOT EXISTS estimated_message_bytes bigint NOT NULL DEFAULT 0
    CHECK (estimated_message_bytes >= 0),
  ADD COLUMN IF NOT EXISTS attachment_metadata jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS size_warnings text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.outbound_email_sends.attachment_bytes IS
  'Decoded/raw bytes for attachments whose content was available to the dispatcher.';

COMMENT ON COLUMN public.outbound_email_sends.estimated_encoded_attachment_bytes IS
  'Estimated attachment bytes after base64 encoding and MIME line wrapping.';

COMMENT ON COLUMN public.outbound_email_sends.estimated_message_bytes IS
  'Reporting-only estimate including bodies, encoded attachments, and approximate MIME/header overhead.';

COMMENT ON COLUMN public.outbound_email_sends.attachment_metadata IS
  'Per-attachment filename, extension, content type, raw/encoded size estimates, and inline status.';

COMMENT ON COLUMN public.outbound_email_sends.size_warnings IS
  'Reporting-only warnings; no message is blocked or altered by these thresholds.';
