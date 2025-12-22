# Testing Checklist: File Manager Enhancements

## Pre-Deployment

### Database Migration
- [ ] SQL migration file created: `supabase/migrations/20250120000020_add_rename_folder_function.sql`
- [ ] Migration reviewed for syntax errors
- [ ] Migration ready to deploy

### Code Changes
- [ ] FileManager.tsx modified successfully
- [ ] No TypeScript compilation errors
- [ ] All translation calls converted to dot notation
- [ ] Edit icon imported and added to UI
- [ ] handleRename function updated

## Database Deployment

### Apply Migration
- [ ] Run: `supabase db push` OR apply SQL directly
- [ ] Verify function exists:
  ```sql
  SELECT routine_name FROM information_schema.routines 
  WHERE routine_name = 'rename_folder';
  ```
- [ ] Test function manually (optional):
  ```sql
  SELECT rename_folder(
    '<some-folder-id>'::uuid, 
    'Test New Name'
  );
  ```

## Frontend Testing - English Mode

### Basic Folder Renaming
- [ ] Navigate to File Manager
- [ ] Find a folder (preferably one without children first)
- [ ] Click pencil icon
- [ ] Rename modal opens
- [ ] Current name appears in input field
- [ ] Enter new name
- [ ] Click "Rename"
- [ ] Folder name updates in list
- [ ] No errors in console

### Folder with Files
- [ ] Find a folder containing files
- [ ] Click pencil icon
- [ ] Rename the folder
- [ ] Verify folder renames
- [ ] Click into folder
- [ ] Verify files still visible
- [ ] Click on an image file
- [ ] Verify image displays correctly

### Nested Folders
- [ ] Create a nested folder structure (if not exists)
- [ ] Rename parent folder
- [ ] Verify parent renames
- [ ] Navigate into child folders
- [ ] Verify child folders still accessible
- [ ] Verify files in child folders still work

### File Renaming
- [ ] Click pencil icon on a file (not folder)
- [ ] Rename the file
- [ ] Verify file renames
- [ ] Verify file still opens/downloads correctly

### Edge Cases
- [ ] Try renaming to empty string (should fail)
- [ ] Try renaming with special characters
- [ ] Try very long name (50+ characters)
- [ ] Rename same folder twice in a row
- [ ] Rename folder then immediately navigate into it

### UI/UX
- [ ] Pencil icon visible in list view
- [ ] Pencil icon visible in grid view
- [ ] Icon has hover state
- [ ] Modal is centered and readable
- [ ] Cancel button works
- [ ] X button closes modal
- [ ] Escape key closes modal
- [ ] Enter key submits rename

## Frontend Testing - Spanish Mode

### Access Spanish Mode
- [ ] Add `?lang=es` to File Manager URL
- [ ] Page reloads with Spanish labels

### Verify Translations
- [ ] "File Manager" → "Gestor de Archivos"
- [ ] "New Folder" → "Nueva Carpeta"
- [ ] "Upload Files" → "Subir Archivos"
- [ ] "Rename" → "Renombrar"
- [ ] "Delete" → "Eliminar"
- [ ] "Download" → "Descargar"
- [ ] "Search files..." → "Buscar archivos..."
- [ ] All error messages in Spanish

### Functional Testing in Spanish
- [ ] Create folder in Spanish mode
- [ ] Rename folder in Spanish mode
- [ ] Upload file in Spanish mode
- [ ] Delete file in Spanish mode
- [ ] Search for files in Spanish mode
- [ ] All operations work identically to English

### Modal Translations
- [ ] Rename modal title in Spanish
- [ ] Placeholder text in Spanish
- [ ] Button labels in Spanish
- [ ] Error messages in Spanish

## Work Order Integration

### English Work Order
- [ ] Navigate to New Work Order page
- [ ] Fill out form
- [ ] Upload before images
- [ ] Submit work order
- [ ] Navigate to File Manager
- [ ] Find work order folder
- [ ] Verify images are there
- [ ] Rename the folder
- [ ] Go back to work order details
- [ ] Verify images still display

### Spanish Work Order
- [ ] Navigate to New Work Order page with `?lang=es`
- [ ] Verify form is in Spanish
- [ ] Fill out form in Spanish mode
- [ ] Upload before images
- [ ] Submit work order
- [ ] Navigate to File Manager with `?lang=es`
- [ ] Find work order folder
- [ ] Verify images are there
- [ ] Rename the folder (Spanish UI)
- [ ] Go back to work order details
- [ ] Verify images still display

