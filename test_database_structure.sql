-- Test script to check the current database structure
-- Run this in your Supabase SQL editor to verify the table structure

-- Check if billing_categories table has property_id column
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'billing_categories' 
ORDER BY ordinal_position;

-- Check the actual table structure using valid SQL
SELECT 
    t.table_name,
    c.column_name,
    c.data_type,
    c.is_nullable,
    c.column_default,
    c.ordinal_position
FROM information_schema.tables t
JOIN information_schema.columns c ON t.table_name = c.table_name
WHERE t.table_name = 'billing_categories'
ORDER BY c.ordinal_position;

-- Check if there are any constraints
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'billing_categories'::regclass;

-- Check if there are any policies
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'billing_categories';

-- Check if the property_id column exists and its properties
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    CASE 
        WHEN column_name = 'property_id' THEN 'EXISTS'
        ELSE 'NOT property_id'
    END as property_id_status
FROM information_schema.columns 
WHERE table_name = 'billing_categories' 
    AND column_name = 'property_id';
