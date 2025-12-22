# Working Days Migration Guide - Resolving Syntax Error

## Issue Description
The original migration failed with this error:
```
ERROR: 42601: syntax error at or near "working_days"
LINE 1: working_days JSONB DEFAULT '{
```

## Root Cause Analysis
The error typically occurs due to:
1. **Complex JSONB Default**: The JSONB default value with nested quotes can cause parsing issues
2. **Table Structure**: The profiles table might not exist or have different structure
3. **PostgreSQL Version**: Some PostgreSQL versions have issues with complex JSONB defaults

## Solution: Step-by-Step Migration

### Option 1: Use the Simple Migration (Recommended)
Run the simplified migration file: `supabase/migrations/20250103000001_add_working_days_simple.sql`

This approach:
- Adds the column without a complex default
- Sets values after column creation
- Uses `IF NOT EXISTS` to prevent errors
- Avoids complex JSONB default syntax

### Option 2: Manual Step-by-Step Migration
If the simple migration still fails, run these commands manually:

```sql
-- Step 1: Add the column
ALTER TABLE profiles ADD COLUMN working_days JSONB;

-- Step 2: Set default values for subcontractors
UPDATE profiles 
SET working_days = '{"monday": true, "tuesday": true, "wednesday": true, "thursday": true, "friday": true, "saturday": false, "sunday": false}'::jsonb
WHERE role = 'subcontractor';

-- Step 3: Set default values for other users
UPDATE profiles 
SET working_days = '{"monday": true, "tuesday": true, "wednesday": true, "thursday": true, "friday": true, "saturday": false, "sunday": false}'::jsonb
WHERE working_days IS NULL;

-- Step 4: Create index
CREATE INDEX idx_profiles_working_days ON profiles USING GIN (working_days);
```

### Option 3: Test and Debug
Run the test script `test_working_days_migration.sql` to:
- Verify the profiles table exists
- Check current table structure
- Test JSONB operations
- Identify any existing issues

## Troubleshooting Steps

### 1. Verify Table Exists
```sql
SELECT table_name FROM information_schema.tables WHERE table_name = 'profiles';
```

### 2. Check Table Structure
```sql
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'profiles';
```

### 3. Test JSONB Syntax
```sql
SELECT '{"test": true}'::jsonb;
```

### 4. Check PostgreSQL Version
```sql
SELECT version();
```

## Common Issues and Solutions

### Issue: "Table profiles does not exist"
**Solution**: Ensure the profiles table is created before running this migration

### Issue: "Column working_days already exists"
**Solution**: Use `ADD COLUMN IF NOT EXISTS` or drop the column first

### Issue: "Invalid JSONB syntax"
**Solution**: Verify the JSON string is properly formatted and escaped

### Issue: "Permission denied"
**Solution**: Ensure you have ALTER TABLE permissions on the profiles table

## Migration Verification

After successful migration, verify:

1. **Column Added**: Check if working_days column exists
2. **Data Populated**: Verify default values are set
3. **Index Created**: Confirm the GIN index exists
4. **Functionality**: Test the availability utilities

## Rollback Plan

If migration fails and needs to be rolled back:

```sql
-- Remove the column
ALTER TABLE profiles DROP COLUMN IF EXISTS working_days;

-- Remove the index
DROP INDEX IF EXISTS idx_profiles_working_days;
```

## Next Steps

1. **Run Simple Migration**: Use `20250103000001_add_working_days_simple.sql`
2. **Test Functionality**: Verify the column works correctly
3. **Update Application**: Test the SubcontractorEditPage
4. **Verify Integration**: Ensure availability utilities work

## Support

If issues persist:
1. Check PostgreSQL error logs
2. Verify table structure and permissions
3. Test with simpler SQL commands first
4. Consider running migration in smaller steps
