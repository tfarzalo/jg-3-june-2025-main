# Email Template Preview Enhancements - November 17, 2025

## Overview
Enhanced the email template preview functionality in the Template Manager to properly render HTML content with sample data, ensuring the preview accurately represents how the final email will appear to recipients in both light and dark modes.

## Issues Fixed

### 1. **Dark Mode Text Visibility** ✅
- **Problem**: Font colors in preview didn't adjust for dark mode, making text hard to read
- **Solution**: Added proper color classes (`text-gray-900 dark:text-gray-100`) to preview containers
- **Impact**: Preview is now readable in both light and dark themes

### 2. **Raw Template Variables Showing** ✅
- **Problem**: Preview showed raw template variables like `{{job_images}}` instead of rendered content
- **Solution**: Created `processTemplateForPreview()` function that:
  - Replaces all template variables with realistic sample data
  - Generates sample HTML for images, tables, and buttons
  - Processes both simple variables (text) and complex variables (HTML blocks)
- **Impact**: Preview now shows exactly how the email will look with actual data

### 3. **HTML Not Rendering** ✅
- **Problem**: HTML code was displayed as plain text instead of being rendered
- **Solution**: Changed preview container to use `dangerouslySetInnerHTML={{ __html: body }}`
- **Impact**: HTML content (images, tables, buttons, formatting) now renders properly in preview

### 4. **Line Breaks and List Formatting** ✅
- **Problem**: Job details and bullet items appeared as one long string without proper formatting
- **Solution**: 
  - Template uses HTML tables for structured data (job details, extra charges)
  - Each row in tables gets proper styling and spacing
  - HTML inline styles ensure consistent rendering across email clients
- **Impact**: All job details, work order info, and billing details display with proper line breaks and formatting

### 5. **Image Links Not Showing in Preview** ✅
- **Problem**: Image variables weren't being replaced in preview
- **Solution**: 
  - Added `generateSampleImages()` function that creates HTML image galleries
  - Processes all image variables: `{{before_images}}`, `{{sprinkler_images}}`, `{{other_images}}`, `{{all_images}}`, `{{job_images}}`
  - Uses placeholder images to demonstrate layout and appearance
  - Each image gets proper styling with borders, shadows, and captions
- **Impact**: Preview shows exactly how image galleries will appear in sent emails

## Technical Implementation

### Template Variable Processing

The preview system now processes these variable types:

#### Simple Text Variables
```typescript
const sampleData = {
  property_address: '123 Main St, Apt 2B, Anytown, CA 12345',
  unit_number: '205',
  job_number: 'WO-000123',
  work_order_number: 'WO-000123',
  property_name: 'Sunset Apartments',
  ap_contact_name: 'John Smith',
  job_type: 'Unit Turn',
  scheduled_date: new Date().toLocaleDateString(),
  completion_date: new Date().toLocaleDateString(),
  extra_charges_description: 'Additional drywall repair work required',
  extra_hours: '3.5',
  estimated_cost: '175.00'
};
```

#### Complex HTML Variables

1. **Approval Button** (`{{approval_button}}`)
   - Generates styled button with gradient background
   - Includes action-required messaging
   - Shows expiration time (30 minutes)
   - Displays security information

2. **Image Galleries** (`{{before_images}}`, `{{sprinkler_images}}`, `{{other_images}}`, `{{all_images}}`, `{{job_images}}`)
   - Creates responsive image grid
   - Each image is clickable with full-size link
   - Includes image captions with type labels
   - Shows image count in header
   - Uses placeholder images for demonstration

3. **Extra Charges Table** (`{{extra_charges_table}}`)
   - Formatted HTML table with headers
   - Row-by-row breakdown of charges
   - Totals row with bold styling
   - Yellow/amber theme for visibility
   - Responsive layout

4. **Job Details Table** (`{{job_details_table}}`)
   - Structured property information
   - Alternating row colors for readability
   - Blue theme to differentiate from charges
   - Labeled fields (Property, Address, Unit, etc.)
   - Bold emphasis on key data (Work Order number)

### Preview Modal Enhancements

#### Structure
```tsx
<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
  <div className="bg-white dark:bg-[#1E293B] rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
    {/* Header with template name and close button */}
    {/* Subject preview with dark mode support */}
    {/* Content preview with HTML rendering */}
    {/* Info banner explaining sample data */}
  </div>
</div>
```

#### Key Features
- **Wider modal**: Changed from `max-w-2xl` to `max-w-4xl` for better image display
- **Scrollable content**: Set `max-height: 600px` with `overflow: auto` for long emails
- **Dark mode styling**: All text and backgrounds adjust to dark theme
- **HTML rendering**: Uses `dangerouslySetInnerHTML` to render processed HTML
- **Sample data notice**: Info banner at bottom explains preview uses sample data

### Styling Improvements

#### Preview Container
```css
style={{ 
  minHeight: '400px',
  maxHeight: '600px',
  lineHeight: '1.6'
}}
className="p-4 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 overflow-auto"
```

#### Subject Line
```tsx
<div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md text-gray-900 dark:text-gray-100">
  {subject}
</div>
```

## How It Works

### When User Clicks "Preview" Button

1. **Template Selection**: User clicks eye icon on any template
2. **Modal Opens**: Preview modal displays with template name
3. **Processing Starts**: `processTemplateForPreview()` function executes
4. **Variable Replacement**: 
   - Simple variables replaced with sample text data
   - Complex variables replaced with generated HTML blocks
