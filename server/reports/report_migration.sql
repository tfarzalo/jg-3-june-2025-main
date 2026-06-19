-- Migration: create report_templates and report_runs tables

CREATE TABLE IF NOT EXISTS report_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  columns jsonb NOT NULL,
  sort jsonb,
  filters jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS report_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  template_id uuid,
  params jsonb NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  result_url text,
  error text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security and add policies (Supabase-style using auth.uid()).
-- Service role keys bypass RLS; server-side jobs should use the service role when needed.

ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if present to make migration idempotent
DROP POLICY IF EXISTS report_templates_owner_full_access ON report_templates;

-- Allow owners (authenticated users matching user_id) to SELECT/INSERT/UPDATE/DELETE their templates
CREATE POLICY "report_templates_owner_full_access" ON report_templates
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- If you want admins (a specific role) to access all templates, add a policy like:
-- CREATE POLICY "report_templates_admin_access" ON report_templates
--   FOR ALL
--   USING (auth.role() = 'admin');

ALTER TABLE report_runs ENABLE ROW LEVEL SECURITY;

-- Drop run-related policies if present
DROP POLICY IF EXISTS report_runs_owner_select ON report_runs;
DROP POLICY IF EXISTS report_runs_owner_insert ON report_runs;
DROP POLICY IF EXISTS report_runs_owner_update ON report_runs;

-- Allow owners to view their runs
CREATE POLICY "report_runs_owner_select" ON report_runs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow owners to insert runs (client-triggered run requests)
CREATE POLICY "report_runs_owner_insert" ON report_runs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow owners to update their runs (e.g., cancel) and view/update status
CREATE POLICY "report_runs_owner_update" ON report_runs
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Note: server-side background workers that use the Supabase "service_role" key bypass RLS automatically.
-- If you are not using Supabase and don't have auth.uid(), replace auth.uid() checks with a function or session
-- variable your authentication layer sets (for example current_setting('jwt.claims.user_id')::uuid = user_id).

-- Example alternative for a generic JWT-based Postgres setup (uncomment and adapt if needed):
-- ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "report_templates_owner_full_access_jwt" ON report_templates
--   FOR ALL
--   USING (current_setting('request.jwt.claims.user_id', true) = user_id::text)
--   WITH CHECK (current_setting('request.jwt.claims.user_id', true) = user_id::text);
