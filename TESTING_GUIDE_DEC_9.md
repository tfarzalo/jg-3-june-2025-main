# Testing Guide - Document/Spreadsheet Editor System
**Date:** December 9, 2025  
**Status:** Ready for User Testing  
**Duration:** 30-45 minutes

---

## 🎯 Testing Objective

Verify that all 12 critical fixes are working correctly and the editor system is production-ready.

---

## 🚀 Before You Start

1. **Ensure dev server is running:**
   ```bash
   npm run dev
   ```

2. **Have test files ready:**
   - 1-2 CSV files (one with data, one empty)
   - 1-2 Excel files (.xlsx)
   - 1-2 Word documents (.docx)
   - 1 PDF file
   - 1 large file (>5MB)

3. **Open browser console** (F12) to see debug logs

---

## 📋 Test Cases

### **Test Group 1: CSV Files** (Priority: HIGH)

#### Test 1.1: Open CSV with Data
1. Click on a CSV file in FileManager
2. **Expected:** 
   - ✅ Grid renders with proper data
   - ✅ Console shows: "📊 Starting to load spreadsheet"
   - ✅ Console shows: "✅ CSV Parse complete"
   - ✅ Headers appear correctly
3. **Pass/Fail:** ___________

#### Test 1.2: Open Empty CSV
1. Upload an empty CSV file
2. Click to open it
3. **Expected:**
   - ✅ Grid renders with default 5x20 grid (A, B, C, D, E headers)
   - ✅ Console shows: "⚠️ Empty CSV detected, creating default grid"
   - ✅ No blank screen
4. **Pass/Fail:** ___________

#### Test 1.3: Edit and Save CSV
1. Open a CSV file
2. Edit 2-3 cells
3. Click "Save" button
4. **Expected:**
   - ✅ Button shows "Saving..."
   - ✅ Success message appears
   - ✅ Unsaved changes indicator disappears
   - ✅ Console shows: "📤 Saving spreadsheet"
   - ✅ Console shows: "✅ Spreadsheet saved successfully"
5. **Pass/Fail:** ___________

---

### **Test Group 2: Excel Files** (Priority: HIGH)

#### Test 2.1: Open Excel File
1. Click on an .xlsx file
2. **Expected:**
   - ✅ Grid renders with data
   - ✅ Sheet tabs appear at bottom if multiple sheets
   - ✅ Console shows: "📗 Detected Excel file"
3. **Pass/Fail:** ___________

#### Test 2.2: Switch Between Sheets
1. Open Excel file with multiple sheets
2. Click different sheet tabs
3. **Expected:**
   - ✅ Grid updates with new sheet data
   - ✅ No errors in console
   - ✅ Active sheet tab is highlighted
4. **Pass/Fail:** ___________

#### Test 2.3: Export Options
1. Open any spreadsheet
2. Click "Export" dropdown
3. Try "Export as CSV"
4. Try "Export as Excel"
5. **Expected:**
   - ✅ CSV downloads successfully
   - ✅ Excel downloads successfully
   - ✅ Files open correctly in external apps
4. **Pass/Fail:** ___________

---

### **Test Group 3: Modal Protection** (Priority: CRITICAL)

#### Test 3.1: Close Without Changes
1. Open any file
2. Don't make changes
3. Click X button
4. **Expected:**
   - ✅ Modal closes immediately
   - ✅ No confirmation dialog appears
5. **Pass/Fail:** ___________

#### Test 3.2: Close With Unsaved Changes
1. Open any editable file
2. Make some changes
3. Click X button
4. **Expected:**
   - ✅ Confirmation dialog appears: "Close without saving?"
   - ✅ Warning text: "You have unsaved changes..."
   - ✅ Two buttons: "Cancel" and "Close Anyway"
5. **Pass/Fail:** ___________

#### Test 3.3: Cancel Close Confirmation
1. Make changes in file
2. Click X button
3. Click "Cancel" in confirmation
4. **Expected:**
   - ✅ Confirmation dialog closes
   - ✅ Editor stays open
   - ✅ Changes are still there
   - ✅ Unsaved changes indicator still visible
5. **Pass/Fail:** ___________

#### Test 3.4: Confirm Close (Lose Changes)
1. Make changes in file
2. Click X button
3. Click "Close Anyway" in confirmation
4. **Expected:**
   - ✅ Confirmation dialog closes
   - ✅ Editor closes
   - ✅ Changes are lost (not saved)
   - ✅ Back to file list
5. **Pass/Fail:** ___________

#### Test 3.5: Backdrop Click Protection
1. Open any file
2. Make changes
3. Click on dark area OUTSIDE the modal
4. **Expected:**
   - ✅ Modal does NOT close
   - ✅ Must use X button to close
5. **Pass/Fail:** ___________

---

### **Test Group 4: Document Editor** (Priority: MEDIUM)

