-- Complete Paint Colors Setup
-- This script completes the setup based on what's already been created

-- First, let's check what exists
DO $$
BEGIN
    -- Check if tables exist
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'property_paint_schemes') THEN
        -- Create property_paint_schemes table
        CREATE TABLE property_paint_schemes (
            id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
            property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
            floorplan smallint NOT NULL CHECK (floorplan >= 1 AND floorplan <= 5),
            name text,
            created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
            updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
            UNIQUE(property_id, floorplan)
        );
        RAISE NOTICE 'Created property_paint_schemes table';
    ELSE
        RAISE NOTICE 'property_paint_schemes table already exists';
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'property_paint_rows') THEN
        -- Create property_paint_rows table
        CREATE TABLE property_paint_rows (
            id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
            scheme_id uuid NOT NULL REFERENCES property_paint_schemes(id) ON DELETE CASCADE,
            room text NOT NULL,
            paint_color text NOT NULL,
            paint_code text,
            paint_finish text,
            sort_order integer DEFAULT 0 NOT NULL,
            created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
            updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
        );
        RAISE NOTICE 'Created property_paint_rows table';
    ELSE
        RAISE NOTICE 'property_paint_rows table already exists';
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_property_paint_schemes_property_id ON property_paint_schemes(property_id);
CREATE INDEX IF NOT EXISTS idx_property_paint_schemes_floorplan ON property_paint_schemes(floorplan);
CREATE INDEX IF NOT EXISTS idx_property_paint_rows_scheme_id ON property_paint_rows(scheme_id);
CREATE INDEX IF NOT EXISTS idx_property_paint_rows_sort_order ON property_paint_rows(sort_order);

-- Create or update the view (based on your existing structure)
CREATE OR REPLACE VIEW property_paint_colors_v WITH (security_invoker=on) AS
SELECT 
    ps.id as scheme_id,
    ps.property_id,
    ps.floorplan,
    ps.name as scheme_name,
    ps.created_at as scheme_created_at,
    ps.updated_at as scheme_updated_at,
    pr.id as row_id,
    pr.room,
    pr.paint_color,
    pr.paint_code,
    pr.paint_finish,
    pr.sort_order,
    pr.created_at as row_created_at,
    pr.updated_at as row_updated_at
FROM property_paint_schemes ps
LEFT JOIN property_paint_rows pr ON ps.id = pr.scheme_id
ORDER BY ps.floorplan, pr.sort_order, pr.created_at;

-- Enable RLS on both tables (if not already enabled)
ALTER TABLE property_paint_schemes ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_paint_rows ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Read paint schemes if can read property" ON property_paint_schemes;
DROP POLICY IF EXISTS "Insert paint schemes if can edit property" ON property_paint_schemes;
DROP POLICY IF EXISTS "Update paint schemes if can edit property" ON property_paint_schemes;
DROP POLICY IF EXISTS "Delete paint schemes if can edit property" ON property_paint_schemes;

-- Create RLS policies for property_paint_schemes
-- Read access: if user can read the property
CREATE POLICY "Read paint schemes if can read property" ON property_paint_schemes
    FOR SELECT 
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM properties p
            WHERE p.id = property_paint_schemes.property_id
            AND (
                -- Admin/management can read all
                EXISTS (
                    SELECT 1 FROM user_roles ur
                    JOIN user_role_assignments ura ON ur.id = ura.role_id
                    WHERE ura.user_id = (SELECT auth.uid())
                    AND ur.name IN ('admin', 'management')
                )
                -- Subcontractors can read if they have access to the property
                OR EXISTS (
                    SELECT 1 FROM user_roles ur
                    JOIN user_role_assignments ura ON ur.id = ura.role_id
                    WHERE ura.user_id = (SELECT auth.uid())
                    AND ur.name = 'subcontractor'
                )
            )
        )
    );

-- Insert access: if user can edit the property
CREATE POLICY "Insert paint schemes if can edit property" ON property_paint_schemes
    FOR INSERT 
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM properties p
            WHERE p.id = property_paint_schemes.property_id
            AND EXISTS (
                SELECT 1 FROM user_roles ur
                JOIN user_role_assignments ura ON ur.id = ura.role_id
                WHERE ura.user_id = (SELECT auth.uid())
                AND ur.name IN ('admin', 'management')
            )
        )
    );

