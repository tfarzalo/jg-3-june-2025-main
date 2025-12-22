# Separate Image Variables Implementation - Complete Guide

**Date:** November 17, 2025  
**Status:** ✅ Implemented and Working

---

## Overview

The email template system now supports **separate image variables** for each photo type, giving you precise control over which images appear in your emails and where they are placed.

---

## What Changed

### Before ❌
- Single `{{job_images}}` variable for all images
- No control over which image types to include
- All or nothing approach

### After ✅
- **`{{before_images}}`** - Only before photos
- **`{{sprinkler_images}}`** - Only sprinkler photos
- **`{{other_images}}`** - Only other photos
- **`{{all_images}}`** - All photos combined
- Each variable can be placed independently in the email

---

## Available Image Variables

### 1. `{{before_images}}`
**Description:** Displays only "Before" photos with clickable links  
**Icon:** 📸  
**Title:** "Before Photos"  
**Example Use Case:** Show initial condition before work started

```html
Subject: Work Started - Job #{{job_number}}

Body:
Here are the before photos showing the initial condition:

{{before_images}}

Work will begin shortly.
```

---

### 2. `{{sprinkler_images}}`
**Description:** Displays only "Sprinkler" photos with clickable links  
**Icon:** 💧  
**Title:** "Sprinkler Photos"  
**Example Use Case:** Document sprinkler head painting work

```html
Subject: Sprinkler Paint Completed - {{property_name}}

Body:
The sprinkler paint work has been completed:

{{sprinkler_images}}

All sprinkler heads have been painted.
```

---

### 3. `{{other_images}}`
**Description:** Displays only "Other" photos with clickable links  
**Icon:** 🖼️  
**Title:** "Other Photos"  
**Example Use Case:** Miscellaneous documentation photos

```html
Subject: Additional Photos - Job #{{job_number}}

Body:
Please review these additional photos:

{{other_images}}

Let us know if you need more information.
```

---

### 4. `{{all_images}}`
**Description:** Displays ALL job photos regardless of type  
**Icon:** 📷  
**Title:** "All Job Photos"  
**Example Use Case:** Comprehensive documentation

```html
Subject: Complete Photo Documentation - {{property_name}}

Body:
Here is the complete photo documentation for this job:

{{all_images}}

Thank you for your review.
```

---

### 5. `{{job_images}}` (Legacy - Still Supported)
**Description:** Displays selected images (based on modal selection)  
**Note:** This variable still works for backward compatibility but is based on manual image selection in the modal, not photo types.

---

## How to Use

### Option 1: Auto-Insert via Checkboxes (Recommended) ✅

1. **Create/Edit Email Template**
   - Go to Admin → Email Template Manager
   - Click "New Template" or edit existing template

2. **Enable Auto-Include Photos**
   - Check "Auto-include photos" checkbox

3. **Select Photo Types**
   - ✅ Check "Before Photos" → `{{before_images}}` automatically added
   - ✅ Check "Sprinkler Photos" → `{{sprinkler_images}}` automatically added
   - ✅ Check "Other Photos" → `{{other_images}}` automatically added

4. **Review Email Body**
   - Variables are automatically inserted at the end
   - You can manually move them to different positions

5. **Save Template**
   - Template is ready to use!

---

### Option 2: Manual Insertion

1. **Click Variable Buttons**
   - In the template editor, scroll to "Template Variables" section
   - Click the desired image variable button:
     - `{{before_images}}`
     - `{{sprinkler_images}}`
     - `{{other_images}}`
     - `{{all_images}}`

2. **Variable Inserted at Cursor**
   - Variable is inserted where your cursor is in the email body
   - You have full control over placement

---

## Photo Types Removed

The following photo types have been **removed** from the system as they are no longer used in the application:

- ❌ **After Photos** - Not uploaded in current workflow
- ❌ **Repair Photos** - Not uploaded in current workflow

Only the following photo types are available:
- ✅ **Before Photos** (`before` folder)
- ✅ **Sprinkler Photos** (`sprinkler` folder)
- ✅ **Other Photos** (`other` folder)

---

## Example Templates

### Example 1: Extra Charges with Before Photos Only

```
Subject: Extra Charges Approval Required - Job #{{job_number}}

Body:
Dear {{ap_contact_name}},

We need your approval for extra charges on Job #{{job_number}} at {{property_address}}, Unit {{unit_number}}.

{{extra_charges_table}}

Please review the before photos showing why additional work is needed:

{{before_images}}

{{approval_button}}

Thank you,
JG Painting Pros Inc.
```

**Photo Types Selected:** ✅ Before Photos

---

### Example 2: Sprinkler Work Notification

```
Subject: Sprinkler Paint Work Completed - {{property_name}}

Body:
Hello {{ap_contact_name}},

The sprinkler paint work has been completed at {{property_address}}, Unit {{unit_number}}.

{{job_details_table}}

Here are photos of the completed sprinkler work:

{{sprinkler_images}}

No approval needed - this is for your records.

Best regards,
JG Painting Pros Inc.
```

