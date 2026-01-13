# Contact Status & Form Embed - Quick Reference

## Contact Statuses (Simplified)

### New Statuses
1. **Lead** - Potential customer or inquiry
2. **General Contact** - Non-sales inquiry  
3. **Client** - Active client
4. **Dead** - No longer active/interested
5. **Proposal Sent** - Quote/proposal sent
6. **Customer** - Paying customer
7. **Other** - Other status

### Old → New Mapping
- New Lead, Contacted, Qualified → **Lead**
- Negotiating → **Proposal Sent**
- Closed Won, Closed - Won → **Customer**
- Closed Lost, Closed - Lost, Dead → **Dead**

## Form Embed Instructions

### Step 1: Get Embed Code
1. Go to Dashboard → Settings
2. Click "Manage Lead Forms"
3. Select your form
4. Click "Embed" tab
5. Copy the embed code

### Step 2: Add to Your Website
```html
<!-- Paste this code where you want the form -->
<iframe 
  id="jg-lead-form-{id}"
  src="{your-domain}/lead-form/{form-id}" 
  width="100%" 
  height="700" 
  frameborder="0"
  style="border: 1px solid #e5e7eb; border-radius: 8px; max-width: 600px;">
</iframe>

<script>
// Listen for form events
window.addEventListener('message', function(event) {
  if (event.data.type === 'leadFormSubmitted') {
    // Form submitted successfully!
    console.log('Lead submitted:', event.data);
    // Add your tracking code here
  }
});
</script>
```

### Step 3: Test
1. Open `test-lead-form-embed.html` in a browser
2. Replace `YOUR_FORM_ID_HERE` with your form ID
3. Submit the form
4. Watch the event log for messages

## How It Works

### Form Submission Flow
```
User fills form
    ↓
Form submitted
    ↓
Lead created (status: "Lead")
    ↓
Trigger fires automatically
    ↓
Contact extracted from form data
    ↓
Contact created in Contacts list
    ↓
Event sent to parent window (if embedded)
```

### Data Flow
- **Form Field** → **Lead.form_data** (JSON)
- **Lead** → **Contact** (via trigger)
- **Contact** appears in Contacts with "Lead" status

### Field Mapping (Automatic)
The system automatically extracts:
- `first_name` or `firstName` or `fname` → First Name
- `last_name` or `lastName` or `lname` → Last Name
- `email` or `e_mail` → Email
- `phone` or `phone_number` → Phone
- `company` or `business` → Company

## Testing Checklist

- [ ] Migration applied successfully
- [ ] Only 7 statuses in dropdown
- [ ] Form loads in iframe
- [ ] Form can be submitted
- [ ] Contact created with "Lead" status
- [ ] Contact appears in Contacts list
- [ ] postMessage events received
- [ ] Event log shows submission

## Files Changed

### Database
- `supabase/migrations/20251118000001_simplify_contact_statuses.sql`

### Frontend
- `src/components/Contacts.tsx` - Status icons
- `src/components/LeadFormBuilder.tsx` - Embed code
- `src/pages/LeadForm.tsx` - Iframe communication

### Testing
- `test-lead-form-embed.html` - Test page

## Troubleshooting

### Form doesn't load
- Check form ID is correct
- Verify form is marked "active"
- Check browser console for errors

### Contact not created
- Check leads table for submission
- Verify trigger is enabled
- Ensure form_data has name or email

### Events not received
- Verify event listener added
- Check iframe src URL
- Look for CORS errors in console

## Support Commands

```sql
-- Check new statuses
SELECT * FROM lead_statuses ORDER BY sort_order;

-- Check trigger status
SELECT * FROM pg_trigger WHERE tgname = 'trigger_create_contact_from_lead';

-- View recent leads
SELECT id, status_id, form_data->'email' as email, created_at 
FROM leads 
ORDER BY created_at DESC 
LIMIT 10;

-- View recent contacts
SELECT first_name, last_name, email, created_at 
FROM contacts 
ORDER BY created_at DESC 
LIMIT 10;
```

## Next Steps

1. **Apply migration**: Run the SQL migration
2. **Test locally**: Use test-lead-form-embed.html
3. **Create form**: Use LeadFormBuilder in admin
4. **Get embed code**: Copy from Embed tab
5. **Add to website**: Paste embed code
6. **Test live**: Submit real form
7. **Verify**: Check Contacts list

## Quick Links

- Contacts: `/dashboard/contacts`
- Lead Forms: `/dashboard/settings` → Manage Lead Forms
- Migration: `supabase/migrations/20251118000001_simplify_contact_statuses.sql`
- Test Page: `test-lead-form-embed.html`
- Full Docs: `CONTACT_STATUS_AND_FORM_EMBED_IMPLEMENTATION.md`
