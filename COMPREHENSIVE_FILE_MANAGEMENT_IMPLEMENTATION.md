# Comprehensive File Management System Implementation

## Overview

This implementation provides a complete file management system with proper folder organization, automatic folder creation, and support for both property-related files and user-created folders.

## Key Features Implemented

### 1. Property Folder Structure
- **Property Root Folder**: `/{Property Name}`
- **Work Orders Subfolder**: `/{Property Name}/Work Orders`
- **Property Files Subfolder**: `/{Property Name}/Property Files`

### 2. Work Order Folder Structure
- **Work Order Folder**: `/{Property Name}/Work Orders/WO-XXXXXX`
- **Before Images**: `/{Property Name}/Work Orders/WO-XXXXXX/Before Images`
- **Sprinkler Images**: `/{Property Name}/Work Orders/WO-XXXXXX/Sprinkler Images`
- **Other Files**: `/{Property Name}/Work Orders/WO-XXXXXX/Other Files`

### 3. Unit Map Storage
- Unit map files are now stored in: `/{Property Name}/Property Files/unit-map-{timestamp}-{filename}`
- Fixed display issue by changing from `object-cover` to `object-contain` for better image display

### 4. Automatic Folder Creation
- Property folders are automatically created when new properties are added
- Work order folders are automatically created when new work orders are created
- All subfolders (Before Images, Sprinkler Images, Other Files) are created automatically

### 5. User-Created Folders
- Users can create custom folders for general file storage
- Folders can be created at any level in the hierarchy
- Proper path management ensures no conflicts

## Database Functions Created

### Core Functions

1. **`create_property_folder_structure(p_property_id, p_property_name)`**
   - Creates the complete property folder structure
   - Returns folder IDs for Work Orders and Property Files

2. **`create_work_order_folder_structure(p_property_id, p_property_name, p_work_order_num, p_job_id)`**
   - Creates work order folder structure with all subfolders
   - Returns folder IDs for Before Images, Sprinkler Images, and Other Files

3. **`get_upload_folder(p_property_id, p_job_id, p_folder_type)`**
   - Returns the appropriate folder ID for file uploads
   - Handles property files and work order files automatically

4. **`create_user_folder(p_name, p_parent_folder_id)`**
   - Allows users to create custom folders
   - Handles path generation and conflict resolution

5. **`handle_unit_map_upload(p_property_id, p_file_name, p_file_path, p_file_size, p_file_type, p_uploaded_by)`**
   - Updated to use Property Files folder
   - Ensures proper folder structure exists

### Cleanup Functions

1. **`identify_orphaned_files()`**
   - Identifies files not properly organized
   - Categorizes issues for better cleanup

2. **`cleanup_orphaned_files_safe()`**
   - Safely deletes orphaned files
   - Handles both database and storage cleanup

3. **`reorganize_files()`**
   - Attempts to move files to proper locations
   - Handles unit map files specifically

4. **`perform_file_cleanup()`**
   - Main cleanup procedure
   - Combines reorganization and cleanup

## Component Updates

### 1. ImageUpload Component
- Updated to use `get_upload_folder()` function
- Simplified folder creation logic
- Proper path construction for new folder structure

### 2. FileManager Component
- Updated to use `create_user_folder()` function
- Simplified folder creation process
- Better error handling

### 3. PropertyDetails Component
- Fixed unit map display issue
- Changed from `object-cover` to `object-contain`
- Added better error logging

### 4. UnitMapUpload Component
- Updated file path construction
- Uses Property Files folder structure

## File Structure Examples

### Property: "Sunset Apartments"
```
/Sunset Apartments/
├── Work Orders/
│   ├── WO-000001/
│   │   ├── Before Images/
│   │   │   ├── 1640995200000-abc123-before1.jpg
│   │   │   └── 1640995200001-def456-before2.jpg
│   │   ├── Sprinkler Images/
│   │   │   └── 1640995200002-ghi789-sprinkler1.jpg
│   │   └── Other Files/
│   │       └── 1640995200003-jkl012-invoice.pdf
│   └── WO-000002/
│       ├── Before Images/
│       └── Other Files/
└── Property Files/
    ├── unit-map-1640995200000-mno345-unit-map.jpg
    └── property-docs-1640995200001-pqr678-lease.pdf
```

### User-Created Folders
```
/User Documents/
├── Contracts/
├── Invoices/
└── Reports/
    └── 2024/
```

## Migration Files

### 1. `20250115000006_comprehensive_file_management_fix.sql`
- Main migration file
- Creates all database functions
- Sets up triggers for automatic folder creation
- Migrates existing data to new structure

### 2. `cleanup_orphaned_files.sql`
- Cleanup utilities
- Monitoring views
- Safe deletion procedures

## Usage Instructions

### 1. Apply the Migration
```sql
-- Run the main migration
\i supabase/migrations/20250115000006_comprehensive_file_management_fix.sql
```

### 2. Check File Organization Status
```sql
-- View current file organization status
SELECT * FROM file_organization_status;
```

### 3. Clean Up Orphaned Files
```sql
-- Identify orphaned files
SELECT * FROM identify_orphaned_files();

-- Perform cleanup
SELECT * FROM perform_file_cleanup();
```

### 4. Create User Folders
```sql
-- Create a user folder
SELECT create_user_folder('My Documents', NULL);

-- Create a subfolder
SELECT create_user_folder('Subfolder', 'parent-folder-id');
```

## Benefits

1. **Organized Structure**: All files are properly organized in a logical hierarchy
2. **Automatic Management**: Folders are created automatically when needed
3. **Flexible Storage**: Users can create custom folders for general file storage
4. **Proper Unit Maps**: Unit map files are stored in dedicated Property Files folders
5. **Work Order Organization**: Work order files are organized by type (Before, Sprinkler, Other)
6. **Easy Cleanup**: Tools to identify and clean up orphaned files
7. **Better Display**: Fixed unit map display issues in property details

## Security

- All functions respect RLS policies
- Users can only access files they have permission to see
- Folder creation is properly authenticated
- File uploads are validated and organized

## Monitoring

- `file_organization_status` view provides overview of file organization
- Functions to identify and clean up issues
- Detailed logging for troubleshooting

## Future Enhancements

1. **File Versioning**: Track file versions and changes
2. **Bulk Operations**: Support for bulk file operations
3. **File Sharing**: Enhanced sharing capabilities
4. **Search**: Full-text search across files
5. **Backup**: Automated backup procedures
6. **Compression**: Automatic image compression for storage optimization

## Troubleshooting

### Common Issues

1. **Unit Map Not Displaying**
   - Check if file exists in Property Files folder
   - Verify file path in database
   - Check browser console for errors

2. **Folder Creation Fails**
   - Ensure user is authenticated
   - Check RLS policies
   - Verify parent folder exists

3. **File Upload Issues**
   - Check folder structure exists
   - Verify file permissions
   - Check storage bucket configuration

### Debug Queries

```sql
-- Check property folder structure
SELECT * FROM files WHERE property_id = 'property-id' AND type = 'folder/directory';

-- Check work order folders
SELECT * FROM files WHERE job_id = 'job-id' AND type = 'folder/directory';

-- Check file organization
SELECT * FROM file_organization_status;

-- Find orphaned files
SELECT * FROM identify_orphaned_files();
```

This implementation provides a robust, scalable file management system that properly organizes all files while maintaining flexibility for user-created content.
