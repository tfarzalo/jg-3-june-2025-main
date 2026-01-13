# Quick Testing Guide - Header Editing & Document Formats

## 🧪 SpreadsheetEditor Tests

### Test 1: Column Header Renaming
1. Open any spreadsheet file (CSV or Excel)
2. **Double-click** on a column header (e.g., "A" or "Column A")
3. ✅ Verify modal appears with input field
4. Type a new name (e.g., "Revenue")
5. Press **Enter**
6. ✅ Verify header changes in the grid
7. ✅ Verify "Unsaved changes" appears

### Test 2: Row Header Double-Click
1. **Double-click** on a row number (e.g., "1", "2", "3")
2. ✅ Verify modal appears (note: rows are typically just numbers)
3. Press **Escape** to cancel
4. ✅ Verify modal closes without changes

### Test 3: Header Rename Cancel
1. Double-click a column header
2. Type a new name
3. Click **Cancel** button
4. ✅ Verify header remains unchanged
5. ✅ Verify no unsaved changes

### Test 4: X Button Position
1. Open any spreadsheet
2. ✅ Verify X button is in the **same row as filename** (top right)
3. ✅ Verify X button is **NOT in the toolbar**
4. Click X button
5. ✅ Verify editor closes

---

## 📄 DocumentEditor Tests

### Test 5: Text File Support
1. Upload/open a `.txt` file
2. ✅ Verify content displays with paragraphs
3. Edit the content
4. Click Save
5. ✅ Verify changes persist

### Test 6: DOCX File Support
1. Upload/open a `.docx` file
2. ✅ Verify formatting is preserved (bold, italics, etc.)
3. Edit the content
4. Export as DOCX
5. ✅ Verify exported file opens correctly

### Test 7: Markdown File Support
1. Upload/open a `.md` or `.markdown` file
2. ✅ Verify headings convert to H1/H2/H3
3. ✅ Verify **bold** and *italic* formatting
4. Edit the content
5. ✅ Verify changes save correctly

### Test 8: RTF File Support
1. Upload/open a `.rtf` file
2. ✅ Verify text content extracts (formatting stripped)
3. Edit the content
4. ✅ Verify editing works smoothly

### Test 9: Legacy DOC Support
1. Upload/open a `.doc` file (if available)
2. ✅ Verify content loads (may be text-only)
3. Edit the content
4. ✅ Verify saves correctly

### Test 10: Pages/ODT Notice
1. Upload/open a `.pages` file
2. ✅ Verify notice message about conversion requirement
3. Upload/open a `.odt` file
4. ✅ Verify compatibility notice displays

### Test 11: Document Export
1. Open any document
2. Click **Export** dropdown
3. Export as **DOCX**
4. ✅ Verify file downloads
5. Export as **HTML**
6. ✅ Verify file downloads
7. Export as **TXT**
8. ✅ Verify file downloads

### Test 12: X Button Position
1. Open any document
2. ✅ Verify X button is in the **same row as filename** (top right)
3. ✅ Verify X button is **NOT in the toolbar**
4. Click X button
5. ✅ Verify editor closes

---

## 🎨 UI/UX Tests

### Test 13: Header Modal UI
1. Double-click any column header
2. ✅ Verify modal has semi-transparent black background
3. ✅ Verify modal is centered on screen
4. ✅ Verify input field has focus
5. ✅ Verify Save button is blue
6. ✅ Verify Cancel button is gray
7. ✅ Verify modal width is reasonable (400px min)

### Test 14: Dark Mode Compatibility
1. Enable dark mode (if available)
2. Open spreadsheet and double-click header
3. ✅ Verify modal has dark background
4. ✅ Verify text is visible
5. Open document editor
6. ✅ Verify editor is readable in dark mode

### Test 15: Keyboard Shortcuts
1. Double-click column header
2. Press **Escape**
3. ✅ Verify modal closes
4. Double-click again
5. Type new name and press **Enter**
6. ✅ Verify saves and closes

---

