-- Create the master job_categories table
CREATE TABLE IF NOT EXISTS job_categories (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  description text,
  sort_order integer,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Add RLS to job_categories
ALTER TABLE job_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view job_categories" ON job_categories FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert job_categories" ON job_categories FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update job_categories" ON job_categories FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete job_categories" ON job_categories FOR DELETE TO authenticated USING (true); 