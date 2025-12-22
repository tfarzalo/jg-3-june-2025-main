-- Add ceiling_display_label column to work_orders table
ALTER TABLE work_orders 
ADD COLUMN IF NOT EXISTS ceiling_display_label TEXT;

-- Add comment for documentation
COMMENT ON COLUMN work_orders.ceiling_display_label IS 'Human-readable display label for the selected ceiling paint option (e.g., "1 Bedroom", "2 Bedroom", "Paint Individual Ceiling")';

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_work_orders_ceiling_display_label ON work_orders(ceiling_display_label);
