# Spreadsheet Editor - Quick Start Guide

## 🚀 How to Use the Spreadsheet Editor

### Opening a Spreadsheet

1. Navigate to **File Manager** in your app
2. Click on any `.csv` or `.xlsx` file
3. The spreadsheet editor will open in a full-screen modal

### Editing Your Spreadsheet

#### Basic Editing
- **Click any cell** to edit its value
- **Press Enter** to move to the next row
- **Press Tab** to move to the next column
- **Right-click** for context menu (copy, paste, etc.)

#### Adding/Removing Rows & Columns
- **Add Row**: Click the blue **"+ Row"** button
- **Add Column**: Click the purple **"+ Col"** button
- **Delete Row**: Select a cell in the row, then click red **"🗑️ Row"** button
- **Delete Column**: Select a cell in the column, then click orange **"🗑️ Col"** button

### Saving Your Work

#### Auto-Save
- Changes are automatically saved after **30 seconds** of inactivity
- You'll see an amber indicator: "Unsaved changes • Auto-save in 30s"

#### Manual Save
- Click the blue **"Save"** button at any time
- Button is only enabled when you have unsaved changes
- You'll see "Saving..." while the file is being saved

### Exporting Your Spreadsheet

1. Click the green **"Export"** button in the toolbar
2. Choose your format:

   - **CSV** (green icon)
     - Best for: Universal compatibility, Excel
     - Extension: `.csv`
     - Size: Smallest
   
   - **Excel** (blue icon)
     - Best for: Full Excel features
     - Extension: `.xlsx`
     - Size: Medium
   
   - **PDF** (red icon)
     - Best for: Printing, read-only sharing
     - Extension: `.pdf`
     - Size: Varies

3. The file will download automatically

### Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Edit cell | Double-click or press Enter |
| Move to next cell | Tab or Arrow keys |
| Select cell | Click |
| Select multiple cells | Click and drag |
| Copy | Ctrl/Cmd + C |
| Paste | Ctrl/Cmd + V |
| Undo | Ctrl/Cmd + Z |
| Redo | Ctrl/Cmd + Y |

### Working with Multiple Sheets

If your Excel file has multiple sheets:
- **Sheet tabs** appear below the toolbar
- Click any tab to switch sheets
- Each sheet saves independently

### Closing the Editor

1. Click the **"✕"** button in the top-right
2. If you have unsaved changes, you'll see a warning:
   - **"Close Anyway"** - discard changes
   - **"Cancel"** - return to editing

## 🎯 Tips & Tricks

### Data Entry
- ✅ Paste data from Excel directly into the grid
- ✅ Use context menu (right-click) for quick actions
- ✅ Drag cell borders to resize columns/rows

### Performance
- ✅ For large files, use CSV export (faster)
- ✅ Auto-save prevents data loss
- ✅ Close other browser tabs if editor is slow

### Export Best Practices
- **CSV**: Best for data analysis, imports
- **Excel**: Best for sharing with Excel users
- **PDF**: Best for printing or read-only viewing

### Troubleshooting

#### Grid not showing?
- Refresh the page
- Check browser console for errors
- Try a different browser

#### Save not working?
- Check your internet connection
- Verify file permissions in Supabase
- Check browser console for errors

#### Export failing?
- Try a different format (CSV usually works)
- Check file size (very large files may time out)
- Check browser console for detailed error

## 📋 Feature Checklist

### ✅ Available Now
- [x] Edit cells
- [x] Add/delete rows
- [x] Add/delete columns
- [x] Resize columns/rows
- [x] Auto-save (30s)
- [x] Manual save
- [x] Export to CSV
- [x] Export to Excel
- [x] Export to PDF
- [x] Multiple sheets
- [x] Context menu
- [x] Keyboard navigation
- [x] Dark mode support

### 🔮 Coming Soon (Future Enhancements)
- [ ] Cell formatting (bold, colors)
- [ ] Formulas (SUM, AVERAGE)
- [ ] Charts/graphs
- [ ] Data validation
- [ ] Conditional formatting
- [ ] Real-time collaboration
- [ ] Comments

## 🎨 Button Reference

### Toolbar Buttons (Left to Right)

1. **💾 Save** (Blue)
   - Saves changes to file
   - Disabled when no changes

2. **📥 Export** (Green)
   - Opens export menu
   - 3 format options

3. **Separator** (Gray line)

4. **➕ Row** (Blue)
   - Adds row at bottom

5. **➕ Col** (Purple)
   - Adds column at end

6. **🗑️ Row** (Red)
   - Deletes selected row

7. **🗑️ Col** (Orange)
   - Deletes selected column

8. **✕ Close** (Gray)
   - Closes editor
   - Warns if unsaved

## 🆘 Support

### Need Help?
1. Check browser console (F12) for errors
2. Review this guide
3. Check the main documentation
4. Contact support with:
   - What you were trying to do
   - What happened instead
   - Browser console errors (if any)

### Common Issues & Solutions

**Issue**: Modal too small
- **Solution**: Already fixed - modal is full-width with 40px padding

**Issue**: Can't see export options
- **Solution**: Export button is now GREEN and prominent

**Issue**: PDF export not working
- **Solution**: Try CSV or Excel export instead (more reliable)

**Issue**: Changes not saving
- **Solution**: Check internet connection, try manual save

**Issue**: File won't open
- **Solution**: Verify file is .csv or .xlsx format

## 🎓 Learning Resources

### For Basic Users
- Just click cells and type!
- Use the colored buttons for common tasks
- Export to share your work

### For Power Users
- Learn keyboard shortcuts for speed
- Use context menu for advanced features
- Explore Excel-compatible features
- Try formulas (if enabled in your version)

### For Developers
- Check `SpreadsheetEditor.tsx` for code
- Review `fileSaveService.ts` for save logic
- See documentation for API integration

---

**Quick Start Guide**  
**Version**: 1.0  
**Last Updated**: December 10, 2024  

**Questions?** Check the full documentation: `SPREADSHEET_EDITOR_FINAL_COMPLETE_FIX_DEC_10.md`
