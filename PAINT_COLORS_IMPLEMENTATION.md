# Paint Colors Implementation Guide

This document explains how to implement the new Paint Colors functionality for Properties in your application.

## Overview

The Paint Colors feature allows users to:
- Create multiple floorplan groups (1-5) for each property
- Add multiple room/paint color combinations within each floorplan
- Edit and manage paint color schemes
- View paint colors on property details pages

## Database Changes

### 1. Run the Migration

Execute the SQL script `apply_paint_colors_migration.sql` in your Supabase SQL editor. This will:

- Create `property_paint_schemes` table for floorplan groups
- Create `property_paint_rows` table for room/color combinations
- Set up proper indexes and constraints
- Enable Row Level Security (RLS) with appropriate policies
- Create a view for convenient data access

### 2. Table Structure

**property_paint_schemes**
- `id`: UUID primary key
- `property_id`: Foreign key to properties table
- `floorplan`: Smallint (1-5) with unique constraint per property
- `created_at`: Timestamp

**property_paint_rows**
- `id`: UUID primary key
- `scheme_id`: Foreign key to property_paint_schemes
- `room`: Text field for room name
- `paint_color`: Text field for paint color
- `sort_order`: Integer for ordering rows
- `created_at`: Timestamp

## Frontend Components

### 1. New Components Created

- **`PaintColorsEditor`** (`src/components/properties/PaintColorsEditor.tsx`)
  - Used in New Property and Edit Property forms
  - Allows adding/removing floorplans and rows
  - Prevents duplicate floorplan numbers
  - Validates input data

- **`PaintColorsViewer`** (`src/components/properties/PaintColorsViewer.tsx`)
  - Used on Property Details page
  - Displays paint color schemes in a clean format
  - Groups by floorplan with room/color pairs

### 2. Helper Functions

- **`src/lib/paintColors.ts`**
  - `getPaintSchemesByProperty()`: Fetch paint schemes for a property
  - `savePaintSchemes()`: Save/update paint schemes
  - `getNextAvailableFloorplan()`: Get next available floorplan number

### 3. Type Definitions

- **`src/lib/types.ts`** - Added new interfaces:
  - `PaintRow`: Individual room/color entry
  - `PaintScheme`: Floorplan with multiple rows
  - `PropertyPaintScheme`: Database model for schemes
  - `PropertyPaintRow`: Database model for rows

## Implementation Steps

### Step 1: Database Setup
1. Run `apply_paint_colors_migration.sql` in Supabase SQL editor
2. Verify tables are created successfully
3. Check RLS policies are in place

### Step 2: Update Property Forms
1. **New Property Form** (`PropertyForm.tsx`):
   - Import `PaintColorsEditor`
   - Add `paintSchemes` state
   - Replace old paint color fields with `PaintColorsEditor`
   - Update `handleSubmit` to save paint schemes

2. **Edit Property Form** (`PropertyEditForm.tsx`):
   - Import `PaintColorsEditor`
   - Add `paintSchemes` state
   - Add `fetchPaintSchemes()` function
   - Replace old paint color fields with `PaintColorsEditor`
   - Update `handleSubmit` to save paint schemes

### Step 3: Update Property Details
1. **Property Details** (`PropertyDetails.tsx`):
   - Import `PaintColorsViewer`
   - Add `paintSchemes` state
   - Add paint schemes fetch in `useEffect`
   - Replace old paint color display with `PaintColorsViewer`

### Step 4: Test the Implementation

1. **Create a new property**:
   - Add multiple floorplans
   - Add multiple rooms/colors per floorplan
   - Save and verify data is stored

2. **Edit an existing property**:
   - Modify paint color schemes
   - Add/remove floorplans and rows
   - Save and verify changes

3. **View property details**:
   - Verify paint colors display correctly
   - Check floorplan grouping
   - Ensure empty states work

## Usage Examples

### Creating Paint Colors
```
Floorplan 2:
- Kitchen → Brown
- Bathroom → Green

Floorplan 4:
- Bedroom 1 → Brown
- Master Bedroom → Green
```

### Editing Paint Colors
- Add new rows to existing floorplans
- Remove rows from floorplans
- Change floorplan numbers (1-5)
- Delete entire floorplans

## Validation Rules

- Floorplan numbers must be 1-5
- No duplicate floorplan numbers per property
- Room and paint color fields cannot be empty
- Maximum 5 floorplans per property
- Rows are automatically ordered by creation time

## Error Handling

- Graceful fallback if paint schemes fail to save
- Console logging for debugging
- User-friendly error messages
- Non-blocking paint color operations

## Security

- Row Level Security (RLS) enabled
- Users can only access paint colors for properties they have permission to view/edit
- Admin/management users have full access
- Subcontractors have read-only access

## Performance Considerations

- Indexes on frequently queried fields
- Efficient data fetching with proper joins
- Lazy loading of paint color data
- Optimized database queries

## Troubleshooting

### Common Issues

1. **Tables not created**: Ensure you have proper permissions in Supabase
2. **RLS policies not working**: Check user roles and permissions
3. **Paint colors not saving**: Verify database connection and error logs
4. **Component not rendering**: Check import paths and component registration

### Debug Steps

1. Check browser console for JavaScript errors
2. Verify database tables exist and have correct structure
3. Test RLS policies with different user roles
4. Check network requests in browser dev tools

## Future Enhancements

- Bulk import/export of paint color schemes
- Paint color templates for common room types
- Integration with paint supplier APIs
- Advanced filtering and search capabilities
- Paint color history and versioning

## Support

If you encounter issues during implementation:
1. Check the console logs for error messages
2. Verify all files are properly imported
3. Ensure database migration completed successfully
4. Test with different user roles and permissions
