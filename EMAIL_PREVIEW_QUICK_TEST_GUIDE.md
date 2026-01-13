# Email Template Preview - Quick Test Guide

## Quick Testing Steps

### Test 1: Basic Preview Functionality
1. Go to **Settings > Email Templates**
2. Click the eye icon (👁️) on any template
3. **Expected**: Modal opens showing processed template with sample data
4. **Check**: Subject line and content both show sample data (not `{{variables}}`)

### Test 2: Dark Mode Visibility
1. Open a template preview
2. Toggle your system to dark mode (or use browser dev tools)
3. **Expected**: All text remains readable
4. **Check**: 
   - Subject line text is light colored
   - Body text is visible
   - Background is dark
   - Good contrast throughout

### Test 3: HTML Rendering
1. Open a template with `{{approval_button}}` or image variables
2. **Expected**: See rendered button or images, not HTML code
3. **Check**:
   - Green approval button displays (if template has it)
   - Images show in galleries (not image tags)
   - Tables have proper borders and formatting

### Test 4: Image Variables
1. Create or edit a template
2. Add `{{before_images}}` or `{{all_images}}` to body
3. Save and preview
4. **Expected**: See placeholder images in styled gallery
5. **Check**:
   - Images display in grid layout
   - Each has caption underneath
   - Gallery has header with count
   - Click-to-view message shows

### Test 5: Line Breaks and Formatting
1. Open a template with `{{job_details_table}}` or bullet points
2. **Expected**: Each detail on separate line, bullets formatted as list
3. **Check**:
   - Job details in formatted table
   - Each row has proper spacing
   - No long strings of text
   - Bullet points display correctly

### Test 6: Multiple Variables
1. Open template with multiple variable types (text, images, tables, button)
2. **Expected**: All variables processed and rendered
3. **Check**:
   - Property address shows sample address
   - Job number shows "WO-000123"
   - Images display if included
   - Tables format if included
   - Button shows if included

## What You Should See

### In Light Mode:
- White/light gray background
- Dark text (black/gray)
- Colored sections for buttons/tables
- Clear borders and shadows
- Readable contrast

### In Dark Mode:
- Dark blue/gray background
- Light text (white/light gray)
- Same colored sections (inline styles)
- Clear borders and shadows
- Readable contrast

### Sample Data You'll See:
- **Property**: Sunset Apartments
- **Address**: 123 Main St, Apt 2B, Anytown, CA 12345
- **Unit**: 205
- **Work Order**: WO-000123
- **Job Type**: Unit Turn
- **Contact**: John Smith
- **Extra Hours**: 3.5
- **Cost**: $175.00

## Quick Fixes

### If preview shows raw variables:
- Check template was saved
- Refresh the page
- Try previewing different template

### If text not readable in dark mode:
- Check browser/system dark mode is enabled
- Try toggling dark mode off and on
- Check if using correct theme classes

### If images not showing:
- Verify template has image variable (`{{before_images}}`, etc.)
- Check variable name spelled correctly
- Save template and preview again

### If HTML shows as code:
- This should be fixed now
- If issue persists, check browser console for errors
- Try hard refresh (Cmd+Shift+R or Ctrl+Shift+F5)

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Variables not replaced | Save template before previewing |
| Images not showing | Add image variable to template body |
| Dark mode unreadable | Refresh page, toggle theme |
| Long string instead of list | Use `{{job_details_table}}` variable |
| HTML code showing | Clear cache and hard refresh |
| Modal too narrow | Fixed - now max-w-4xl |
| Can't see full content | Scroll within preview container |

## Verification Checklist

Before considering preview working correctly:

- [ ] Preview modal opens when clicking eye icon
- [ ] Subject line shows sample data (no `{{variables}}`)
- [ ] Body shows sample data (no `{{variables}}`)
- [ ] Images render (if template includes image variables)
- [ ] Tables format correctly (if template includes table variables)
- [ ] Approval button displays (if template includes button variable)
- [ ] Text readable in light mode
- [ ] Text readable in dark mode
- [ ] Close button works
- [ ] No console errors
- [ ] Content scrolls if long
- [ ] Line breaks display correctly
- [ ] Lists and bullets format properly

## Success Criteria

✅ **Preview is working if:**
1. You see sample data instead of template variables
2. HTML renders (buttons, images, tables) instead of code
3. Text is readable in both light and dark modes
4. Each job detail is on its own line
5. Images display in galleries when image variables present
6. Everything looks like an actual email, not a template

❌ **Preview needs fixing if:**
1. You see `{{variable_name}}` in preview
2. You see HTML tags like `<div>` in preview
3. Text is invisible or unreadable in dark mode
4. Job details appear as one long string
5. Image variables don't show any images
6. Preview looks like raw template code

## Report Issues

If you encounter issues after these fixes:

1. **Check browser console** for error messages
2. **Note which template** is causing issues
3. **Document what you see** vs what you expected
4. **Try in different browser** to rule out browser issues
5. **Check template syntax** for variable formatting

Include in bug report:
- Template name
- Variable(s) causing issue
- Screenshot of preview
- Browser and version
- Light or dark mode
- Console errors (if any)
