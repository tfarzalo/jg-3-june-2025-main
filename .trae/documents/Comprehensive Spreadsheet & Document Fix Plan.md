# Deep Dive & Architectural Overhaul Plan

## 1. Architectural Change: Dedicated Editor Page
We will move from the fragile "Modal" approach to a robust **Dedicated Editor Page** (`/file-editor/:fileId`).
*   **Why:** This isolates the heavy editing environment from the file browser. It solves state loss issues, improves performance, and allows for deep linking (e.g., sending a URL to a coworker).
*   **Behavior:** Clicking a file in the File Manager will open a **new browser tab** dedicated to that file.
*   **Security:** The new route will be protected by the existing authentication system.

## 2. Technical Fixes (The "Not Saving" Solution)
We will implement the "Blob Strategy" to ensure 100% reliable saving.

### A. Spreadsheet Editor
*   **CSV Fix:** We will stop using `ExcelJS` to save CSVs. Instead, we will use `PapaParse` to generate a raw text blob directly from the grid data. This guarantees that **what you see is what you save**.
*   **Excel Fix:** We will continue using `ExcelJS` for `.xlsx` files but ensure the file buffer is generated correctly before upload.
*   **Interface:** The Editor will now pass a `Blob` (binary data) to the save handler, decoupling it from the storage logic.

### B. Document Editor
*   **Stability:** We will wrap the `html-to-docx` conversion in a safety net. If it fails, the user will be notified and offered a fallback (e.g., save as HTML).

### C. File Save Service
*   **Simplification:** We will refactor `fileSaveService.ts` to simply accept a `Blob` and upload it. It will no longer try to be "smart" about converting workbooks, eliminating a major source of bugs.

## 3. Implementation Steps

1.  **Create `src/pages/FileEditorPage.tsx`**:
    *   Fetches file metadata from Supabase.
    *   Determines which Editor to load (Spreadsheet, Document, PDF).
    *   Handles the "Save" action by calling the refactored service.
2.  **Update `App.tsx`**:
    *   Register the new route: `/file-editor/:fileId`.
3.  **Refactor `FileManager.tsx`**:
    *   Remove all modal logic.
    *   Change file click behavior to `window.open('/file-editor/ID', '_blank')`.
4.  **Update `SpreadsheetEditor.tsx`**:
    *   Implement `PapaParse` export for CSVs.
    *   Pass `Blob` to `onSave`.
5.  **Update `fileSaveService.ts`**:
    *   Support direct Blob uploads.

## 4. SQL Verification
I will provide a script to double-check that the database is ready for these files, ensuring no permission errors occur.

## 5. Verification Checklist
*   [ ] Click a CSV -> Opens in new tab -> Edit -> Save -> **Persists**.
*   [ ] Click an XLSX -> Opens in new tab -> Edit -> Save -> **Persists**.
*   [ ] Refresh the Editor tab -> File reloads correctly.
