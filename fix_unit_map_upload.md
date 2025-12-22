# Fix Unit Map Upload Issue

The unit map file has spaces in its path which causes issues with Supabase storage URLs. Here's how to fix it:

## Problem
- File path: `1010 Dilworth/Property Files/unit-map-1757052576.554619-unit-map-1757052573882-dilworth-prop-map.png`
- Spaces in the path cause 400 errors when accessing the file
- Supabase storage doesn't handle spaces well in URLs

## Solution

### Option 1: Re-upload the Unit Map (Recommended)
1. Go to the property edit page
2. Delete the current unit map
3. Upload the same image again
4. The new upload will use the sanitized path format: `1010_Dilworth/Property_Files/unit-map-...`

### Option 2: Run Database Migration
1. Run the migration `20250120000011_fix_spaces_in_file_paths.sql`
2. This will update the database paths to use underscores instead of spaces
3. Note: The actual file in storage will still have spaces, so you may still need to re-upload

### Option 3: Manual Storage Fix (Advanced)
1. Go to Supabase Dashboard > Storage
2. Navigate to the `files` bucket
3. Find the file with spaces in the path
4. Download the file
5. Upload it again with the sanitized path (replace spaces with underscores)
6. Update the database record to match the new path

## Prevention
The file upload function has been updated to automatically sanitize property names, so future uploads won't have this issue.

## Debug Information
Run the `check_storage_files.sql` query to see what's currently in the database for this property.
