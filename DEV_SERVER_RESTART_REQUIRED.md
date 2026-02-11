# 🔥 CRITICAL: Dev Server Restart Required

**Problem:** Code changes not loading - Vite HMR failed  
**Solution:** Complete dev server restart  

---

## ⚠️ IMMEDIATE ACTION REQUIRED

### Step 1: Stop Current Dev Server
In the terminal running `npm run dev`:
- Press `Ctrl + C`
- Wait for "Server stopped" or process to exit

### Step 2: Clear Node Modules Cache (Optional but Recommended)
```bash
cd /Users/timothyfarzalo/Desktop/jg-january-2026
rm -rf node_modules/.vite
```

### Step 3: Restart Dev Server
```bash
npm run dev
```

Wait for:
```
  ➜  Local:   http://localhost:5173/
```

### Step 4: Close ALL Browser Tabs
- Close EVERY tab with `localhost:5173`
- Don't just refresh - completely close them

### Step 5: Open Fresh Browser Tab
- Open NEW tab
- Navigate to: `http://localhost:5173/dashboard/properties/5c8c70d6-5b9e-4f92-ab16-17c14815b6b8/edit`
- Open DevTools (F12)
- Go to Console tab
- Clear console (trash icon)

---

## ✅ Expected Console Output

### On Page Load
You should immediately see:
```
🎨 PropertyContactsEditor rendered with: { customContactsCount: X, customContacts: [...] }
```

**If you DON'T see this:** The component isn't rendering or code didn't reload.

### When Clicking Contact Role Checkbox
You should see:
```
🔘 Subcontractor radio clicked for contact: <id>
🔄 handleCustomContactChange called: { id: "<id>", field: "is_subcontractor_contact", value: true }
```

### When Saving Property
You should see:
```
💾 Saving contacts with roles: [{ ...all contact data }]
💾 Contacts to insert: [{ ...with role fields }]
✅ Contacts saved successfully
```

---

## ❌ Troubleshooting

### If Logs Still Don't Appear

#### Option 1: Nuclear Reset
```bash
# Stop dev server (Ctrl+C)
cd /Users/timothyfarzalo/Desktop/jg-january-2026
rm -rf node_modules/.vite
rm -rf dist
npm run dev
```

#### Option 2: Check File Was Actually Modified
```bash
grep -A 3 "PropertyContactsEditor rendered" src/components/property/PropertyContactsEditor.tsx
```

**Expected output:**
```typescript
  // Debug log to confirm component renders
  console.log('🎨 PropertyContactsEditor rendered with:', {
    customContactsCount: customContacts.length,
```

If this doesn't show up → file didn't save correctly.

#### Option 3: Check PropertyEditForm Has handleCustomContactChange Log
```bash
grep "🔄 handleCustomContactChange called" src/components/PropertyEditForm.tsx
```

**Expected output:**
```typescript
    console.log('🔄 handleCustomContactChange called:', { id, field, value });
```

---

## 🎯 What We're Testing

### Test 1: Component Renders
- ✅ See `🎨 PropertyContactsEditor rendered` on page load

### Test 2: Click Handlers Fire  
- ✅ See `🔘 Subcontractor radio clicked` when clicking radio
- ✅ See `🔄 handleCustomContactChange called` immediately after

### Test 3: Data Saves with Roles
- ✅ See `💾 Saving contacts with roles` when clicking Save
- ✅ Verify role fields are in the data object

### Test 4: Persistence
- ✅ Navigate to Property Details
- ✅ See role badges on contacts
- ✅ Refresh page - roles still there

---

## 🚨 If NOTHING Works

There may be a deeper issue. Please provide:

1. Output of:
   ```bash
   grep -n "handleCustomContactChange" src/components/PropertyEditForm.tsx | head -5
   ```

2. Screenshot of PropertyContactsEditor section in the UI

3. Confirm you have custom contacts (not just system contacts)

---

**Current Status:** Waiting for dev server restart and fresh browser test.