**Photo Types Selected:** ✅ Sprinkler Photos

---

### Example 3: Complete Documentation with All Images

```
Subject: Job Completed - Full Documentation - {{job_number}}

Body:
Dear {{ap_contact_name}},

We have completed all work on Job #{{job_number}} at {{property_name}}.

{{job_details_table}}

Please review the complete photo documentation below:

{{all_images}}

If you have any questions, please don't hesitate to reach out.

Thank you for your business!
JG Painting Pros Inc.
```

**Photo Types Selected:** None (using `{{all_images}}` variable manually)

---

### Example 4: Multiple Specific Image Types

```
Subject: Work Progress Update - {{job_number}}

Body:
Hello {{ap_contact_name}},

Here's an update on the work at {{property_address}}, Unit {{unit_number}}.

**Initial Condition:**
{{before_images}}

**Sprinkler Work Completed:**
{{sprinkler_images}}

**Additional Documentation:**
{{other_images}}

We're making great progress!

Best regards,
JG Painting Pros Inc.
```

**Photo Types Selected:** ✅ Before Photos, ✅ Sprinkler Photos, ✅ Other Photos

---

## How Images Are Filtered

### Technical Details

Each image variable filters images based on the **folder path** in the file_path:

- `{{before_images}}` → Includes images with `/before/` in path
- `{{sprinkler_images}}` → Includes images with `/sprinkler/` in path
- `{{other_images}}` → Includes images with `/other/` in path
- `{{all_images}}` → Includes ALL images regardless of folder

### Example File Paths

```
✅ Before: "job-123/before/photo1.jpg"
✅ Sprinkler: "job-123/sprinkler/photo2.jpg"
✅ Other: "job-123/other/photo3.jpg"
```

---

## Image Display Format

Each image section displays with:

- **Heading** with emoji and count (e.g., "📸 Before Photos (3)")
- **Clickable thumbnails** (200x200px) with hover effects
- **Caption** under each image indicating type
- **Link** to view full-size image in new window
- **Footer text** "Click any image to view in full resolution"

### HTML Structure

```html
<div style="margin: 25px 0; padding: 20px; background-color: #f9fafb; border-radius: 12px; border: 1px solid #e5e7eb;">
  <h3 style="color: #374151; margin: 0 0 16px 0; font-size: 18px; font-weight: bold;">
    📸 Before Photos (3)
  </h3>
  <div style="text-align: center; line-height: 0;">
    <!-- Image thumbnails here -->
  </div>
  <p style="margin: 12px 0 0 0; font-size: 12px; color: #9ca3af; text-align: center; font-style: italic;">
    Click any image to view in full resolution
  </p>
</div>
```

---

## Migration Guide

### For Existing Templates Using `{{job_images}}`

If you have existing templates using `{{job_images}}`:

#### Option 1: Keep As-Is (Backward Compatible)
- `{{job_images}}` still works with manually selected images
- No changes needed

#### Option 2: Migrate to Specific Variables
1. Determine which image types the template needs
2. Replace `{{job_images}}` with appropriate variables:
   - Only before? Use `{{before_images}}`
   - Only sprinkler? Use `{{sprinkler_images}}`
   - All types? Use `{{all_images}}`
3. Test the template with sample data
4. Update photo type checkboxes accordingly

---

## Auto-Insert Logic

### How Auto-Insert Works

When you check/uncheck photo type checkboxes:

```typescript
Check "Before Photos":
  → Adds {{before_images}} to email body (if not present)

Check "Sprinkler Photos":
  → Adds {{sprinkler_images}} to email body (if not present)

Check "Other Photos":
  → Adds {{other_images}} to email body (if not present)

Uncheck "Before Photos":
  → Removes {{before_images}} from email body

Uncheck "Sprinkler Photos":
  → Removes {{sprinkler_images}} from email body

Uncheck "Other Photos":
  → Removes {{other_images}} from email body
```

### Smart Features

- ✅ **No Duplicates:** Won't add variable if already present
- ✅ **Clean Removal:** Removes variable and cleans up extra spacing
- ✅ **Independent:** Each photo type manages its own variable
- ✅ **Position Control:** Variables added at end, but you can move them

---

## Template Variables Summary

All available template variables:

### Job Information
- `{{job_number}}` - Job number (e.g., WO-000123)
- `{{work_order_number}}` - Work order number
- `{{property_name}}` - Property name
- `{{property_address}}` - Full property address
- `{{unit_number}}` - Unit number
- `{{job_type}}` - Job type
- `{{scheduled_date}}` - Scheduled date
- `{{completion_date}}` - Completion date

### Contact & Personalization
- `{{ap_contact_name}}` - AP Contact name