5. **HTML Rendering**: Processed template rendered using `dangerouslySetInnerHTML`
6. **Display**: User sees fully rendered email exactly as recipient would

### Sample Data Generation

Each time preview opens, the system generates:
- **2 Before Photos** (placeholder images with labels)
- **1 Sprinkler Photo** (placeholder image)
- **1 Other Photo** (placeholder image)
- **3 Job Photos** (for `{{job_images}}` variable)
- **4 All Images** (for `{{all_images}}` variable)
- **1 Extra Charges Table** (with sample charge data)
- **1 Job Details Table** (with sample property data)
- **1 Approval Button** (with full styling and messaging)

## Benefits

### For Template Editors
- **WYSIWYG Preview**: See exactly what recipients will see
- **Instant Feedback**: Changes visible immediately in preview
- **Dark Mode Testing**: Can test readability in both themes
- **Layout Verification**: Confirm images, tables, and formatting work correctly

### For Property Managers
- **Visual Confirmation**: Verify email appearance before sending
- **Brand Consistency**: Ensure all emails maintain professional appearance
- **Client Experience**: Preview what property owners will receive

### For Development
- **Debugging Aid**: Easier to identify template issues
- **Testing Tool**: Verify all variables process correctly
- **Documentation**: Preview serves as visual documentation of template system

## Files Modified

### `/src/components/EmailTemplateManager.tsx`

#### Changes Made:
1. Added `processTemplateForPreview()` function for variable replacement
2. Added helper functions for generating sample HTML:
   - `generateSampleApprovalButton()`
   - `generateSampleImages()`
   - `generateSampleExtraChargesTable()`
   - `generateSampleJobDetailsTable()`
3. Updated preview modal structure and styling
4. Changed from text display to HTML rendering with `dangerouslySetInnerHTML`
5. Improved dark mode support throughout preview
6. Widened modal from `max-w-2xl` to `max-w-4xl`
7. Added info banner explaining sample data

## Testing Checklist

- [x] Preview opens when clicking eye icon
- [x] All template variables replaced with sample data
- [x] HTML renders correctly (not as raw code)
- [x] Images display in proper galleries
- [x] Tables format correctly with headers and rows
- [x] Approval button shows with full styling
- [x] Text readable in light mode
- [x] Text readable in dark mode
- [x] Subject line processes variables
- [x] Body content processes all variable types
- [x] Line breaks and spacing correct
- [x] Lists and bullets format properly
- [x] Modal scrolls for long content
- [x] Close button works
- [x] No console errors
- [x] No TypeScript errors

## Usage Instructions

### To View Template Preview:

1. Navigate to **Settings > Email Templates**
2. Find the template you want to preview
3. Click the **eye icon** (👁️) in the Actions column
4. Preview modal opens with:
   - Template name in header
   - Processed subject line
   - Fully rendered email content
   - Sample images, tables, and buttons
5. Review the preview in current theme (light or dark)
6. Click **X** or outside modal to close

### What to Look For in Preview:

✅ **Subject Line**
- All variables replaced with sample data
- Text clear and readable

✅ **Content**
- Proper paragraph spacing
- Job details in formatted table
- Extra charges in formatted table (if included)
- Image galleries with proper layout (if included)
- Approval button styled and centered (if included)

✅ **Formatting**
- Lists and bullets display correctly
- Line breaks between sections
- Color contrast good in current theme
- Images sized appropriately
- Tables have proper borders and spacing

✅ **Dark Mode** (if applicable)
- Toggle to dark mode and check preview again
- Text should remain readable
- Inline styles in HTML maintain appearance
- Background colors contrast properly

## Future Enhancements

### Potential Improvements:
1. **Real Job Data Toggle**: Option to preview with actual job data instead of samples
2. **Device Preview**: Toggle between desktop/mobile/tablet views
3. **Theme Preview**: Toggle between light/dark in preview itself
4. **Variable Highlighting**: Highlight which variables are present in template
5. **Send Test Email**: Button to send preview to your own email
6. **Multiple Samples**: Cycle through different sample data scenarios
7. **Export Preview**: Download preview as HTML file
8. **Accessibility Check**: Verify email meets accessibility standards
9. **Email Client Preview**: Show how email looks in different email clients
10. **Version History**: Compare preview with previous template versions

## Related Documentation

- `EMAIL_TEMPLATE_UPDATES_NOV_17_2025.md` - Template variable system
- `PHOTO_TYPE_AUTO_INSERT_GUIDE.md` - Photo type checkbox functionality
- `SEPARATE_IMAGE_VARIABLES_GUIDE.md` - Image variable system
- `EMAIL_PREVIEW_IMPROVEMENTS_NOV_17.md` - Preview enhancement details
- `EMAIL_PREVIEW_AND_APPROVAL_FIXES_NOV_17.md` - Approval system fixes

## Support

For questions or issues with the preview system:
1. Check that template variables are correctly formatted (`{{variable_name}}`)
2. Verify template is saved before previewing
3. Test in both light and dark modes
4. Check browser console for any errors
5. Try refreshing the page and previewing again

## Conclusion

The email template preview system now provides a fully functional WYSIWYG preview that accurately represents how emails will appear to recipients. All issues with dark mode visibility, raw variables, HTML rendering, line breaks, and image display have been resolved. The preview is now a reliable tool for template editing and verification.
