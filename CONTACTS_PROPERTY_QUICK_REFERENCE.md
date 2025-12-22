# Contact to Property Creation - Quick Reference Guide

**Last Updated:** January 20, 2025

---

## 🎯 Quick Start: Create a Property from a Contact

### Step-by-Step Instructions

#### 1. Navigate to Contact
- Go to **Dashboard** → **Contacts**
- Click on any contact to view details

#### 2. Check Property Status
- Look at the **Property & Address** section
- If contact already has a property, you'll see a green badge: "Linked to Property: {name}"
- If no property exists, you'll see the **"Create Property from Contact"** button at the bottom

#### 3. Open Property Creation Modal
- Click **"Create Property from Contact"**
- A modal window will open with pre-filled information

#### 4. Review Pre-Filled Information
The following fields are automatically filled from the contact:
- ✅ **Address** - Street address from contact
- ✅ **City** - City from contact
- ✅ **State** - State from contact  
- ✅ **ZIP** - ZIP code from contact
- ✅ **Primary Contact Name** - Contact's full name
- ✅ **Primary Contact Phone** - Contact's phone number
- ✅ **AP Email** - Contact's email address

#### 5. Fill Required Fields
You need to enter:
- **Property Name** - A descriptive name for the property
- **Property Management Group** - Select from dropdown or choose "None"

Optional fields:
- Address Line 2 (Unit, Suite, etc.)
- Phone (if different from contact phone)

#### 6. Create Property
- Click **"Create Property"** button
- Wait for success notification
- Modal will close automatically

#### 7. Verify Success
After creation, you should see:
- ✅ Green success notification: "Property created and linked to contact"
- ✅ Contact status updated to **"Customer"**
- ✅ Green badge showing: "Linked to Property: {property name}"
- ✅ **"Create Property from Contact"** button is now hidden

---

## 📋 Field Reference

### Required Fields
| Field | Description | Example |
|-------|-------------|---------|
| Property Name | Unique name for the property | "Oak Grove Apartments" |
| Address | Street address | "123 Main Street" |
| Property Management Group | Company managing the property | Select from dropdown or "None" |

### Pre-Filled Fields (Editable)
| Field | Source | Can Edit? |
|-------|--------|-----------|
| Address | Contact's address | ✅ Yes |
| City | Contact's address | ✅ Yes |
| State | Contact's address | ✅ Yes |
| ZIP | Contact's address | ✅ Yes |
| Primary Contact Name | Contact's full name | ✅ Yes |
| Primary Contact Phone | Contact's phone | ✅ Yes |
| AP Email | Contact's email | ✅ Yes |

---

## 💡 Tips and Best Practices

### ✅ DO:
- **Review pre-filled information** - Ensure address is correct before creating
- **Use descriptive property names** - Makes it easier to find properties later
- **Select appropriate management group** - Helps with organization and reporting
- **Verify contact information** - Ensure primary contact details are accurate

### ❌ DON'T:
- **Create duplicate properties** - Check if property already exists first
- **Leave property name blank** - Property name is required
- **Forget to select management group** - Select "None" if not applicable
- **Close modal before completion** - Wait for success notification

---

## 🔍 Common Scenarios

### Scenario 1: Contact Missing Address
**Problem:** Contact has no address information  
**Solution:**
1. Click "Create Property from Contact" anyway
2. Manually enter address in the modal
3. Consider updating contact record with address

### Scenario 2: Need to Link to Existing Property
**Problem:** Property already exists, want to link contact  
**Solution:**
1. Edit the contact in Contacts page
2. Use the property dropdown to select existing property
3. Contact status will update accordingly

### Scenario 3: Wrong Property Management Group
**Problem:** Selected wrong group during creation  
**Solution:**
1. Go to Properties page
2. Find the property you just created
3. Edit property and change management group

### Scenario 4: Contact Already Has Property
**Problem:** "Create Property" button not visible  
**Status:** Contact already linked to a property  
**Solution:**
- View linked property in green badge
- To create new property, first unlink current property in contact edit mode

---

## 🎨 Visual Guide

### Contact Detail Layout
```
┌─────────────────────────────────────────┐
│ Contact Name                            │
│ Status: Lead → Customer (after create)  │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Property & Address                      │
├─────────────────────────────────────────┤
│ Property Name: [Shows if exists]        │
│ Property Group: [Shows if exists]       │
│ Address:                                │
│   Street: 123 Main St                   │
│   City: Anytown                         │
│   State: CA    ZIP: 12345               │
├─────────────────────────────────────────┤
│ [Create Property from Contact]          │ ← Only if no property
│                                         │
│ OR                                      │
│                                         │
│ ✅ Linked to Property: Oak Grove Apt    │ ← If property exists
└─────────────────────────────────────────┘
```

