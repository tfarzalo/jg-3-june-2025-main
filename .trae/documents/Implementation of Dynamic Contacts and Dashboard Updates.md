I have successfully implemented the requested changes for the Subcontractor Dashboard and Property Information management.

### **1. Subcontractor Dashboard Updates**
*   **Dynamic Labeling**: The "Position / Job" label in the job details toggle is now dynamic. It displays the **Title/Position** of the contact (e.g., "Regional Manager") instead of the hardcoded text "Position / Job".
*   **Primary Contact Display**: It continues to show the First Name of the designated primary contact (Maintenance Supervisor).

### **2. Property Information & Details Management**
*   **Additional Contacts Support**: I have added a new "Additional Contacts" section to both the **Create Property** and **Edit Property** forms.
    *   **Add Contact Button**: Users can now add multiple contacts with Name, Position, Email, and Phone.
    *   **Primary Contact Selection**: Added a checkbox next to each contact. Selecting a contact as "Primary" automatically updates the main "Maintenance Supervisor" fields for the property. This ensures that the selected contact is the one displayed on the Subcontractor Dashboard.
*   **Property Details View**: The Property Details page now lists all "Additional Contacts" in the Contact Information section, ensuring full visibility of all team members associated with a property.

### **Verification**
*   **Dashboard**: Verified code to fetch and display `maintenance_supervisor_title`.
*   **Forms**: Verified implementation of dynamic contact list management and "Primary" sync logic.
*   **Data Persistence**: Confirmed that contacts are saved to the `property_contacts` table and the primary contact is synced to the `properties` table for backward compatibility and dashboard visibility.