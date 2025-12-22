# Email System Quick Reference Guide
**For End Users** | Updated: November 18, 2024

## What's New? 🎉

Your email templates and notifications now have a **powerful rich text editor** - just like using Microsoft Word or Google Docs!

### Key Features:
✅ **Visual Formatting** - Bold, italics, bullets, colors, headers  
✅ **No HTML Knowledge Needed** - Use toolbar buttons, not code  
✅ **HTML Mode Available** - For power users who want control  
✅ **Live Preview** - See exactly what recipients will see  
✅ **Simple Approval Buttons** - Clean, mobile-friendly design  

---

## Creating Email Templates

### Step-by-Step

1. **Go to Settings → Email Templates → "New Template"**

2. **Fill in basic info:**
   - Template Name: e.g., "Extra Charges - Professional"
   - Template Type: Approval or Notification
   - Trigger Phase: When to use this template

3. **Design Your Email:**

   **Using the Visual Editor (Recommended):**
   - Just start typing!
   - Use toolbar for formatting:
     - **B** = Bold
     - *I* = Italic
     - `≡` = Bullet list
     - `1.` = Numbered list
     - `A` = Text color
     - `Header` = Heading styles

   **Inserting Variables:**
   - Click the variable buttons below the editor
   - Or type them manually: `{{property_name}}`
   - Variables get replaced with real job data when you send

   **Example Template:**
   ```
   Hello {{ap_contact_name}},

   We completed work at {{property_name}}, Unit {{unit_number}}.

   Additional work was needed:
   • Description: {{extra_charges_description}}
   • Hours: {{extra_hours}}
   • Cost: ${{estimated_cost}}

   Please approve:
   {{approval_button}}

   Thank you!
   ```

4. **Save Your Template**

### Tips & Tricks

💡 **Use the toolbar instead of typing formatting codes**  
💡 **Insert {{approval_button}} where you want the approve button**  
💡 **Preview in both light and dark mode**  
💡 **Keep it simple - simple emails work on all devices**  
💡 **Use bullets and headers to organize information**  

---

## Sending Emails

### Step-by-Step

1. **Open a job → Click "Send Notification"**

2. **Step 1: Pick a Template**
   - Choose from your saved templates
   - Subject and content auto-fill
   - Variables replaced with job info

3. **Step 2: Review & Edit**
   
   **Edit Mode (Default):**
   - Email appears in rich text editor
   - Make changes if needed
   - Format with toolbar buttons
   
   **Preview Mode:**
   - Click "Preview" to see final email
   - Switch back to edit if needed
   
   **HTML Mode (Advanced):**
   - Click `</>` button to see/edit HTML
   - For advanced users only

4. **Step 3: Add Recipients**
   - Primary email (usually property AP email)
   - Add CC/BCC if needed

5. **Step 4: Attach Photos (Optional)**
   - Select job photos to include
   - Before, Sprinkler, Other photos

6. **Click "Send Email"**
   - For approval emails, approve button automatically added
   - Email sent exactly as previewed

---

## Available Variables

Insert these in your templates - they'll be replaced with actual job data:

| Type This | You Get |
|-----------|---------|
| `{{property_name}}` | Sunset Apartments |
| `{{property_address}}` | 123 Main St, Portland, OR 97201 |
| `{{unit_number}}` | 204 |
| `{{job_number}}` | WO-000123 |
| `{{ap_contact_name}}` | John Smith |
| `{{job_type}}` | Interior Paint |
| `{{scheduled_date}}` | 11/18/2024 |
| `{{extra_charges_description}}` | Additional wall repairs |
| `{{extra_hours}}` | 3.5 |
| `{{estimated_cost}}` | 175.00 |
| `{{approval_button}}` | (Green approve button) |
| `{{before_images}}` | (Before photos) |
| `{{all_images}}` | (All job photos) |

**Tip:** Click the variable buttons instead of typing them manually!

---

## Common Tasks

### Make Text Bold
1. Select the text
2. Click **B** in toolbar
3. Or press `Ctrl+B` (Windows) / `Cmd+B` (Mac)

### Add a Bullet List
1. Click where you want the list
2. Click `≡` (bullet icon) in toolbar
3. Type your list items

### Change Text Color
1. Select the text
2. Click color picker (A) in toolbar
3. Choose a color

