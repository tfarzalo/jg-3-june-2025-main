# Quick Testing Guide - Spreadsheet Formatting

## How to Test the New Formatting Features

### Prerequisites
✅ Dev server is running on http://localhost:5174/
✅ You're logged into the application
✅ You have access to the File Manager

### Test Scenario 1: CSV File with Formatting

1. **Open File Manager**
2. **Upload a CSV file** (or use an existing one)
3. **Open the CSV file** in the spreadsheet editor
4. **Select a cell** and apply formatting:
   - Click **Bold** button (B)
   - Click **Font Color** picker and choose red
   - Click **Font Size** dropdown and select 16pt
   - Click **Highlight** picker and choose yellow
5. **Type some text** in the cell
6. **Click Save** (should light up immediately while typing)
7. **Wait for "Saved successfully" message**
8. **Close the editor**
9. **Reopen the same CSV file**
10. **✅ VERIFY:** All formatting should be preserved (bold, red text, 16pt, yellow background)

### Test Scenario 2: Excel File with Existing Formatting

1. **Upload an Excel (.xlsx) file** with existing formatting
2. **Open the Excel file**
3. **✅ VERIFY:** Existing formatting loads correctly (colors, bold, etc.)
4. **Make some edits:**
   - Change text in a formatted cell
   - Add new formatting to an unformatted cell
5. **Click Save**
6. **Close and reopen**
7. **✅ VERIFY:** Both original and new formatting are preserved

### Test Scenario 3: Export Options

**Export as CSV:**
1. Open any spreadsheet
2. Apply some formatting
3. Click **Export → Export as CSV**
4. ✅ VERIFY: File downloads as .csv (plain text, no formatting - expected)

**Export as Excel:**
1. Open any spreadsheet with formatting
2. Click **Export → Export as Excel**
3. ✅ VERIFY: File downloads as .xlsx
4. Open the downloaded file in Excel or LibreOffice
5. ✅ VERIFY: All formatting is present

**Export as PDF:**
1. Open any spreadsheet
2. Click **Export → Export as PDF**
3. ✅ VERIFY: PDF downloads and opens correctly
4. ✅ VERIFY: Data is readable and properly formatted in table

### Test Scenario 4: Multiple Formatting on Same Cell

1. Open a spreadsheet
2. Select a cell
3. Apply **all formatting options:**
   - Bold
   - Italic
   - Underline
   - Font Color: Blue
   - Font Size: 18pt
   - Highlight: Light green
   - Alignment: Center
4. Type some text
5. Click Save
6. Close and reopen
7. **✅ VERIFY:** All 7 formatting options are preserved

### Test Scenario 5: Save Button Activation

1. Open a spreadsheet
2. Click on an empty cell
3. Start typing immediately (don't click out)
4. **✅ VERIFY:** Save button should light up **while you're typing** (not after clicking out)
5. Click Save without leaving the cell
6. **✅ VERIFY:** Changes are saved

### Test Scenario 6: Formatting Selection Range

1. Open a spreadsheet
2. Select multiple cells (drag to select a range)
3. Apply bold formatting
4. **✅ VERIFY:** All selected cells become bold
5. Apply red font color
6. **✅ VERIFY:** All selected cells turn red
7. Save, close, reopen
8. **✅ VERIFY:** All cells in the range have preserved formatting

### Common Issues to Check

**Issue:** Save button doesn't light up while typing
- **Expected:** Should enable immediately when you start editing a cell
- **If not working:** Check browser console for errors

**Issue:** Formatting disappears after save
- **Expected:** All formatting should persist
- **If not working:** 
  - Verify ExcelJS is installed: `npm list exceljs`
  - Check browser console for errors
  - Try clearing browser cache

**Issue:** File won't open
- **Expected:** CSV and XLSX files should open
- **If not working:**
  - Check file extension
  - Verify file isn't corrupted
  - Check browser console for errors

**Issue:** Export fails
- **Expected:** All three export options work
- **If not working:**
  - Check browser console for errors
  - Try with smaller file
  - Verify sufficient disk space

### Console Messages to Look For

**On File Load:**
```
📊 Starting to load spreadsheet: [filename]
✅ Excel parsed successfully with ExcelJS
✅ Loaded ExcelJS sheet: [sheetname]
🎨 Formatting metadata entries: [number]
✅ Applied formatting to Handsontable cells
```

**On Save:**
```
🚀 Starting save process with ExcelJS...
💾 Saving spreadsheet - Current data rows: [number]
💾 ExcelJS worksheet updated with [number] rows and formatting
✅ onSave callback completed successfully
✅ Save completed successfully at [time]
```

**On Cell Edit:**
```
✏️ Cell edit in progress, enabling save
📝 User edit detected: [changes]
```

### Performance Benchmarks

**File Loading:**
- Small file (< 100 rows): ~500ms
- Medium file (100-1000 rows): ~1-2 seconds
- Large file (1000-10000 rows): ~3-5 seconds

**Saving:**
- Small file: ~300ms
- Medium file: ~500-1000ms
- Large file: ~1-2 seconds

**Formatting Application:**
- Single cell: Instant
- Range (10x10): ~100ms
- Large range (100x100): ~500ms

### Browser Compatibility Test

Test in each browser:
- ✅ Chrome/Edge
- ✅ Firefox
- ✅ Safari
- ✅ Mobile Safari (iOS)
- ✅ Chrome Mobile (Android)

### Formatting Options to Test

**Text Formatting:**
- [ ] Bold (B button)
- [ ] Italic (I button)
- [ ] Underline (U button)
- [ ] Bold + Italic (both)
- [ ] Bold + Italic + Underline (all three)

**Font Color:**
- [ ] Black (default)
- [ ] Red
- [ ] Blue
- [ ] Green
- [ ] Custom color (use color picker)

**Font Size:**
- [ ] 8pt (smallest)
- [ ] 11pt (default)
- [ ] 14pt (medium)
- [ ] 18pt (large)
- [ ] 24pt (largest)

**Highlight/Background:**
- [ ] Yellow (default highlight)
- [ ] Light green
- [ ] Light blue
- [ ] Light red
- [ ] Custom color

**Text Alignment:**
- [ ] Left (default)
- [ ] Center
- [ ] Right

### Success Criteria

The implementation is successful if:

1. ✅ All formatting options can be applied
2. ✅ Formatting is visible in the editor
3. ✅ Save button enables during typing
4. ✅ Save completes without errors
5. ✅ File can be closed and reopened
6. ✅ All formatting persists after reopen
7. ✅ Export to Excel preserves formatting
8. ✅ Export to CSV works (plain text)
9. ✅ Export to PDF works (table format)
10. ✅ No console errors during normal use
11. ✅ Performance is acceptable (< 5 seconds for large files)
12. ✅ Works in multiple browsers

---

**Need Help?**
- Check `EXCELJS_FORMATTING_IMPLEMENTATION_COMPLETE.md` for technical details
- Check browser console for error messages
- Verify ExcelJS is installed: `npm list exceljs`
- Try clearing browser cache: Ctrl+Shift+Delete (or Cmd+Shift+Delete on Mac)

**Report Issues:**
If you find any issues, note:
1. What you were trying to do
2. What happened instead
3. Browser and version
4. Console error messages (if any)
5. File type (CSV or Excel)
6. File size (approximate row count)
