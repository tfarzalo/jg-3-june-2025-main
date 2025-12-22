# ✅ Spreadsheet Editor - Testing Checklist

## 🎯 Quick Verification Guide

Use this checklist to verify all fixes are working correctly.

---

## 1. MODAL APPEARANCE ✓

### Open a spreadsheet file and verify:

- [ ] Modal appears centered on screen
- [ ] Modal has **40px padding** around all edges (not touching screen edges)
- [ ] Modal uses maximum available space (feels full-width)
- [ ] Background overlay is visible (dark semi-transparent)
- [ ] Modal has rounded corners
- [ ] Close button (X) visible in top-right

**Expected:** Modal should be: `w-[calc(100vw-80px)] h-[calc(100vh-80px)]`

---

## 2. TOOLBAR BUTTONS ✓

### Verify each button is visible and colored correctly:

#### Left Section (Primary Actions)
- [ ] **Save button** is BLUE 🔵
  - Shows "Save" text
  - Disabled (gray) when no changes
  - Enabled (blue) when changes exist
  
- [ ] **Export button** is GREEN 🟢
  - Shows "Export" text
  - Has shadow effect
  - Always enabled

#### Middle Section (Row/Column Tools)
- [ ] Separator line visible (thin gray line)

- [ ] **Add Row button** is BLUE 🔵
  - Shows "+ Row" text
  - Has white text

- [ ] **Add Column button** is PURPLE 🟣
  - Shows "+ Col" text  
  - Has white text

- [ ] **Delete Row button** is RED 🔴
  - Shows trash icon + "Row" text
  - Has white text

- [ ] **Delete Column button** is ORANGE 🟠
  - Shows trash icon + "Col" text
  - Has white text

#### Right Section
- [ ] **Close button** (X) is gray
  - Hovers to darker gray
  - Located far right of toolbar

---

## 3. EXPORT DROPDOWN ✓

### Click the green "Export" button and verify:

- [ ] Dropdown menu appears below button
- [ ] Menu has white background with shadow
- [ ] Menu has border (2px)
- [ ] Menu appears **above** all other content (z-index)

### Verify 3 options are visible:

#### Option 1: CSV
- [ ] **Green icon** 📄 visible (FileDown)
- [ ] Text: "Export as CSV" (bold)
- [ ] Subtitle: "Compatible with Excel" (gray, small)
- [ ] Hovers to green background
- [ ] Border separating from next option

#### Option 2: Excel
- [ ] **Blue icon** 📊 visible (FileDown)
- [ ] Text: "Export as Excel" (bold)
- [ ] Subtitle: ".xlsx format" (gray, small)
- [ ] Hovers to blue background
- [ ] Border separating from next option

#### Option 3: PDF
- [ ] **Red icon** 📋 visible (FileDown)
- [ ] Text: "Export as PDF" (bold)
- [ ] Subtitle: "Printable format" (gray, small)
- [ ] Hovers to red background

### Verify dropdown behavior:
- [ ] Click outside dropdown to close it
- [ ] Click Export button again to toggle
- [ ] Dropdown stays on top of grid

---

## 4. EXPORT FUNCTIONALITY ✓

### Test CSV Export:
- [ ] Click "Export as CSV"
- [ ] File downloads immediately
- [ ] Filename ends with `.csv`
- [ ] Can open in Excel or text editor
- [ ] Data is correct (no corruption)
- [ ] Console shows: `✅ CSV exported successfully`

### Test Excel Export:
- [ ] Click "Export as Excel"
- [ ] File downloads immediately
- [ ] Filename ends with `.xlsx`
- [ ] Can open in Excel/LibreOffice
- [ ] Data is correct (formatting preserved)
- [ ] Console shows: `✅ Excel exported successfully`

### Test PDF Export:
- [ ] Click "Export as PDF"
- [ ] **Check console first:**
  - Should see: `✅ Modules loaded`
  - Should see: `✅ autoTable function found`
  - Should see: `✅ Table generated successfully`
  - Should see: `✅ PDF saved: filename.pdf`
- [ ] File downloads immediately
- [ ] Filename ends with `.pdf`
- [ ] Can open in PDF reader
- [ ] Data appears in table format (not plain text)
- [ ] **NO ERROR**: `doc.autoTable is not a function`

**If PDF fails:**
- Check console for specific error
- Verify jspdf packages are installed
- Try refreshing page and re-opening file
- Use CSV or Excel as fallback

---

## 5. EDITING TOOLS ✓

### Test Add Row:
- [ ] Click blue "+ Row" button
- [ ] New empty row appears at bottom
- [ ] Can edit new row cells
- [ ] "Unsaved changes" indicator appears

### Test Add Column:
- [ ] Click purple "+ Col" button
- [ ] New empty column appears at right
- [ ] Can edit new column cells
- [ ] Column has proper header

### Test Delete Row:
- [ ] Click any cell to select it
- [ ] Note the row number
- [ ] Click red "🗑️ Row" button
- [ ] Selected row is deleted
- [ ] Remaining rows shift up

### Test Delete Column:
- [ ] Click any cell to select it
- [ ] Note the column letter
- [ ] Click orange "🗑️ Col" button
- [ ] Selected column is deleted
- [ ] Remaining columns shift left

---

## 6. SAVE FUNCTIONALITY ✓

### Test Manual Save:
- [ ] Make any edit to a cell
- [ ] "Unsaved changes" indicator appears (amber with pulse)
- [ ] Save button becomes enabled (blue)
- [ ] Click Save button
- [ ] Button shows "Saving..." briefly
- [ ] Button returns to "Save" and disables
- [ ] "Unsaved changes" indicator disappears
- [ ] Console shows: `✅ File saved successfully`

