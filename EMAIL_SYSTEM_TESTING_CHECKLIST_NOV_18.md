# Email System Testing Checklist
**Complete QA Guide** | November 18, 2024

## Pre-Testing Setup

### Environment Check
- [ ] Development environment running
- [ ] Supabase connection active
- [ ] Test email account configured
- [ ] Browser console open (F12)
- [ ] React DevTools installed (optional but helpful)

### Test Data Needed
- [ ] Test property with AP email
- [ ] Test job with work order
- [ ] Test job with extra charges
- [ ] Job images uploaded (before, sprinkler, other)
- [ ] Multiple test email addresses

---

## 1. Rich Text Editor - Template Manager

### Basic Functionality
- [ ] Navigate to Settings → Email Templates
- [ ] Click "New Template"
- [ ] Verify RichTextEditor loads properly
- [ ] Editor toolbar visible and styled correctly

### Visual Editing Mode
- [ ] Type plain text in editor
- [ ] Text appears as you type (no lag)
- [ ] Select text and click **Bold** button
- [ ] Text becomes bold
- [ ] Select text and click *Italic* button
- [ ] Text becomes italic
- [ ] Click bullet list button
- [ ] Type list items, each gets bullet
- [ ] Click numbered list button
- [ ] List converts to numbers
- [ ] Use color picker to change text color
- [ ] Color applies correctly
- [ ] Add heading (H1, H2, H3)
- [ ] Heading appears with proper size
- [ ] Add link
- [ ] Link dialog appears and works

### HTML Mode Toggle
- [ ] Click `</>` button (top right)
- [ ] Editor switches to HTML view
- [ ] HTML shows proper formatting from visual mode
- [ ] Edit HTML directly (add a `<strong>` tag)
- [ ] Click visual icon to switch back
- [ ] Visual mode shows HTML changes

### Variable Insertion
- [ ] Click "Insert Variable" in helper section
- [ ] Variables displayed below editor
- [ ] Click `{{property_name}}` button
- [ ] Variable inserted in editor at cursor
- [ ] Variable displays as text (not rendered)
- [ ] Click multiple variables in sequence
- [ ] All insert correctly

### Dark Mode
- [ ] Switch to dark mode (system or app setting)
- [ ] Editor background adapts to dark theme
- [ ] Toolbar icons visible in dark mode
- [ ] Text readable in editor
- [ ] Switch back to light mode
- [ ] Everything still works

### Save Template
- [ ] Fill in template name: "Test Template 1"
- [ ] Select template type: "Approval"
- [ ] Select trigger phase: "Extra Charges Only"
- [ ] Add formatted content with variables
- [ ] Click "Save Template"
- [ ] Success toast appears
- [ ] Template appears in list
- [ ] Close form modal

### Edit Existing Template
- [ ] Click "Edit" on saved template
- [ ] Template loads in RichTextEditor
- [ ] All formatting preserved (bold, bullets, etc.)
- [ ] Variables show correctly
- [ ] Make changes to content
- [ ] Add new formatting
- [ ] Click "Update Template"
- [ ] Changes saved successfully
- [ ] Preview updated template
- [ ] Changes visible in preview

---

## 2. Rich Text Editor - Email Send Modal

### Open Modal
- [ ] Navigate to Jobs list
- [ ] Open a job with extra charges
- [ ] Click "Send Notification" button
- [ ] Modal opens
- [ ] Step 1 (Select Template) appears

### Template Selection
- [ ] Templates list displayed
- [ ] Select "Test Template 1" (created above)
- [ ] Click "Next"
- [ ] Step 2 (Review & Edit) loads
- [ ] Template content appears in editor
- [ ] Variables replaced with actual job data
- [ ] `{{property_name}}` shows actual property
- [ ] `{{job_number}}` shows actual WO number
- [ ] `{{ap_contact_name}}` shows actual name
- [ ] All formatting preserved from template

### Edit Email Content
- [ ] RichTextEditor loads with processed template
- [ ] Editor in visual mode by default
- [ ] Make text changes
- [ ] Add bold formatting to a word
- [ ] Add bullet points
- [ ] Changes apply in real-time

