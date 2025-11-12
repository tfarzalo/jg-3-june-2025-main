# Property File Upload & Cleanup Complete Solution

## Overview
This solution ensures that property folders are ALWAYS created before any file uploads, and provides scripts to clean up orphaned files.

## The Problem

### Issue 1: Orphaned Files
Files appearing in root File Manager folder without proper folder assignment.

### Issue 2: Property Unit Map Upload Timing
When creating a new property, the unit map upload happens before the property folder structure exists, causing files to be orphaned or fail to upload.

## The Solution

### 1. Database-Level Folder Creation Trigger
- Property folders are created **automatically** when a property is inserted
- Trigger fires immediately after property creation
- Ensures folders exist before any frontend code attempts to upload files

### 2. Frontend Safety Check
- Added `prepare_property_for_file_upload()` RPC call before uploads
- Ensures folders exist even if trigger failed
- Returns folder IDs for proper file assignment

### 3. Enhanced File Upload Logic
- Updated `uploadPropertyUnitMap()` to call preparation function first
- Adds comprehensive logging for debugging
- Properly assigns files to `Property Files` folder with correct `folder_id`

## Files Changed

### SQL Migrations
1. **`supabase/migrations/20250120000021_fix_property_folder_upload.sql`**
   - Creates `ensure_property_folders_exist()` function
   - Creates `prepare_property_for_file_upload()` function
   - Adds trigger to auto-create folders on property insert
   - Backfills existing properties
   - Adds display_path and storage_path columns

2. **`cleanup_and_assign_orphaned_files.sql`**
   - Identifies orphaned files
   - Option A: Delete orphaned files
   - Option B: Assign to correct folders
   - Verification queries

3. **`ensure_property_folders_before_upload.sql`**
   - Detailed version with more documentation
   - Verification queries
   - Manual fix procedures

### Frontend Code
1. **`src/lib/utils/fileUpload.ts`**
   - Updated `uploadPropertyUnitMap()` function
   - Calls `prepare_property_for_file_upload` before upload
   - Enhanced error handling and logging
   - Properly sets folder_id, display_path, and storage_path

## Deployment Steps

### Step 1: Apply Main Migration
```bash
# Option A: Using Supabase CLI
supabase db push

# Option B: Manual via SQL Editor
# Copy and run: supabase/migrations/20250120000021_fix_property_folder_upload.sql
```

### Step 2: Clean Up Orphaned Files

**Review orphaned files:**
```sql
SELECT id, name, path, property_id, job_id, folder_id, created_at
FROM files
WHERE folder_id IS NULL 
  AND type != 'folder/directory'
ORDER BY created_at DESC;
```

**Choose cleanup method:**

**Option A - Delete all orphaned files** (if not needed):
```bash
# Run the DELETE section in: cleanup_and_assign_orphaned_files.sql
# Uncomment the DO block marked "OPTION A"
```

**Option B - Assign to correct folders** (recommended):
```bash
# Run the DO block marked "OPTION B" in: cleanup_and_assign_orphaned_files.sql
# This will attempt to match files to their correct property/job folders
```

### Step 3: Verify Everything

```sql
-- Check for remaining orphaned files
SELECT COUNT(*) as remaining_orphaned_files
FROM files
WHERE folder_id IS NULL 
  AND type != 'folder/directory';

-- Should return 0

-- Check all properties have complete folder structures
SELECT 
    p.id,
    p.property_name,
    COUNT(DISTINCT CASE WHEN f.name = 'Work Orders' THEN f.id END) as has_work_orders_folder,
    COUNT(DISTINCT CASE WHEN f.name = 'Property Files' THEN f.id END) as has_property_files_folder
FROM properties p
LEFT JOIN files f ON f.property_id = p.id AND f.type = 'folder/directory'
GROUP BY p.id, p.property_name
HAVING 
    COUNT(DISTINCT CASE WHEN f.name = 'Work Orders' THEN f.id END) = 0
    OR COUNT(DISTINCT CASE WHEN f.name = 'Property Files' THEN f.id END) = 0;

-- Should return no rows
```

