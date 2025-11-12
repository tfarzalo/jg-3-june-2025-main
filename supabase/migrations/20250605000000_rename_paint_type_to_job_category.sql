-- Create job_categories table
CREATE TABLE IF NOT EXISTS job_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE job_categories ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow authenticated users to create job categories"
  ON job_categories
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to view all job categories"
  ON job_categories
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to update job categories"
  ON job_categories
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete job categories"
  ON job_categories
  FOR DELETE
  TO authenticated
  USING (true);

-- Insert default job categories
INSERT INTO job_categories (name, description, sort_order)
VALUES 
  ('Regular Paint', 'Standard paint job', 1),
  ('Color Change', 'Paint color change job', 2)
ON CONFLICT (name) DO NOTHING;

-- Add job_category_id to work_orders table
ALTER TABLE work_orders 
ADD COLUMN job_category_id uuid REFERENCES job_categories(id);

-- Update existing work_orders to link to job_categories
UPDATE work_orders wo
SET job_category_id = jc.id
FROM job_categories jc
WHERE wo.job_category = jc.name;

-- Make job_category_id required
ALTER TABLE work_orders
ALTER COLUMN job_category_id SET NOT NULL;

-- Drop the old job_category column
ALTER TABLE work_orders
DROP COLUMN job_category;
