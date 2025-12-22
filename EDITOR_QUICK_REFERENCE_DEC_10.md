# Spreadsheet & Document Editor - Quick Reference Guide

## 📊 File Renaming

### How to Rename a File
1. **Open** a spreadsheet or document in the editor modal
2. **Click** the filename at the top of the editor
3. **Type** the new name
4. **Save** by pressing `Enter` or clicking the "Save" button
5. **Cancel** by pressing `Escape` or clicking the "Cancel" button

**Visual Indicators:**
- Filename shows "(click to rename)" hint when hovering
- Edit mode displays input field with buttons
- "Saving..." appears during the rename operation

---

## 🎨 Text Formatting (Spreadsheet Editor)

### How to Format Cells

#### 1. Select Cells
- Click and drag to select cells
- Hold `Shift` to extend selection
- Use keyboard arrows with `Shift` for precise selection

#### 2. Apply Formatting
All formatting buttons are in the toolbar below the filename.

### Available Formatting Options

#### **📝 Text Style**
| Button | Effect | Toggle |
|--------|--------|--------|
| **B** (Bold) | Makes text bold | Yes - click again to remove |
| *I* (Italic) | Makes text italic | Yes - click again to remove |
| <u>U</u> (Underline) | Underlines text | Yes - click again to remove |

**Example:**
1. Select cells A1:C3
2. Click the **B** button
3. Text becomes bold
4. Click **B** again to remove bold

---

#### **🔤 Font Size**
- Click the **Type icon with number** button
- Select size from dropdown: 8, 9, 10, 11, 12, 14, 16, 18, 20, 24
- Default is 11pt

**Example:**
1. Select cells with data
2. Click font size button
3. Choose 16 from the dropdown
4. Text becomes larger

---

#### **🎨 Cell Color**
- Click the **Palette icon** button
- Enter color in the prompt
  - Hex codes: `#ffff00`
  - Color names: `yellow`, `lightblue`, `pink`
- Background changes immediately

**Example:**
1. Select cells to highlight
2. Click palette button
3. Type `#ffff00` or `yellow`
4. Click OK

---

#### **↔️ Text Alignment**
| Button | Alignment |
|--------|-----------|
| Left align icon | Align Left |
| Center align icon | Align Center |
| Right align icon | Align Right |

**Example:**
1. Select column headers
2. Click center align button
3. Headers center in their cells

---

## 💾 Saving Changes

### Auto-Save
- Changes auto-save after 30 seconds of inactivity
- Yellow indicator shows "Unsaved changes • Auto-save in 30s"

### Manual Save
- Click the **Save** button in the toolbar
- Button is blue when changes exist
- Button shows "Saving..." during save operation

---

## 📤 Exporting Files

### Export Options
1. Click the **Export ▼** button
2. Choose format:
   - **CSV** - Comma-separated values
   - **Excel** - Full Excel workbook with all sheets
   - **PDF** - Formatted PDF document

### Export Includes:
- ✅ All data and formulas
- ⚠️ Formatting may not export perfectly (future enhancement)
- ✅ Multiple sheets (Excel only)

---

## ⚙️ Row & Column Operations

### Add Rows/Columns
| Button | Action |
|--------|--------|
| **+Row** | Adds row below current selection |
| **+Col** | Adds column to right of selection |

### Delete Rows/Columns
| Button | Action |
|--------|--------|
| **🗑️Row** | Deletes selected row |
| **🗑️Col** | Deletes selected column |

**Note:** Select a cell in the row/column you want to delete

---

## 🔍 Tips & Tricks

### Keyboard Shortcuts
- `Enter` - Save filename while renaming
- `Escape` - Cancel rename or close dropdown
- `Ctrl/Cmd + C` - Copy cell(s)
- `Ctrl/Cmd + V` - Paste cell(s)
- `Ctrl/Cmd + Z` - Undo (Handsontable default)

### Multiple Formatting
You can apply multiple formats to the same cells:
1. Select cells
2. Click Bold
3. Click Italic
4. Click Center Align
5. All formats apply simultaneously

### Removing Formatting
- Toggle buttons (Bold, Italic, Underline) - Click again to remove
- Alignment - Select different alignment to replace
- Color - Enter blank or white to remove color
- Font Size - Select 11 to return to default

---

## ❗ Important Notes

### Formatting Persistence
- ⚠️ **Current Session Only** - Formatting is lost when you close the file
- 💡 **Future Update** - Formatting persistence is coming soon
- 📋 **Workaround** - Export as Excel to preserve some formatting

### Selection Required
- Most formatting requires cells to be selected first
- Alert appears if no cells are selected

### Undo/Redo
- Handsontable provides built-in undo/redo for data changes
- Formatting changes can also be undone with `Ctrl/Cmd + Z`

---

## 🐛 Troubleshooting

### "Please select cells to format"
**Solution:** Click and drag to select cells before clicking formatting button

### Formatting not visible
**Solution:** Check browser zoom level; formatting classes may need adjustment at extreme zooms

### Save button grayed out
**Solution:** This is normal when there are no unsaved changes

### Can't rename file
**Solution:** Ensure you have permission to edit the file; check that modal is not in read-only mode

---

## 📞 Need Help?

### Common Questions

**Q: How do I remove all formatting from a cell?**  
A: Toggle off Bold/Italic/Underline individually; alignment defaults to left; font size back to 11; color to white

**Q: Can I copy formatting from one cell to another?**  
A: Format painter is planned for a future update; currently, reapply formatting manually

**Q: Does formatting export to PDF/Excel?**  
A: Basic formatting exports, but some styles may be lost; Excel export is best for preservation

**Q: Can I undo a rename?**  
A: Rename history/undo is planned; for now, rename back to the original name manually

---

## 🎯 Quick Start Checklist

- [ ] Open a spreadsheet file
- [ ] Try renaming the file
- [ ] Select some cells
- [ ] Apply bold formatting
- [ ] Try changing alignment
- [ ] Test cell color
- [ ] Save your changes
- [ ] Export as Excel
- [ ] Success! 🎉

---

**Version**: 1.0  
**Last Updated**: December 10, 2025  
**For**: Spreadsheet & Document Editor v2.0