#### Test 4.1: Open DOCX File
1. Click on a .docx file
2. **Expected:**
   - ✅ Document content loads
   - ✅ Rich text editor appears
   - ✅ Formatting toolbar visible
3. **Pass/Fail:** ___________

#### Test 4.2: Edit and Save Document
1. Open a document
2. Make changes
3. Click Save
4. **Expected:**
   - ✅ Save button works
   - ✅ Console shows: "📤 Saving document"
   - ✅ Console shows: "✅ Document saved successfully as: [filename].html"
   - ✅ File extension changes to .html
5. **Pass/Fail:** ___________

#### Test 4.3: Word Count
1. Open or create document
2. Type some text
3. **Expected:**
   - ✅ Word count updates in real-time
   - ✅ Shows "X words" in toolbar
4. **Pass/Fail:** ___________

---

### **Test Group 5: Auto-Save** (Priority: MEDIUM)

#### Test 5.1: Auto-Save Timer
1. Open editable file
2. Make a change
3. Wait 30 seconds WITHOUT clicking save
4. **Expected:**
   - ✅ File saves automatically
   - ✅ Unsaved changes indicator disappears
   - ✅ Console shows save logs
5. **Pass/Fail:** ___________

#### Test 5.2: Auto-Save Indicator
1. Open file
2. Make changes
3. **Expected:**
   - ✅ Orange dot appears with "Unsaved changes • Auto-save in 30s"
   - ✅ Indicator is visible and clear
4. **Pass/Fail:** ___________

---

### **Test Group 6: PDF Viewer** (Priority: LOW)

#### Test 6.1: Open PDF
1. Click on a PDF file
2. **Expected:**
   - ✅ PDF loads in viewer
   - ✅ Can navigate pages
   - ✅ Download button works
3. **Pass/Fail:** ___________

---

### **Test Group 7: Error Handling** (Priority: HIGH)

#### Test 7.1: Corrupted File
1. Try to open a corrupted/invalid file
2. **Expected:**
   - ✅ Error message appears (not blank screen)
   - ✅ "Try Again" button available
   - ✅ "Close" button available
   - ✅ Console shows error details
3. **Pass/Fail:** ___________

#### Test 7.2: Network Error During Save
1. Open file, make changes
2. Disconnect internet or pause network in DevTools
3. Try to save
4. **Expected:**
   - ✅ Error message appears
   - ✅ User-friendly error text
   - ✅ Can retry after reconnecting
5. **Pass/Fail:** ___________

---

### **Test Group 8: Loading States** (Priority: MEDIUM)

#### Test 8.1: File Opening Loading
1. Click on a file
2. **Expected:**
   - ✅ Loading spinner appears while URL generates
   - ✅ "Loading..." text or indicator visible
   - ✅ No blank screen
3. **Pass/Fail:** ___________

#### Test 8.2: Large File Loading
1. Open a large file (>5MB)
2. **Expected:**
   - ✅ Loading spinner appears
   - ✅ Progress indication (if available)
   - ✅ Eventually loads or shows error
3. **Pass/Fail:** ___________

---

### **Test Group 9: Responsive Design** (Priority: LOW)

#### Test 9.1: Mobile View
1. Resize browser to mobile width (375px)
2. Open any file
3. **Expected:**
   - ✅ Modal fits screen
   - ✅ Buttons are accessible
   - ✅ Grid/editor is usable
4. **Pass/Fail:** ___________

---

### **Test Group 10: Dark Mode** (Priority: LOW)

#### Test 10.1: Dark Mode Toggle
1. Enable dark mode (if available)
2. Open files in each editor
3. **Expected:**
   - ✅ Colors invert properly
   - ✅ Text is readable
   - ✅ No white boxes
4. **Pass/Fail:** ___________

---

## 🐛 Bug Report Template

If you find an issue:

```
**Issue:** [Brief description]
**Severity:** [High/Medium/Low]
**Steps to Reproduce:**
1. 
2. 
3. 

**Expected Result:**

**Actual Result:**

**Console Errors:**

**Screenshots:** (if applicable)
```

---

## ✅ Sign-Off

### Testing Completed By:
**Name:** _________________  
**Date:** _________________  

### Results Summary:
- **Total Tests:** 35
- **Passed:** _____
- **Failed:** _____
- **Critical Issues Found:** _____

### Overall Status:
- [ ] ✅ APPROVED - Ready for Production
- [ ] ⚠️ APPROVED WITH MINOR ISSUES - Can deploy
- [ ] ❌ NOT APPROVED - Critical issues must be fixed

### Additional Notes:
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________

---

## 🎉 Next Steps After Testing

1. **If all tests pass:** Deploy to production
2. **If minor issues found:** Document and schedule fixes
3. **If critical issues found:** Fix immediately before deployment

---

**Happy Testing! 🚀**
