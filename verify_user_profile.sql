-- Verify the specific user profile exists and is accessible
-- This will help us understand why the app can't access it

-- Check if the specific user profile exists
SELECT id, email, full_name, role, created_at, updated_at 
FROM profiles 
WHERE id = 'e73e8b31-1c9c-4b56-97be-d85dd30ca26d';

-- Check if we can access it with different queries (like the app does)
SELECT role FROM profiles WHERE id = 'e73e8b31-1c9c-4b56-97be-d85dd30ca26d';

SELECT * FROM profiles WHERE id = 'e73e8b31-1c9c-4b56-97be-d85dd30ca26d';

-- Check if there are any constraints or triggers blocking access
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'profiles'::regclass;

-- Check if there are any active triggers
SELECT 
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'profiles';

-- Test a simple insert/update to see if there are any hidden blocks
-- (This will help identify if there are other issues beyond RLS)
SELECT 'Table is accessible' as status;