-- Update access: if user can edit the property
CREATE POLICY "Update paint schemes if can edit property" ON property_paint_schemes
    FOR UPDATE 
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM properties p
            WHERE p.id = property_paint_schemes.property_id
            AND EXISTS (
                SELECT 1 FROM user_roles ur
                JOIN user_role_assignments ura ON ur.id = ura.role_id
                WHERE ura.user_id = (SELECT auth.uid())
                AND ur.name IN ('admin', 'management')
            )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM properties p
            WHERE p.id = property_paint_schemes.property_id
            AND EXISTS (
                SELECT 1 FROM user_roles ur
                JOIN user_role_assignments ura ON ur.id = ura.role_id
                WHERE ura.user_id = (SELECT auth.uid())
                AND ur.name IN ('admin', 'management')
            )
        )
    );

-- Delete access: if user can edit the property
CREATE POLICY "Delete paint schemes if can edit property" ON property_paint_schemes
    FOR DELETE 
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM properties p
            WHERE p.id = property_paint_schemes.property_id
            AND EXISTS (
                SELECT 1 FROM user_roles ur
                JOIN user_role_assignments ura ON ur.id = ura.role_id
                WHERE ura.user_id = (SELECT auth.uid())
                AND ur.name IN ('admin', 'management')
            )
        )
    );

-- Create RLS policies for property_paint_rows
-- Read access: if user can read the property
CREATE POLICY "Read paint rows if can read property" ON property_paint_rows
    FOR SELECT 
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM property_paint_schemes ps
            JOIN properties p ON p.id = ps.property_id
            WHERE ps.id = property_paint_rows.scheme_id
            AND (
                -- Admin/management can read all
                EXISTS (
                    SELECT 1 FROM user_roles ur
                    JOIN user_role_assignments ura ON ur.id = ura.role_id
                    WHERE ura.user_id = (SELECT auth.uid())
                    AND ur.name IN ('admin', 'management')
                )
                -- Subcontractors can read if they have access to the property
                OR EXISTS (
                    SELECT 1 FROM user_roles ur
                    JOIN user_role_assignments ura ON ur.id = ura.role_id
                    WHERE ura.user_id = (SELECT auth.uid())
                    AND ur.name = 'subcontractor'
                )
            )
        )
    );

-- Insert access: if user can edit the property
CREATE POLICY "Insert paint rows if can edit property" ON property_paint_rows
    FOR INSERT 
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM property_paint_schemes ps
            JOIN properties p ON p.id = ps.property_id
            WHERE ps.id = property_paint_rows.scheme_id
            AND EXISTS (
                SELECT 1 FROM user_roles ur
                JOIN user_role_assignments ura ON ur.id = ura.role_id
                WHERE ura.user_id = (SELECT auth.uid())
                AND ur.name IN ('admin', 'management')
            )
        )
    );

-- Update access: if user can edit the property
CREATE POLICY "Update paint rows if can edit property" ON property_paint_rows
    FOR UPDATE 
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM property_paint_schemes ps
            JOIN properties p ON p.id = ps.property_id
            WHERE ps.id = property_paint_rows.scheme_id
            AND EXISTS (
                SELECT 1 FROM user_roles ur
                JOIN user_role_assignments ura ON ur.id = ura.role_id
                WHERE ura.user_id = (SELECT auth.uid())
                AND ur.name IN ('admin', 'management')
            )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM property_paint_schemes ps
            JOIN properties p ON p.id = ps.property_id
            WHERE ps.id = property_paint_rows.scheme_id
            AND EXISTS (
                SELECT 1 FROM user_roles ur
                JOIN user_role_assignments ura ON ur.id = ura.role_id
                WHERE ura.user_id = (SELECT auth.uid())
                AND ur.name IN ('admin', 'management')
            )
        )
    );

-- Delete access: if user can edit the property
CREATE POLICY "Delete paint rows if can edit property" ON property_paint_rows
    FOR DELETE 
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM property_paint_schemes ps
            JOIN properties p ON p.id = ps.property_id
            WHERE ps.id = property_paint_rows.scheme_id
            AND EXISTS (
                SELECT 1 FROM user_roles ur
                JOIN user_role_assignments ura ON ur.id = ura.role_id
                WHERE ura.user_id = (SELECT auth.uid())
                AND ur.name IN ('admin', 'management')
            )
        )
    );

-- Grant permissions to authenticated users
GRANT ALL ON property_paint_schemes TO authenticated;
GRANT ALL ON property_paint_rows TO authenticated;
GRANT SELECT ON property_paint_colors_v TO authenticated;

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
DROP TRIGGER IF EXISTS update_property_paint_schemes_updated_at ON property_paint_schemes;
CREATE TRIGGER update_property_paint_schemes_updated_at
    BEFORE UPDATE ON property_paint_schemes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_property_paint_rows_updated_at ON property_paint_rows;
CREATE TRIGGER update_property_paint_rows_updated_at
    BEFORE UPDATE ON property_paint_rows
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Success message
SELECT 'Paint Colors setup completed successfully!' as status;
