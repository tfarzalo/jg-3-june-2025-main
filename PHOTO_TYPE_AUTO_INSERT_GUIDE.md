# Photo Type Auto-Insert Feature - Quick Guide

## Overview
When creating or editing email templates, checking photo type checkboxes now automatically manages the `{{job_images}}` variable in your email content.

---

## How It Works

### ✅ Checking Photo Types

**Scenario 1: First Photo Type Selected**
- **Action**: Check any photo type (e.g., "Before Photos")
- **Result**: `{{job_images}}` automatically added to the end of email body
- **Example**:
  ```
  Email body before:
  "Please review the extra charges for Job #{{job_number}}."
  
  Email body after (auto-updated):
  "Please review the extra charges for Job #{{job_number}}.
  
  {{job_images}}"
  ```

**Scenario 2: Additional Photo Types Selected**
- **Action**: Check more photo types (e.g., "After Photos", "Repair Photos")
- **Result**: No duplicate `{{job_images}}` added (only one instance exists)
- **Note**: The photo types array is updated, but email body remains clean

### ❌ Unchecking Photo Types

**Scenario 1: Unchecking Some Photo Types**
- **Action**: Uncheck one or more photo types (but not all)
- **Result**: `{{job_images}}` remains in email body
- **Reason**: You still have photo types selected

**Scenario 2: Unchecking Last Photo Type**
- **Action**: Uncheck the final remaining photo type
- **Result**: `{{job_images}}` automatically removed from email body
- **Example**:
  ```
  Email body before:
  "Please review the extra charges for Job #{{job_number}}.
  
  {{job_images}}"
  
  Email body after (auto-updated):
  "Please review the extra charges for Job #{{job_number}}."
  ```

---

## Step-by-Step Usage

### Creating a New Template with Images

1. **Enable Photo Inclusion**
   - Check "Auto-include photos" checkbox
   - Photo type options will appear

2. **Select Photo Types**
   - Check desired photo types (Before, After, Sprinkler, Repair, Other)
   - `{{job_images}}` automatically added to email body on first selection

3. **Customize Email Content**
   - Write your email content
   - `{{job_images}}` will be at the end by default
   - You can manually move it to a different position if needed

4. **Save Template**
   - Click "Save Template"
   - Template ready for use with automatic image inclusion

### Editing Existing Template

1. **Open Template for Editing**
   - Click Edit icon on template

2. **Modify Photo Types**
   - Check/uncheck photo types as needed
   - Variable auto-inserted/removed based on selections

3. **Review Changes**
   - Verify `{{job_images}}` is where you want it
   - Manually adjust position if needed

4. **Save Changes**
   - Click "Save Template"

---

## Best Practices

### ✅ DO:
- Let the system auto-insert `{{job_images}}` when checking first photo type
- Check all relevant photo types for your use case
- Review the final email content before saving
- Test the template by sending a preview email

### ❌ DON'T:
- Manually type `{{job_images}}` multiple times (one instance is sufficient)
- Leave photo types checked if you don't want images in the email
- Forget to check photo types if you want images included

---

## Manual Override

You can always manually manage the `{{job_images}}` variable:

### To Add Manually:
1. Click the `{{job_images}}` button in the "Template Variables" section
2. Variable inserted at cursor position in email body

### To Remove Manually:
1. Select and delete the `{{job_images}}` text from email body
2. Or uncheck all photo types (auto-removes)

### To Reposition:
1. Cut the `{{job_images}}` variable (Cmd+X / Ctrl+X)
2. Place cursor where you want it
3. Paste (Cmd+V / Ctrl+V)

---

## Example Templates

### Example 1: Extra Charges with Before/After Photos
```
Subject: Extra Charges Approval Required - Job #{{job_number}}

Body:
Dear {{ap_contact_name}},

We need your approval for extra charges on Job #{{job_number}} at {{property_address}}.

{{extra_charges_table}}

Please review the photos below showing the work completed:

{{job_images}}

{{approval_button}}

Thank you,
JG Painting Pros Inc.
```

**Photo Types Selected**: Before Photos, After Photos

---

### Example 2: Sprinkler Paint Notification
```
Subject: Sprinkler Paint Work Completed - {{property_name}}

Body:
Hello {{ap_contact_name}},

The sprinkler paint work has been completed at {{property_address}}, Unit {{unit_number}}.

{{job_details_table}}

{{job_images}}

No approval needed - this is for your records.

Best regards,
JG Painting Pros Inc.
```

**Photo Types Selected**: Sprinkler Photos

---

### Example 3: General Notification (No Photos)
```
Subject: Work Order Update - {{job_number}}

Body:
Dear {{ap_contact_name}},

This is a notification regarding Job #{{job_number}} at {{property_address}}.

{{job_details_table}}

Scheduled Date: {{scheduled_date}}

Thank you,
JG Painting Pros Inc.
```

**Photo Types Selected**: None (no `{{job_images}}` in body)

---

## Troubleshooting

### Problem: `{{job_images}}` not auto-inserting
**Solution**: 
- Ensure "Auto-include photos" is checked first
- Then check at least one photo type
- If still not working, refresh the page and try again

### Problem: Multiple `{{job_images}}` in email body
**Solution**:
- This shouldn't happen with the auto-insert feature
- If you see duplicates, manually remove extras
- Keep only one instance of `{{job_images}}`

### Problem: `{{job_images}}` not removed when unchecking
**Solution**:
- Ensure you've unchecked ALL photo types
- Variable only auto-removes when no photo types remain selected
- Can also manually delete if needed

### Problem: Images not showing in sent emails
**Solution**:
- Verify photo types are selected in template
- Confirm `{{job_images}}` is in email body
- Check that job has uploaded images in selected categories
- Verify Supabase Storage public access

---

## Technical Details

### Auto-Insert Logic
```
IF (first photo type checked) AND ({{job_images}} not in body):
  → Add {{job_images}} at end of email body

IF (last photo type unchecked) AND ({{job_images}} in body):
  → Remove {{job_images}} from email body
```

### Spacing & Formatting
- Two newlines before `{{job_images}}` when auto-inserted
- One newline after `{{job_images}}`
- Automatic cleanup of excessive newlines when removed
- Preserves existing formatting in email body

---

## Related Variables

All available template variables:
- `{{job_number}}` - Job number
- `{{work_order_number}}` - Work order number
- `{{property_name}}` - Property name
- `{{property_address}}` - Full address
- `{{unit_number}}` - Unit number
- `{{ap_contact_name}}` - AP Contact name
- `{{job_type}}` - Job type
- `{{scheduled_date}}` - Scheduled date
- `{{completion_date}}` - Completion date
- `{{extra_charges_description}}` - Charges description
- `{{extra_hours}}` - Extra hours
- `{{estimated_cost}}` - Estimated cost
- `{{approval_button}}` - Approval button HTML
- **`{{job_images}}`** - Job images (auto-managed)
- `{{extra_charges_table}}` - Charges table
- `{{job_details_table}}` - Details table

---

## Support

For questions or issues with the photo type auto-insert feature, please check:
1. This guide
2. Main documentation: `APPROVAL_EMAIL_FIXES_COMPLETE_SUMMARY.md`
3. Code: `src/components/EmailTemplateManager.tsx` (line ~318)

---

**Last Updated**: December 2024  
**Feature Status**: ✅ Active and Working
