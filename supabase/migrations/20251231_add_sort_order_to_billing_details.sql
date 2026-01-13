/*
  # Persist Line Item Order for Billing Details

  1. Changes
    - Add sort_order column to billing_details
    - Backfill sort_order per category using created_at/id
    - Add index for efficient ordered reads per category

  2. Notes
    - Safe to run multiple times (IF NOT EXISTS guards)
    - Does not change existing unique constraints
*/

ALTER TABLE billing_details
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_billing_details_category_sort
  ON billing_details(category_id, sort_order);

WITH ranked AS (
  SELECT
    id,
    category_id,
    ROW_NUMBER() OVER (PARTITION BY category_id ORDER BY created_at, id) AS rn
  FROM billing_details
)
UPDATE billing_details bd
SET sort_order = r.rn
FROM ranked r
WHERE bd.id = r.id;
