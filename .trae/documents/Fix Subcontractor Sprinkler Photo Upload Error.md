I will implement the "cleanest and simplest" fix by mimicking exactly how 'Before Images' are handled, but for 'Sprinkler Images'.

I will create and execute a minimal SQL script `fix_sprinkler_support_minimal.sql` that:

1.  **Updates `create_work_order_folder_structure`**: Ensures this function creates the 'Sprinkler Images' folder, just as it creates the 'Before Images' folder.
2.  **Updates `get_upload_folder`**: Adds the 'sprinkler' case to the logic, mapping it to the 'Sprinkler Images' folder, exactly parallel to how 'before' maps to 'Before Images'.

I will **NOT** modify the `create_property_folder_structure` function or any RLS policies, preserving the existing folder hierarchy and permissions as requested. This targets strictly the missing sprinkler logic.

**Verification**:
I will execute the SQL script to apply the fix.
