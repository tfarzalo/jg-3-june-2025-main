# Unit Map File Upload System Implementation

This document outlines the implementation of converting the property unit map URL field to a file upload system using Supabase storage.

## Overview

The system has been updated to replace the `unit_map_url` TEXT field with a file-based approach where:
- Unit map images are uploaded to Supabase storage in the `files` bucket
- Files are organized in a folder structure: `Property Assets/{Property Name}/`
- File metadata is stored in the `files` table with references to properties
- The property details page displays images from the file system instead of URLs

## Database Changes

### SQL Migration File: `update_unit_map_to_file_upload.sql`

This migration performs the following operations:

1. **Adds new columns to properties table:**
   - `unit_map_file_id` (uuid) - References the file record in the files table
   - `unit_map_file_path` (text) - Storage path to the file in Supabase storage

2. **Creates folder structure:**
   - Root folder: `/Property Assets`
   - Property-specific folders: `/Property Assets/{Property Name}`

3. **Creates helper functions:**
   - `create_property_asset_folders()` - Automatically creates asset folders for new properties
   - `handle_unit_map_upload()` - Handles file uploads and creates database records
   - `get_property_unit_map_info()` - Retrieves unit map file information

4. **Sets up triggers and policies:**
   - Automatic folder creation when new properties are added
   - RLS policies for secure file access

## File Structure

```
Property Assets/
├── Property Name 1/
│   └── unit-map-1234567890-image.jpg
├── Property Name 2/
│   └── unit-map-1234567891-image.png
└── ...
```

## New Components

### 1. File Upload Utility (`src/lib/utils/fileUpload.ts`)

Provides functions for:
- `uploadPropertyUnitMap()` - Uploads unit map files to storage
- `deletePropertyUnitMap()` - Removes unit map files
- `getUnitMapPublicUrl()` - Gets public URLs for display
- `getPropertyUnitMapInfo()` - Retrieves file metadata

### 2. Unit Map Upload Component (`src/components/ui/UnitMapUpload.tsx`)

A reusable React component that provides:
- Drag and drop file upload
- File type validation (images only)
- File size validation (max 10MB)
- Upload progress indication
- File preview and management
- Delete functionality

## Updated Components

### 1. PropertyForm.tsx
- Replaced URL input with `UnitMapUpload` component
- Updated form data structure to use `unit_map_file_path`
- Modified submit handler to exclude file path from database insert

### 2. PropertyEditForm.tsx
- Replaced URL input with `UnitMapUpload` component
- Updated form data structure to use `unit_map_file_path`
- Modified submit handler to exclude file path from database update
- Updated data fetching to handle new file fields

### 3. PropertyDetails.tsx
- Updated Property interface to use new file fields
- Modified unit map display to use file storage URLs
- Updated lightbox to reference file storage paths

## Implementation Steps

### Step 1: Run Database Migration

```bash
# Execute the SQL migration file in your Supabase dashboard
# or run it via the Supabase CLI
supabase db push
```

### Step 2: Update Environment Variables

Ensure your `.env` file includes:
```env
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key
```

### Step 3: Deploy Updated Components

The React components have been updated and are ready for deployment.

### Step 4: Test the System

1. **Create a new property** - Verify the unit map upload works
2. **Edit an existing property** - Verify file management works
3. **View property details** - Verify images display correctly
4. **Check file manager** - Verify files appear in the Property Assets folder

## File Management Integration

The uploaded unit maps will automatically appear in the FileManager component under:
- Root folder: "Property Assets"
- Subfolder: "{Property Name}"

Admin users can manage these files through the existing file management interface.

## Security Features

- **File type validation** - Only image files are allowed
- **File size limits** - Maximum 10MB per file
- **RLS policies** - Secure access control based on user permissions
- **Automatic cleanup** - Failed uploads are automatically removed from storage

## Error Handling

The system includes comprehensive error handling for:
- Invalid file types
- File size exceeded
- Storage upload failures
- Database operation failures
- Network connectivity issues

## Migration Notes

- **Existing properties** with `unit_map_url` values will continue to work
- **New properties** will use the file upload system
- **Backward compatibility** is maintained for existing data
- **Gradual migration** can be performed by updating existing properties

## Troubleshooting

### Common Issues

1. **Files not displaying:**
   - Check storage bucket permissions
   - Verify file paths are correct
   - Ensure RLS policies are properly configured

2. **Upload failures:**
   - Check file size limits
   - Verify file type restrictions
   - Check storage bucket configuration

3. **Permission errors:**
   - Verify user authentication
   - Check RLS policy configuration
   - Ensure proper user roles

### Debug Information

The system includes console logging for debugging:
- File upload progress
- Database operation results
- Error details and stack traces

## Future Enhancements

Potential improvements for future versions:
- **Image optimization** - Automatic resizing and compression
- **Multiple file support** - Allow multiple unit map versions
- **File versioning** - Track changes to unit maps over time
- **Bulk operations** - Upload/update multiple properties at once
- **Advanced search** - Search unit maps by property characteristics

## Support

For technical support or questions about this implementation, refer to:
- Database schema documentation
- Supabase storage documentation
- React component documentation
- File upload utility documentation
