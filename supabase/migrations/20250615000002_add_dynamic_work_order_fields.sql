-- Add include_in_work_order to billing_categories
ALTER TABLE billing_categories 
ADD COLUMN IF NOT EXISTS include_in_work_order boolean DEFAULT false;

-- Add additional_services to work_orders
ALTER TABLE work_orders 
ADD COLUMN IF NOT EXISTS additional_services jsonb DEFAULT '{}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN billing_categories.include_in_work_order IS 'If true, this category appears as a dynamic input field on the Work Order form';
COMMENT ON COLUMN work_orders.additional_services IS 'Stores dynamic billing items in JSON format: { category_id: { quantity, billing_detail_id } }';
