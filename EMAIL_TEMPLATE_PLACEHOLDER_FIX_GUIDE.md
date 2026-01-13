# Email Template Placeholder Fix - Complete Guide

**Issue:** Email templates showing literal curly braces like `{Timothy Farzalo}` and `{WO-000760}` instead of actual values  
**Cause:** Templates have hardcoded placeholder text instead of proper tokens  
**Status:** ✅ FIXED  
**Date:** December 11, 2025

---

## 🔍 Problem Identified

### Before (Incorrect):
```
Subject: Extra Charges Approval Needed - {WO-000760}

Hi {Timothy Farzalo},

We need approval for some extra work on Job #{WO-000760}.
```

### After (Correct):
```
Subject: Extra Charges Approval Needed - WO-000760

Hi Timothy Farzalo,

We need approval for some extra work on Job #WO-000760.
```

---

## 🔧 What Was Fixed

### 1. Added More Recipient Name Tokens
Updated `EnhancedPropertyNotificationModal.tsx` to recognize more variations:
- `{{recipient_name}}`
- `{{contact_name}}`
- `{{name}}`
- `{{property_owner}}`
- `{{property_owner_name}}`
- `{{manager_name}}`
- `{{recipient}}`

All of these now map to the AP contact name from the property.

### 2. Created SQL Migration
`FIX_EMAIL_TEMPLATE_PLACEHOLDERS.sql` - Updates all existing email templates to replace:
- `{WO-000760}` → `{{job_number}}`
- `Hi {Name},` → `Hi {{recipient_name}},`
- `Job #{WO-XXXXX}` → `Job #{{job_number}}`

---

## 📋 How to Apply the Fix

### Step 1: Run the SQL Migration
```sql
-- In Supabase SQL Editor, run:
-- FIX_EMAIL_TEMPLATE_PLACEHOLDERS.sql
```

This will:
1. Find all templates with hardcoded placeholders
2. Replace them with proper tokens
3. Update the `updated_at` timestamp
4. Show you a preview of fixed templates

### Step 2: Deploy Code Changes
The code change to `EnhancedPropertyNotificationModal.tsx` has already been applied.

### Step 3: Verify in Admin UI
1. Log in as admin
2. Go to Settings → Email Templates
3. Edit the "Extra Charges Approval" template
4. Verify it shows tokens like `{{recipient_name}}` and `{{job_number}}`
5. Use the preview feature to test

### Step 4: Test with Real Email
1. Create or edit a job with extra charges
2. Send approval email to yourself
3. Verify the email shows actual names and job numbers, not curly braces

---

## 📚 Available Tokens Reference

### Recipient/Contact Tokens
| Token | Description | Example Output |
|-------|-------------|----------------|
| `{{recipient_name}}` | Email recipient name | Timothy Farzalo |
| `{{ap_contact_name}}` | AP contact name | John Smith |
| `{{contact_name}}` | Generic contact | Jane Doe |
| `{{property_owner_name}}` | Property owner | ABC Management |
| `{{manager_name}}` | Property manager | Mike Johnson |

**All of these map to the same value** (AP contact name from property).

### Job Information Tokens
| Token | Description | Example Output |
|-------|-------------|----------------|
| `{{job_number}}` | Work order number | WO-000760 |
| `{{work_order_number}}` | Same as job_number | WO-000760 |
| `{{property_name}}` | Property name | Sunset Apartments |
| `{{property_address}}` | Full address | 123 Main St, City, ST 12345 |
| `{{unit_number}}` | Unit number | 4B |
| `{{job_type}}` | Job type | Interior Paint |
| `{{scheduled_date}}` | Scheduled date | December 15, 2025 |

### Extra Charges Tokens
| Token | Description | Example Output |
|-------|-------------|----------------|
| `{{extra_charges_description}}` | Description | Additional drywall repair needed |
| `{{extra_charges.bill_amount}}` | Bill amount (formatted) | $1,250.00 |
| `{{extra_charges.hours}}` | Hours | 8 |
| `{{estimated_cost}}` | Estimated cost (plain) | 1250.00 |
| `{{extra_charges.sub_pay_amount}}` | Subcontractor pay | $800.00 |
| `{{extra_charges.profit_amount}}` | Profit amount | $450.00 |

---

## ✅ Correct Template Examples

### Example 1: Professional Tone
```
Subject: Approval Required: Extra Charges for Job {{job_number}}

Hi {{recipient_name}},

We need your approval for additional work on Job {{job_number}} at {{property_address}}, Unit {{unit_number}}.

Description: {{extra_charges_description}}
Estimated Cost: {{extra_charges.bill_amount}}
Hours Required: {{extra_charges.hours}}

Please review and approve at your earliest convenience.

Thank you,
JG Painting Pros Inc.
```

