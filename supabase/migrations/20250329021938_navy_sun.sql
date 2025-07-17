/*
  # Add Delete Policies for Billing Tables

  1. Changes
    - Add delete policies for billing tables
    - Enable deletion for authenticated users
    - Maintain data integrity with cascading deletes

  2. Security
    - Enable delete policies for authenticated users
    - Ensure proper access control
*/

-- Add delete policies
CREATE POLICY "Enable delete for authenticated users"
  ON billing_categories
  FOR DELETE
  TO authenticated
  USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users"
  ON billing_details
  FOR DELETE
  TO authenticated
  USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users"
  ON billing_items
  FOR DELETE
  TO authenticated
  USING (auth.role() = 'authenticated');