### Image Upload Component
- [ ] Work order page shows ImageUpload component
- [ ] Upload works in English mode
- [ ] Upload works in Spanish mode
- [ ] Images fetch correctly after upload
- [ ] No console errors during upload

## Performance Testing

### Speed
- [ ] Folder rename completes in < 2 seconds
- [ ] Large folders (10+ files) rename successfully
- [ ] Nested folders (3+ levels) rename successfully
- [ ] Page loads in < 3 seconds

### Browser Compatibility
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile Safari (iOS)
- [ ] Mobile Chrome (Android)

### Responsive Design
- [ ] Desktop view (1920x1080)
- [ ] Laptop view (1366x768)
- [ ] Tablet view (768x1024)
- [ ] Mobile view (375x667)

## Error Handling

### Network Errors
- [ ] Disconnect internet
- [ ] Try to rename folder
- [ ] Appropriate error message shows
- [ ] Reconnect internet
- [ ] Retry rename
- [ ] Works correctly

### Permission Errors
- [ ] Try to rename folder you don't own (if applicable)
- [ ] Appropriate error message
- [ ] No console errors break the app

### Database Errors
- [ ] Invalid folder ID (manually test if possible)
- [ ] Folder already deleted
- [ ] Concurrent rename attempts

## Data Integrity

### After Rename
- [ ] Query database for folder:
  ```sql
  SELECT * FROM files WHERE id = '<folder-id>';
  ```
- [ ] Verify `name` updated
- [ ] Verify `display_path` updated
- [ ] Verify `storage_path` updated correctly (with underscores)

- [ ] Query child files:
  ```sql
  SELECT * FROM files WHERE folder_id = '<folder-id>';
  ```
- [ ] Verify all `path` fields updated
- [ ] Verify all `storage_path` fields updated
- [ ] Verify all `display_path` fields updated

- [ ] Check for orphaned references:
  ```sql
  SELECT * FROM files 
  WHERE path LIKE '%old-folder-name%' 
  AND folder_id = '<folder-id>';
  ```
- [ ] Should return 0 rows

## Cleanup Tasks

### Orphaned Files
- [ ] Navigate to File Manager root
- [ ] Note any files without proper folder assignment
- [ ] Decide: Delete or assign to folder
- [ ] If delete: Use trash icon
- [ ] If assign: Use cleanup script or manual SQL

### Legacy Data
- [ ] Check for files with old path formats
- [ ] Run cleanup scripts if needed
- [ ] Verify all paths follow new convention

## Documentation

### Code Documentation
- [ ] Functions have JSDoc comments
- [ ] Complex logic is commented
- [ ] README files updated

### User Documentation
- [ ] Quick Start Guide reviewed
- [ ] Implementation Summary complete
- [ ] FAQ addresses common issues

## Security

### Authentication
- [ ] Must be logged in to rename
- [ ] Unauthenticated users get error

### Authorization  
- [ ] Can only rename own folders (if applicable)
- [ ] RLS policies enforced
- [ ] No SQL injection vulnerabilities

### Data Validation
- [ ] Empty names rejected
- [ ] Malicious input sanitized
- [ ] Special SQL characters escaped

## Final Checks

### Console
- [ ] No errors in browser console
- [ ] Only expected warnings (if any)
- [ ] Debug logs present for troubleshooting

### Network Tab
- [ ] RPC calls succeed (200 status)
- [ ] No failed requests
- [ ] Reasonable response times

### Database
- [ ] No orphaned records
- [ ] Foreign keys intact
- [ ] Indexes still valid

### User Experience
- [ ] Operations feel responsive
- [ ] Loading states clear
- [ ] Error messages helpful
- [ ] Success feedback visible

## Sign-Off

### Functional Testing
- [ ] All core features work
- [ ] No critical bugs found
- [ ] Edge cases handled

### Performance
- [ ] App responds quickly
- [ ] No memory leaks observed
- [ ] Scales with data

### Documentation
- [ ] User guide complete
- [ ] Technical docs accurate
- [ ] FAQ helpful

### Ready for Production
- [ ] All tests passed
- [ ] Code reviewed
- [ ] Database migrated
- [ ] Users can be trained

---

## Test Results Summary

**Tested by:** _______________
**Date:** _______________
**Environment:** ☐ Development ☐ Staging ☐ Production

**Overall Status:** ☐ Pass ☐ Fail ☐ Pass with issues

**Issues Found:**
1. 
2. 
3. 

**Notes:**


**Approved for Deployment:** ☐ Yes ☐ No

**Signature:** _______________
