# Quick Start Guide - Document & Spreadsheet Editors

## 🚀 Getting Started

### 1. Run the Application
```bash
npm run dev
```

### 2. Navigate to File Manager
Go to the File Manager section in your application.

### 3. Upload Test Files
Upload sample files to test:
- `test.xlsx` - Excel spreadsheet
- `test.csv` - CSV file
- `test.docx` - Word document
- `test.txt` - Text file
- `test.pdf` - PDF document

### 4. Open & Edit
Click on any file to open it in the appropriate editor.

---

## 📁 Supported File Types

| Type | Extensions | Editing | Export Formats |
|------|-----------|---------|----------------|
| Spreadsheet | .xlsx, .xls, .csv | ✅ Yes | Excel, CSV |
| Document | .docx, .doc, .txt | ✅ Yes | DOCX, HTML, TXT |
| PDF | .pdf | ❌ View Only | N/A |

---

## 🎨 Editor Features

### Spreadsheet Editor
- **Edit cells**: Click or double-click any cell
- **Multiple sheets**: Switch between sheets using tabs
- **Resize**: Drag column/row borders to resize
- **Save**: Auto-saves every 30s, or click Save button
- **Export**: Click Export → Choose CSV or Excel

### Document Editor
- **Format text**: Use toolbar for bold, italic, headers, etc.
- **Add links**: Click link icon in toolbar
- **Insert images**: Click image icon
- **Word count**: Displayed in top-right corner
- **Save**: Auto-saves every 30s, or click Save button
- **Export**: Click Export → Choose DOCX, HTML, or TXT

### PDF Viewer
- **Navigate**: Use arrows or page thumbnails
- **Zoom**: Use zoom buttons or scroll
- **Search**: Use search bar in sidebar
- **Download**: Click Download button

---

## 💾 Auto-Save

All editors automatically save your changes after 30 seconds of inactivity.

**Visual indicators:**
- 🟠 Orange dot = Unsaved changes
- ⏱️ "Auto-save in 30s" = Timer counting down
- ✅ Green checkmark = Saved successfully

---

## ⌨️ Keyboard Shortcuts

### Spreadsheet
- `Arrow keys` - Navigate cells
- `Enter` - Edit cell
- `Tab` - Move to next cell
- `Ctrl/Cmd + C` - Copy
- `Ctrl/Cmd + V` - Paste
- `Ctrl/Cmd + Z` - Undo

### Document
- `Ctrl/Cmd + B` - Bold
- `Ctrl/Cmd + I` - Italic
- `Ctrl/Cmd + U` - Underline
- `Ctrl/Cmd + K` - Insert link
- `Ctrl/Cmd + Z` - Undo
- `Ctrl/Cmd + Y` - Redo

---

## ⚠️ Troubleshooting

### File won't open
- Check if file format is supported
- Try re-uploading the file
- Check browser console for errors

### Changes not saving
- Check internet connection
- Verify you have edit permissions
- Try manual save (click Save button)

### Slow performance
- Close other browser tabs
- Try with a smaller file
- Refresh the page

---

## 📞 Need Help?

Check the full documentation: `DOCUMENT_SPREADSHEET_EDITOR_IMPLEMENTATION_DEC_9_2025.md`

---

**Quick Reference Card**

```
┌─────────────────────────────────────────────┐
│  FILE TYPES                                 │
│  ✅ .xlsx .xls .csv    → Spreadsheet       │
│  ✅ .docx .doc .txt    → Document          │
│  👁️ .pdf               → View Only         │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  ACTIONS                                    │
│  💾 Auto-save          → Every 30s         │
│  📥 Export             → Multiple formats  │
│  ⌨️ Keyboard shortcuts → Full support     │
│  📱 Mobile             → Responsive        │
└─────────────────────────────────────────────┘
```
