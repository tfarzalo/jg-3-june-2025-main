# Job Import Confirmation Feature Plan

## 1. Overview
We will enhance the current `JobImportManager` component to include a mandatory confirmation step before any data is written to the database. After the user uploads a valid CSV file, they will see a clear, paginated list of all the jobs that are about to be created. This prevents accidental bulk imports and allows for a final review.

## 2. User Interface Workflow

### Step 1: Upload & Validation (Existing)
- The user uploads a CSV file.
- The system validates each row.
- **Change:** Instead of the "Import [N] Jobs" button immediately processing the import, it will change to **"Review [N] Jobs"**.

### Step 2: Confirmation Screen (New)
- When "Review [N] Jobs" is clicked, the UI transitions to a confirmation view.
- **Header:** "Review Jobs to Import".
- **Content:** A table listing the parsed job details (Property, Unit, Type, Date, Description).
    -   Since bulk imports can be large, we will use a simple scrollable table or basic pagination if the list exceeds 50 items.
- **Action Buttons:**
    -   **"Back"**: Returns to the upload screen to upload a different file.
    -   **"Confirm & Import"**: Executes the actual import process.

### Step 3: Processing & Result (Existing)
- Once confirmed, the import process runs as before.
- The success message and summary are displayed.

## 3. Component Updates (`JobImportManager.tsx`)

### State Management
- Add a new state variable: `step: 'upload' | 'review' | 'processing' | 'complete'`.
- Store the `validRows` separately so they can be easily mapped in the review table.

### Review Table Logic
- Display the *parsed* data (e.g., the actual Date object formatted for display) rather than the raw CSV strings, so the user sees exactly what will be stored.
- Columns: Property Name, Unit Number, Unit Size, Job Type, Scheduled Date, Job Category.

### Import Execution
- Move the `handleImport` logic to be triggered only by the "Confirm & Import" button in the review step.

## 4. Safety & Verification
- **No Data Written:** The file is NOT saved to storage and NO jobs are created until the final "Confirm & Import" button is clicked.
- **Clear Visuals:** The confirmation screen will clearly state "You are about to create [N] new job requests."

## 5. Action Plan
1.  **Modify `JobImportManager.tsx`**:
    -   Implement the `step` state.
    -   Create the Review UI view.
    -   Wire up the "Review" and "Confirm" buttons.
2.  **Test**:
    -   Upload a file.
    -   Verify the review screen shows the correct data.
    -   Click "Back" and verify state resets.
    -   Click "Confirm" and verify jobs are created.
