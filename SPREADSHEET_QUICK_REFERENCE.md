# Spreadsheet Editor - Quick Reference Card

## 🎯 One-Page Guide to All Features

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  📊 YOUR_FILENAME.xlsx                                      ← FILENAME HERE  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [💾] [📥▼] │ [+Row] [+Col] [🗑️Row] [🗑️Col] │ [B][I][U] [12▼] [🎨] [⬅][⬛][➡]  [✕]  │
│  Save Export│  Edit Tools                  │  Text Format                │
│             │                              │                              │
│  [●] Unsaved changes • Auto-save in 30s                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📋 Button Reference

| Button | Name | Color | Function | Selection Required |
|--------|------|-------|----------|-------------------|
| **💾 Save** | Save | Blue | Save changes to file | No |
| **📥 Export** | Export | Green | Download as CSV/Excel/PDF | No |
| **+ Row** | Add Row | Blue | Add row at bottom | No |
| **+ Col** | Add Column | Purple | Add column at right | No |
| **🗑️ Row** | Delete Row | Red | Delete selected row | **Yes** |
| **🗑️ Col** | Delete Column | Orange | Delete selected column | **Yes** |
| **B** | Bold | Gray | Toggle bold text | **Yes** |
| **I** | Italic | Gray | Toggle italic text | **Yes** |
| **U** | Underline | Gray | Toggle underline | **Yes** |
| **12** | Font Size | Gray | Change font size | **Yes** |
| **🎨** | Color | Gray | Background color | **Yes** |
| **⬅** | Align Left | Gray | Align text left | **Yes** |
| **⬛** | Align Center | Gray | Center text | **Yes** |
| **➡** | Align Right | Gray | Align text right | **Yes** |
| **✕** | Close | Gray | Close editor | No |

---

## ⚡ Quick Actions

### Save & Export
```
Save Changes:        Click [💾 Save] (blue)
Export to CSV:       Click [📥 Export] → "Export as CSV"
Export to Excel:     Click [📥 Export] → "Export as Excel"
Export to PDF:       Click [📥 Export] → "Export as PDF"
```

### Edit Structure
```
Add Row:            Click [+ Row] (blue)
Add Column:         Click [+ Col] (purple)
Delete Row:         1. Click cell in row  2. Click [🗑️ Row] (red)
Delete Column:      1. Click cell in col  2. Click [🗑️ Col] (orange)
```

### Format Text
```
Bold:               1. Select cells  2. Click [B]
Italic:             1. Select cells  2. Click [I]
Underline:          1. Select cells  2. Click [U]
Font Size:          1. Select cells  2. Click [12▼]  3. Pick size
Background:         1. Select cells  2. Click [🎨]  3. Enter color
Align Left:         1. Select cells  2. Click [⬅]
Align Center:       1. Select cells  2. Click [⬛]
Align Right:        1. Select cells  2. Click [➡]
```

---

## 🎨 Formatting Examples

### How to Format Cells:

**Example 1: Make Header Row Bold**
```
1. Click cell A1
2. Drag to last column (or Shift+Click)
3. Click [B] button
4. Header is now bold!
```

**Example 2: Center Align Numbers**
```
1. Select all number cells
2. Click [⬛] (center align)
3. Numbers are centered!
```

**Example 3: Highlight Important Rows**
```
1. Select entire row (click row number, drag across)
2. Click [🎨] (color button)
3. Type: yellow (or #ffff00)
4. Press OK
5. Row is highlighted!
```

**Example 4: Change Title Font Size**
```
1. Select title cells
2. Click [12▼] (font size dropdown)
3. Click 18 or 20
4. Title is larger!
```

---

## ⌨️ Keyboard Shortcuts (Grid)

```
Arrow Keys        Move between cells
Tab              Next cell (right)
Shift+Tab        Previous cell (left)
Enter            Next cell (down)
Shift+Enter      Previous cell (up)
Ctrl/Cmd+C       Copy selected cells
Ctrl/Cmd+V       Paste
Ctrl/Cmd+Z       Undo (if supported)
Delete           Clear cell content
```

---

## ⚠️ Important Notes

