# Paint Colors Test Guide

Use this guide to test the Paint Colors functionality after implementation.

## Prerequisites

1. Database migration completed successfully
2. All frontend components updated
3. Application running without errors

## Test Scenarios

### Test 1: Create New Property with Paint Colors

1. **Navigate to New Property form**
   - Go to `/dashboard/properties/new` or equivalent
   - Fill in basic property information

2. **Add Paint Colors**
   - In the Paint Colors section, click "Add Floorplan"
   - Select Floorplan 2
   - Add a row: Room "Kitchen", Paint Color "Brown"
   - Add another row: Room "Bathroom", Paint Color "Green"
   - Click "Add Floorplan" again
   - Select Floorplan 4
   - Add a row: Room "Bedroom 1", Paint Color "Brown"
   - Add another row: Room "Master Bedroom", Paint Color "Green"

3. **Save Property**
   - Click "Create Property"
   - Verify no errors occur
   - Navigate to property details page

4. **Verify Paint Colors Display**
   - Check that Paint Colors section shows:
     - Floorplan 2 with Kitchen→Brown and Bathroom→Green
     - Floorplan 4 with Bedroom 1→Brown and Master Bedroom→Green

### Test 2: Edit Existing Property Paint Colors

1. **Navigate to Edit Property form**
   - Go to property details page
   - Click "Edit Property" button

2. **Modify Paint Colors**
   - Add a new row to Floorplan 2: Room "Living Room", Paint Color "Beige"
   - Remove one row from Floorplan 4
   - Change a paint color (e.g., change "Brown" to "Tan")

3. **Save Changes**
   - Click "Save Changes"
   - Verify no errors occur
   - Navigate back to property details

4. **Verify Changes**
   - Check that new row appears in Floorplan 2
   - Verify removed row is gone from Floorplan 4
   - Confirm paint color changes are saved

### Test 3: Floorplan Management

1. **Test Floorplan Constraints**
   - Try to add more than 5 floorplans (should be disabled)
   - Try to select the same floorplan number twice (should be prevented)
   - Verify floorplan numbers 1-5 are available

2. **Test Floorplan Removal**
   - Remove a floorplan with existing rows
   - Verify all associated rows are also removed
   - Check that floorplan number becomes available again

### Test 4: Data Validation

1. **Test Empty Fields**
   - Try to save with empty room names
   - Try to save with empty paint colors
   - Verify validation prevents saving

2. **Test String Trimming**
   - Add rows with leading/trailing spaces
   - Save and verify spaces are trimmed

### Test 5: Database Verification

1. **Check Tables Created**
   ```sql
   SELECT * FROM property_paint_schemes;
   SELECT * FROM property_paint_rows;
   SELECT * FROM property_paint_colors_v;
   ```

2. **Verify Data Integrity**
   - Check that property_id foreign keys are correct
   - Verify floorplan constraints (1-5)
   - Confirm sort_order values are sequential

3. **Test RLS Policies**
   - Try to access paint colors with different user roles
   - Verify admin/management can read/write
   - Verify subcontractors can only read

## Expected Results

### Success Indicators

✅ **New Property Creation**
- Paint colors save without errors
- All floorplans and rows are stored
- Navigation to details page works

✅ **Property Editing**
- Existing paint colors load correctly
- Changes save successfully
- No data loss occurs

✅ **Data Display**
- Paint colors show in correct groups
- Floorplan numbers are sequential
- Room/color pairs display properly

✅ **Validation**
- Empty fields are prevented
- Duplicate floorplans are blocked
- Maximum floorplan limit enforced

✅ **Database**
- Tables created with correct structure
- Foreign key relationships work
- RLS policies function correctly

### Error Indicators

❌ **Common Issues to Watch For**
- JavaScript errors in console
- Database connection failures
- Component rendering errors
- RLS policy violations
- Data not persisting

## Troubleshooting

### If Tests Fail

1. **Check Console Logs**
   - Look for JavaScript errors
   - Check network request failures
   - Verify component mounting

2. **Verify Database**
   - Confirm tables exist
   - Check RLS policies
   - Verify user permissions

3. **Component Issues**
   - Check import paths
   - Verify component registration
   - Test component isolation

### Debug Commands

```sql
-- Check table structure
\d property_paint_schemes
\d property_paint_rows

-- Check RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('property_paint_schemes', 'property_paint_rows');

-- Test data access
SELECT * FROM property_paint_colors_v WHERE property_id = 'your-property-id';
```

## Performance Testing

1. **Load Testing**
   - Create properties with many paint color schemes
   - Test page load times
   - Verify no memory leaks

2. **Database Performance**
   - Check query execution plans
   - Verify indexes are used
   - Monitor response times

## Security Testing

1. **User Role Testing**
   - Test with admin user
   - Test with management user
   - Test with subcontractor user
   - Test with unauthorized user

2. **Data Isolation**
   - Verify users can only see their own data
   - Test cross-property access prevention
   - Verify RLS policies work correctly

## Final Verification

After completing all tests:

1. **Create a comprehensive test property** with multiple floorplans and rows
2. **Edit the property** multiple times to ensure stability
3. **Verify data persistence** across application restarts
4. **Check all user roles** can access appropriate data
5. **Confirm no regressions** in existing functionality

## Success Criteria

The implementation is successful when:

- ✅ All test scenarios pass
- ✅ No console errors occur
- ✅ Data saves and loads correctly
- ✅ UI is responsive and intuitive
- ✅ Security policies work as expected
- ✅ Performance is acceptable
- ✅ Existing functionality remains intact
