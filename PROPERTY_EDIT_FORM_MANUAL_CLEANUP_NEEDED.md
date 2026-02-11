# PropertyEditForm.tsx Integration Status - REQUIRES MANUAL CLEANUP

## Current State: BROKEN ⚠️
The PropertyEditForm.tsx file is currently in a broken state due to incomplete UI replacements. The file needs manual cleanup to complete the integration.

## What Happened
During the automated integration process, partial replacements of the old Contact Information UI created JSX structure issues. There are fragments of old contact UI mixed with attempts to add PropertyContactsEditor.

## Root Cause
The PropertyEditForm.tsx file is ~1500 lines long with deeply nested JSX. Automated find-and-replace operations resulted in:
- Incomplete removal of old contact UI (lines ~874-1200)
- Duplicate Property Unit Map sections  
- Broken JSX structure

## Solution: Manual Cleanup Required

### Step 1: Remove ALL Old Contact UI
**Delete lines approximately 874-1206** - everything between:
```tsx
          />

          {/* Property Unit Map */}
```
...and the REAL Property Unit Map section that starts around line 1207.

The section to DELETE includes:
- All the old Property Contact 1 (Community Manager) UI
- All the old Property Contact 2 (Maintenance Supervisor) UI  
- All additional contact cards with old radio buttons
- The "Add Contact" button card
- Any references to `subcontractorContactSource`, `notificationContactSource`, `propertySecondaryEmailVisibility`
- Any references to `formData.community_manager_*`, `formData.maintenance_supervisor_*`, `formData.ap_*` fields
- Any calls to deleted handler functions like `handleSubcontractorContactChange`, `handleNotificationContactChange`, `togglePropertySecondaryEmailField`

### Step 2: Verify Structure
After deletion, the structure should be:
```tsx
          <PropertyContactsEditor
            systemContacts={systemContacts}
            systemContactRoles={systemContactRoles}
            customContacts={contacts}
            onSystemContactChange={handleSystemContactChange}
            onSystemContactRoleChange={handleSystemContactRoleChange}
            onCustomContactChange={handleCustomContactChange}
            onCustomContactAdd={handleCustomContactAdd}
            onCustomContactDelete={handleCustomContactDelete}
          />

          {/* Property Unit Map */}
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Property Unit Map</h2>
            
            {propertyId ? (
              // Show the upload component for existing properties
              <UnitMapUpload
                propertyId={propertyId}
                propertyName={formData.property_name}
                ...
```

### Step 3: Clean Up Billing Section (Optional but Recommended)
Around lines 1250-1350, remove duplicate AP contact fields from the Billing Information section since AP is now managed in PropertyContactsEditor.

## What WAS Successfully Completed ✅
1. ✅ Added imports for PropertyContactsEditor and contact types
2. ✅ Updated PropertyContact interface with role fields
3. ✅ Added systemContacts and systemContactRoles state
4. ✅ Added all handler functions for PropertyContactsEditor
5. ✅ Updated fetchProperty to populate systemContacts from database
6. ✅ Cleaned up formData state declaration
7. ✅ Updated handleSubmit to use systemContacts and roles
8. ✅ Removed old handler functions (handleDeleteContact, handleSubcontractorContactChange, etc.)
9. ✅ Removed old handleAddContact function
10. ✅ PropertyContactsEditor component is imported and ready to use

## What NEEDS Manual Fix ❌
1. ❌ Remove ALL old contact UI from JSX (lines ~874-1206)
2. ❌ Ensure only ONE Property Unit Map section exists
3. ❌ Remove any lingering references to deleted state variables in JSX
4. ❌ Fix JSX structure errors
5. ❌ Test compilation after cleanup

## Quick Manual Fix Steps

### Open PropertyEditForm.tsx and:

1. **Find line ~865** which has:
   ```tsx
   />

   {/* Property Unit Map */}
   ```

2. **Scroll down to find the SECOND occurrence** of `{/* Property Unit Map */}` around line 1207

3. **Delete EVERYTHING between these two Property Unit Map comments**

4. **Save and check for compilation errors**

5. **If there are still errors**, search for:
   - `subcontractorContactSource` - should NOT exist in JSX
   - `notificationContactSource` - should NOT exist in JSX
   - `formData.community_manager_` - should NOT exist in JSX
   - `formData.maintenance_supervisor_` - should NOT exist in JSX
   - `formData.ap_` - should NOT exist in JSX
   - `propertySecondaryEmailVisibility` - should NOT exist in JSX
   - `handleSubcontractorContactChange` - should NOT exist
   - `handleNotificationContactChange` - should NOT exist
   - `togglePropertySecondaryEmailField` - should NOT exist
   - `handleAddContact` - should NOT exist (replaced with handleCustomContactAdd)

## Alternative: Use Git
If you have a clean git history:
1. Revert PropertyEditForm.tsx to the last working state
2. Manually add ONLY:
   - The imports (lines 1-12)
   - The updated PropertyContact interface (lines 17-31)
   - The new state (lines 45-60)
   - The handler functions (lines 120-300)
   - The updated fetchProperty logic (lines 380-410)  
   - The updated handleSubmit logic (lines 485-540)
3. Then carefully replace ONLY the Contact Information section UI with:
   ```tsx
   <PropertyContactsEditor ... />
   ```

## Files Reference
- ✅ `/src/components/PropertyForm.tsx` - Successfully integrated, use as reference
- ⚠️  `/src/components/PropertyEditForm.tsx` - Needs manual cleanup (THIS FILE)
- ✅ `/src/components/property/PropertyContactsEditor.tsx` - The component to use
- ✅ `/src/types/contacts.ts` - Contact type definitions

## Date
February 10, 2026 - Integration attempted but requires manual cleanup