### Test Auto-Save:
- [ ] Make any edit
- [ ] Wait 30 seconds without clicking Save
- [ ] Auto-save should trigger automatically
- [ ] Indicator disappears
- [ ] Save button disables

---

## 7. GRID INTERACTION ✓

### Basic Editing:
- [ ] Click any cell to edit
- [ ] Type text - appears immediately
- [ ] Press Enter - moves to next row
- [ ] Press Tab - moves to next column
- [ ] Right-click - context menu appears

### Selection:
- [ ] Click and drag to select multiple cells
- [ ] Selected area highlights
- [ ] Can copy/paste (Ctrl/Cmd+C, Ctrl/Cmd+V)

### Scrolling:
- [ ] Grid scrolls horizontally
- [ ] Grid scrolls vertically
- [ ] Headers stay visible when scrolling
- [ ] No cut-off content

---

## 8. MULTIPLE SHEETS ✓

**If file has multiple sheets:**

- [ ] Sheet tabs appear below toolbar
- [ ] Active sheet is highlighted
- [ ] Click different sheet tab
- [ ] Grid switches to show that sheet
- [ ] Can edit each sheet independently
- [ ] Save applies to all sheets

---

## 9. CLOSE BEHAVIOR ✓

### Without Changes:
- [ ] Click X button
- [ ] Modal closes immediately
- [ ] Returns to file manager

### With Unsaved Changes:
- [ ] Make an edit (don't save)
- [ ] Click X button
- [ ] Warning dialog appears:
  - "Close without saving?"
  - "You have unsaved changes..."
  - Buttons: "Close Anyway" and "Cancel"
- [ ] Click "Cancel" - stays in editor
- [ ] Click X again
- [ ] Click "Close Anyway" - closes without saving

---

## 10. DARK MODE ✓

### If your app supports dark mode:

- [ ] Toggle dark mode
- [ ] All buttons remain visible
- [ ] Text is readable
- [ ] Grid has appropriate dark theme
- [ ] Export dropdown is dark themed
- [ ] Borders and separators visible

---

## 11. CONSOLE LOGS ✓

### When opening a file, console should show:

```
✅ These logs mean everything is working:

📦 Handsontable modules registered
🟢 SpreadsheetEditor mounted with: {fileUrl, fileName}
📊 Starting to load spreadsheet: filename.csv
✅ Fetch response status: 200
📗 Detected Excel file (or CSV)
✅ Excel/CSV parsed successfully
✅ Spreadsheet loading complete
🎨 Rendering SpreadsheetEditor - Headers: X Data rows: Y
✨ Rendering HotTable with X rows and Y columns
```

### When exporting, console should show:

**CSV Export:**
```
📥 Exporting to CSV...
✅ CSV exported successfully
```

**Excel Export:**
```
📊 Exporting to Excel...
✅ Excel workbook created
```

**PDF Export:**
```
📄 Starting PDF export...
✅ Modules loaded
📊 Data to export: X rows
📝 jsPDF instance created
autoTable exists? function
✅ autoTable function found, generating table...
✅ Table generated successfully
✅ PDF saved: filename.pdf
```

---

## 12. ERROR SCENARIOS ✓

### Expected Behaviors:

**Invalid file:**
- [ ] Error message appears
- [ ] "Close" button available
- [ ] Returns to file manager when closed

**Network error during save:**
- [ ] Error alert appears
- [ ] Can retry save
- [ ] Changes not lost

**Very large file:**
- [ ] Loading indicator shows
- [ ] Eventually loads (may take time)
- [ ] Grid may be slower but functional

---

## 🎯 PASS/FAIL CRITERIA

### ✅ ALL MUST PASS:

1. Modal is full-width with 40px padding
2. Export button is GREEN and visible
3. CSV export option is visible in dropdown
4. PDF export works (no autoTable error)
5. All toolbar buttons are visible and colored
6. All editing tools (add/delete row/column) work
7. Save functionality works
8. Close button works

### If ANY fail:
- Check browser console for errors
- Verify packages are installed (`npm install`)
- Clear browser cache
- Try different browser
- Check documentation files for troubleshooting

---

## 📋 Quick Test Script

**5-Minute Smoke Test:**

1. ✅ Open any spreadsheet file
2. ✅ Verify modal is full-width with padding
3. ✅ Check Export button is GREEN
4. ✅ Click Export - verify 3 options with subtitles
5. ✅ Export to CSV - verify download works
6. ✅ Export to PDF - verify no error in console
7. ✅ Click blue "+ Row" button - verify row added
8. ✅ Click red "🗑️ Row" button - verify row deleted
9. ✅ Make edit - verify Save button enables
10. ✅ Click Save - verify saves successfully
11. ✅ Click X - verify closes (after save)

**If all 11 steps pass → ✅ READY FOR PRODUCTION**

---

## 📞 If Issues Found

### Issue: PDF export fails
**Check:**
- Console for specific error
- `package.json` has `jspdf` and `jspdf-autotable`
- Network inspector for failed imports

**Fix:**
- Run `npm install jspdf jspdf-autotable`
- Clear browser cache
- Restart dev server

### Issue: Export button not green
**Check:**
- Browser cache (hard refresh: Ctrl+F5)
- CSS not loading

**Fix:**
- Clear cache and refresh
- Check for TypeScript/build errors

### Issue: Modal not full-width
**Check:**
- Browser zoom level (should be 100%)
- Screen resolution

**Fix:**
- Reset zoom to 100%
- Try different screen size

---

**Testing Checklist**  
**Version**: 1.0  
**Date**: December 10, 2024  
**Status**: Ready for Testing ✓

**Next Step**: Work through this checklist to verify all fixes!
