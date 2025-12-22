-- Update Paint Colors Schema: Floorplans to Paint Types
-- This migration changes the system from floorplan-based to paint type-based

-- Step 1: Create new paint_types table
CREATE TABLE IF NOT EXISTS paint_types (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL UNIQUE,
    description text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Step 2: Insert default paint types
INSERT INTO paint_types (name, description) VALUES
    ('Regular Paint', 'Standard paint application'),
    ('Color Change', 'Paint color change from existing'),
    ('Touch Up', 'Minor paint touch up work'),
    ('Full Repaint', 'Complete repainting of area'),
    ('Primer Only', 'Primer application only')
ON CONFLICT (name) DO NOTHING;

-- Step 3: Update property_paint_schemes table
-- Add new columns
ALTER TABLE property_paint_schemes 
ADD COLUMN IF NOT EXISTS paint_type_id uuid REFERENCES paint_types(id),
ADD COLUMN IF NOT EXISTS notes text;

-- Step 4: Migrate existing data (if any)
-- Set default paint type for existing schemes
UPDATE property_paint_schemes 
SET paint_type_id = (SELECT id FROM paint_types WHERE name = 'Regular Paint')
WHERE paint_type_id IS NULL;

-- Step 5: Make paint_type_id required and remove floorplan constraint
ALTER TABLE property_paint_schemes 
ALTER COLUMN paint_type_id SET NOT NULL;

-- Drop the old unique constraint
ALTER TABLE property_paint_schemes 
DROP CONSTRAINT IF EXISTS property_paint_schemes_property_id_floorplan_key;

-- Add new unique constraint
ALTER TABLE property_paint_schemes 
ADD CONSTRAINT property_paint_schemes_property_id_paint_type_id_key 
UNIQUE(property_id, paint_type_id);

-- Step 6: Update the view
DROP VIEW IF EXISTS property_paint_colors_v;

CREATE OR REPLACE VIEW property_paint_colors_v WITH (security_invoker=on) AS
SELECT 
    ps.id as scheme_id,
    ps.property_id,
    ps.paint_type_id,
    pt.name as paint_type_name,
    ps.notes as scheme_notes,
    ps.created_at as scheme_created_at,
    ps.updated_at as scheme_updated_at,
    pr.id as row_id,
    pr.room,
    pr.paint_color,
    pr.sort_order,
    pr.created_at as row_created_at,
    pr.updated_at as row_updated_at
FROM property_paint_schemes ps
JOIN paint_types pt ON ps.paint_type_id = pt.id
LEFT JOIN property_paint_rows pr ON ps.id = pr.scheme_id
ORDER BY pt.name, pr.sort_order, pr.created_at;

-- Step 7: Update RLS policies for new structure
-- Drop old policies
DROP POLICY IF EXISTS "Read paint schemes if can read property" ON property_paint_schemes;
DROP POLICY IF EXISTS "Insert paint schemes if can edit property" ON property_paint_schemes;
DROP POLICY IF EXISTS "Update paint schemes if can edit property" ON property_paint_schemes;
DROP POLICY IF EXISTS "Delete paint schemes if can edit property" ON property_paint_schemes;

-- Create new policies
CREATE POLICY "Read paint schemes if can read property" ON property_paint_schemes
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM properties p
            WHERE p.id = property_paint_schemes.property_id
            AND EXISTS (
                SELECT 1 FROM user_roles ur
                JOIN user_role_assignments ura ON ur.id = ura.role_id
                WHERE ura.user_id = auth.uid()
                AND ur.name IN ('admin', 'superadmin', 'jgmanagement')
            )
        )
    );

CREATE POLICY "Insert paint schemes if can edit property" ON property_paint_schemes
    FOR INSERT TO authenticated WITH CHECK (
        EXISTS (
            SELECT 1 FROM properties p
            WHERE p.id = property_paint_schemes.property_id
            AND EXISTS (
                SELECT 1 FROM user_roles ur
                JOIN user_role_assignments ura ON ur.id = ura.role_id
                WHERE ura.user_id = auth.uid()
                AND ur.name IN ('admin', 'superadmin', 'jgmanagement')
            )
        )
    );

CREATE POLICY "Update paint schemes if can edit property" ON property_paint_schemes
    FOR UPDATE TO authenticated USING (
        EXISTS (
            SELECT 1 FROM properties p
            WHERE p.id = property_paint_schemes.property_id
            AND EXISTS (
                SELECT 1 FROM user_roles ur
                JOIN user_role_assignments ura ON ur.id = ura.role_id
                WHERE ura.user_id = auth.uid()
                AND ur.name IN ('admin', 'superadmin', 'jgmanagement')
            )
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM properties p
            WHERE p.id = property_paint_schemes.property_id
            AND EXISTS (
                SELECT 1 FROM user_roles ur
                JOIN user_role_assignments ura ON ur.id = ura.role_id
                WHERE ura.user_id = auth.uid()
                AND ur.name IN ('admin', 'superadmin', 'jgmanagement')
            )
        )
    );

CREATE POLICY "Delete paint schemes if can edit property" ON property_paint_schemes
    FOR DELETE TO authenticated USING (
        EXISTS (
            SELECT 1 FROM properties p
            WHERE p.id = property_paint_schemes.property_id
            AND EXISTS (
                SELECT 1 FROM user_roles ur
                JOIN user_role_assignments ura ON ur.id = ura.role_id
                WHERE ura.user_id = auth.uid()
                AND ur.name IN ('admin', 'superadmin', 'jgmanagement')
            )
        )
    );

-- Step 8: Enable RLS on paint_types table
ALTER TABLE paint_types ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for paint_types (read-only for authenticated users)
CREATE POLICY "Read paint types for authenticated users" ON paint_types
    FOR SELECT TO authenticated USING (true);

-- Step 9: Add updated_at trigger for paint_types
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_paint_types_updated_at 
    BEFORE UPDATE ON paint_types 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Step 10: Clean up old columns (optional - uncomment if you want to remove them)
-- ALTER TABLE property_paint_schemes DROP COLUMN IF EXISTS floorplan;
-- ALTER TABLE property_paint_schemes DROP COLUMN IF EXISTS name;

-- Migration completed successfully
SELECT 'Paint Colors schema updated successfully!' as status;
