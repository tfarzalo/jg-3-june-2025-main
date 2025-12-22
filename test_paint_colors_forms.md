# Paint Colors Forms Testing Guide

This guide ensures that both the **Add New Property** and **Edit Property** forms work identically with paint colors functionality.

## 🎯 **Test Objective**

Verify that both forms:
- ✅ Handle paint colors identically
- ✅ Save data to database consistently
- ✅ Load existing data properly (Edit form)
- ✅ Display paint colors correctly on Property Details page

## 📋 **Pre-Test Checklist**

### 1. Database Setup
- [ ] Run `complete_paint_colors_setup.sql` in Supabase
- [ ] Verify tables exist: `property_paint_schemes`, `property_paint_rows`
- [ ] Verify view exists: `property_paint_colors_v`
- [ ] Check RLS policies are in place

### 2. Frontend Components
- [ ] All files are in place and imported correctly
- [ ] No TypeScript compilation errors
- [ ] Components render without console errors

## 🧪 **Test Scenarios**

### **Test 1: Add New Property with Paint Colors**

#### **Step 1: Navigate to New Property Form**
- Go to `/dashboard/properties/new` or equivalent
- Verify form loads without errors
- Check console for any warnings

#### **Step 2: Fill Basic Property Information**
- Property Name: "Test Property - Paint Colors"
- Address: "123 Paint Test St"
- City: "Test City"
- State: "TS"
- ZIP: "12345"
- Property Management Group: Select any group

#### **Step 3: Add Paint Colors**
1. **Add First Floorplan**:
   - Click "Add Floorplan"
   - Verify Floorplan 1 is selected
   - Enter Scheme Name: "Building A"
   - Add Row 1: Room "Kitchen", Color "Brown", Code "SW-7004", Finish "Eggshell"
   - Add Row 2: Room "Bathroom", Color "Green", Code "SW-6451", Finish "Satin"

2. **Add Second Floorplan**:
   - Click "Add Floorplan" again
   - Verify Floorplan 2 is selected
   - Enter Scheme Name: "Premium Units"
   - Add Row 1: Room "Master Bedroom", Color "Cream", Code "BM-OC-65", Finish "Eggshell"
   - Add Row 2: Room "Living Room", Color "Gray", Code "SW-7664", Finish "Flat"

#### **Step 4: Save Property**
- Click "Create Property"
- **Expected Result**: No errors, redirects to property details page
- **Check Console**: Should see "Saving paint schemes for new property" and "Paint schemes saved successfully"

#### **Step 5: Verify Database Storage**
```sql
-- Get the property ID
SELECT id FROM properties WHERE property_name = 'Test Property - Paint Colors';

-- Check paint schemes
SELECT * FROM property_paint_schemes 
WHERE property_id = 'your-property-id';

-- Check paint rows
SELECT * FROM property_paint_rows 
WHERE scheme_id IN (
    SELECT id FROM property_paint_schemes 
    WHERE property_id = 'your-property-id'
);

-- Check view
SELECT * FROM property_paint_colors_v 
WHERE property_id = 'your-property-id';
```

**Expected Results**:
- 2 paint schemes (Floorplans 1 & 2)
- 4 paint rows total
- All data fields populated correctly

#### **Step 6: Verify Property Details Display**
- Navigate to property details page
- Look for "Paint Colors" section
- Verify it shows:
  - Floorplan 1 - Building A
    - Kitchen → Brown (Code: SW-7004, Finish: Eggshell)
    - Bathroom → Green (Code: SW-6451, Finish: Satin)
  - Floorplan 2 - Premium Units
    - Master Bedroom → Cream (Code: BM-OC-65, Finish: Eggshell)
    - Living Room → Gray (Code: SW-7664, Finish: Flat)

---

### **Test 2: Edit Existing Property Paint Colors**

#### **Step 1: Navigate to Edit Form**
- From property details page, click "Edit Property"
- Verify form loads with existing data
- Check console for "Fetching paint schemes for property" message

#### **Step 2: Verify Existing Data Loaded**
- **Paint Colors section** should show:
  - Floorplan 1 - Building A (with existing rows)
  - Floorplan 2 - Premium Units (with existing rows)
- All room names, colors, codes, and finishes should be populated

#### **Step 3: Modify Paint Colors**
1. **Edit Floorplan 1**:
   - Change Kitchen color from "Brown" to "Tan"
   - Add new row: Room "Dining Room", Color "Beige", Code "SW-7005", Finish "Eggshell"
   - Remove Bathroom row

2. **Edit Floorplan 2**:
   - Change scheme name from "Premium Units" to "Luxury Units"
   - Change Master Bedroom color from "Cream" to "Ivory"
   - Add new row: Room "Study", Color "Navy", Code "SW-6244", Finish "Satin"

3. **Add New Floorplan**:
   - Click "Add Floorplan"
   - Select Floorplan 3
   - Enter Scheme Name: "Garden Level"
   - Add Row: Room "Patio", Color "White", Code "SW-7006", Finish "Flat"

#### **Step 4: Save Changes**
- Click "Save Changes"
- **Expected Result**: No errors, redirects back to property details
- **Check Console**: Should see "Saving paint schemes for property" and "Paint schemes saved successfully"