### Preview Mode
- [ ] Click "Preview" button
- [ ] Editor switches to preview mode (read-only)
- [ ] Formatted HTML displays correctly
- [ ] Bold text appears bold
- [ ] Bullets render as bullets
- [ ] Colors display correctly
- [ ] Approval button visible (if approval email)
- [ ] Images display (if included)
- [ ] Switch to dark mode
- [ ] Preview still readable (text not invisible)
- [ ] Styled elements (button) still visible
- [ ] Switch back to light mode
- [ ] Click "Edit" button
- [ ] Returns to editable mode

### HTML Mode in Email Modal
- [ ] Click `</>` button
- [ ] Switches to HTML view
- [ ] Shows processed HTML with actual data
- [ ] Edit HTML directly (change some text)
- [ ] Click visual icon
- [ ] Changes reflected in visual mode
- [ ] Preview shows HTML changes

---

## 3. Approval Button

### Button in Template
- [ ] Create new template with `{{approval_button}}`
- [ ] In visual mode, see `{{approval_button}}` as text
- [ ] Save template
- [ ] Load template in send modal
- [ ] `{{approval_button}}` replaced with actual button HTML

### Button Rendering
- [ ] Preview mode shows green button
- [ ] Button left-aligned (not centered)
- [ ] Button text: "Approve Charges"
- [ ] Button styled (green background, white text)
- [ ] Button has padding and border-radius
- [ ] No complex container around button
- [ ] Switch to dark mode
- [ ] Button still visible and properly styled

### Button in HTML Mode
- [ ] Switch to HTML mode in send modal
- [ ] Find button HTML in code
- [ ] Verify simple structure:
  ```html
  <div style="margin: 20px 0;">
    <a href="..." style="...">Approve Charges</a>
  </div>
  ```
- [ ] No complex gradients or shadows
- [ ] Minimal inline styles (6 properties)

---

## 4. Email Sending Flow

### Complete Flow - Extra Charges
- [ ] Open job with extra charges
- [ ] Click "Send Notification"
- [ ] Step 1: Select approval template
- [ ] Click "Next"
- [ ] Step 2: Review content
  - [ ] Verify all variables replaced
  - [ ] Verify approval button present
  - [ ] Make minor edit if desired
- [ ] Click "Next"
- [ ] Step 3: Enter recipients
  - [ ] Primary email auto-filled (AP email)
  - [ ] Add CC email
  - [ ] Add BCC email
- [ ] Click "Next"
- [ ] Step 4: Select images (optional)
  - [ ] Select 2-3 images
- [ ] Click "Send Email"
- [ ] Loading state appears
- [ ] Success toast: "Email sent successfully"
- [ ] Modal closes

### Verify Email Received
- [ ] Check recipient inbox
- [ ] Email received
- [ ] Subject correct
- [ ] Content formatted correctly
  - [ ] Bold text is bold
  - [ ] Bullets render as bullets
  - [ ] Colors display
- [ ] Approval button visible
- [ ] Button clickable
- [ ] Images attached (if selected)

### Test Approval Flow
- [ ] Click "Approve Charges" button in email
- [ ] Approval page loads
- [ ] Job details displayed correctly
- [ ] Extra charges shown
- [ ] Click "Approve" button
- [ ] Success message appears
- [ ] Return to job in admin panel
- [ ] Job phase updated to "Work Order"
- [ ] Approval recorded in database

---

## 5. Template Variables Processing

### Test Each Variable Type

**Property Variables:**
- [ ] `{{property_name}}` → Actual property name
- [ ] `{{property_address}}` → Full address
- [ ] `{{unit_number}}` → Unit number or "N/A"

**Job Variables:**
- [ ] `{{job_number}}` → WO-000123 format
- [ ] `{{work_order_number}}` → Same as job_number
- [ ] `{{job_type}}` → Job type label
- [ ] `{{scheduled_date}}` → Formatted date

**Contact Variables:**
- [ ] `{{ap_contact_name}}` → AP contact name (or "Property Manager")

**Charges Variables:**
- [ ] `{{extra_charges_description}}` → Description text
- [ ] `{{extra_hours}}` → Number of hours
- [ ] `{{estimated_cost}}` → Calculated cost

**Image Variables:**
- [ ] `{{before_images}}` → Before photos section with images
- [ ] `{{sprinkler_images}}` → Sprinkler photos section
- [ ] `{{other_images}}` → Other photos section
- [ ] `{{all_images}}` → All photos combined
- [ ] Images clickable to view full size
- [ ] Image sections only appear if images exist

