# PropertyEditForm.tsx - Critical Manual Fix Required

## ⚠️ CURRENT STATUS: FILE IS BROKEN

The PropertyEditForm.tsx file attempted automated cleanup but is now in a corrupted state with 73+ compile errors. **Manual intervention is required.**

## PROBLEM

During automated refactoring, large sections of duplicate/legacy code were partially removed, but the replacements created new structural issues:
- The component closing tags (`</form>`, `</div>`, `}`) appear in the middle of the file (around line 1090-1103)
- Duplicate sections still exist after the premature component end
- Legacy contact code mixed with new code
- References to deleted state variables

## RECOMMENDED FIX APPROACH

**Option 1: Restore from Git (FASTEST)**
If you have git history:
```bash
cd /Users/timothyfarzalo/Desktop/jg-january-2026
git checkout src/components/PropertyEditForm.tsx
```
Then manually integrate PropertyContactsEditor using PropertyForm.tsx as a reference.

**Option 2: Copy Structure from PropertyForm.tsx (RECOMMENDED)**
1. Open PropertyForm.tsx (which is working correctly)
2. Note the exact structure after PropertyContactsEditor:
   - Property Unit Map section
   - Manage Billing Details section
   - Paint Colors section  
   - Compliance Information section
   - Billing Information section (NO AP contact fields - handled by PropertyContactsEditor)
   - Form Actions section

3. In PropertyEditForm.tsx:
   - Keep everything BEFORE PropertyContactsEditor (lines 1-866)
   - Keep the PropertyContactsEditor component itself (lines 855-865)
   - **DELETE** everything from line 867 to about line 1100 (all the broken/duplicate stuff)
   - Copy the clean sections from PropertyForm.tsx:
     - Property Unit Map (but use UnitMapUpload component, not the file selection UI)
     - Manage Billing Details
     - Paint Colors
     - Compliance Information
     - Billing Information (clean version WITHOUT AP contact fields)
     - Form Actions
     - Lightbox
     - Component closing tags

**Option 3: Delete File and Start Fresh**
Copy PropertyForm.tsx → rename to PropertyEditForm.tsx → modify for editing instead of creating.

## WHAT THE WORKING VERSION SHOULD LOOK LIKE

### Correct Section Order:
1. **Form opening**
2. **Basic Information** (property_name, management group, etc.)
3. **Location Details** (address, city, state, etc.)
4. **Contact Information** ← PropertyContactsEditor component (NEW - working)
5. **Property Unit Map** ← UnitMapUpload component
6. **Manage Billing Details** ← Link to billing page
7. **Paint Colors** ← Paint location field + PaintColorsEditor
8. **Compliance Information** ← Grid of compliance fields with dates
9. **Billing Information** ← QuickBooks, billing notes, extra charges (NO AP contact - that's in PropertyContactsEditor)
10. **Form Actions** ← Cancel and Save buttons
11. **Form closing**
12. **Lightbox** component
13. **Component closing** (`</div>`, `);`, `}`)

### What Should NOT Be in the File:
❌ Legacy contact fields (`community_manager_*`, `maintenance_supervisor_*`, `ap_*` form fields)
❌ `subcontractorContactSource` state or references
❌ `notificationContactSource` state or references  
❌ `handleSubcontractorContactChange` function or references
❌ `handleNotificationContactChange` function or references
❌ `togglePropertySecondaryEmailField` function or references
❌ `propertySecondaryEmailVisibility` state or references
❌ `secondaryEmailVisibility` state or references
❌ `handleContactChange`, `handleAddContact`, `handleDeleteContact` ← These ARE defined and used by PropertyContactsEditor handlers
❌ Duplicate sections (Property Unit Map appearing twice, etc.)
❌ "Additional Contacts" section with manual contact cards (handled by PropertyContactsEditor)

### What SHOULD Be in the File:
✅ `systemContacts` state (lines 48-53)
✅ `systemContactRoles` state (lines 55-60)
✅ `contacts` state for custom contacts (line 44)
✅ PropertyContactsEditor component (lines 856-865)
✅ Handler functions: `handleSystemContactChange`, `handleSystemContactRoleChange`, `handleCustomContactChange`, `handleCustomContactAdd`, `handleCustomContactDelete` (lines 116-152)
✅ Updated `fetchProperty` function that loads contacts from database (lines 260-320)
✅ Updated `handleSubmit` function that saves contacts (lines 469-569)

## KEY INSIGHT

The PropertyContactsEditor component is a **self-contained contact management UI**. It handles:
- System contacts (Community Manager, Maintenance Supervisor, Primary Contact, AP)
- Custom contacts (add/delete)
- All role assignments (subcontractor, AR, approval, notification recipients)
- Primary recipient selection

Therefore, the form should NOT have any manual contact input fields outside of this component!

## FILES TO REFERENCE

### Working Example:
- **src/components/PropertyForm.tsx** (lines 720-1096) - Shows correct structure and flow

### Component to Use:
- **src/components/property/PropertyContactsEditor.tsx** - The contact management component

### Type Definitions:
- **src/types/contacts.ts** - Contact role types

## TESTING AFTER FIX

Once fixed, test:
1. ✅ File compiles with zero TypeScript errors
2. ✅ Can load existing property for editing
3. ✅ Contacts load correctly into PropertyContactsEditor
4. ✅ Can modify system contacts  
5. ✅ Can add/remove custom contacts
6. ✅ Can assign roles to contacts
7. ✅ Can save changes successfully
8. ✅ Contacts save to property_contacts table with correct roles
9. ✅ No duplicate form sections
10. ✅ Clean, organized, professional UI with white backgrounds

## CURRENT LINE NUMBERS (For Reference)

**Good sections to keep:**
- Lines 1-866: Everything before and including PropertyContactsEditor ✅

**Broken/duplicate sections to delete:**
- Lines 867-1329: Everything after PropertyContactsEditor (broken structure)

**What to add back (copy from PropertyForm.tsx):**
- Property Unit Map section (modify for editing)
- Manage Billing Details section
- Paint Colors section
- Compliance Information section
- Billing Information section (clean, no AP contact fields)
- Form Actions section
- Lightbox component
- Proper component closing

## SUMMARY

The file needs a "surgical" fix:
1. Keep everything up to and including PropertyContactsEditor (line 865)
2. Delete the corrupted mess after it (lines 867-1329)
3. Copy clean sections from PropertyForm.tsx  
4. Adapt Property Unit Map section for editing (use UnitMapUpload, not file selection)
5. Test thoroughly

**Estimated time to fix manually: 15-30 minutes**

Good luck! The PropertyForm.tsx file is your guide for how it should look.
