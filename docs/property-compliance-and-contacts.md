# Property Compliance & Contact Inventory

## Compliance data
- **Table**: `properties` (Supabase direct). Current fields are stored as text/status strings, no date tracking: `compliance_required`, `compliance_approved`, `compliance_bid_approved`, `compliance_po_needed`, `compliance_w9_created`, `compliance_coi_address`, `compliance_create_sub_prop_portal`, `compliance_notify_team`, `compliance_upload_documents`, `compliance_invoice_delivery`.
- **New date fields** (migration `20251211000003_add_compliance_dates_and_property_contacts.sql`): `compliance_required_date`, `compliance_approved_date`, `compliance_bid_approved_date`, `compliance_po_needed_date`, `compliance_w9_created_date`, `compliance_coi_address_date`, `compliance_create_sub_prop_portal_date`, `compliance_notify_team_date`, `compliance_upload_documents_date`, `compliance_invoice_delivery_date` (all nullable `date` on `properties`).
- **APIs**: All reads/writes are direct Supabase calls from the frontend. `PropertyDetails` does `select *` on `properties`; `PropertyForm` inserts into `properties`; `PropertyEditForm` updates the same row with the full compliance payload. Date strings are sent as `date` columns.
- **UI surfaces**:
  - Create: `src/components/PropertyForm.tsx` renders select/text inputs for every compliance_* field with accompanying date inputs and posts them on insert.
  - Edit: `src/components/PropertyEditForm.tsx` loads the same columns, pre-fills them (including dates), and updates on save.
  - Details: `src/components/PropertyDetails.tsx` shows compliance badges for every compliance item and a “Date:” line (formatted) or “No date set”.
- **Enumerations**: Status values are free-form strings but UI offers fixed options (e.g., Yes/No/Pending/Completed depending on the field). No shared enum helper found.

## Contact data tied to properties
- **Table (new)**: `property_contacts` (id uuid PK, property_id FK → properties on delete cascade, position, name, email, phone, timestamps) added in migration `20251211000003_add_compliance_dates_and_property_contacts.sql`.
- **Legacy columns**: `properties` still holds contact columns directly: `community_manager_name/email/phone`, `maintenance_supervisor_name/email/phone`, `primary_contact_name/phone/role`, `point_of_contact`, `subcontractor_a/b`, plus AP contact fields `ap_name/email/phone`.
- **APIs**: The property create/edit forms now also write/read `property_contacts` rows; property details fetches `property_contacts`. Legacy columns are still written for backward compatibility.
- **UI surfaces**:
  - Create: `src/components/PropertyForm.tsx` has a “Property Contacts (with job position)” repeater (position/name/email/phone) saved into `property_contacts`, plus the legacy contact fields.
  - Edit: `src/components/PropertyEditForm.tsx` loads, edits, adds, and deletes `property_contacts` rows; legacy fields remain.
  - Details: `src/components/PropertyDetails.tsx` renders dynamic cards from `property_contacts` (position in uppercase); if no rows exist, it falls back to the legacy Community Manager / Maintenance Supervisor / Primary / Subcontractor cards.

## Other contact system (leads/CRM)
- **Table**: `contacts` (lead/CRM) already has `job_title`, `company`, `email`, `phone`, etc. Migration `supabase/migrations/20250120000015_add_property_group_to_contacts.sql` added `property_id`, `property_name`, `property_address`, and `property_group`.
- **UI surfaces**: `src/components/Contacts.tsx` and `src/components/ContactDetail.tsx` display/edit `job_title`; `src/components/NewContactForm.tsx` collects it. `src/components/CreatePropertyFromContactModal.tsx` can create a property and link a contact (sets `property_id`), but the resulting property still relies on the property-level columns above rather than pulling contacts dynamically.

## Notes/observations
- Compliance data is column-based on `properties` with string statuses; no existing migration or model includes dates.
- Property contact cards are tightly coupled to specific columns/roles and cannot show arbitrary positions today.
- There is no dedicated backend service layer; the frontend writes directly to Supabase tables, so schema changes will need matching insert/update/select updates in the React components.
