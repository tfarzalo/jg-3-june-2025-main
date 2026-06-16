Reporting

The Reports page follows the same Supabase-first pattern as the rest of the app.

What is implemented:
- Route and navigation for `/dashboard/reports`.
- Saved report templates stored in `public.report_templates`.
- Report run metadata stored in `public.report_runs`.
- Client-side CSV exports from Supabase `jobs` data and related records.
- Preset reports plus user-created templates.

Files:
- `src/pages/ReportsPage.tsx` - Reports page.
- `src/components/Reports/RunReportModal.tsx` - Date range and template selection.
- `src/components/Reports/TemplateEditor.tsx` - Saved template editor.
- `src/components/Reports/TemplatesList.tsx` - Template list cards.
- `src/lib/reports.ts` - Presets, columns, Supabase CRUD, CSV export.
- `supabase/migrations/20260616000000_create_report_templates.sql` - Tables and RLS policies.

Setup:
1. Apply the Supabase migration.
2. Run the app with the normal frontend command:
   `npm run dev`
3. Open `/dashboard/reports`.

Notes:
- There is no local Express API server for reports.
- The first implementation exports CSV in the browser. If reports later need ZIP files, scheduled delivery, background processing, or service-role access, add a Supabase Edge Function for the export runner only.