## 🔧 Edge Cases

### Test 16: Empty Header Name
1. Double-click column header
2. Delete all text (empty input)
3. Press Enter
4. ✅ Verify default name is used (e.g., "Column 1")

### Test 17: Very Long Header Name
1. Double-click column header
2. Type a very long name (100+ characters)
3. Press Enter
4. ✅ Verify header updates (may truncate in display)

### Test 18: Special Characters
1. Double-click column header
2. Type special characters: `!@#$%^&*()`
3. Press Enter
4. ✅ Verify header accepts special characters

### Test 19: Multiple Rapid Edits
1. Double-click header → rename → save
2. Immediately double-click same header
3. Rename again
4. ✅ Verify works without issues

### Test 20: Unsupported File Format
1. Upload a file with unknown extension (e.g., `.xyz`)
2. ✅ Verify error message or basic text editor
3. ✅ Verify doesn't crash

---

## 📊 Results Template

```
Test #  | Description               | Pass/Fail | Notes
--------|---------------------------|-----------|-------
1       | Column Header Rename      | ⬜        |
2       | Row Header Double-Click   | ⬜        |
3       | Header Rename Cancel      | ⬜        |
4       | X Button Position (Sheet) | ⬜        |
5       | Text File Support         | ⬜        |
6       | DOCX File Support         | ⬜        |
7       | Markdown File Support     | ⬜        |
8       | RTF File Support          | ⬜        |
9       | Legacy DOC Support        | ⬜        |
10      | Pages/ODT Notice          | ⬜        |
11      | Document Export           | ⬜        |
12      | X Button Position (Doc)   | ⬜        |
13      | Header Modal UI           | ⬜        |
14      | Dark Mode Compatibility   | ⬜        |
15      | Keyboard Shortcuts        | ⬜        |
16      | Empty Header Name         | ⬜        |
17      | Very Long Header Name     | ⬜        |
18      | Special Characters        | ⬜        |
19      | Multiple Rapid Edits      | ⬜        |
20      | Unsupported File Format   | ⬜        |
```

---

## 🎯 Critical Tests (Must Pass)

**Priority 1 (Blockers):**
- ✅ Test 1: Column Header Rename
- ✅ Test 4: X Button Position (Spreadsheet)
- ✅ Test 5: Text File Support
- ✅ Test 6: DOCX File Support
- ✅ Test 12: X Button Position (Document)

**Priority 2 (Important):**
- ✅ Test 3: Header Rename Cancel
- ✅ Test 7: Markdown File Support
- ✅ Test 11: Document Export
- ✅ Test 15: Keyboard Shortcuts

**Priority 3 (Nice to Have):**
- ✅ Test 8-10: Additional format support
- ✅ Test 13-14: UI/UX polish
- ✅ Test 16-20: Edge cases

---

## 🚨 Known Limitations

1. **Row Headers**: Rows are typically just sequential numbers. Double-clicking works but renaming may not be as useful as columns.

2. **Pages Format**: Apple Pages files are packages (ZIP archives) and require specialized parsing. The editor shows a notice to convert to DOCX or PDF instead.

3. **ODT Format**: Full ODT support requires additional libraries. Basic text extraction is provided with a compatibility notice.

4. **RTF Format**: Only basic text extraction is performed. Complex formatting may be lost.

5. **Legacy DOC**: Old .doc format support is limited. The editor attempts conversion but may fall back to text-only mode.

---

## ✅ Success Criteria

**All features working if:**
- [ ] Column headers can be renamed via double-click
- [ ] Header rename modal appears and functions correctly
- [ ] X button is in filename row for both editors
- [ ] Text, DOCX, and Markdown files load and edit correctly
- [ ] Export functions work for all formats
- [ ] No console errors during normal operations
- [ ] Autosave triggers after header rename
- [ ] Dark mode works properly
- [ ] Keyboard shortcuts (Enter/Escape) work

---

**Date**: December 10, 2025  
**Version**: 1.0  
**Status**: Ready for Testing
