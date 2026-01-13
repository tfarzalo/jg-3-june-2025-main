## Summary
- Fix the split folders problem by standardizing one canonical storage path per property and per work order, and by removing all hardcoded path building.
- Use database RPCs to create/resolve folders and always upload using the folder’s actual storage path from the files table.
- Keep all current functionality (job request uploads, work order uploads for before/sprinkler/other, property files, File Manager), while ensuring images/files live under one hierarchy and display reliably on Job and Property pages.

## What’s Wrong Today
- Mixed path schemes create duplicate work order folders:
  - Job Request/Job Edit hardcode paths like “/Properties/<PropertyName>/Work Orders/WO-XXXXXX/Job Files”.
  - Work order images use normalized “/<sanitized_property>/Work Orders/WO-XXXXXX/...”.
  - FileUpload and FileManager sometimes use “properties/<property_id>/jobs/<job_id>/...”.
- Subfolder name mismatch:
  - Job Request uses “Job Files”; work order flow uses “Other Files”.
- Path lookups by literal strings:
  - JobDetails and EnhancedPropertyNotificationModal search for “/Properties/...”, which won’t match the normalized storage path.
- Bucket mismatch:
  - NewWorkOrder deletes from “work_orders” bucket, while uploads store in “files”.
- Property names with apostrophes/special chars cause path variants; some code bypasses the sanitization.

References: [JobRequestForm.tsx](file:///Users/timothyfarzalo/Desktop/jg-3-june-2025-main-main/src/components/JobRequestForm.tsx#L269-L340), [JobEditForm.tsx](file:///Users/timothyfarzalo/Desktop/jg-3-june-2025-main-main/src/components/JobEditForm.tsx#L331-L436), [ImageUpload.tsx](file:///Users/timothyfarzalo/Desktop/jg-3-june-2025-main-main/src/components/ImageUpload.tsx#L358-L413), [ImageGallery.tsx](file:///Users/timothyfarzalo/Desktop/jg-3-june-2025-main-main/src/components/ImageGallery.tsx#L61-L101), [JobDetails.tsx](file:///Users/timothyfarzalo/Desktop/jg-3-june-2025-main-main/src/components/JobDetails.tsx#L534-L568), [EnhancedPropertyNotificationModal.tsx](file:///Users/timothyfarzalo/Desktop/jg-3-june-2025-main-main/src/components/EnhancedPropertyNotificationModal.tsx#L281-L296), [fileSaveService.ts](file:///Users/timothyfarzalo/Desktop/jg-3-june-2025-main-main/src/services/fileSaveService.ts#L109-L118), [create_work_order_folder SQL](file:///Users/timothyfarzalo/Desktop/jg-3-june-2025-main-main/supabase/migrations/20250123000030_standardize_property_folder_paths.sql#L270-L513).

## Canonical Folder Hierarchy
- Property root: storage path “/<sanitized_property>”, display path “/Properties/<Property Name>”.
- Under property: “/Work Orders”, “/Property Files”.
- Under work order: “/Before Images”, “/Sprinkler Images”, “/Other Files”.
- No “Properties/” prefix in storage paths; only use for display_path.

## Core Fixes (Code)
1. Replace all hardcoded path strings with DB-driven paths
- Always call RPCs to create/resolve folders:
  - create_property_folder_structure(property_id, property_name)
  - get_upload_folder(property_id, job_id, folder_type)
- After getting a folder_id, read its path from files and upload to “<that_path>/<timestamped_filename>”.

2. Unify Job Request and Job Edit uploads to “Other Files”
- JobRequestForm.tsx and JobEditForm.tsx:
  - Stop building “/Properties/.../Job Files”.
  - Call get_upload_folder(property_id, job_id, 'other').
  - Read folder path via files(id=returned_uuid).path and upload there.
  - Insert file row with category='other'.

3. Resolve work order folder by id, not string path
- JobDetails.tsx and EnhancedPropertyNotificationModal.tsx:
  - Derive work order folder_id via files where property_id=job.property.id and job_id=job.id and name='WO-XXXXXX' and type='folder/directory'; or use create_work_order_folder_structure to get wo_folder_id.
  - Pass that id to ImageGallery and related views.

4. Align ImageGallery folder mapping
- Map folder='job_files' to the subfolder named “Other Files” (while keeping 'before' and 'sprinkler').
- Query by folder_id and, for non-job_files, filter by category.

5. Fix bucket mismatch in NewWorkOrder
- Delete files from 'files' bucket (not 'work_orders').

6. Standardize FileUpload and FileManager uploads
- FileUpload.tsx: if property & job selected, resolve folder via get_upload_folder('other'); for property-only, resolve Property Files via get_upload_folder(property_id, NULL).
- FileManager.tsx: when uploading inside a selected folder, use that folder’s files.path from DB; drop property_id/job_id-based ad hoc paths.

7. Keep display_path for UI only
- Use files.path for storage operations (signed URLs, upload/remove). Use files.display_path only for breadcrumb/UI.

## Safeguards And Compatibility
- Database functions already sanitize names and are idempotent; they reuse folders by property_id and job_id.
- Add an alias in get_upload_folder: treat 'job_files' as 'other' to preserve legacy callers.
- Leave ImageUpload.tsx as-is (it already uses get_upload_folder and folder.path).

## Data Cleanup (Migration Plan)
- Identify duplicate trees under “/Properties/<PropertyName>/...” and move their objects to “/<sanitized_property>/...”: copy + delete in storage, update files.path/storage_path, and remove the duplicate folder rows.
- Enforce unique(files.path) (already present) to prevent re-creation of duplicates.
- Provide a one-time SQL script to:
  - Find work orders with both variants and select canonical ids.
  - Update child file rows to reference canonical folder_id.
  - Delete obsolete 'Job Files' subfolders where an 'Other Files' exists.

## Verification
- Upload in job request: appears in “Other Files” under the single WO folder; displays in JobDetails ImageGallery and Notification modal.
- Upload before/sprinkler: appear under the same WO folder; delete works against 'files' bucket.
- Upload property files: appear under single Property Files folder; preview and display work.
- File Manager: uploading inside any folder uses the folder’s actual path.

## Deliverables
- Code updates to: JobRequestForm.tsx, JobEditForm.tsx, JobDetails.tsx, EnhancedPropertyNotificationModal.tsx, NewWorkOrder.tsx, FileUpload.tsx, FileManager.tsx, ImageGallery.tsx (mapping tweak).
- SQL migration/scripts to alias 'job_files' to 'other' (optional) and to clean existing duplicates.
- Post-change manual test checklist covering job request → work order → display flows.

If you approve this plan, I will implement the code changes, provide the migration script, and run a verification pass end-to-end without breaking existing functionality.