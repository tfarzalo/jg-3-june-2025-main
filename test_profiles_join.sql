-- Quick diagnostic - test the problematic section
-- This will tell us exactly what's wrong

-- Test 1: Check if the profiles join works
SELECT 
    wo.id,
    wo.created_at,
    wo.prepared_by,
    u.full_name,
    u.email,
    COALESCE(u.full_name, u.email, 'System') as submitted_by_name
FROM work_orders wo
LEFT JOIN profiles u ON u.id = wo.prepared_by
WHERE wo.is_active = true
LIMIT 1;

-- Test 2: Check if there's an issue with the profiles table columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'profiles'
AND column_name IN ('id', 'full_name', 'email');
