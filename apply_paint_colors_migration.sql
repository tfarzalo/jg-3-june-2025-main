-- Apply Paint Colors Migration
-- Run this script in your Supabase SQL editor to create the new paint colors tables

-- Create property_paint_schemes table
CREATE TABLE IF NOT EXISTS property_paint_schemes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    floorplan smallint NOT NULL CHECK (floorplan >= 1 AND floorplan <= 5),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(property_id, floorplan)
);

-- Create property_paint_rows table
CREATE TABLE IF NOT EXISTS property_paint_rows (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    scheme_id uuid NOT NULL REFERENCES property_paint_schemes(id) ON DELETE CASCADE,
    room text NOT NULL,
    paint_color text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_property_paint_schemes_property_id ON property_paint_schemes(property_id);
CREATE INDEX IF NOT EXISTS idx_property_paint_schemes_floorplan ON property_paint_schemes(floorplan);
CREATE INDEX IF NOT EXISTS idx_property_paint_rows_scheme_id ON property_paint_rows(scheme_id);
CREATE INDEX IF NOT EXISTS idx_property_paint_rows_sort_order ON property_paint_rows(sort_order);

-- Create view for convenient reads
CREATE OR REPLACE VIEW property_paint_colors_v AS
SELECT 
    ps.id as scheme_id,
    ps.property_id,
    ps.floorplan,
    ps.created_at as scheme_created_at,
    pr.id as row_id,
    pr.room,
    pr.paint_color,
    pr.sort_order,
    pr.created_at as row_created_at
FROM property_paint_schemes ps
LEFT JOIN property_paint_rows pr ON ps.id = pr.scheme_id
ORDER BY ps.floorplan, pr.sort_order, pr.created_at;

-- Enable RLS on both tables
ALTER TABLE property_paint_schemes ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_paint_rows ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for property_paint_schemes
-- Read access: if user can read the property
CREATE POLICY "Read paint schemes if can read property" ON property_paint_schemes
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM properties p
            WHERE p.id = property_paint_schemes.property_id
            AND (
                -- Admin/management can read all
                EXISTS (
                    SELECT 1 FROM user_roles ur
                    WHERE ur.user_id = auth.uid()
                    AND ur.role IN ('admin', 'management')
                )
                -- Subcontractors can read if they have access to the property
                OR EXISTS (
                    SELECT 1 FROM user_roles ur
                    WHERE ur.user_id = auth.uid()
                    AND ur.role = 'subcontractor'
                )
            )
        )
    );

-- Write access: if user can edit the property
CREATE POLICY "Write paint schemes if can edit property" ON property_paint_schemes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM properties p
            WHERE p.id = property_paint_schemes.property_id
            AND EXISTS (
                SELECT 1 FROM user_roles ur
                WHERE ur.user_id = auth.uid()
                AND ur.role IN ('admin', 'management')
            )
        )
    );

-- Create RLS policies for property_paint_rows
-- Read access: if user can read the property
CREATE POLICY "Read paint rows if can read property" ON property_paint_rows
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM property_paint_schemes ps
            JOIN properties p ON p.id = ps.property_id
            WHERE ps.id = property_paint_rows.scheme_id
            AND (
                -- Admin/management can read all
                EXISTS (
                    SELECT 1 FROM user_roles ur
                    WHERE ur.user_id = auth.uid()
                    AND ur.role IN ('admin', 'management')
                )
                -- Subcontractors can read if they have access to the property
                OR EXISTS (
                    SELECT 1 FROM user_roles ur
                    WHERE ur.user_id = auth.uid()
                    AND ur.role = 'subcontractor'
                )
            )
        )
    );

-- Write access: if user can edit the property
CREATE POLICY "Write paint rows if can edit property" ON property_paint_rows
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM property_paint_schemes ps
            JOIN properties p ON p.id = ps.property_id
            WHERE ps.id = property_paint_rows.scheme_id
            AND EXISTS (
                SELECT 1 FROM user_roles ur
                WHERE ur.user_id = auth.uid()
                AND ur.role IN ('admin', 'management')
            )
        )
    );

-- Grant permissions to authenticated users
GRANT ALL ON property_paint_schemes TO authenticated;
GRANT ALL ON property_paint_rows TO authenticated;
GRANT SELECT ON property_paint_colors_v TO authenticated;

-- Success message
SELECT 'Paint Colors migration completed successfully!' as status;
