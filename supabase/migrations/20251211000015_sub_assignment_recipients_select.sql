/*
  # Allow authenticated users to read sub assignment notification recipients

  Needed so subcontractors (and public decision pages) can load recipient list to send admin notifications.
*/

-- Ensure RLS read policy exists for authenticated users
CREATE POLICY IF NOT EXISTS "Authenticated can read sub assignment recipients"
  ON sub_assignment_notification_recipients
  FOR SELECT
  TO authenticated
  USING (true);
