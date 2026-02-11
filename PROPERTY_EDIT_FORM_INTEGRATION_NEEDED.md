# PropertyEditForm.tsx Integration - IN PROGRESS

## Status
❌ **INCOMPLETE** - PropertyEditForm.tsx still needs PropertyContactsEditor integration

## Current State
- ✅ PropertyForm.tsx (creation) has been successfully updated with PropertyContactsEditor
- ❌ PropertyEditForm.tsx (editing) still uses the old contact UI
- ❌ PropertyDetails.tsx (view) still uses the old contact display

## What Was Done
1. Added imports for PropertyContactsEditor and contact types
2. Updated PropertyContact interface to include role fields
3. Added systemContacts and systemContactRoles state
4. Added handler functions for PropertyContactsEditor
5. Updated fetchProperty to populate systemContacts from database
6. Cleaned up formData to remove old contact fields

## Remaining Work

### 1. Remove Old Contact Logic in handleSubmit
**Location**: Lines ~520-580 in PropertyEditForm.tsx

Currently the handleSubmit function references old state variables that no longer exist:
- `subcontractorContactSource`
- `notificationContactSource`  
- `formData.community_manager_name` (and other contact fields)

**Need to replace with**:
```typescript
// Extract contact data from systemContacts
const updateData: Record<string, any> = {
  ...formData,
  // System contact info
  community_manager_name: systemContacts.community_manager.name,
  community_manager_email: systemContacts.community_manager.email,
  community_manager_secondary_email: systemContacts.community_manager.secondary_email,
  community_manager_phone: systemContacts.community_manager.phone,
  community_manager_title: systemContacts.community_manager.title || 'Community Manager',
  maintenance_supervisor_name: systemContacts.maintenance_supervisor.name,
  maintenance_supervisor_email: systemContacts.maintenance_supervisor.email,
  maintenance_supervisor_secondary_email: systemContacts.maintenance_supervisor.secondary_email,
  maintenance_supervisor_phone: systemContacts.maintenance_supervisor.phone,
  maintenance_supervisor_title: systemContacts.maintenance_supervisor.title || 'Maintenance Supervisor',
  ap_name: systemContacts.ap.name,
  ap_email: systemContacts.ap.email,
  ap_secondary_email: systemContacts.ap.secondary_email,
  ap_phone: systemContacts.ap.phone,
};

// Set primary contact fields based on which contact has the subcontractor role
const subcontractorContact = Object.entries(systemContactRoles).find(
  ([_, roles]) => roles.subcontractor
);

if (subcontractorContact) {
  const [key] = subcontractorContact;
  const contact = systemContacts[key as SystemContactKey];
  updateData.primary_contact_name = contact.name;
  updateData.primary_contact_role = contact.title;
  updateData.primary_contact_email = contact.email;
  updateData.primary_contact_phone = contact.phone;
} else {
  // Check custom contacts
  const customSubContact = contacts.find(c => c.is_subcontractor_contact);
  if (customSubContact) {
    updateData.primary_contact_name = customSubContact.name;
    updateData.primary_contact_role = customSubContact.position;
    updateData.primary_contact_email = customSubContact.email;
    updateData.primary_contact_phone = customSubContact.phone;
  } else {
    // Fallback to community manager
    updateData.primary_contact_name = systemContacts.community_manager.name;
    updateData.primary_contact_role = systemContacts.community_manager.title;
    updateData.primary_contact_email = systemContacts.community_manager.email;
    updateData.primary_contact_phone = systemContacts.community_manager.phone;
  }
}
```

### 2. Remove Old Handler Functions
**Location**: Lines ~668-748 in PropertyEditForm.tsx

Delete these old functions that reference removed state:
- `handleDeleteContact` (uses `subcontractorContactSource`, `setSubcontractorContactSource`, `setSecondaryEmailVisibility`)
- `handleSubcontractorContactChange` (uses `setSubcontractorContactSource`)
- `handleNotificationContactChange` (uses `setNotificationContactSource`)  
- `handleContactChange` (references deleted state variables)
- `handleAddContact` (old implementation)
- `toggleSecondaryEmailField` (uses `setSecondaryEmailVisibility`)
- `togglePropertySecondaryEmailField` (uses `setPropertySecondaryEmailVisibility`)

These are replaced by the new handlers already added:
- `handleSystemContactChange`
- `handleSystemContactRoleChange`
- `handleCustomContactChange`
- `handleCustomContactAdd`
- `handleCustomContactDelete`

### 3. Replace Contact Information UI Section
**Location**: Lines ~960-1200 in PropertyEditForm.tsx

Replace the entire old Contact Information section (from the `{/* Contact Information */}` comment through the closing `</div>`) with:

```tsx
{/* Contact Information */}
<PropertyContactsEditor
  systemContacts={systemContacts}
  systemContactRoles={systemContactRoles}
  customContacts={contacts}
  onSystemContactChange={handleSystemContactChange}
  onSystemContactRoleChange={handleSystemContactRoleChange}
  onCustomContactChange={handleCustomContactChange}
  onCustomContactAdd={handleCustomContactAdd}
  onCustomContactDelete={handleCustomContactDelete}
/>
```

### 4. Update Billing Section
**Location**: Around line ~1200-1300 in PropertyEditForm.tsx

Remove duplicate AP contact fields from the Billing Information section (similar to what was done in PropertyForm.tsx). AP contact is now managed in the Contact Information section.

### 5. Remove References to Old State in fetchProperty
**Location**: Lines ~428-475 in PropertyEditForm.tsx

Remove or update these lines that reference removed state variables:
```typescript
// These lines should be removed:
setSubcontractorContactSource('maintenance_supervisor');
setSubcontractorContactSource('community_manager');
setNotificationContactSource('community_manager');
setNotificationContactSource('maintenance_supervisor');
setNotificationContactSource('ap');
```

The role determination is now handled by populat ing `systemContactRoles` based on the database data (already done in lines ~390-409).

### 6. Update fetchContacts Function
The fetchContacts function should also load role information from the database once we add those fields to the property_contacts table schema.

## Testing After Completion
1. Edit an existing property
2. Verify all system contacts load correctly
3. Change contact roles (subcontractor, AR, approval, notification)
4. Add/remove custom contacts  
5. Save changes and verify they persist
6. Check that approval/notification emails use the correct contacts

## PropertyDetails.tsx (View Component)
This component also needs updating to display contacts using the new role-based system. However, since it's primarily a read-only view, this is lower priority than fixing the edit form.

### Suggested Approach for PropertyDetails.tsx:
1. Add a new `PropertyContactsViewer` component (similar to PropertyContactsEditor but read-only)
2. Show role badges next to contacts (Subcontractor, AR, Approval Recipient, etc.)
3. Replace the old contact display section with the new viewer

## Files to Update
- `/src/components/PropertyEditForm.tsx` - Priority 1 (editing)
- `/src/components/PropertyDetails.tsx` - Priority 2 (viewing)

## Related Documentation
- See `/PROPERTY_CONTACTS_INTEGRATION_COMPLETE.md` for PropertyForm.tsx changes
- See `/src/components/property/PropertyContactsEditor.tsx` for the component API
- See `/src/types/contacts.ts` for contact type definitions

## Date
February 10, 2026 - Integration started but incomplete