#### **Step 5: Verify Database Updates**
```sql
-- Check updated paint schemes
SELECT * FROM property_paint_schemes 
WHERE property_id = 'your-property-id'
ORDER BY floorplan;

-- Check updated paint rows
SELECT * FROM property_paint_rows 
WHERE scheme_id IN (
    SELECT id FROM property_paint_schemes 
    WHERE property_id = 'your-property-id'
)
ORDER BY scheme_id, sort_order;
```

**Expected Results**:
- 3 paint schemes (Floorplans 1, 2, 3)
- Floorplan 1: Kitchen (Tan), Dining Room (Beige) - Bathroom removed
- Floorplan 2: Master Bedroom (Ivory), Living Room (Gray), Study (Navy)
- Floorplan 3: Patio (White)

#### **Step 6: Verify Property Details Display**
- Navigate back to property details page
- Verify all changes are displayed correctly
- Check that removed rows are gone
- Verify new rows and modified data appear

---

### **Test 3: Edge Cases and Validation**

#### **Test Empty Paint Schemes**
1. **Edit Property** and remove ALL floorplans
2. **Save Changes**
3. **Verify**: Database should have no paint schemes for this property
4. **Check Property Details**: Should show "No paint colors recorded"

#### **Test Invalid Data**
1. **Edit Property** and add rows with:
   - Empty room names
   - Empty paint colors
2. **Save Changes**
3. **Verify**: Invalid rows are filtered out, only valid data is saved

#### **Test Floorplan Constraints**
1. **Try to add more than 5 floorplans**
2. **Verify**: "Add Floorplan" button should be disabled
3. **Try to select duplicate floorplan numbers**
4. **Verify**: Only available floorplan numbers are shown in dropdowns

---

### **Test 4: Data Consistency Between Forms**

#### **Verify Identical Behavior**
- [ ] Both forms use identical `PaintColorsEditor` component
- [ ] Both forms save data using identical `savePaintSchemes` function
- [ ] Both forms handle errors identically
- [ ] Both forms provide same user experience

#### **Verify Database Consistency**
- [ ] New properties create paint schemes correctly
- [ ] Edited properties update paint schemes correctly
- [ ] Deleted paint schemes are properly removed from database
- [ ] All paint scheme data is preserved during edits

## 🔍 **Debugging Steps**

### **If Paint Colors Don't Save**

1. **Check Console Logs**:
   - Look for "Saving paint schemes" messages
   - Check for any error messages
   - Verify paint schemes data structure

2. **Check Database Permissions**:
   ```sql
   -- Test if you can insert/update
   INSERT INTO property_paint_schemes (property_id, floorplan, name) 
   VALUES ('test-id', 1, 'Test') 
   ON CONFLICT DO NOTHING;
   ```

3. **Check RLS Policies**:
   ```sql
   -- Verify policies exist
   SELECT * FROM pg_policies 
   WHERE tablename IN ('property_paint_schemes', 'property_paint_rows');
   ```

### **If Paint Colors Don't Load**

1. **Check Console Logs**:
   - Look for "Fetching paint schemes" messages
   - Check for any error messages

2. **Check Database Data**:
   ```sql
   -- Verify data exists
   SELECT * FROM property_paint_colors_v 
   WHERE property_id = 'your-property-id';
   ```

3. **Check Component Props**:
   - Verify `PaintColorsEditor` receives correct props
   - Check `initial` prop in Edit form
   - Verify `onChange` callback works

### **If Components Don't Render**

1. **Check Import Paths**:
   - Verify all component imports are correct
   - Check for TypeScript compilation errors

2. **Check Component Registration**:
   - Verify components are properly exported
   - Check for any missing dependencies

## ✅ **Success Criteria**

Both forms work identically when:

- ✅ **Create**: New properties save paint colors without errors
- ✅ **Read**: Edit forms load existing paint colors correctly
- ✅ **Update**: Modified paint colors save and persist
- ✅ **Delete**: Removed paint colors are properly deleted from database
- ✅ **Display**: Property details show paint colors consistently
- ✅ **Validation**: Invalid data is filtered out appropriately
- ✅ **User Experience**: Both forms provide identical interface and behavior

## 🚨 **Common Issues and Solutions**

### **Issue: Paint colors save but don't display**
**Solution**: Check PropertyDetails component paint schemes fetching

### **Issue: Edit form doesn't load existing paint colors**
**Solution**: Verify `fetchPaintSchemes` function and `initial` prop

### **Issue: Database errors during save**
**Solution**: Check RLS policies and user permissions

### **Issue: Components don't render**
**Solution**: Verify import paths and component registration

## 📝 **Test Results Log**

Document your test results:

| Test Scenario | Status | Notes |
|---------------|--------|-------|
| Add New Property | ✅/❌ | |
| Edit Property | ✅/❌ | |
| Data Persistence | ✅/❌ | |
| Display Consistency | ✅/❌ | |
| Error Handling | ✅/❌ | |

## 🎉 **Final Verification**

After completing all tests:

1. **Create a comprehensive test property** with multiple paint schemes
2. **Edit it multiple times** to ensure stability
3. **Verify data persistence** across application restarts
4. **Confirm both forms work identically**

The Paint Colors system is fully functional when all tests pass! 🎨✨