### Example 2: Casual Tone
```
Subject: Quick Approval Needed - Job {{job_number}}

Hi {{recipient_name}},

Quick heads up about some extra work needed for Job {{job_number}}.

What happened: {{extra_charges_description}}
Cost: {{extra_charges.bill_amount}}

Can you approve this when you get a chance?

Thanks!
JG Painting
```

### Example 3: Formal Tone
```
Subject: Formal Request for Approval - Job {{job_number}}

Dear {{recipient_name}},

This message serves as a formal request for approval of additional charges related to Job {{job_number}} at {{property_name}}.

Property: {{property_address}}
Unit: {{unit_number}}
Scheduled Date: {{scheduled_date}}

Additional Work Description:
{{extra_charges_description}}

Cost Breakdown:
- Total Bill Amount: {{extra_charges.bill_amount}}
- Hours Required: {{extra_charges.hours}}

We kindly request your approval to proceed with this additional work.

Respectfully,
JG Painting Pros Inc.
```

---

## ❌ Common Mistakes to Avoid

### DON'T Use Literal Values
```
❌ Hi {Timothy Farzalo},           # Will show literally
❌ Job #{WO-000760}                # Will show literally
❌ Hi {Name},                      # Will show literally
❌ Contact: {John Smith}           # Will show literally
```

### DO Use Double Curly Braces with Token Names
```
✅ Hi {{recipient_name}},          # Will be replaced
✅ Job #{{job_number}}             # Will be replaced
✅ Contact: {{ap_contact_name}}    # Will be replaced
✅ Property: {{property_name}}     # Will be replaced
```

### Token Format Rules
1. **Always use double curly braces**: `{{token}}` not `{token}`
2. **Use exact token names**: See reference table above
3. **Case-insensitive**: `{{job_number}}` = `{{Job_Number}}` = `{{JOB_NUMBER}}`
4. **Spaces allowed inside braces**: `{{ job_number }}` works
5. **No special characters in token names**: Use underscores not hyphens

---

## 🧪 Testing Checklist

- [ ] Run `FIX_EMAIL_TEMPLATE_PLACEHOLDERS.sql` migration
- [ ] Verify templates in Admin UI show proper tokens
- [ ] Send test email to yourself
- [ ] Check email shows actual names (not {Name})
- [ ] Check email shows actual job numbers (not {WO-XXXXX})
- [ ] Verify all tokens are replaced
- [ ] Check email subject line
- [ ] Check email body
- [ ] Test with different template tones (Professional, Casual, Formal)
- [ ] Test preview feature in Admin UI

---

## 🔍 Troubleshooting

### Issue: Still Seeing Curly Braces
**Check:**
1. Did you run the SQL migration?
2. Did you refresh the page after running migration?
3. Are you using the correct token names?
4. Check the template source in database:
   ```sql
   SELECT id, tone, subject, body 
   FROM email_templates 
   WHERE subject LIKE '%Approval%';
   ```

### Issue: Blank Values Instead of Names
**Check:**
1. Does the property have an AP contact name?
   ```sql
   SELECT id, name, ap_name, ap_email 
   FROM properties 
   WHERE id = 'your-property-id';
   ```
2. Is the job associated with the property?
3. Try using a different token variant (e.g., `{{contact_name}}` instead of `{{recipient_name}}`)

### Issue: Some Tokens Work, Others Don't
**Verify token name spelling:**
```sql
-- Check what tokens are used in template
SELECT body 
FROM email_templates 
WHERE id = 'your-template-id';
```

Compare against the Available Tokens Reference table above.

---

## 📁 Related Files

### Code Changes
- `src/components/EnhancedPropertyNotificationModal.tsx` - Added recipient name token variations

### SQL Migrations
- `FIX_EMAIL_TEMPLATE_PLACEHOLDERS.sql` - Fixes hardcoded placeholders in templates

### Documentation
- `EMAIL_TEMPLATE_PLACEHOLDER_FIX_GUIDE.md` - This file
- `SEPARATE_IMAGE_VARIABLES_GUIDE.md` - General token reference guide
- `EMAIL_SYSTEM_USER_GUIDE_NOV_18.md` - Email system documentation

---

## 🎯 Summary

**Problem:** Email templates had literal `{Name}` and `{WO-XXXXX}` text showing in sent emails  
**Root Cause:** Templates were created with hardcoded placeholder text instead of proper tokens  
**Solution:** 
1. Added more recipient name token variations to code
2. Created SQL migration to fix existing templates
3. Documented correct token usage

**Status:** ✅ COMPLETE  
**Testing Required:** Yes - send test email after applying migration  
**User Impact:** Improved - emails now show proper names and job numbers

---

*Last Updated: December 11, 2025*