**Special Variables:**
- [ ] `{{approval_button}}` → Simple green button
- [ ] `{{extra_charges_table}}` → Formatted table
- [ ] `{{job_details_table}}` → Formatted table

---

## 6. Dark Mode Comprehensive Test

### Template Manager Dark Mode
- [ ] Switch to dark mode
- [ ] Navigate to Email Templates
- [ ] All text visible (headers, labels, etc.)
- [ ] Template list readable
- [ ] Click "New Template"
- [ ] Modal background dark
- [ ] Form labels visible
- [ ] RichTextEditor background dark
- [ ] Toolbar icons visible
- [ ] Type text in editor - readable
- [ ] Save button visible
- [ ] Close modal
- [ ] Template preview in dark mode
- [ ] Preview text readable
- [ ] No invisible text

### Email Send Modal Dark Mode
- [ ] Switch to dark mode
- [ ] Open "Send Notification" modal
- [ ] Modal background dark
- [ ] Step labels visible
- [ ] Template list readable
- [ ] Select template, click "Next"
- [ ] RichTextEditor in dark mode
- [ ] Content visible in editor
- [ ] Click "Preview"
- [ ] Preview content readable
  - [ ] Plain text visible (light gray on dark)
  - [ ] Approval button visible (green)
  - [ ] Images visible
  - [ ] No invisible elements
- [ ] Switch back to light mode
- [ ] Everything still works
- [ ] Switch back to dark mode
- [ ] Still working

---

## 7. Browser Compatibility

### Desktop Browsers
**Chrome:**
- [ ] All features work
- [ ] RichTextEditor loads
- [ ] Preview renders correctly
- [ ] Dark mode works
- [ ] No console errors

**Firefox:**
- [ ] All features work
- [ ] RichTextEditor loads
- [ ] Preview renders correctly
- [ ] Dark mode works
- [ ] No console errors

**Safari:**
- [ ] All features work
- [ ] RichTextEditor loads
- [ ] Preview renders correctly
- [ ] Dark mode works
- [ ] No console errors

**Edge:**
- [ ] All features work
- [ ] RichTextEditor loads
- [ ] Preview renders correctly
- [ ] Dark mode works
- [ ] No console errors

### Mobile Browsers
**iOS Safari:**
- [ ] Templates load
- [ ] Can edit in RichTextEditor
- [ ] Toolbar usable on mobile
- [ ] Preview readable
- [ ] Modal responsive

**Android Chrome:**
- [ ] Templates load
- [ ] Can edit in RichTextEditor
- [ ] Toolbar usable on mobile
- [ ] Preview readable
- [ ] Modal responsive

---

## 8. Email Client Compatibility

### Send Test Email to Multiple Clients

**Gmail (Web):**
- [ ] Email received
- [ ] Formatting preserved
- [ ] Bold/italic work
- [ ] Bullets render
- [ ] Approval button visible and clickable
- [ ] Colors display correctly

**Gmail (Mobile App):**
- [ ] Email received
- [ ] Formatting preserved
- [ ] Button clickable
- [ ] Images display (if attached)

**Outlook (Desktop):**
- [ ] Email received
- [ ] Formatting preserved
- [ ] Button visible and clickable
- [ ] No broken styles
- [ ] Text readable

**Outlook (Web):**
- [ ] Email received
- [ ] Formatting preserved
- [ ] Button works
- [ ] Colors correct

**Apple Mail (macOS):**
- [ ] Email received
- [ ] Formatting preserved
- [ ] Button clickable
- [ ] Everything renders correctly

**iOS Mail:**
- [ ] Email received
- [ ] Formatted correctly
- [ ] Button tappable
- [ ] Responsive layout

**Android Mail (Various):**
- [ ] Gmail app works
- [ ] Samsung Mail works
- [ ] Outlook app works
- [ ] Button always clickable

---

## 9. Edge Cases & Error Handling

### Empty/Missing Data
- [ ] Job with no AP email → Use manual entry
- [ ] Job with no unit number → Shows "N/A"
- [ ] Job with no extra charges → Variables show defaults
- [ ] Job with no images → Image variables return empty
- [ ] Template with no variables → Sends as-is

### Malformed Input
- [ ] Template with broken HTML in HTML mode
- [ ] Edit to fix, save successfully
- [ ] Invalid email address in recipients
- [ ] Error shown, validation prevents send
- [ ] Special characters in content
- [ ] Characters preserved correctly