### When Delete Doesn't Work:
- **Problem**: Clicked delete but nothing happened
- **Solution**: You must **select a cell first**
  1. Click any cell in the row/column
  2. Then click delete button
  3. Alert will show if still no selection

### When Formatting Doesn't Work:
- **Problem**: Clicked Bold/Italic but nothing happened
- **Solution**: You must **select cells first**
  1. Click and drag to select cells
  2. Then click formatting button
  3. Alert will show if no selection

### Saving:
- **Auto-save**: Waits 30 seconds after last change
- **Manual save**: Click blue Save button anytime
- **Indicator**: Orange dot + text shows unsaved changes

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| Delete row does nothing | Select a cell first, then click delete |
| Delete column does nothing | Select a cell first, then click delete |
| Bold doesn't apply | Select cells first, then click Bold |
| Font size dropdown doesn't appear | Click the button again, or click outside first |
| Can't see filename | It's at the very top, above all buttons |
| Changes not saving | Click blue Save button (or wait for auto-save) |
| Export dropdown not showing | Click Export button again |

---

## 📊 File Format Guide

### CSV Export
- **Best for**: Excel, Google Sheets, databases
- **Format**: Plain text, comma-separated
- **Compatibility**: Universal
- **Use when**: Sharing with others, importing data

### Excel Export
- **Best for**: Excel, LibreOffice
- **Format**: Binary .xlsx
- **Compatibility**: Modern Excel (2007+)
- **Use when**: Preserving formatting, complex sheets

### PDF Export
- **Best for**: Printing, viewing, sharing
- **Format**: Portable document
- **Compatibility**: Universal (any PDF reader)
- **Use when**: Final version, read-only distribution

---

## 🎯 Common Workflows

### 1. Edit Existing File
```
1. Open file from File Manager
2. Click cell to edit
3. Type new value
4. Press Enter
5. Click Save
```

### 2. Add Data Rows
```
1. Click [+ Row] (blue) multiple times
2. Fill in new data
3. Click Save
```

### 3. Format Report Header
```
1. Select header row
2. Click [B] for bold
3. Click [12▼], select 16 for larger font
4. Click [⬛] to center
5. Click [🎨], enter light color
6. Click Save
```

### 4. Remove Unused Columns
```
1. Click any cell in column
2. Click [🗑️ Col] (orange)
3. Repeat for other columns
4. Click Save
```

### 5. Export for Client
```
1. Make all edits
2. Click Save
3. Click Export
4. Choose PDF for viewing or Excel for editing
5. File downloads
```

---

## 🎨 Color Examples

When clicking the color button ([🎨]), you can use:

**Named Colors**:
- `yellow`, `red`, `blue`, `green`, `orange`, `purple`, `pink`

**Hex Colors**:
- `#ffff00` (yellow), `#ff0000` (red), `#00ff00` (green)
- `#ccccff` (light blue), `#ffcccc` (light red)

**RGB Colors**:
- `rgb(255, 255, 0)` (yellow)
- `rgb(200, 200, 255)` (light blue)

**Recommended Highlights**:
- Light yellow: `#ffffcc` or `#ffffe0`
- Light green: `#ccffcc` or `#e0ffe0`
- Light blue: `#ccccff` or `#e0e0ff`
- Light red: `#ffcccc` or `#ffe0e0`

---

## ✅ Pre-Flight Checklist

Before closing the editor:

- [ ] All edits complete
- [ ] Formatting applied
- [ ] Unnecessary rows/columns deleted
- [ ] **Saved** (no orange dot showing)
- [ ] Exported if needed

---

## 🆘 Need Help?

### Check Console (F12):
- Opens browser developer tools
- Look for messages starting with ✅, ❌, 🎨, etc.
- Shows what's happening behind the scenes

### Common Console Messages:
```
✅ Row added at index: 5        → Row added successfully
🗑️ Deleting column: 3           → Column being deleted
✅ bold applied successfully     → Formatting worked
❌ No cell selected              → Need to select a cell first
⚠️ No cells selected            → Need to select cells
```

---

**Quick Reference Card**  
**Version**: 1.0  
**Date**: December 10, 2024  
**Print this page for easy reference!**
