## Summary
- Add “Email Notifications” selection to AP Contact and make AP the default selection when available.
- Persist the selected contact as property.primary_contact_email so Extra Charges and notification emails use it as the “to” address.
- Enforce single selection across all contacts (Community Manager, Maintenance Supervisor, AP Contact, Additional Contacts).

## Current Behavior
- Recipient defaults to property.primary_contact_email, falling back to property.ap_email in email modals.
- Property details/edit forms allow choosing Community Manager, Maintenance Supervisor, or an Additional Contact via a single-selection radio group named notification_contact_source.
- AP Contact is displayed but not selectable for Email Notifications.

## Changes
- Add AP Contact into the single-selection group for Email Notifications in both view and edit screens.
- Initialize the selection to AP Contact by default if property.ap_email exists; otherwise fall back to existing logic.
- When AP Contact is selected, update property.primary_contact_email = property.ap_email.

## Files to Update
- Property details page: [PropertyDetails.tsx](file:///Users/timothyfarzalo/Desktop/jg-3-june-2025-main-main/src/components/PropertyDetails.tsx)
- Property edit form: [PropertyEditForm.tsx](file:///Users/timothyfarzalo/Desktop/jg-3-june-2025-main-main/src/components/PropertyEditForm.tsx)
- Property creation form: [PropertyForm.tsx](file:///Users/timothyfarzalo/Desktop/jg-3-june-2025-main-main/src/components/PropertyForm.tsx)

## Implementation Steps
1. PropertyDetails.tsx
- Add a radio input under the “AP Contact” card using name="notification_contact_source" and label “Email Notifications”.
- Checked when notificationContactSource === 'ap'. On change, call handleNotificationContactChange('ap').
- Extend handleNotificationContactChange to handle 'ap' by calling updateNotificationEmail(property.ap_email || null).
- After property and contacts load, set notificationContactSource based on property.primary_contact_email:
  - If equals property.ap_email → 'ap'
  - Else if equals property.community_manager_email → 'community_manager'
  - Else if equals property.maintenance_supervisor_email → 'maintenance_supervisor'
  - Else if matches an Additional Contact email → that contact.id
  - Else default to 'ap' if property.ap_email exists; otherwise 'community_manager'.

2. PropertyEditForm.tsx
- Add an “Email Notifications” radio option to the AP Contact card in Billing Information with name="notification_contact_source"; checked when notificationContactSource === 'ap'; onChange → setNotificationContactSource('ap').
- Initialize notificationContactSource to 'ap' if formData.ap_email exists; otherwise keep existing default.
- In save logic, explicitly handle 'ap' when setting updateData.primary_contact_email = formData.ap_email.
- When loading existing property, set notificationContactSource using the same matching logic as above (compare to ap/community/maintenance/additional contacts), defaulting to 'ap' if available.

3. PropertyForm.tsx (Create)
- Add an “Email Notifications” radio option for AP Contact similar to edit form.
- Initialize notificationContactSource to 'ap' by default if ap_email is entered; otherwise default to 'community_manager'.
- In submit logic, explicitly handle 'ap' for cleanedFormData.primary_contact_email = formData.ap_email.

## Email Sending Flow (No Code Changes Needed)
- Notification modals already prefer property.primary_contact_email, falling back to property.ap_email:
  - [NotificationEmailModal.tsx](file:///Users/timothyfarzalo/Desktop/jg-3-june-2025-main-main/src/components/NotificationEmailModal.tsx#L84-L92)
  - [EnhancedPropertyNotificationModal.tsx](file:///Users/timothyfarzalo/Desktop/jg-3-june-2025-main-main/src/components/EnhancedPropertyNotificationModal.tsx#L239-L244)
- By persisting the selection to property.primary_contact_email, recipientEmail initializes to the chosen contact automatically.

## Single Selection Enforcement
- Continue using radios with the shared name notification_contact_source across all contact options to guarantee exactly one selection.

## Edge Cases
- If AP email is empty, default to community_manager; users can still choose another contact.
- If property.primary_contact_email does not match any known contact, set selection to 'ap' when ap_email exists; otherwise 'community_manager'.

## Verification
- On Property Details, select AP Contact and verify property.primary_contact_email updates; confirm “Email Notifications” radio reflects AP.
- Open Extra Charges/Notification email modals; confirm “To” pre-fills with AP email when AP is selected.
- Change selection to another contact; verify “To” updates to that contact’s email.
- Create a new property: enter AP and verify default selection is AP; send a notification to confirm "to" uses AP.
