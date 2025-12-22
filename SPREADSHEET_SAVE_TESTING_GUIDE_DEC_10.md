# Quick Testing Guide - Spreadsheet Save & Rename Fixes

## 🧪 Test 1: Save Persistence (Most Important!)
**Goal**: Verify that changes actually save and persist

### Steps:
1. **Open** any spreadsheet file (CSV or Excel)
2. **Edit** several cells with new values
3. **Save** by clicking the Save button
4. **Wait** for "Last saved: [time]" to appear
5. **Close** the spreadsheet modal
6. **Reopen** the SAME spreadsheet file
7. **Check Console** for these logs:
   ```
   📂 File URL changed, reloading spreadsheet
   🌐 Fetching file from URL (with cache-bust)
   ```

### ✅ Expected Result:
- All your changes should be visible
- The data should match what you saved
- Console should show cache-busting in the URL

### ❌ If It Fails:
- Check console for errors
- Verify the save logs show correct data
- Check if Supabase storage was updated

---

## 🧪 Test 2: Autosave Persistence
**Goal**: Verify autosave works and persists

### Steps:
1. **Open** any spreadsheet file
2. **Edit** a few cells
3. **Wait** 30 seconds (or longer)
4. **Observe** "Last saved: [time]" timestamp appear
5. **Close** the spreadsheet WITHOUT manually saving
6. **Reopen** the file

### ✅ Expected Result:
- Autosaved changes should be visible
- No data loss

---

## 🧪 Test 3: Rename Input Width
**Goal**: Verify rename input is properly sized

### Steps:
1. **Open** any spreadsheet file
2. **Click** on the filename at the top
3. **Observe** the input field that appears

### ✅ Expected Result:
- Input field should be ~450px wide (not full width)
- Clear separation between input and X button
- Easy to see where to type
- Not confusing

### ❌ Old Behavior:
- Input stretched across entire width
- Looked weird next to X button

---

## 🧪 Test 4: Multiple Save Cycles
**Goal**: Verify changes persist across multiple saves

### Steps:
1. **Open** a spreadsheet
2. **Edit** cell A1 to "Test 1"
3. **Save** and close
4. **Reopen** → verify "Test 1" is there
5. **Edit** cell A1 to "Test 2"
6. **Save** and close
7. **Reopen** → verify "Test 2" is there
8. **Repeat** with different cells

### ✅ Expected Result:
- Each save should persist
- Latest changes always visible
- No regression to old data

---

## 🧪 Test 5: Cache Busting Verification
**Goal**: Confirm cache-busting is working

### Steps:
1. **Open** browser DevTools → Network tab
2. **Open** a spreadsheet file
3. **Look** at the fetch request in Network tab
4. **Check** the URL has `?_t=` or `&_t=` parameter
5. **Note** the timestamp value
6. **Close** and **reopen** the file
7. **Check** the new request has a DIFFERENT timestamp

### ✅ Expected Result:
- Each request should have a unique timestamp
- Timestamp should be in milliseconds (13 digits)
- Example: `signed-url?token=abc&_t=1702234567890`

---

## 🧪 Test 6: Browser Console Logs
**Goal**: Verify debug logs are working

### Open Console and Check For:

**On File Open:**
```
📂 File URL changed, reloading spreadsheet: [url]
📊 Starting to load spreadsheet: [filename]
🌐 Fetching file from URL (with cache-bust): [url with _t param]
✅ Fetch response status: 200 OK
```

**On Save:**
```
💾 Saving spreadsheet - Current data rows: [number]
💾 Headers: [array]
💾 First few data rows: [preview]
💾 Creating worksheet with [number] total rows (including headers)
💾 Workbook updated, calling onSave...
📤 Saving spreadsheet: {fileId, fileName, storagePath}
✅ Spreadsheet saved successfully
✅ Save completed successfully
```

---

## 🐛 Troubleshooting

### Problem: Changes still not saving
**Check:**
1. Console for save logs - do they show correct data?
2. Network tab - is the upload request succeeding?
3. Supabase Storage - is the file timestamp updating?
4. Browser cache - try hard refresh (Cmd+Shift+R)

### Problem: Getting old data
**Check:**
1. Console for cache-bust parameter in URL
2. Network tab - is it fetching or using cached version?
3. Try clearing browser cache completely

### Problem: Rename input still too wide
**Check:**
1. Inspect element - should have `max-w-md` class
2. Verify no other CSS is overriding it
3. Check browser zoom level

---

## ✅ Success Criteria

All of these should work:
- ✅ Manual save persists data
- ✅ Autosave persists data  
- ✅ Changes visible after close/reopen
- ✅ Cache-busting parameter in URLs
- ✅ Rename input ~450px wide
- ✅ Console logs show correct data
- ✅ No errors in console
- ✅ Multiple save cycles work
- ✅ Fresh data loaded each time

---

## 📊 Expected Console Output Example

```
📂 File URL changed, reloading spreadsheet: https://...?token=abc&_t=1702234567890
📊 Starting to load spreadsheet: sample.xlsx
🌐 Fetching file from URL (with cache-bust): https://...?token=abc&_t=1702234567890
✅ Fetch response status: 200 OK
📗 Detected Excel file (isExcel: true isPKZip: true)
✅ Excel parsed successfully
📊 Sheets found: 1 [ 'Sheet1' ]
✅ Spreadsheet loading complete

[User makes changes]

💾 Saving spreadsheet - Current data rows: 20
💾 Headers: ['Name', 'Age', 'Email']
💾 First few data rows: [['John', '30', 'john@example.com'], ...]
💾 Creating worksheet with 21 total rows (including headers)
💾 Workbook updated, calling onSave...
📤 Saving spreadsheet: {fileId: 'abc123', fileName: 'sample.xlsx', ...}
💾 Upload size: 15234 bytes
✅ Spreadsheet saved successfully
✅ Save completed successfully
```

---

*Testing Guide - December 10, 2025*
