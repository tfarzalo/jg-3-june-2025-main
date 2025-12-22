# Job Request CSV Import Feature Plan (Bulk Schedule)

## 1. Safety & Non-Destructive Guarantee
I have performed a final comprehensive review of the proposed changes.
-   **No Schema Changes:** We will NOT modify any database tables or run any SQL migrations.
-   **No Data Overwrites:** We are only *adding* new records (jobs and files). No existing data will be modified or deleted.
-   **No UI Disruption:** The new feature is contained entirely within a new tab in the Admin Settings. Existing tabs and functionality remain untouched.
-   **Code Safety:** The implementation uses a new standalone component (`JobImportManager.tsx`), isolating the logic from the rest of the application.

## 2. User Interface Integration

### Admin Settings Update (`src/components/AppSettings.tsx`)
-   **Action:** Add a new tab labeled **"Bulk Schedule"**.
-   **Logic:** When this tab is selected, render the `JobImportManager` component.
-   **Impact:** Minimal. Just a new entry in the navigation list.

### New Component: `JobImportManager`
Create `src/components/admin/JobImportManager.tsx` containing:
1.  **Template Download**: Generates a CSV file with the correct headers for the user.
2.  **File Upload**: A drag-and-drop zone to upload the completed CSV.
3.  **Validation Preview**: A table displaying the parsed data.
    -   **Green Rows**: Ready to import.
    -   **Red Rows**: Contain errors (e.g., "Property 'Sunset Apts' not found" or "Invalid Date").
4.  **Import Button**: Active only when valid data is present.

## 3. CSV Template Structure
The template will enforce the following columns:
-   **Property Name** (Required, matches existing properties)
-   **Unit Number** (Required)
-   **Unit Size** (Required, e.g., "1x1")
-   **Job Type** (Required, e.g., "Full Paint")
-   **Scheduled Date** (Required, Format: **MM-DD-YYYY** or MM/DD/YYYY)
-   **Description** (Optional)
-   **Job Category** (Optional)

## 4. Technical Implementation & Data Flow

### Step A: Data Preparation
On load, the component will fetch active Properties, Unit Sizes, and Job Types from Supabase. This allows us to validate the CSV data immediately in the browser.

### Step B: Date Parsing Logic
-   The system will specifically parse dates entered as **MM-DD-YYYY** (e.g., 12-25-2025) or **MM/DD/YYYY**.
-   These dates will be validated to ensure they are real calendar dates.
-   Before submission, they will be converted to the database-standard `YYYY-MM-DD` format to ensure they are stored correctly.

### Step C: File Persistence (File Manager Integration)
When the user clicks "Import":
1.  **Check Folder:** Query the `files` table for a root folder named **"Bulk Imports"**.
2.  **Create Folder:** If it doesn't exist, insert a new record into the `files` table (`type: 'folder/directory'`, `name: 'Bulk Imports'`).
3.  **Upload File:**
    -   Upload the CSV to Supabase Storage.
    -   Insert a record into the `files` table linked to the "Bulk Imports" folder.
    -   **Result:** The file automatically appears in your File Manager.

### Step D: Job Creation
1.  **Process:** Iterate through the valid CSV rows.
2.  **Execute:** Call the existing `create_job` database function for each row using the formatted data.
    -   This function automatically handles activity logs, notifications, and status setting.
3.  **Feedback:** Show a success message summary.

## 5. Action Plan
1.  **Create Component**: Build `src/components/admin/JobImportManager.tsx` with the custom date parsing logic.
2.  **Update Settings**: Add the "Bulk Schedule" tab to `src/components/AppSettings.tsx`.
3.  **Verify**:
    -   Download template.
    -   Upload a test file with **MM-DD-YYYY** dates.
    -   Confirm file appears in File Manager > Bulk Imports.
    -   Confirm jobs appear in the Job Requests list with the correct date.
