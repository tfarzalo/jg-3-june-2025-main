## Scope
- Implement client‑side image optimization and auto naming across all upload surfaces:
  - Work order images: [ImageUpload.tsx](file:///Users/timothyfarzalo/Desktop/jg-3-june-2025-main-main/src/components/ImageUpload.tsx), [NewWorkOrder.tsx](file:///Users/timothyfarzalo/Desktop/jg-3-june-2025-main-main/src/components/NewWorkOrder.tsx), [NewWorkOrderSpanish.tsx](file:///Users/timothyfarzalo/Desktop/jg-3-june-2025-main-main/src/components/NewWorkOrderSpanish.tsx)
  - Job request/edit forms: [JobRequestForm.tsx](file:///Users/timothyfarzalo/Desktop/jg-3-june-2025-main-main/src/components/JobRequestForm.tsx)
  - Property forms/edit: [PropertyForm.tsx](file:///Users/timothyfarzalo/Desktop/jg-3-june-2025-main-main/src/components/PropertyForm.tsx), [PropertyEditForm.tsx](file:///Users/timothyfarzalo/Desktop/jg-3-june-2025-main-main/src/components/PropertyEditForm.tsx)
  - Unit map uploads: [UnitMapUpload.tsx](file:///Users/timothyfarzalo/Desktop/jg-3-june-2025-main-main/src/components/ui/UnitMapUpload.tsx), [fileUpload.ts](file:///Users/timothyfarzalo/Desktop/jg-3-june-2025-main-main/src/lib/utils/fileUpload.ts)
  - File manager: [FileManager.tsx](file:///Users/timothyfarzalo/Desktop/jg-3-june-2025-main-main/src/components/FileManager.tsx), [FileUpload.tsx](file:///Users/timothyfarzalo/Desktop/jg-3-june-2025-main-main/src/components/FileUpload.tsx)

## Optimization Strategy
- Client‑side Canvas pipeline; max dimension 2048; JPEG quality ~0.82; PNG → WebP ~0.85; GIF/SVG unchanged; fallback if any error
- Optimized mime determines file extension; DB size/type reflect optimized blob

## Auto Naming Rules
- Format: `wo-<work_order_number>_<field>_<index>.<ext>`
  - Field: `before | sprinkler | other`
  - Work order number taken from DB (ImageUpload) or parsed from folder path (FileManager) or fetched by job context as needed
  - Index computed as max existing index in that job+field folder + 1, then increment per file in batch
- Apply in:
  - Work order images (ImageUpload, NewWorkOrder flows)
  - FileManager when uploading into Work Orders subfolders (`.../WO-######/(Before Images|Sprinkler Images|Other)`) and job context exists
  - JobRequestForm: if attachments/images are uploaded for a job context, use the same naming; otherwise use original name
  - Unit map uploads keep existing naming scheme (unit‑map‑timestamp) since they’re property assets; optimization still applies

## Data Model
- Add files table columns: original_size BIGINT, optimized_size BIGINT
- For optimized uploads: set size = optimized_size; record original_size and optimized_size
- Legacy files show size fallback when original_size is NULL

## Shared Utility
- Add src/lib/utils/imageOptimization.ts with optimizeImage(file) → { blob, mime, suggestedExt, width, height, originalSize, optimizedSize }

## Integration Points
1. ImageUpload.tsx
   - Optimize each image before upload; compute auto name; upload via storagePreviews; insert DB with type/size/original_size/optimized_size/category

2. FileManager.tsx + FileUpload.tsx
   - Optimize images before XHR upload; in job context + recognized subfolder, use auto naming; otherwise preserve filename; insert DB with size/type and original/optimized columns; continue thumbnail previews

3. JobRequestForm.tsx
   - For any file inputs (selectedFiles state), run optimizeImage for images; if job context present, use auto naming; upload with appropriate contentType; record original/optimized sizes

4. PropertyForm.tsx + PropertyEditForm.tsx
   - Integrate optimization for any image/file inputs; keep property asset naming (no work‑order auto naming); ensure DB size/type updated

5. UnitMapUpload.tsx + fileUpload.ts
   - Optimize unit map images; update mime/size and filename extension; record original_size/optimized_size

## File Manager UI Enhancements
- Thumbnails: already present when previewUrl is available (list/grid)
- Org/Opt sizes: under name, show `Org: <bytes>   Opt: <bytes>   Saved: <percent>%` using original_size/optimized_size
- Rename validation: keep enforcement preventing extension changes; show inline error if attempted

## Verification
- Uploads in all forms show optimized sizes and correct auto names where applicable; thumbnails visible; rename extension blocked; DB reflects original/optimized sizes and correct mime/extension; previews and downloads work

## Notes
- All processing is client‑side; no server framework changes required
- Future optional: edge function to retro‑optimize legacy files and generate standardized thumbnails across storage