### Network Issues
- [ ] Simulate slow network (DevTools → Network → Slow 3G)
- [ ] Template loads (with loading state)
- [ ] Email sends (with loading state)
- [ ] Appropriate timeouts if connection fails
- [ ] Error messages helpful

### Long Content
- [ ] Template with 1000+ words
- [ ] Editor handles large content
- [ ] Preview scrollable
- [ ] Email sends successfully
- [ ] No performance issues

---

## 10. Performance Testing

### Load Times
- [ ] Template manager loads in < 2 seconds
- [ ] Template list loads quickly (even with 20+ templates)
- [ ] RichTextEditor initializes in < 1 second
- [ ] Template selection and processing < 1 second
- [ ] Preview mode switches instantly
- [ ] HTML mode toggle instant
- [ ] No lag when typing in editor

### Memory Usage
- [ ] Open DevTools → Performance
- [ ] Monitor memory while editing
- [ ] No memory leaks after editing multiple templates
- [ ] Close and reopen modal multiple times
- [ ] Memory usage stays reasonable

---

## 11. Accessibility Testing

### Keyboard Navigation
- [ ] Tab through form fields in order
- [ ] Can focus on editor with Tab
- [ ] Can type in editor with keyboard
- [ ] Toolbar buttons keyboard accessible
- [ ] Can submit forms with Enter
- [ ] Can close modals with Esc

### Screen Reader Support
- [ ] Form labels announced correctly
- [ ] Button purposes clear
- [ ] Editor content readable
- [ ] Error messages announced
- [ ] Success messages announced

---

## 12. Security Testing

### XSS Prevention
- [ ] Try inserting `<script>alert('XSS')</script>` in template
- [ ] Save template
- [ ] Load in send modal
- [ ] Script does not execute (content escaped)
- [ ] Try in HTML mode
- [ ] Preview shows as text, not executable

### SQL Injection (via Supabase)
- [ ] Try SQL injection strings in template name
- [ ] Example: `'; DROP TABLE email_templates; --`
- [ ] Save attempt
- [ ] Database not affected (Supabase handles escaping)

### Approval Token Security
- [ ] Send approval email
- [ ] Check token in database
- [ ] Token is random and unique
- [ ] Expiry time set correctly (30 min)
- [ ] Try using token twice
- [ ] Second use rejected
- [ ] Try using expired token
- [ ] Rejected with proper message

---

## 13. Data Integrity

### Template Storage
- [ ] Create template with complex formatting
- [ ] Save to database
- [ ] Query database directly (Supabase dashboard)
- [ ] HTML stored correctly in `body` column
- [ ] Variables preserved exactly
- [ ] Edit template
- [ ] Changes saved correctly
- [ ] Old version not corrupted

### Email Logs
- [ ] Send email
- [ ] Check `email_logs` table in database
- [ ] Log entry created
- [ ] Job ID correct
- [ ] Recipient email correct
- [ ] Subject stored
- [ ] Content (HTML) stored
- [ ] Template ID referenced
- [ ] Timestamp accurate

### Approval Tokens
- [ ] Send approval email
- [ ] Check `approval_tokens` table
- [ ] Token created
- [ ] Job ID linked correctly
- [ ] Expiry set to 30 min from now
- [ ] Extra charges data stored in JSON
- [ ] After approval
- [ ] Token marked as used
- [ ] approved_at timestamp set

---

## 14. Regression Testing

### Existing Functionality Still Works
- [ ] Old templates (pre-refactor) still load
- [ ] Old templates can be edited (in HTML mode if needed)
- [ ] Sending emails with old templates works
- [ ] Image attachments still work
- [ ] CC/BCC still work
- [ ] Non-approval emails still work
- [ ] Email configuration settings still work
- [ ] Template type filtering works
- [ ] Template search/filter works

### No Breaking Changes
- [ ] Jobs list still loads
- [ ] Job details still display
- [ ] Work orders still create
- [ ] Phase transitions still work
- [ ] Other modals not affected
- [ ] Navigation not broken
- [ ] No new console errors in unrelated pages

---

## 15. User Acceptance Testing

### Create Real Template (End-to-End)
**Scenario:** Create professional extra charges approval template

