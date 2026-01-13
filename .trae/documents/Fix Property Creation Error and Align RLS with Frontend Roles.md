## Diagnosis
- The submit flow inserts into properties; see [PropertyForm.tsx](file:///Users/timothyfarzalo/Desktop/jg-3-june-2025-main-main/src/components/PropertyForm.tsx#L147-L287). The generic "Failed to create property" appears when Supabase returns an error.
- Recent RLS updates require admin/management via helper functions using user_role_assignments; see [update-rls-policies.sql](file:///Users/timothyfarzalo/Desktop/jg-3-june-2025-main-main/supabase/update-rls-policies.sql#L64-L73). Frontend role detection uses profiles.role; see [UserRoleContext.tsx](file:///Users/timothyfarzalo/Desktop/jg-3-june-2025-main-main/src/contexts/UserRoleContext.tsx#L27-L33). If assignments aren’t populated, inserts are denied → error after submit.
- Property folder structure is created via trigger calling ensure_property_folders_exist → create_property_folder_structure; see [ensure_property_folders_before_upload.sql](file:///Users/timothyfarzalo/Desktop/jg-3-june-2025-main-main/ensure_property_folders_before_upload.sql#L79-L99) and the canonical folder creator [standardize_property_folder_paths.sql](file:///Users/timothyfarzalo/Desktop/jg-3-june-2025-main-main/supabase/migrations/20250123000030_standardize_property_folder_paths.sql#L65-L75). This creates: Property folder → Work Orders → Property Files. Upload uses RPC prepare + storage path "{sanitized}/Property_Files" then inserts a DB record targeted to Property Files; see [fileUpload.ts](file:///Users/timothyfarzalo/Desktop/jg-3-june-2025-main-main/src/lib/utils/fileUpload.ts#L60-L88, file:///Users/timothyfarzalo/Desktop/jg-3-june-2025-main-main/src/lib/utils/fileUpload.ts#L126-L143).

## Fix: Permissions Alignment
1. Update is_admin_or_management and is_subcontractor to also honor profiles.role, keeping user_role_assignments in place.
   - is_admin_or_management: add OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','jg_management')).
   - is_subcontractor: add OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'subcontractor').
2. Recreate properties and property_management_groups policies using these helpers so admin/management can INSERT/UPDATE reliably.
3. Frontend: gate create buttons for non-admin/management via useUserRole and surface permission errors clearly in PropertyForm and PropertyGroupForm.

## Fix: Folder Creation Process
1. Verify and (if missing) reapply the automatic folder creation trigger on properties:
   - Trigger property_create_folders_trigger AFTER INSERT calls ensure_property_folders_exist; see [ensure_property_folders_before_upload.sql](file:///Users/timothyfarzalo/Desktop/jg-3-june-2025-main-main/ensure_property_folders_before_upload.sql#L93-L99).
2. Confirm create_property_folder_structure returns all three IDs and parents the property folder under /Properties while keeping normalized storage path; see [standardize_property_folder_paths.sql](file:///Users/timothyfarzalo/Desktop/jg-3-june-2025-main-main/supabase/migrations/20250123000030_standardize_property_folder_paths.sql#L209-L264) and [restructure_file_manager.sql](file:///Users/timothyfarzalo/Desktop/jg-3-june-2025-main-main/supabase/migrations/20251222000000_restructure_file_manager.sql#L49-L160).
3. Ensure uploads call RPC prepare_property_for_file_upload to guarantee "Property Files" exists before writing; already implemented in [fileUpload.ts](file:///Users/timothyfarzalo/Desktop/jg-3-june-2025-main-main/src/lib/utils/fileUpload.ts#L60-L76). Keep using property_files_folder_id for the DB record’s folder_id.
4. Align storage paths and display paths:
   - Continue writing to storage with sanitized names and "Property_Files" allowed.
   - Always set display_path to "/Properties/{PropertyName}/Property Files/{file}" and folder_id to the "Property Files" folder ID.
5. Add a small guard: If RPC returns no property_files_folder_id, abort the upload and show a descriptive error; this is already present, but we will log and surface the message to the user.

## PMG Process Check
1. PMG CRUD uses property_management_groups with the same RLS model; after helper updates, admins/management can create/edit; see [PropertyGroupForm.tsx](file:///Users/timothyfarzalo/Desktop/jg-3-june-2025-main-main/src/components/PropertyGroupForm.tsx#L99-L136).
2. Association updates adjust properties.property_management_group_id; this relies on properties UPDATE permission; see [PropertyGroupForm.tsx handlePropertyAssociations](file:///Users/timothyfarzalo/Desktop/jg-3-june-2025-main-main/src/components/PropertyGroupForm.tsx#L138-L179). This will function once permissions align.

## Validation
- Create a property as management/admin:
  - Confirm folder entries are created: Property folder under /Properties, nested Work Orders and Property Files; verify via files table and display_path.
  - Upload a property unit map: storage path uses sanitized name + Property_Files; DB record points to the "Property Files" folder; properties.unit_map_file_id and unit_map_file_path set.
- Attempt with subcontractor:
  - Create buttons disabled; if forced, permission error message appears instead of generic failure.
- PMG:
  - Create/edit a group, then associate a property; verify properties.property_management_group_id updated and files remain correctly nested.

If approved, I will apply the SQL helper updates and confirm triggers/policies, then add the minimal frontend gating and enhanced error messages, followed by end-to-end verification.