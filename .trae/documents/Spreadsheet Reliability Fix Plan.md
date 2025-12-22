# Diagnosis & Fix Plan: Spreadsheet & Document Reliability

## 1) Immediate Diagnosis Checklist (15–30 minutes)

**Objective:** Validate data corruption during save and formatting desynchronization.

1.  **Formatting Persistence Test:**
    *   Open a new Spreadsheet.
    *   Type "Test" in cell `A1`. Set background to **Yellow**.
    *   **Action:** Insert a new row above Row 1.
    *   **Inspect:** Check if the Yellow background moved to the new `A2` (correct) or stayed at `A1` (bug).
    *   *Expected Result:* It will likely stay at `A1`, proving the `cellMetadata` desync bug.
2.  **Save/Load Roundtrip:**
    *   Save the sheet. Reload the page.
    *   **Inspect:** Check if the new row structure and formatting are preserved exactly as left.
3.  **Console Inspection:**
    *   Open DevTools. Look for `ExcelJS` warnings or `spliceRows` errors during Save.
    *   Look for "HotTable instance not available" errors.

## 2) Architecture Assessment

**Current Flow:**
*   **UI/Editor:** `Handsontable` (Spreadsheet) / `React-Quill` (Document).
*   **State:** Local React State (`data` array + `cellMetadata` Map).
*   **Adapter (Load):** `fetch` -> `ExcelJS` (extracts values + styles) -> `Handsontable` props.
*   **Adapter (Save):** `Handsontable` data + `cellMetadata` -> `ExcelJS` Workbook rebuild -> `Blob`.
*   **Persistence:** `Supabase Storage` (overwrite existing file).

**Critical Weakness:**
*   **Formatting State:** Stored in `cellMetadata` map using `"row-col"` string keys.
*   **The Disconnect:** `Handsontable` handles data structural changes (insert/delete rows) internally, but **does not automatically update** the external `cellMetadata` keys. This causes formatting to "detach" from its data when rows/cols are modified.
*   **Save Logic:** The "Wipe and Rebuild" strategy (`spliceRows`) in `handleSave` is brittle and performance-heavy.

## 3) Root Cause Hypotheses (Ranked)

1.  **Metadata/Formatting Desync (High Probability/Impact):** `cellMetadata` keys (`"row-col"`) are not shifted when rows/columns are added or deleted. Formatting stays at the old coordinates while data moves.
2.  **Brittle Save Logic (High Impact):** `worksheet.spliceRows` is unreliable in `ExcelJS` for clearing sheets, potentially leading to duplicate rows or corrupted files upon saving.
3.  **Race Conditions (Medium Probability):** Autosave timer (`setTimeout`) and Manual Save do not share a robust locking mechanism, potentially triggering double saves or saving partial states.
4.  **Performance Bottleneck (Medium Impact):** `setData(hotInstance.getData())` triggers a full React re-render on *every* cell change. For large sheets (>1000 rows), this will cause typing lag.
5.  **Lossy Document Conversion (High Impact for Docs):** `Mammoth` (Import) -> `Quill` (HTML) -> `html-to-docx` (Export) chain drops complex Word features (headers, footers, tables, floating layout).

## 4) Fix Plan (Phased)

### Phase 1: Structural Integrity & State Sync (Priority)
*   **Fix:** Implement `useMetadataManager` hook to handle `afterCreateRow`, `afterRemoveRow`, `afterCreateCol`, `afterRemoveCol` events from Handsontable.
*   **Logic:** When a row is inserted at index `i`, shift all metadata keys where `row >= i` by `+1`. (Inverse for delete).
*   **Fix:** Refactor `handleSave` to use a "New Worksheet -> Swap" strategy instead of `spliceRows` to ensure clean saves.

### Phase 2: Persistence Hardening
*   **Fix:** Implement a proper `SaveQueue` or `Debounce` with locking to prevent Autosave/Manual save collision.
*   **Fix:** Optimize `setData` usage. Do not sync full data to React state on every keystroke; sync only on Save or use a `ref` for the latest data, updating state only for UI feedback (like "Unsaved changes").

### Phase 3: UX & Performance
*   **Fix:** Add "Saving..." overlay or toast to prevent navigation during save.
*   **Fix:** Document Editor: Add explicit warnings about formatting limitations or switch to a more robust HTML-to-DOCX config if possible.

## 5) Concrete Implementation Instructions

**Module:** `src/components/editors/SpreadsheetEditor.tsx`

**1. Metadata Manager (New Logic):**
```typescript
// Pseudo-code for new handler
const handleRowChange = (index: number, amount: number, action: 'insert' | 'remove') => {
  const newMeta = new Map();
  cellMetadata.forEach((value, key) => {
    let [r, c] = key.split('-').map(Number);
    if (r >= index) {
      if (action === 'insert') r += amount;
      else if (action === 'remove') r -= amount;
    }
    // Only keep valid rows
    if (r >= 0) newMeta.set(`${r}-${c}`, value);
  });
  setCellMetadata(newMeta);
};
```

**2. Robust Save Strategy:**
*   Instead of `worksheet.spliceRows(1, count)`:
    1.  `workbook.removeWorksheet(sheet.id)`
    2.  `const newSheet = workbook.addWorksheet(sheetName)`
    3.  Populate `newSheet` with Headers + Data + Styles.

**3. State Optimization:**
*   Remove `setData` from `afterChange`.
*   Let `Handsontable` manage its own data model.
*   Only read `hotInstance.getData()` when `handleSave` is called.
*   Keep `hasChanges` state for UI.

**Module:** `src/services/fileSaveService.ts`
*   No major changes needed if the `workbook` passed is correct, but ensure `upsert` is reliable (it is).

## 6) Instrumentation & Tests

**Telemetry/Logs:**
*   Log `metadata.size` before and after structural changes.
*   Log `workbook.worksheets.length` before save.

**Test Plan:**
1.  **Unit Test (Metadata):** Write a standalone function `shiftMetadata(map, action, index)` and test edge cases (insert at 0, delete last row).
2.  **Integration Test (UI):**
    *   Set cell A1 Red.
    *   Insert Row at 0.
    *   Verify A1 is White, A2 is Red.
    *   Save. Reload. Verify A2 is Red.

## 7) Acceptance Criteria

*   [ ] **Structure:** Inserting/Deleting rows/columns shifts formatting correctly.
*   [ ] **Persistence:** Saving a file and reloading restores 100% of data and formatting (values, bold, color).
*   [ ] **Reliability:** No duplicate data rows after multiple saves.
*   [ ] **Feedback:** UI clearly shows "Saved" state only after Supabase confirms upload.
