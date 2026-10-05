# Mailgun staged cutover

The application remains on Zoho unless `OUTBOUND_EMAIL_PROVIDER` is explicitly
set to `mailgun`. Adding the Mailgun secrets and deploying the functions does not
switch live traffic by itself.

## Required Supabase secrets

- `OUTBOUND_EMAIL_PROVIDER=zoho` during staging
- `MAILGUN_SMTP_USERNAME` — the full Mailgun SMTP login
- `MAILGUN_SMTP_PASSWORD` — the SMTP user's password (not an API/sending key)
- `MAILGUN_SMTP_HOST=smtp.mailgun.org`
- `MAILGUN_SMTP_PORT=587`
- `MAILGUN_FROM_EMAIL=admin@jgpaintingprosinc.com`
- `MAILGUN_FROM_NAME=JG Painting Pros Inc.`
- `MAILGUN_REPLY_TO_EMAIL=admin@jgpaintingprosinc.com`
- `MAILGUN_WEBHOOK_SIGNING_KEY` — Mailgun's HTTP webhook signing key

Do not put secret values in source control or browser-side environment files.

## Deployment order

1. Apply `20261005000000_add_outbound_email_sends.sql`.
2. Add the Mailgun secrets while leaving `OUTBOUND_EMAIL_PROVIDER=zoho`.
3. Deploy `send-email`, `send-notification-email`, and `create-user` normally.
4. Deploy `mailgun-webhook` without JWT verification because Mailgun, not an
   application user, calls it. Requests are authenticated using Mailgun's HMAC
   signature inside the function.
5. In Mailgun, configure delivery, temporary failure, permanent failure, and
   complaint webhooks to:
   `https://<SUPABASE_PROJECT_REF>.supabase.co/functions/v1/mailgun-webhook`
6. Send a Zoho smoke test and confirm the new audit row is written.
7. In a controlled test window, set `OUTBOUND_EMAIL_PROVIDER=mailgun`, send to
   Gmail, Microsoft 365, and a corporate recipient, and verify Mailgun Events
   plus `outbound_email_sends` / `outbound_email_events`.
8. If the test fails, immediately restore `OUTBOUND_EMAIL_PROVIDER=zoho`. No
   application rollback is needed.

## Attachment evaluation (no UI change in this release)

Use the existing interface to send a test matrix with zero, one, three, and the
current maximum number of images. Compare provider delivery events, recipient
inbox/junk/quarantine placement, total message size, and attachment bytes.

- If large/current messages consistently reach inboxes, retain the current UI.
- If quarantine correlates with image count or message size, first optimize
  email-only image copies on the backend. Keep original job photos unchanged.
- Add a visible attachment cap or selection redesign only if the controlled
results show backend optimization is insufficient.
