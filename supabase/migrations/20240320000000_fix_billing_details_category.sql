-- First, let's check if we need to add the category_id column
DO $$ 
BEGIN
    -- Add category_id column to billing_details table if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'billing_details' 
        AND column_name = 'category_id'
    ) THEN
        ALTER TABLE billing_details
        ADD COLUMN category_id UUID REFERENCES job_categories(id);
    END IF;
END $$;

-- Add an index for better query performance
CREATE INDEX IF NOT EXISTS idx_billing_details_category_id ON billing_details(category_id);

-- Note: The category_id will be populated through the application logic
-- when creating or updating billing details 