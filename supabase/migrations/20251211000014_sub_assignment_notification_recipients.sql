/*
  # Sub assignment notification recipients

  Stores admin/JG management users who should be notified when subcontractor assignments are accepted or declined.
*/

CREATE TABLE IF NOT EXISTS sub_assignment_notification_recipients (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Basic RLS
ALTER TABLE sub_assignment_notification_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage sub assignment recipients"
  ON sub_assignment_notification_recipients
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin','jg_management')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin','jg_management')
    )
  );
