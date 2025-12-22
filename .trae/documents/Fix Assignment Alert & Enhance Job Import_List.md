I will implement the requested changes to fix the pending alert, add columns to the job list, and enhance the import process.

### **Phase 1: Fix "Pending Assignment" Alert**
**Objective**: Prevent the "Pending job assignment" alert from showing when no subcontractor is assigned.
**File**: `src/components/JobDetails.tsx`
- **Logic**: Update the alert condition to check that `job.assigned_to` is not null.
- **Change**: `(job.assignment_status === 'pending' && job.assigned_to)`

### **Phase 2: Enhance Job List Columns**
**Objective**: Add "Assigned" and "Job Status" columns to the Job Listing Page and Export.
**File**: `src/components/shared/JobListingPage.tsx`
- **Data Fetching**: Update `JOB_EXPORT_SELECT` to join the `profiles` table for `assigned_to` (fetching `full_name`).
- **Interface**: Update `Job` interface to include the assigned subcontractor's name.
- **Export Config**: Add `assignedTo` and `jobStatus` to the `ExportConfig` structure and default state.
- **Export Logic**: Map these new fields in `exportToCSV` and `exportToPDF`.

### **Phase 3: Enhance Job Import Process**
**Objective**: Allow importing "Assigned To" and "Status" via CSV and prompt the user about email rules.
**File**: `src/components/admin/JobImportManager.tsx`
- **Reference Data**: Fetch `subcontractors` (profiles) and `job_phases` on mount to validate CSV data.
- **Validation**: Update `validateRows` to handle 'Assigned To' (match by name) and 'Job Status' (match by label) columns.
- **Processing**: Update `handleImport` to apply the assignment and status.
    - *Note*: Since `create_job` RPC might not accept these fields, I will perform an additional `update` call for each job that has these fields.
- **UI Prompt**: In the "Review" step, if any jobs have an assignment, display a warning/notice: *"Note: Assignment emails will be sent to subcontractors no earlier than 2 days before the scheduled date."*

### **Phase 4: Verification**
- **Test Alert**: Verify the alert no longer appears on unassigned jobs.
- **Test Import**: Import a CSV with "Assigned To" and verify the user is assigned and the prompt appears.
- **Test Columns**: Verify the new columns appear in the CSV export.
