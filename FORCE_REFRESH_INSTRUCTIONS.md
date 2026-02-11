# Force Refresh Instructions - Property Contact Roles Not Saving

## Problem
Console logs we added to debug contact role saving are not appearing, which means the browser is still running old cached code.

## Solution: Complete Cache Clear

### Step 1: Stop Dev Server
1. Go to the terminal running `npm run dev`
2. Press `Ctrl+C` to stop it
3. Wait for it to fully stop

### Step 2: Clear Vite Cache
```bash
cd /Users/timothyfarzalo/Desktop/jg-january-2026
rm -rf node_modules/.vite
rm -rf dist
```

### Step 3: Clear Browser Cache Completely
**Option A: Hard Refresh (May not be enough)**
- Mac: `Cmd + Shift + R`
- Also try: `Cmd + Option + E` (to empty cache)

**Option B: Developer Tools Method (Recommended)**
1. Open Chrome DevTools (`Cmd + Option + I`)
2. **Right-click** on the browser refresh button (while DevTools is open)
3. Select "Empty Cache and Hard Reload"

**Option C: Clear All Browsing Data (Nuclear option)**
1. Chrome Settings > Privacy and Security
2. Clear browsing data
3. Select "Cached images and files"
4. Time range: "Last hour" or "All time"
5. Click "Clear data"

### Step 4: Restart Dev Server
```bash
npm run dev
```

### Step 5: Open App in New Incognito Window
1. Open a **new Incognito/Private window** (`Cmd + Shift + N`)
2. Navigate to `http://localhost:5173` (or your dev server URL)
3. Log in fresh

### Step 6: Test and Verify Logs
1. Navigate to any property edit page
2. Open Chrome DevTools Console (`Cmd + Option + I`, then click Console tab)
3. You should see:
   - `🎨 PropertyContactsEditor rendered with:` - This confirms the component loaded
   - When you change a contact field, you should see logs like:
     - `☑️ Subcontractor checkbox changed...`
     - `🔄 handleCustomContactChange called:...`
4. Make changes to a contact role
5. Click Save
6. Check console for:
   - `💾 Saving contacts with roles:`
   - `💾 Contacts to insert:`
   - `✅ Contacts saved successfully`

## Expected Console Output
When the new code is loaded, you should see console logs like this:

```
🎨 PropertyContactsEditor rendered with: {customContactsCount: 2, customContacts: Array(2)}
☑️ Subcontractor checkbox changed for contact: abc-123 to: true
🔄 handleCustomContactChange called: {id: "abc-123", field: "is_subcontractor_contact", value: true}
💾 Saving contacts with roles: [{id: "abc-123", is_subcontractor_contact: true, ...}, ...]
💾 Contacts to insert: [{property_id: "...", is_subcontractor_contact: true, ...}, ...]
✅ Contacts saved successfully
```

## If Logs Still Don't Appear
If after following all these steps you still don't see the `🎨 PropertyContactsEditor rendered` log:

1. Check which URL you're on - make sure you're editing a property with custom contacts
2. Try adding a NEW custom contact (click "+ Add Custom Contact")
3. Check the Network tab in DevTools to see if `PropertyContactsEditor.tsx` is being loaded from cache
4. Try a completely different browser (Firefox, Safari) as a test

## Files with Console Logs
These files have extensive logging:
- `src/components/property/PropertyContactsEditor.tsx` (line 75+)
- `src/components/PropertyEditForm.tsx` (lines 180, 551, 565)
- `src/components/PropertyForm.tsx` (similar logs)

If you see ANY of these emoji-prefixed logs, the code is loading correctly. If you see NONE of them, it's a caching issue.
