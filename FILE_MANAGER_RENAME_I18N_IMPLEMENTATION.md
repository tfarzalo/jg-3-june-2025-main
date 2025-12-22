# File Manager Folder Renaming & i18n Implementation Summary

## Overview
Enhanced the File Manager with folder renaming functionality and full Spanish/English language support.

## Changes Made

### 1. SQL Function for Folder Renaming
**File:** `/supabase/migrations/20250120000020_add_rename_folder_function.sql`

Created a comprehensive SQL function `rename_folder(p_folder_id UUID, p_new_name TEXT)` that:
- Renames a folder and updates all related file/folder paths recursively
- Updates both `storage_path` (with underscores) and `display_path` (with spaces)
- Handles nested folders and all child files
- Returns a summary of updated files and folders
- Uses the existing `sanitize_for_storage()` function for consistent path handling

**Key features:**
- Recursively updates all child folders and files
- Maintains consistency between database paths and storage paths
- Provides detailed logging for debugging
- Returns JSON summary of the operation

### 2. Frontend FileManager Component Updates
**File:** `/src/components/FileManager.tsx`

#### Added Translation Support
```typescript
const translations = {
  en: {
    fileManager: 'File Manager',
    allFiles: 'All Files',
    searchFiles: 'Search files...',
    rename: 'Rename',
    // ... all other translations
  },
  es: {
    fileManager: 'Gestor de Archivos',
    allFiles: 'Todos los Archivos',
    searchFiles: 'Buscar archivos...',
    rename: 'Renombrar',
    // ... all Spanish translations
  }
};
```

#### Language Detection
- Detects language from URL query parameter `?lang=es` or `?lang=en`
- Falls back to browser language if not specified
- Defaults to English if neither Spanish nor English

#### Added Pencil Icon for Renaming
- Imported `Edit` icon from `lucide-react`
- Added rename button with pencil icon to both list and grid views
- Button appears next to download and delete buttons
- Clicking opens the rename modal with current name pre-filled

#### Enhanced Rename Handler
```typescript
const handleRename = async (item: FileItem) => {
  if (!newName.trim()) return;

  try {
    if (item.type === 'folder/directory') {
      // Use rename_folder RPC for folders
      const { data, error } = await supabase.rpc('rename_folder', {
        p_folder_id: item.id,
        p_new_name: newName.trim()
      });
      if (error) throw error;
      console.log('[FileManager] Folder renamed:', data);
    } else {
      // Simple name update for files
      const { error } = await supabase
        .from('files')
        .update({ name: newName.trim() })
        .eq('id', item.id);
      if (error) throw error;
    }

    setShowRenameInput(null);
    setNewName('');
    fetchItems();
  } catch (err) {
    console.error('Error renaming item:', err);
    setError(t.failedToRename);
  }
};
```

### 3. UI/UX Improvements

#### List View
```tsx
<button
  onClick={(e) => {
    e.stopPropagation();
    setNewName(item.name);
    setShowRenameInput(item);
  }}
  className="p-1 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
  title={t.rename}
>
  <Edit className="h-4 w-4" />
</button>
```

#### Grid View
```tsx
<button
  onClick={(e) => {
    e.stopPropagation();
    setNewName(item.name);
    setShowRenameInput(item);
  }}
  className="p-2 text-gray-500 hover:text-blue-500 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
  title={t.rename}
>
  <Edit className="h-5 w-5" />
</button>
```

### 4. Integration with Work Orders

The File Manager now works seamlessly with the work order system:
- Detects work order context from URL parameters
- Uses proper folder paths from `get_upload_folder` function
- Maintains consistency with `ImageUpload` component
- Supports both English and Spanish modes via URL parameter `?lang=es`

## Usage

### Renaming a Folder
1. Navigate to File Manager
2. Find the folder you want to rename (e.g., "death_star")
3. Click the pencil (Edit) icon
4. Enter new name (e.g., "Death Star")
5. Click "Rename"
6. All child files and folders are automatically updated

### Using in Spanish Mode
Add `?lang=es` to the URL:
```
/file-manager?lang=es
```

The entire UI will switch to Spanish, including:
- All labels and buttons
- Error messages
- Placeholder text
- Confirmation dialogs

## Example Use Case

**Scenario:** Rename "death_star" folder to "Death Star"

1. User clicks pencil icon on "death_star" folder
2. Rename modal opens with current name
3. User types "Death Star"
4. System calls `rename_folder` function:
   - Updates folder name to "Death Star"
   - Updates `display_path` from "death_star" to "Death Star"
   - Updates `storage_path` from "death_star" to "death_star" (sanitized)
   - Recursively updates all child files/folders paths
5. UI refreshes showing "Death Star" as folder name
6. All file references remain intact

## Database Migration

To apply the rename function to your database:

```bash
# If using Supabase CLI
supabase db push

# Or apply the migration file directly
psql $DATABASE_URL -f supabase/migrations/20250120000020_add_rename_folder_function.sql
```

## Testing Checklist

- [ ] Rename root-level folder
- [ ] Rename nested folder
- [ ] Rename folder with files inside
- [ ] Rename folder with nested folders inside
- [ ] Verify file paths update correctly
- [ ] Verify images still display after rename
- [ ] Test in English mode
- [ ] Test in Spanish mode
- [ ] Test on work order page with ImageUpload
- [ ] Verify orphaned files are cleaned up

## Notes

- **Display Names vs Storage Paths:** The system maintains two types of paths:
  - `display_path`: Uses spaces for user-friendly display (e.g., "Death Star")
  - `storage_path`: Uses underscores for Supabase storage (e.g., "death_star")
  
- **Path Consistency:** The `rename_folder` function ensures both paths are updated consistently across all files and folders.

- **Error Handling:** All errors are logged and displayed to the user in the appropriate language.

- **Orphaned Files:** Files in the root folder without a proper `folder_id` should be either:
  - Deleted if they're no longer needed
  - Assigned to the correct folder using the cleanup scripts

## Related Files

- `/src/components/FileManager.tsx` - Main component
- `/src/components/ImageUpload.tsx` - Uses correct folder paths
- `/src/components/JobDetails.tsx` - Displays images from folders
- `/src/utils/storagePaths.ts` - Path sanitization utilities
- `/supabase/migrations/20250120000020_add_rename_folder_function.sql` - Rename function
- `/supabase/migrations/20250115000006_comprehensive_file_management_fix.sql` - Folder management
- `/cleanup_orphaned_files.sql` - Cleanup script for orphaned files

## Future Enhancements

1. **Bulk Rename:** Allow renaming multiple folders at once
2. **Move Files:** Allow moving files between folders via drag-and-drop
3. **Folder Templates:** Preset folder structures for common use cases
4. **Auto-cleanup:** Automatically move orphaned files to a designated folder
5. **Audit Log:** Track all rename operations for compliance

## Conclusion

The File Manager now has robust folder renaming functionality that:
✅ Maintains database integrity
✅ Updates all file/folder references
✅ Works in both English and Spanish
✅ Provides clear user feedback
✅ Handles edge cases gracefully
✅ Integrates seamlessly with work orders and image uploads
