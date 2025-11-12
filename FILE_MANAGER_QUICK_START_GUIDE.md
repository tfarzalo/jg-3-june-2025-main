# Quick Start Guide: File Manager Folder Renaming & Spanish Support

## Renaming a Folder

### Step-by-Step
1. **Navigate to File Manager**
2. **Find the folder** you want to rename
3. **Click the pencil icon** (✏️) next to the folder name
4. **Enter the new name** in the modal dialog
5. **Click "Rename"** button
6. **Done!** All files and subfolders are automatically updated

### Example
- **Old Name**: `death_star`
- **New Name**: `Death Star`
- **Result**: Folder displays as "Death Star" to users, stored as "death_star" in database

## Using Spanish Mode

### Quick Switch
Add `?lang=es` to any URL:

```
English: https://yourapp.com/file-manager
Spanish: https://yourapp.com/file-manager?lang=es

English: https://yourapp.com/work-orders/new
Spanish: https://yourapp.com/work-orders/new?lang=es
```

### What Changes
- All button labels (Upload → Subir, Delete → Eliminar)
- Menu items
- Error messages
- Placeholder text
- Confirmation dialogs

### What Stays the Same
- File names
- Folder names
- User data
- Functionality

## Common Tasks

### Clean Up Orphaned Files
If you see files in the root File Manager folder that should be in job folders:

1. **Option A - Delete them**:
   - Select the file
   - Click trash icon
   - Confirm deletion

2. **Option B - Use cleanup script**:
   ```sql
   -- Run the cleanup script to auto-assign files to correct folders
   -- Ask developer to run: cleanup_orphaned_files.sql
   ```

### Rename Multiple Folders
Currently must rename one at a time:
1. Rename first folder
2. Wait for confirmation
3. Rename next folder
4. Repeat as needed

### Fix Naming Mistakes
If you make a typo while renaming:
1. Click pencil icon again
2. Enter correct name
3. Save
No limit to how many times you can rename

## Troubleshooting

### "Failed to rename folder"
**Possible causes:**
- Network connection issue
- Database timeout
- Permission problem

**Solution:**
1. Check internet connection
2. Try again
3. Contact support if persists

### Folder renamed but files not showing
**Possible causes:**
- Browser cache
- Page not refreshed

**Solution:**
1. Refresh the page (F5 or Cmd+R)
2. Clear browser cache
3. Log out and back in

### Spanish mode not working
**Possible causes:**
- Incorrect URL parameter
- URL copied without parameter

**Solution:**
1. Ensure URL has `?lang=es` at the end
2. Bookmark the Spanish version
3. Clear browser cache if needed

## Tips & Best Practices

### Folder Naming
✅ **Good names:**
- "Main Bedroom"
- "Kitchen Cabinets"
- "Before Photos"
- "Unit 101"

❌ **Avoid:**
- Special characters (!, @, #, $, %)
- Very long names (keep under 50 characters)
- Only numbers (confusing in lists)

### Organization
- Use clear, descriptive names
- Be consistent with naming conventions
- Keep folder structure simple
- Rename folders as soon as you notice issues

### Language Switching
- Set language at start of session
- Keep URL with `?lang=es` bookmarked
- All features work the same in both languages

## Keyboard Shortcuts

When rename modal is open:
- **Enter** → Save/Rename
- **Escape** → Cancel
- **Tab** → Move between fields

## Mobile Usage

Works on phones and tablets:
- Tap pencil icon to rename
- Type new name
- Tap "Rename" button
- All features responsive

## Support

Need help?
1. Check this guide first
2. Review the detailed documentation:
   - `FILE_MANAGER_RENAME_I18N_IMPLEMENTATION.md`
   - `COMPLETE_FILE_MANAGER_IMPLEMENTATION_SUMMARY.md`
3. Contact development team

## FAQ

**Q: Will renaming a folder break any links?**
A: No, all references are automatically updated.

**Q: Can I undo a rename?**
A: Just rename it back to the original name.

**Q: Does Spanish mode change my data?**
A: No, only the interface language changes, not your data.

**Q: Can I rename files too?**
A: Yes, click the pencil icon on any file.

**Q: What happens to nested folders?**
A: They're all updated automatically when you rename a parent folder.

**Q: Can other users see my renamed folders?**
A: Yes, folder names are shared across all users.

**Q: How do I switch back to English?**
A: Remove `?lang=es` from URL or use `?lang=en`

---

## Quick Reference Table

| Task | English | Spanish |
|------|---------|---------|
| Rename | Click pencil → Enter name → Rename | Click lápiz → Ingresar nombre → Renombrar |
| Upload | Click "Upload Files" | Click "Subir Archivos" |
| Delete | Click trash icon | Click icono de basura |
| Search | Type in search box | Escribir en cuadro de búsqueda |
| New Folder | Click "New Folder" | Click "Nueva Carpeta" |

---

Last Updated: November 11, 2025
