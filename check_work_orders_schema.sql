-- Check work_orders table schema to see what fields are available
-- Run this to see if created_at and user_id (or similar) fields exist

SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'work_orders'
ORDER BY ordinal_position;