### Modal Layout
```
┌───────────────────────────────────────┐
│ Create Property from Contact    [X]   │
├───────────────────────────────────────┤
│                                       │
│ Property Name *                       │
│ [_____________________________]       │
│                                       │
│ Address *                             │
│ [123 Main Street] ← Pre-filled        │
│                                       │
│ City *          State *               │
│ [Anytown]       [CA]                  │
│                                       │
│ ZIP *           Phone                 │
│ [12345]         [555-1234]            │
│                                       │
│ Property Management Group *           │
│ [▼ Select or None]                    │
│                                       │
│ Primary Contact Name                  │
│ [John Doe] ← Pre-filled               │
│                                       │
│ Primary Contact Phone                 │
│ [555-1234] ← Pre-filled               │
│                                       │
│ AP Email                              │
│ [john@example.com] ← Pre-filled       │
│                                       │
│         [Cancel]  [Create Property]   │
└───────────────────────────────────────┘
```

---

## ⚡ Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Close Modal | `Esc` |
| Submit Form | `Ctrl/Cmd + Enter` (in modal) |
| Navigate to Contacts | Click breadcrumb |

---

## 📊 Status Changes

### Automatic Status Update
When you create a property from a contact, the contact's status automatically updates:

**Before Property Creation:**
- Status: Usually "Lead" or "General Contact"

**After Property Creation:**
- Status: **"Customer"** ✅

This happens automatically and cannot be prevented. If you need a different status, you can change it manually after property creation.

---

## 🔧 Troubleshooting

### Button Not Showing
**Possible Reasons:**
1. ✅ Contact already has a linked property (check for green badge)
2. ✅ You're in edit mode (click Cancel to exit edit mode)
3. ✅ Page hasn't fully loaded (wait a moment and refresh)

### Modal Won't Open
**Solutions:**
1. Check browser console for errors (F12)
2. Refresh the page
3. Try a different browser
4. Clear browser cache

### Property Not Creating
**Check:**
1. ✅ Property name is filled in
2. ✅ Address is filled in
3. ✅ Property management group is selected (or "None")
4. ✅ No errors in form fields
5. ✅ Internet connection is stable

### Contact Status Not Updating
**Solutions:**
1. Refresh the contact detail page
2. Check that property was actually created (visit Properties page)
3. Manually update status if needed
4. Contact support if issue persists

---

## 📱 Mobile Support

The "Create Property from Contact" feature is fully responsive and works on:
- ✅ Desktop browsers (Chrome, Firefox, Safari, Edge)
- ✅ Tablet devices (iPad, Android tablets)
- ✅ Mobile phones (iOS, Android)

**Mobile Tips:**
- Form fields stack vertically on small screens
- Tap any field to focus and edit
- Scroll within modal to see all fields
- Modal adapts to screen size

---

## 📈 Reporting and Analytics

### Track Your Success
After using this feature, you can:
1. View all "Customer" status contacts in Contacts page
2. Filter properties by management group
3. See property creation date in Properties page
4. Track contact-to-customer conversion rate

---

## 🎓 Training Resources

### Video Tutorials
- **Contact Management Basics** - 5 min
- **Creating Properties from Contacts** - 3 min
- **Property Management Groups** - 4 min

### Documentation
- Complete Implementation Summary
- Contact Status Guide
- Property Management Guide

---

## 📞 Support

**Need Help?**
- **In-App Support:** Click help icon in top right
- **Email:** support@example.com
- **Phone:** 1-800-XXX-XXXX
- **Hours:** Monday-Friday, 9am-5pm EST

---

## 🆕 What's New

### Version 2.0 (January 2025)
- ✅ Streamlined property creation from contact details
- ✅ Automatic status update to "Customer"
- ✅ Pre-filled forms save time
- ✅ Cleaner UI without duplicate fields
- ✅ Better visual feedback with green badges

### Coming Soon
- Bulk property creation
- Property templates
- Enhanced reporting
- Mobile app support

---

**💡 Pro Tip:** Create a new contact first with all details (name, email, phone, address), then immediately click "Create Property from Contact" for the fastest workflow!

---

**Last Updated:** January 20, 2025  
**Document Version:** 2.0  
**System Version:** v2.0.0
