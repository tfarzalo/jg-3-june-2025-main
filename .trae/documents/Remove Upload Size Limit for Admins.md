I will modify the upload utility to completely remove the file size limitation for Admin and JG Management users.

1.  **Modify `src/lib/utils/fileUpload.ts`**:
    *   Update the validation logic to check if the user has the `admin` or `jg_management` role.
    *   If the user has one of these roles, the file size check will be skipped entirely (effectively allowing uploads of "ANY size" as requested).
    *   For other users, the standard 10MB limit will remain in place.

This ensures that management users are not restricted by any client-side size limits in the code.