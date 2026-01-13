# Preview Dark Mode - Quick Visual Test

## What You Should See Now

### ✅ LIGHT MODE

```
┌──────────────────────────────────────────────────┐
│ EMAIL PREVIEW                                     │
│                                                   │
│ Hi John Smith,                    ← DARK TEXT ✓  │
│                                                   │
│ We need approval for extra work   ← DARK TEXT ✓  │
│ at 511 Queens - Unit 12212.                      │
│                                                   │
│ ┌────────────────────────────────────────────┐  │
│ │    ⚡ ACTION REQUIRED                       │  │
│ │   Approve Extra Charges        ← GREEN ✓   │  │
│ │                                            │  │
│ │   ┌────────────────────┐                  │  │
│ │   │ ✅ APPROVE CHARGES │  ← WHITE TEXT ✓ │  │
│ │   └────────────────────┘                  │  │
│ │                                            │  │
│ │ Click button to review...  ← GREEN TEXT ✓ │  │
│ └────────────────────────────────────────────┘  │
│                                                   │
│ ┌─ 📋 Job Details ──────────────────────────┐   │
│ │ Property │ Sunset Apartments  ← VISIBLE ✓ │   │
│ │ Address  │ 123 Main St...     ← VISIBLE ✓ │   │
│ └────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────┘
```

### ✅ DARK MODE

```
┌──────────────────────────────────────────────────┐
│ EMAIL PREVIEW (DARK BACKGROUND)                   │
│                                                   │
│ Hi John Smith,                   ← LIGHT TEXT ✓  │
│                                                   │
│ We need approval for extra work  ← LIGHT TEXT ✓  │
│ at 511 Queens - Unit 12212.                      │
│                                                   │
│ ┌────────────────────────────────────────────┐  │
│ │    ⚡ ACTION REQUIRED                       │  │
│ │   Approve Extra Charges        ← GREEN ✓   │  │
│ │                                            │  │
│ │   ┌────────────────────┐                  │  │
│ │   │ ✅ APPROVE CHARGES │  ← WHITE TEXT ✓ │  │
│ │   └────────────────────┘                  │  │
│ │                                            │  │
│ │ Click button to review...  ← GREEN TEXT ✓ │  │
│ └────────────────────────────────────────────┘  │
│                                                   │
│ ┌─ 📋 Job Details ──────────────────────────┐   │
│ │ Property │ Sunset Apartments  ← VISIBLE ✓ │   │
│ │ Address  │ 123 Main St...     ← VISIBLE ✓ │   │
│ └────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────┘
```

## Quick Test (30 seconds)

1. **Open email modal**
2. **Go to Step 3** (Review & Send)
3. **Click "Show Preview"**
4. **Check in current mode** (light or dark):
   - [ ] Can you read plain text? (should be visible)
   - [ ] Can you see approval button colors? (should be green)
   - [ ] Can you read text in colored boxes? (should be visible)
   - [ ] Can you see table content? (should be visible)

5. **Toggle dark mode** (switch your system or app theme)
6. **Check again**:
   - [ ] Can you read plain text? (should be visible)
   - [ ] Can you see approval button colors? (should be green)
   - [ ] Can you read text in colored boxes? (should be visible)
   - [ ] Can you see table content? (should be visible)

## Expected Results

### Plain Text (Outside Containers)
- **Light Mode**: Dark gray (readable on white)
- **Dark Mode**: Light gray (readable on dark)

### Approval Button
- **Both Modes**: Green background with white text
- **Both Modes**: Green text for descriptions
- **Should look the same in both modes**

### Tables (Job Details, Extra Charges)
- **Both Modes**: Colored backgrounds
- **Both Modes**: Appropriate text colors for readability
- **Should look the same in both modes**

## If Something's Wrong

### Problem: Can't read plain text in dark mode
- **Expected**: Light gray text
- **Check**: Dark mode is actually enabled
- **Fix**: Hard refresh (Cmd+Shift+R / Ctrl+Shift+F5)

### Problem: Can't see text in colored boxes
- **Expected**: Original colors preserved
- **Check**: Browser console for errors
- **Fix**: Clear cache and reload

### Problem: Everything is one color
- **Expected**: Mixed colors (plain text adapts, containers don't)
- **Check**: Template has styled elements (`{{approval_button}}`, `{{job_details_table}}`)
- **Fix**: Use template with styled variables

## Color Reference

### Plain Text Colors:
- Light Mode: `#374151` (gray-700)
- Dark Mode: `#f3f4f6` (gray-100)

### Approval Button Colors (preserved):
- Background: Green gradient
- Text: White/Green (as designed)
- Should NOT change with theme

### Table Colors (preserved):
- Job Details: Blue theme
- Extra Charges: Yellow/amber theme
- Should NOT change with theme

## Success Criteria

✅ **All text is readable in light mode**  
✅ **All text is readable in dark mode**  
✅ **Styled containers keep their colors in both modes**  
✅ **No text appears invisible or unreadable**  

## Status

If all checkboxes above pass: **✅ WORKING CORRECTLY**

If any fail: Check `DARK_MODE_PREVIEW_FINAL_FIX_NOV_18.md` for details

---

*Quick Test Guide - November 18, 2025*
