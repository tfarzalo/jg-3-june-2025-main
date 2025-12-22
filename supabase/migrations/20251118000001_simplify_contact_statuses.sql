-- Simplify Contact Statuses
-- Date: November 18, 2025
-- Purpose: Reduce contact statuses to: Lead, General Contact, Client, Dead, Proposal Sent, Customer, Other

-- First, create a mapping for old statuses to new statuses
CREATE TEMP TABLE status_mapping AS
SELECT 
  old_status.id as old_id,
  new_status.id as new_id
FROM lead_statuses old_status
CROSS JOIN lead_statuses new_status
WHERE 
  (old_status.name = 'New Lead' AND new_status.name = 'Lead') OR
  (old_status.name = 'Contacted' AND new_status.name = 'Lead') OR
  (old_status.name = 'Qualified' AND new_status.name = 'Lead') OR
  (old_status.name = 'Negotiating' AND new_status.name = 'Proposal Sent') OR
  (old_status.name = 'Closed Won' AND new_status.name = 'Customer') OR
  (old_status.name = 'Closed - Won' AND new_status.name = 'Customer') OR
  (old_status.name = 'Closed Lost' AND new_status.name = 'Dead') OR
  (old_status.name = 'Closed - Lost' AND new_status.name = 'Dead');

-- Update the simplified status list (keep only the desired statuses)
-- Remove all existing statuses first, then insert the new ones
DELETE FROM lead_statuses;

-- Insert the new simplified statuses
INSERT INTO lead_statuses (name, description, color, sort_order) VALUES
  ('Lead', 'Potential customer or inquiry', '#3B82F6', 1),
  ('General Contact', 'General contact or non-sales inquiry', '#8B5CF6', 2),
  ('Client', 'Active client', '#10B981', 3),
  ('Dead', 'No longer active or not interested', '#6B7280', 4),
  ('Proposal Sent', 'Proposal or quote has been sent', '#F59E0B', 5),
  ('Customer', 'Paying customer', '#059669', 6),
  ('Other', 'Other status', '#94A3B8', 7)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  color = EXCLUDED.color,
  sort_order = EXCLUDED.sort_order;

-- Update any existing leads to use the new status IDs
-- Map old statuses to closest new equivalent
WITH new_status_ids AS (
  SELECT id, name FROM lead_statuses
)
UPDATE leads
SET status_id = (
  CASE 
    -- Map any old "New Lead", "Contacted", "Qualified" to "Lead"
    WHEN EXISTS (
      SELECT 1 FROM lead_statuses ls 
      WHERE ls.id = leads.status_id 
      AND ls.name IN ('New Lead', 'Contacted', 'Qualified')
    ) THEN (SELECT id FROM new_status_ids WHERE name = 'Lead')
    
    -- Map "Negotiating" to "Proposal Sent"
    WHEN EXISTS (
      SELECT 1 FROM lead_statuses ls 
      WHERE ls.id = leads.status_id 
      AND ls.name = 'Negotiating'
    ) THEN (SELECT id FROM new_status_ids WHERE name = 'Proposal Sent')
    
    -- Map "Closed Won" or "Closed - Won" to "Customer"
    WHEN EXISTS (
      SELECT 1 FROM lead_statuses ls 
      WHERE ls.id = leads.status_id 
      AND ls.name IN ('Closed Won', 'Closed - Won')
    ) THEN (SELECT id FROM new_status_ids WHERE name = 'Customer')
    
    -- Map "Closed Lost" or "Closed - Lost" to "Dead"
    WHEN EXISTS (
      SELECT 1 FROM lead_statuses ls 
      WHERE ls.id = leads.status_id 
      AND ls.name IN ('Closed Lost', 'Closed - Lost', 'Dead')
    ) THEN (SELECT id FROM new_status_ids WHERE name = 'Dead')
    
    -- Default to "Lead" if no match
    ELSE (SELECT id FROM new_status_ids WHERE name = 'Lead')
  END
)
WHERE status_id IS NOT NULL;

-- Set default status for new leads to "Lead"
UPDATE leads
SET status_id = (SELECT id FROM lead_statuses WHERE name = 'Lead')
WHERE status_id IS NULL;

-- Drop the temp table
DROP TABLE IF EXISTS status_mapping;

-- Add comment
COMMENT ON TABLE lead_statuses IS 'Simplified contact statuses: Lead, General Contact, Client, Dead, Proposal Sent, Customer, Other';
