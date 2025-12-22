-- Allow users to delete their own notifications (so dismiss/clear truly remove them)
DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;

CREATE POLICY "Users can delete their own notifications"
  ON notifications
  FOR DELETE
  USING (user_id = auth.uid());