- [ ] Start: Navigate to Email Templates
- [ ] Click "New Template"
- [ ] Name: "Extra Charges - Professional v2"
- [ ] Type: "Approval"
- [ ] Phase: "Extra Charges Only"
- [ ] In editor, type:
  ```
  Hello {{ap_contact_name}},

  We have completed scheduled work at {{property_name}}, Unit {{unit_number}}.

  During the job, we encountered additional work requiring your approval:

  • Description: {{extra_charges_description}}
  • Additional Hours: {{extra_hours}}
  • Estimated Cost: ${{estimated_cost}}

  Please review and approve these charges:
  {{approval_button}}

  Job Photos:
  {{before_images}}

  If you have any questions, please contact us.

  Thank you,
  JG Painting Pros Inc.
  ```
- [ ] Format "Additional work requiring your approval:" as bold
- [ ] Format the bullet points as actual bullets
- [ ] Format "JG Painting Pros Inc." as bold
- [ ] Click "Save Template"
- [ ] Success!

### Send Real Email with New Template
- [ ] Find job with extra charges
- [ ] Open "Send Notification"
- [ ] Select "Extra Charges - Professional v2"
- [ ] Review content - all variables replaced
- [ ] Make small edit: Change greeting to "Hello [Name],"
- [ ] Preview - looks good
- [ ] Add recipient (your test email)
- [ ] Select 2 before photos
- [ ] Send email
- [ ] Check inbox
- [ ] Email received and looks professional
- [ ] Click approval button
- [ ] Approve charges
- [ ] Check job - phase updated
- [ ] ✅ SUCCESS!

---

## Known Issues & Workarounds

### Issue 1: Quill Editor Cursor Position
**Issue:** Cursor sometimes jumps when variables inserted  
**Workaround:** Click where you want variable before clicking button  
**Status:** Minor UI issue, doesn't affect functionality

### Issue 2: Complex HTML in Visual Mode
**Issue:** Very complex HTML (old templates) may not be fully editable in visual mode  
**Workaround:** Use HTML mode (`</>` button) for editing complex templates  
**Status:** Expected behavior - visual editor has limitations

### Issue 3: Email Client CSS Overrides
**Issue:** Some email clients apply their own styles  
**Workaround:** Keep formatting simple, test in actual clients  
**Status:** Universal email limitation, minimized with simple button design

---

## Bug Reporting Template

If you find a bug during testing, report it with:

```
**Bug Title:** [Short description]

**Environment:**
- Browser: [Chrome 119 / Firefox 120 / Safari 17 / etc.]
- OS: [macOS 14 / Windows 11 / etc.]
- App Mode: [Light / Dark]

**Steps to Reproduce:**
1. Navigate to...
2. Click...
3. Enter...
4. Observe...

**Expected Result:**
[What should happen]

**Actual Result:**
[What actually happened]

**Screenshots:**
[Attach if applicable]

**Console Errors:**
[Any errors from browser console]

**Severity:**
[Critical / High / Medium / Low]

**Workaround:**
[If you found one]
```

---

## Sign-Off Checklist

When all tests pass, complete this final checklist:

### Code Quality
- [ ] No console errors in any tested scenario
- [ ] No TypeScript errors
- [ ] Code formatted properly
- [ ] No commented-out code blocks
- [ ] No debugging console.logs (or only intentional ones)

### Documentation
- [ ] All documentation files reviewed
- [ ] User guide accurate
- [ ] Technical guide complete
- [ ] Testing checklist followed

### User Experience
- [ ] UI is intuitive
- [ ] Loading states appropriate
- [ ] Error messages helpful
- [ ] Success feedback clear
- [ ] Dark mode perfect

### Performance
- [ ] No lag or delays
- [ ] Large templates handled well
- [ ] Memory usage reasonable
- [ ] Fast load times

### Security
- [ ] XSS prevention working
- [ ] Approval tokens secure
- [ ] No data leakage
- [ ] Proper authentication

### Compatibility
- [ ] Works in all major browsers
- [ ] Emails render in all clients
- [ ] Mobile responsive
- [ ] Accessible

---

## Final Sign-Off

**Tested by:** ___________________  
**Date:** ___________________  
**All tests passed:** ☐ Yes ☐ No  
**Ready for production:** ☐ Yes ☐ No  
**Notes:** _________________________________________

---

**Testing Complete!** 🎉

If all tests pass, the refactored email system is ready for production use!

**Document Version:** 1.0  
**Last Updated:** November 18, 2024
