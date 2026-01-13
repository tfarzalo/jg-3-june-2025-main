# 🔍 Quick Debugging Checklist - December 10, 2025

## Before You Report "Not Working"

### ✅ MUST DO: Open Browser Console
Press **F12** (or Cmd+Option+I on Mac) and click the **Console** tab.

Keep it open while testing!

---

## 🧪 Test 1: Spreadsheet Save

### Steps:
1. [ ] Open browser console (F12)
2. [ ] Open a spreadsheet file
3. [ ] Make a change to any cell
4. [ ] Click **Save** button
5. [ ] **WATCH THE CONSOLE**

### What You Should See:
```
🚀 Starting save process...
💾 Saving spreadsheet - Current data rows: [number]
💾 Headers: [...]
💾 First 3 data rows: [...]
💾 Creating worksheet with [number] total rows
💾 Workbook updated, calling onSave callback...
📤 Saving spreadsheet: {fileId: "...", fileName: "...", storagePath: "..."}
💾 Upload size: [number] bytes
✅ Spreadsheet saved successfully
✅ onSave callback completed successfully
✅ Save completed successfully at [time]
```

### ✅ If You See All This:
The save IS working! Continue to step 6:

6. [ ] Close the spreadsheet
7. [ ] Reopen the same file
8. [ ] Check if your changes are there

### ❌ If You DON'T See All This:
**STOP AND SHARE THE CONSOLE OUTPUT!**

Copy everything from the console and share it. Tell us where the logs stop.

---

## 📄 Test 2: Document Loading

### Steps:
1. [ ] Open browser console (F12)
2. [ ] Try to open a document (.docx, .doc, .txt)
3. [ ] **WATCH THE CONSOLE**

### What You Should See (for .docx):
```
📄 Loading document: {fileName: "...", fileType: "...", fileUrl: "..."}
📗 Loading DOCX file with mammoth
✅ DOCX loaded successfully
```

### ❌ If You See an Error:
Look for:
```
❌ Error loading document: [error details]
Error details: {
  message: "...",
  fileName: "...",
  fileType: "...",
  fileUrl: "..."
}
```

**COPY THIS ERROR OBJECT AND SHARE IT!**

This tells us exactly what's wrong.

---

## 🎨 Test 3: Color Picker

### Steps:
1. [ ] Open a spreadsheet
2. [ ] Click on a cell
3. [ ] Click the Palette button (🎨)

### What You Should See:
- [ ] A dropdown with colorful squares
- [ ] 20 color options in a grid
- [ ] Custom color picker at bottom
- [ ] "Apply" button

### Test It:
1. [ ] Click a yellow color square
2. [ ] Cell background should turn yellow immediately
3. [ ] Dropdown should close
4. [ ] Click palette again
5. [ ] Use custom color picker at bottom
6. [ ] Pick a color
7. [ ] Click "Apply"
8. [ ] Cell should change to your custom color

### ❌ If It Doesn't Work:
- Share screenshot of what you see
- Check console for any errors

---

## 📋 Quick Troubleshooting

### "Changes Not Saving"

**Before reporting, answer these:**

1. Did you click the Save button? [ ] Yes [ ] No
2. Did you open the browser console? [ ] Yes [ ] No
3. What did the console show? (paste it)
4. Did you see "✅ Save completed successfully"? [ ] Yes [ ] No
5. Did you close and reopen the file? [ ] Yes [ ] No
6. Did you wait for the new file to fully load? [ ] Yes [ ] No

### "Document Not Loading"

**Before reporting, answer these:**

1. What file format? .docx [ ] .doc [ ] .txt [ ] other: ____
2. Did you open the browser console? [ ] Yes [ ] No
3. What error message showed in the console? (paste it)
4. What does the error details object show? (paste it)
5. Can you download the file successfully? [ ] Yes [ ] No

---

## 🚨 Red Flags in Console

### Look for these ERROR patterns:

**❌ Storage Error:**
```
❌ onSave callback failed: Error: Storage upload failed
```
→ Supabase storage issue

**❌ Network Error:**
```
❌ Error loading document: NetworkError: Failed to fetch
```
→ File URL issue or network problem

**❌ Undefined Path:**
```
📤 Saving spreadsheet: {storagePath: undefined}
```
→ File path missing (we should have fixed this!)

**❌ Workbook Null:**
```
❌ Cannot save: workbook is null
```
→ File didn't load properly

---

## ✅ Good Signs in Console

### Look for these SUCCESS patterns:

**✅ Save Success:**
```
✅ Spreadsheet saved successfully
✅ Save completed successfully at 2:34:56 PM
```

**✅ Load Success:**
```
✅ DOCX loaded successfully
✅ TXT loaded successfully
```

**✅ Color Applied:**
```
✅ Cell color applied: #ffff00
```

---

## 📸 What to Share

If something isn't working, please share:

### For Save Issues:
1. **Screenshot of the spreadsheet** (showing your changes)
2. **Full console log** (from clicking Save)
3. **Error message** (if any shows in UI)
4. **Steps you took** (exactly what you did)

### For Document Loading Issues:
1. **File name and type** (e.g., "report.docx")
2. **Full console log** (from opening file)
3. **Error details object** (from console)
4. **Screenshot of error** (what you see in UI)

---

## 💡 Pro Tips

### Make Debugging Easier:

1. **Keep console open** while testing
2. **Take screenshots** of errors
3. **Copy console logs** before refreshing
4. **Try with a simple file** first (small test file)
5. **Test one thing at a time** (don't change multiple things)

### Console Keyboard Shortcuts:
- **F12** - Open dev tools
- **Ctrl+L** (Cmd+K on Mac) - Clear console
- **Ctrl+F** - Search in console
- **Right-click → Copy** - Copy console text

---

## 🎯 Expected Behavior

### Spreadsheet Save Should:
1. ✅ Show "Saving..." on button
2. ✅ Log all save steps in console
3. ✅ Complete with success message
4. ✅ Show "Last saved: [time]" timestamp
5. ✅ Persist changes when reopened

### Document Loading Should:
1. ✅ Show loading indicator
2. ✅ Log format detection in console
3. ✅ Load content successfully
4. ✅ Show document in editor

### Color Picker Should:
1. ✅ Open dropdown on click
2. ✅ Show 20 preset colors
3. ✅ Apply color immediately (presets)
4. ✅ Show custom color picker
5. ✅ Close on click outside

---

## ⚠️ Common Mistakes

### DON'T:
- ❌ Report "not working" without console logs
- ❌ Refresh page before copying console
- ❌ Test with console closed
- ❌ Assume it didn't save without checking console
- ❌ Skip the "close and reopen" step

### DO:
- ✅ Open console FIRST
- ✅ Copy logs BEFORE refresh
- ✅ Share complete error details
- ✅ Test the full flow (save → close → reopen)
- ✅ Look for the success messages

---

## 📞 Ready to Report?

Before you say "still not working", please confirm:

- [ ] I opened the browser console (F12)
- [ ] I watched the console while testing
- [ ] I copied the console logs
- [ ] I tested the full flow (including close/reopen for saves)
- [ ] I can share screenshots of errors
- [ ] I read the console output and looked for ❌ errors

**If you checked all boxes above**, then share:
1. Console logs (full text)
2. Error details (if any)
3. Screenshots
4. Exact steps you took

This will help us fix it FAST! 🚀

---

*Checklist created: December 10, 2025*
*Remember: Console logs are your friend!*
