-- Add additional_services column to work_orders if it doesn't exist
-- This allows storing dynamic service selections (quantity, billing_detail_id, description)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'work_orders'
        AND column_name = 'additional_services'
    ) THEN
        ALTER TABLE work_orders ADD COLUMN additional_services JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;
