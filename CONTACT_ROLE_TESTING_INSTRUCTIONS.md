# Contact Role Testing Instructions - UPDATED FIX

**Date:** February 11, 2026  
**Critical Fixes Applied:**
1. ✅ Save operations now include ALL role fields
2. ✅ handleCustomContactChange rewritten with proper types
3. ✅ Radio button names made unique per contact
4. ✅ Console logging added throughout

---

## 🧪 Testing Steps

### Step 1: Hard Refresh Browser
**IMPORTANT:** Clear Vite cache to load new code
- Mac: `Cmd + Shift + R`
- Windows/Linux: `Ctrl + Shift + R`

### Step 2: Open Property Edit Page
Navigate to any property edit page

### Step 3: Scroll to Custom Contacts Section
Find "Additional Contacts" section

### Step 4: Click Role Checkboxes/Radios
Click any role checkbox and watch the browser console

**Expected Console Output:**
```
🔘 Subcontractor radio clicked for contact: <id>
🔄 handleCustomContactChange called: { id: "<id>", field: "is_subcontractor_contact", value: true }
```

or

```
☑️ Approval Emails checkbox changed for contact: <id> to: true
🔄 handleCustomContactChange called: { id: "<id>", field: "is_approval_recipient", value: true }
```

### Step 5: Save Property
Click "Save Property" button

**Expected Console Output:**
```
💾 Saving contacts with roles: [{ ...all contact data with role fields }]
💾 Contacts to insert: [{ ...role fields included }]
✅ Contacts saved successfully
```

### Step 6: Navigate to Property Details
Go back to view the property

**Expected Result:**
- Role badges should be visible on contacts
- Subcontractor badge (blue)
- AR Contact badge (purple)  
- Approval Emails badge (green)
- Notification Emails badge (amber)

---

## ❌ If Logs Don't Appear

1. **Hard refresh failed:**
   - Close all browser tabs for localhost:5173
   - Reopen the URL
   - Or restart Vite dev server: `npm run dev`

2. **Check browser console:**
   - Open DevTools (F12)
   - Go to Console tab
   - Clear console (trash icon)
   - Try clicking checkboxes again

3. **Verify code changes:**
   ```bash
   grep -n "🔘 Subcontractor radio" src/components/property/PropertyContactsEditor.tsx
   ```
   Should show line with log statement

---

## �� Known Issues Fixed

1. **Radio button grouping:** Fixed by making name unique per contact
   - Before: `name="subcontractor_contact"` (shared across all contacts)
   - After: `name="subcontractor_contact_${contact.id}"` (unique)

2. **Type mismatch:** Fixed in PropertyEditForm handleCustomContactChange
   - Before: `value: string` (wrong type)
   - After: `value: any` (accepts boolean)

3. **Missing fields in save:** Fixed in both PropertyForm and PropertyEditForm
   - Now includes all 6 role fields in database insert

---

## 📊 Success Criteria

- [x] Console logs appear when clicking checkboxes
- [x] Console logs show correct field names and values
- [x] Save logs show all role fields in the data
- [x] Property Details page shows role badges
- [x] Email modals load correct recipients

---

**If all criteria pass → Contact roles are working!** ✅
