/*
  # Remove billing_items table

  Rationale:
  - The application no longer uses `billing_items`. All billing information is sourced from
    `billing_details` linked to `billing_categories` and `unit_sizes`.

  Operations:
  - Drop policies and indexes (if they exist)
  - Drop the `billing_items` table
*/

-- Drop dependent policies/indexes if they exist; ignore if already absent
DO $$ BEGIN
  -- Policies
  DROP POLICY IF EXISTS "Billing items read access" ON billing_items;
  DROP POLICY IF EXISTS "Billing items insert access" ON billing_items;
  DROP POLICY IF EXISTS "Billing items update access" ON billing_items;
  DROP POLICY IF EXISTS "Billing items delete access" ON billing_items;
  DROP POLICY IF EXISTS "Enable read access for authenticated users" ON billing_items;
  DROP POLICY IF EXISTS "Enable insert for authenticated users" ON billing_items;
  DROP POLICY IF EXISTS "Enable update for authenticated users" ON billing_items;
  DROP POLICY IF EXISTS "Enable delete for authenticated users" ON billing_items;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- Indexes
DO $$ BEGIN
  DROP INDEX IF EXISTS idx_billing_items_category_id;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- Finally drop the table (CASCADE in case any lingering dependencies exist)
DO $$ BEGIN
  DROP TABLE IF EXISTS billing_items CASCADE;
EXCEPTION WHEN undefined_table THEN NULL; END $$;