### Step 4: Frontend Deployment
The frontend changes in `fileUpload.ts` are already in place. Just commit and deploy:
```bash
git add src/lib/utils/fileUpload.ts
git commit -m "Fix property unit map upload timing issue"
git push
```

## How It Works Now

### Property Creation Flow

```
1. User fills out "Add Property" form
2. User selects unit map image (optional)
3. User clicks "Create Property"
   ↓
4. Frontend: supabase.from('properties').insert()
   ↓
5. Database Trigger fires IMMEDIATELY:
   - Creates property root folder
   - Creates "Work Orders" subfolder  
   - Creates "Property Files" subfolder
   ↓
6. Frontend: PropertyForm receives new property ID
   ↓
7. Frontend: If unit map selected, calls uploadPropertyUnitMap()
   ↓
8. uploadPropertyUnitMap() calls prepare_property_for_file_upload()
   - Verifies folders exist (they do!)
   - Returns folder IDs
   ↓
9. File uploaded to storage with correct path
   ↓
10. File record created in database with correct folder_id
   ↓
11. Property updated with unit_map_file_id reference
   ↓
12. SUCCESS! File properly organized in Property Files folder
```

### Property Edit Flow

```
1. User navigates to existing property
2. User clicks "Edit"
3. User selects new unit map image
4. User clicks "Save"
   ↓
5. Frontend: Calls uploadPropertyUnitMap()
   ↓
6. uploadPropertyUnitMap() calls prepare_property_for_file_upload()
   - Checks if folders exist
   - If missing, creates them (shouldn't happen but safe!)
   - Returns folder IDs
   ↓
7. File uploaded and assigned correctly
   ↓
8. Old unit map file deleted (if exists)
   ↓
9. SUCCESS! New file properly organized
```

## Testing Checklist

### Test 1: New Property with Unit Map
- [ ] Create new property
- [ ] Upload unit map during creation
- [ ] Submit form
- [ ] Go to File Manager
- [ ] Navigate to property folder → Property Files
- [ ] Verify unit map is there with correct folder_id
- [ ] Go to Property Details page
- [ ] Verify unit map displays correctly

### Test 2: Edit Existing Property - Add Unit Map
- [ ] Open existing property without unit map
- [ ] Click Edit
- [ ] Upload unit map
- [ ] Save
- [ ] Verify file appears in Property Files folder
- [ ] Verify displays on property details page

### Test 3: Edit Existing Property - Replace Unit Map
- [ ] Open existing property with unit map
- [ ] Click Edit
- [ ] Upload different unit map
- [ ] Save
- [ ] Verify new file in Property Files folder
- [ ] Verify old file deleted
- [ ] Verify new map displays on property details page

### Test 4: Cleanup Orphaned Files
- [ ] Run query to find orphaned files
- [ ] Note count
- [ ] Run cleanup script (Option B recommended)
- [ ] Verify files assigned to correct folders
- [ ] Check File Manager - no files in root
- [ ] Verify images still display in their original locations

### Test 5: Folder Structure Auto-Creation
- [ ] Query database for properties without folders
- [ ] Run backfill script
- [ ] Verify all properties now have folders
- [ ] Try uploading file to previously folderless property
- [ ] Verify upload works correctly

## SQL Commands Quick Reference

### Find Orphaned Files
```sql
SELECT id, name, path, property_id, job_id, folder_id
FROM files
WHERE folder_id IS NULL AND type != 'folder/directory'
ORDER BY created_at DESC;
```

### Delete Single Orphaned File
```sql
-- First, delete from storage (if needed)
-- Then delete from database
DELETE FROM files WHERE id = '<file-id>';
```

### Assign Single File to Folder
```sql
UPDATE files
SET folder_id = '<folder-id>'
WHERE id = '<file-id>';
```

