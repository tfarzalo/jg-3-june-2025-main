# How to Run SQL Files in Supabase

## ⚠️ Important Note
**DO NOT** try to run `.md` (Markdown) files in Supabase SQL Editor!
Only run `.sql` files.

---

## Files to Run (In Order)

### Step 1: Run Main Migration
**File:** `RUN_THIS_MIGRATION.sql`

1. Open Supabase Dashboard
2. Go to SQL Editor
3. Click "New Query"
4. Open the file `RUN_THIS_MIGRATION.sql` in a text editor
5. Copy the **entire contents** of the file
6. Paste into Supabase SQL Editor
7. Click "Run" or press Cmd+Enter (Mac) / Ctrl+Enter (Windows)

**What it does:**
- Creates `ensure_property_folders_exist()` function
- Creates `prepare_property_for_file_upload()` RPC function
- Creates trigger for automatic property folder creation
- Cleans up orphaned files

---

### Step 2: Run Property Folder Preparation
**File:** `ensure_property_folders_before_upload.sql`

1. In Supabase SQL Editor, click "New Query"
2. Open the file `ensure_property_folders_before_upload.sql` in a text editor
3. Copy the **entire contents** of the file
4. Paste into Supabase SQL Editor
5. Click "Run"

**What it does:**
- Creates folders for any existing properties that don't have them
- Assigns orphaned files to their correct folders
- Fixes any folder_id mismatches

---

### Step 3: Verify Everything Worked
**File:** `QUICK_SQL_COMMANDS.sql` (Optional - for testing)

This file contains useful queries for checking your database state:
- Check if folders exist for all properties
- Find orphaned files
- Verify folder structure
- Test upload functionality

You can copy individual queries from this file and run them one at a time to verify everything is working correctly.

---

## Common Errors

### Error: "relation already exists"
**Solution:** This is usually safe to ignore. It means the function/table/trigger already exists from a previous run.

### Error: "ambiguous column reference"
**Solution:** This should be fixed in the provided SQL files. If you see this, make sure you're using the latest version of the files.

### Error: "permission denied"
**Solution:** Make sure you're running the queries as the database owner (usually the default in Supabase SQL Editor).

---

## After Running the SQL Files

### Frontend Changes (Already Done)
The following files have been updated and should already be in your codebase:
- `src/lib/utils/fileUpload.ts` - Calls `prepare_property_for_file_upload` before uploads
- `src/components/ImageUpload.tsx` - Enhanced error logging
- `src/components/FileManager.tsx` - Folder management and i18n

### Test the System
1. **Create a new property** - folders should be created automatically
2. **Upload a unit map** - should go into the correct folder
3. **Create a work order** - images should be in the right work order folder
4. **Check File Manager** - all files should be organized correctly

---

## Documentation Files (DO NOT RUN THESE)

These are **documentation only** - read them, don't run them:
- ✅ `PROPERTY_UPLOAD_FIX_COMPLETE_GUIDE.md` - Comprehensive guide
- ✅ `START_HERE_PROPERTY_FIX.md` - Quick start guide
- ✅ `COMPREHENSIVE_FILE_MANAGEMENT_IMPLEMENTATION.md` - Technical details
- ✅ `DEPLOYMENT.md` - Deployment instructions

---

## Need Help?

If you encounter any issues:
1. Check the error message in Supabase SQL Editor
2. Review the `QUICK_SQL_COMMANDS.sql` file for diagnostic queries
3. Check the browser console for frontend errors
4. Review the documentation files for troubleshooting tips

---

## Summary

✅ **Run:** `RUN_THIS_MIGRATION.sql` (Step 1)  
✅ **Run:** `ensure_property_folders_before_upload.sql` (Step 2)  
📖 **Read:** All `.md` files for context and troubleshooting  
🧪 **Use:** `QUICK_SQL_COMMANDS.sql` for testing and verification  

---

**That's it! Your file upload system should now be fully functional.**