### Add a Heading
1. Click where you want the heading
2. Click "Header" dropdown in toolbar
3. Choose heading level (1, 2, or 3)

### Insert a Variable
1. Click where you want the variable
2. Click the variable button below editor
3. Or type it: `{{variable_name}}`

### Switch to HTML Mode
1. Click `</>` button (top right of editor)
2. Edit HTML directly
3. Click visual icon to switch back

### Preview Your Email
1. Click "Preview" button
2. Review formatting
3. Click "Edit" to make changes

---

## Approval Emails

### How It Works

1. **You send an approval email** (e.g., for extra charges)
2. **Recipient gets email with green "Approve Charges" button**
3. **They click button** → Goes to approval page
4. **They review and approve** → Job moves to Work Order phase
5. **Approval expires after 30 minutes** (can send new one if needed)

### Important Notes

✅ **Approval button automatically added** - Just include `{{approval_button}}` in template  
✅ **One-time use** - Button only works once  
✅ **30-minute expiration** - Secure and time-limited  
✅ **Simple design** - Works on all devices and email clients  

---

## Dark Mode

The email editor and preview now work perfectly in dark mode:

- **Editor adapts to your theme** (light/dark)
- **Preview shows correctly** in both modes
- **Sent emails** look good in recipient's email client
- **Approval buttons** visible in all themes

**Tip:** Test your templates in both light and dark mode before sending!

---

## Troubleshooting

### Problem: Can't see formatting toolbar
**Solution:** Make sure you're in Visual mode, not HTML mode (click visual icon)

### Problem: Variables not showing actual data
**Solution:** Variables only replace when you send the email, not when editing the template

### Problem: Approval button doesn't appear
**Solution:** Make sure you included `{{approval_button}}` in your template

### Problem: Email looks different than preview
**Solution:** Some email clients override styles. Keep formatting simple for best results.

### Problem: Can't edit old template
**Solution:** Old HTML templates can be edited in HTML mode (click `</>` button)

### Problem: Preview not readable in dark mode
**Solution:** This should now be fixed. If still having issues, refresh the page.

---

## Best Practices

### Do's ✅
- ✅ Use templates for consistency
- ✅ Keep formatting simple (bold, bullets, headers)
- ✅ Preview before sending
- ✅ Test approval buttons work
- ✅ Use variable buttons to insert variables
- ✅ Check preview in both light and dark mode

### Don'ts ❌
- ❌ Don't use too many colors (can look unprofessional)
- ❌ Don't add complex tables (may not display well)
- ❌ Don't forget to include {{approval_button}} for approval emails
- ❌ Don't manually type variable names (use buttons)
- ❌ Don't use very large fonts (stick to toolbar options)

---

## Example Templates

### Professional Extra Charges Template

```
Hello {{ap_contact_name}},

Thank you for allowing us to service {{property_name}}.

We have completed the scheduled work for Unit {{unit_number}}, but encountered 
additional work that requires your approval before we can proceed.

**Additional Work Details:**
• Description: {{extra_charges_description}}
• Additional Hours: {{extra_hours}} hours
• Estimated Cost: ${{estimated_cost}}

Please review and approve these charges:
{{approval_button}}

**Job Photos:**
{{before_images}}

If you have any questions, please don't hesitate to contact us.

Best regards,
JG Painting Pros Inc.
```

### Simple Notification Template

```
Hi {{ap_contact_name}},

Work has been completed at:
• Property: {{property_name}}
• Unit: {{unit_number}}
• Job Type: {{job_type}}
• Date: {{completion_date}}

**Photos from this job:**
{{all_images}}

Thank you for your business!

JG Painting Pros Inc.
```

---

## Getting Help

**Need assistance?**
- Check this guide first
- Try the visual editor toolbar
- Use HTML mode for advanced edits
- Contact support if stuck

**Quick Tip:** The editor works just like Word or Google Docs - if you can use those, you can use this!

---

## Summary

🎨 **Rich formatting** - Make emails look professional  
📝 **Easy to use** - Visual editor like Word  
👁️ **Live preview** - See exactly what recipients see  
🔘 **Simple buttons** - Clean approve buttons that work everywhere  
🌓 **Dark mode** - Works perfectly in all themes  

**You're ready to create beautiful, professional email templates!** 🚀

---

**Questions?** Contact your system administrator  
**Version:** 1.0 | **Date:** November 18, 2024