### Find Property Files Folder ID
```sql
SELECT id, name, path
FROM files
WHERE property_id = '<property-id>'
  AND name = 'Property Files'
  AND type = 'folder/directory';
```

### Check Property Folder Structure
```sql
SELECT 
    f.id,
    f.name,
    f.type,
    f.path,
    f.folder_id
FROM files f
WHERE f.property_id = '<property-id>'
  AND f.type = 'folder/directory'
ORDER BY f.path;
```

### Manually Create Folders for Property
```sql
SELECT * FROM ensure_property_folders_exist(
    '<property-id>'::uuid,
    '<property-name>'
);
```

### Test prepare_property_for_file_upload
```sql
SELECT * FROM prepare_property_for_file_upload('<property-id>'::uuid);

-- Should return JSON like:
-- {
--   "success": true,
--   "property_folder_id": "...",
--   "work_orders_folder_id": "...",
--   "property_files_folder_id": "...",
--   "folders_existed": true,
--   "folders_created": false,
--   "message": "Folders already exist"
-- }
```

## Troubleshooting

### Issue: Files still appearing in root
**Cause:** Old files not cleaned up yet
**Solution:** Run cleanup script in Step 2

### Issue: New uploads still fail
**Cause:** Migration not applied
**Solution:** Verify migration applied with:
```sql
SELECT routine_name FROM information_schema.routines 
WHERE routine_name IN ('ensure_property_folders_exist', 'prepare_property_for_file_upload');
```

### Issue: Trigger not firing
**Cause:** Trigger not created
**Solution:** Check trigger exists:
```sql
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'property_create_folders_trigger';
```

### Issue: Unit map not displaying
**Cause:** File path mismatch or missing folder_id
**Solution:** Check file record:
```sql
SELECT id, name, path, storage_path, display_path, folder_id, property_id
FROM files
WHERE property_id = '<property-id>'
  AND name LIKE '%unit-map%';
```

## Additional Notes

### Display Path vs Storage Path
- **display_path**: User-friendly with spaces (e.g., "Property Name/Property Files/file.jpg")
- **storage_path**: Sanitized for storage (e.g., "Property_Name/Property_Files/file.jpg")
- Both are maintained automatically

### Folder ID Assignment
- **Critical**: Every file must have a `folder_id` (except root folders)
- Files without `folder_id` appear orphaned in File Manager
- The upload function now ensures this is always set correctly

### Spanish Mode Support
- All functionality works identically in Spanish mode
- Language only affects UI labels, not data or folder structure
- Use `?lang=es` parameter as before

## Success Criteria

✅ No orphaned files in root File Manager folder
✅ All properties have complete folder structure
✅ Unit map uploads work during property creation
✅ Unit map uploads work during property edit
✅ All files have correct folder_id assignment
✅ Images display correctly on property details page
✅ File paths are consistent (display vs storage)
✅ Trigger auto-creates folders for new properties
✅ Frontend calls safety function before upload

## Rollback Plan

If something goes wrong:

```sql
-- Drop the trigger
DROP TRIGGER IF EXISTS property_create_folders_trigger ON properties;

-- Drop the functions
DROP FUNCTION IF EXISTS ensure_property_folders_exist(UUID, TEXT);
DROP FUNCTION IF EXISTS prepare_property_for_file_upload(UUID);
DROP FUNCTION IF EXISTS trigger_create_property_folders();

-- Revert frontend changes
git revert <commit-hash>
```

## Conclusion

This solution provides:
1. **Automatic** folder creation via database trigger
2. **Safe** file uploads with preparation function
3. **Clean** File Manager without orphaned files
4. **Proper** folder_id assignment for all files
5. **Complete** path tracking (display + storage)
6. **Comprehensive** logging for debugging

The root cause (timing issue) is completely resolved. Folders are created **before** frontend code attempts any uploads.
