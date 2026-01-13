-- Add internal notification emails for approval/decline decisions
-- This migration adds comments and keeps the approval/decline functions simple
-- Internal notification emails will be sent from the application layer after successful decisions

-- Add helpful comments
COMMENT ON TABLE approval_tokens IS 'Stores approval/decline tokens with decision tracking. Applications can query recent decisions to send internal notifications';
COMMENT ON COLUMN approval_tokens.decision IS 'The decision made: approved or declined. Used by application to trigger internal notifications';
COMMENT ON COLUMN approval_tokens.decision_at IS 'When the decision was made. Used to query for recent decisions needing notification';

-- The process_approval_token and process_decline_token functions are already updated
-- in migration 20251211000001_add_extra_charges_approval_decline.sql
-- They now properly set the decision and decision_at fields
-- The application layer can query these fields to send internal notifications