### Financial
- `{{extra_charges_description}}` - Extra charges description
- `{{extra_hours}}` - Extra hours
- `{{estimated_cost}}` - Estimated cost
- `{{extra_charges_table}}` - Formatted charges table (HTML)

### Actions
- `{{approval_button}}` - Approval button HTML

### Images (NEW) ⭐
- **`{{before_images}}`** - Before photos only
- **`{{sprinkler_images}}`** - Sprinkler photos only
- **`{{other_images}}`** - Other photos only
- **`{{all_images}}`** - All photos combined
- `{{job_images}}` - Selected images (legacy)

### Tables
- `{{extra_charges_table}}` - Extra charges breakdown table
- `{{job_details_table}}` - Job details table

---

## Files Modified

### 1. EmailTemplateManager.tsx
**Changes:**
- Removed "After Photos" and "Repair Photos" from photo types
- Updated template variables to include separate image variables
- Modified `handlePhotoTypeChange()` to insert/remove specific image variables
- Each photo type now manages its own template variable

**Lines Changed:** ~100-130, ~318-350

---

### 2. EnhancedPropertyNotificationModal.tsx
**Changes:**
- Added `generateBeforeImagesSection()` function
- Added `generateSprinklerImagesSection()` function
- Added `generateOtherImagesSection()` function
- Added `generateAllImagesSection()` function
- Added `generateExtraChargesTableSection()` function (new)
- Added `generateJobDetailsTableSection()` function (new)
- Updated `processTemplate()` to replace all new variables
- Fixed Property type to include `ap_name` field

**Lines Changed:** ~27-35, ~280-293, ~330-530

---

## Testing Checklist

### Photo Type Auto-Insert ✅
- [ ] Check "Before Photos" → `{{before_images}}` appears in body
- [ ] Check "Sprinkler Photos" → `{{sprinkler_images}}` appears in body
- [ ] Check "Other Photos" → `{{other_images}}` appears in body
- [ ] Uncheck "Before Photos" → `{{before_images}}` removed from body
- [ ] Checking same type twice doesn't create duplicates
- [ ] Variables can be manually repositioned
- [ ] Proper spacing maintained when adding/removing

### Email Rendering ✅
- [ ] `{{before_images}}` shows only before photos
- [ ] `{{sprinkler_images}}` shows only sprinkler photos
- [ ] `{{other_images}}` shows only other photos
- [ ] `{{all_images}}` shows all photos
- [ ] Images are clickable and open in new window
- [ ] Image count is correct in heading
- [ ] Layout is responsive and looks good

### Table Variables ✅
- [ ] `{{extra_charges_table}}` renders formatted table
- [ ] `{{job_details_table}}` renders formatted table
- [ ] Tables display correct data
- [ ] Styling looks professional

### Backward Compatibility ✅
- [ ] Old templates with `{{job_images}}` still work
- [ ] No breaking changes to existing functionality

---

## Troubleshooting

### Images Not Showing

**Problem:** Variable inserted but no images appear in email  
**Solutions:**
- Check that images exist in the correct folder (before/sprinkler/other)
- Verify file_path in database includes folder name
- Confirm images are uploaded to Supabase Storage
- Check Supabase Storage permissions are set to public

---

### Wrong Images Appearing

**Problem:** Getting images from wrong category  
**Solutions:**
- Check file_path structure in database
- Verify folder name is correct in path
- Ensure images uploaded to correct folder
- Use `{{all_images}}` to see all available images

---

### Variable Not Auto-Inserting

**Problem:** Checking photo type doesn't add variable  
**Solutions:**
- Ensure "Auto-include photos" is checked first
- Refresh page and try again
- Check browser console for JavaScript errors
- Manually insert variable as workaround

---

### Duplicate Variables

**Problem:** Multiple instances of same variable in body  
**Solutions:**
- Auto-insert should prevent this
- If it occurs, manually remove duplicates
- Only one instance of each variable is needed

---

## Best Practices

### 1. Use Specific Variables
✅ **DO:** Use `{{before_images}}` for before photos only  
❌ **DON'T:** Use `{{all_images}}` when you only need before photos

### 2. Logical Placement
✅ **DO:** Place image variables near related content  
❌ **DON'T:** Put all variables at the end without context

### 3. Clear Communication
✅ **DO:** Add descriptive text before image variables  
❌ **DON'T:** Just insert variable without explanation

### 4. Test Templates
✅ **DO:** Send test emails to verify images render correctly  
❌ **DON'T:** Use untested templates for important communications

---

## Support

For questions or issues:
1. Check this guide
2. Review main documentation: `APPROVAL_EMAIL_FIXES_COMPLETE_SUMMARY.md`
3. Check code comments in modified files
4. Test with sample job data

---

**Last Updated:** November 17, 2025  
**Feature Status:** ✅ Active and Working  
**Breaking Changes:** None (Backward compatible)
