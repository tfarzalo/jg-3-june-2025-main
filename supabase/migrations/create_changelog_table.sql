-- Create changelog table
CREATE TABLE IF NOT EXISTS changelog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('feature', 'fix', 'enhancement', 'update')),
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  is_published BOOLEAN DEFAULT true
);

-- Create index for faster queries
CREATE INDEX idx_changelog_date ON changelog(date DESC);
CREATE INDEX idx_changelog_type ON changelog(type);
CREATE INDEX idx_changelog_published ON changelog(is_published);

-- Enable RLS
ALTER TABLE changelog ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read published changelog entries
CREATE POLICY "Anyone can view published changelog entries"
  ON changelog
  FOR SELECT
  USING (is_published = true);

-- Policy: Admins can insert changelog entries
CREATE POLICY "Admins can insert changelog entries"
  ON changelog
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'jg_management')
    )
  );

-- Policy: Admins can update changelog entries
CREATE POLICY "Admins can update changelog entries"
  ON changelog
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'jg_management')
    )
  );

-- Policy: Admins can delete changelog entries
CREATE POLICY "Admins can delete changelog entries"
  ON changelog
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'jg_management')
    )
  );

-- Insert existing changelog data
INSERT INTO changelog (date, type, title, description, is_published) VALUES
  ('2025-11-24', 'feature', 'Enhanced Notification System', 'Notifications now persist when you refresh the page. Pending Work Order notifications have special colored backgrounds.', true),
  ('2025-11-24', 'enhancement', 'Wider Notification Dropdown', 'Made notification dropdown wider so phase badges display cleanly on one line.', true),
  ('2025-11-24', 'feature', 'Activity Logging for Emails', 'System now logs when notification or extra charges emails are sent for Pending Work Order jobs.', true),
  ('2025-11-18', 'feature', 'User Notifications', 'Added real-time notifications for job phase changes. You''ll only see changes made by other users.', true),
  ('2025-11-18', 'enhancement', 'Color-Coded Phase Badges', 'Job phase changes now show with color-coded badges matching your job phases.', true),
  ('2025-11-18', 'feature', 'Mark All as Read', 'Added button to quickly mark all notifications as read.', true),
  ('2025-11-13', 'fix', 'Calendar Feed Security', 'Fixed calendar feed authentication to work properly with external calendar apps.', true),
  ('2025-11-13', 'enhancement', 'Improved Event Titles', 'Calendar events now show clearer titles with property names and unit numbers.', true),
  ('2025-11-12', 'feature', 'Calendar Feed Subscriptions', 'Subscribe to your job schedules in your favorite calendar app (Google Calendar, Apple Calendar, Outlook).', true),
  ('2025-11-10', 'enhancement', 'Improved Job Filtering', 'Enhanced job search and filtering capabilities for better workflow management.', true),
  ('2025-11-08', 'fix', 'Invoice Generation', 'Fixed issues with invoice PDF generation and email delivery.', true),
  ('2025-11-05', 'feature', 'Activity Timeline', 'Track all job changes and communications in a detailed activity timeline.', true),
  ('2025-11-03', 'enhancement', 'Mobile Responsive Design', 'Improved mobile experience across all pages for on-the-go access.', true),
  ('2025-11-01', 'feature', 'Approval Workflow', 'Streamlined approval process for property managers with email notifications and countdown timers.', true),
  ('2025-10-28', 'fix', 'Email Delivery Improvements', 'Enhanced email reliability and delivery tracking for all system emails.', true),
  ('2025-10-25', 'enhancement', 'Dashboard Analytics', 'Added comprehensive analytics and reporting to the main dashboard.', true),
  ('2025-10-22', 'feature', 'Property Contact Management', 'Manage property owner and manager contacts directly from job details.', true),
  ('2025-10-20', 'fix', 'Authentication Security', 'Enhanced security measures for user authentication and session management.', true),
  ('2025-10-18', 'enhancement', 'Document Upload', 'Improved document upload interface with preview and drag-and-drop support.', true),
  ('2025-10-15', 'feature', 'Extra Charges System', 'Added ability to add and track extra charges for jobs with client notifications.', true),
  ('2025-10-12', 'enhancement', 'Dark Mode', 'Implemented system-wide dark mode for better viewing in low-light conditions.', true),
  ('2025-10-10', 'feature', 'Job Phase Management', 'Comprehensive job phase tracking system with customizable phases and colors.', true),
  ('2025-10-08', 'fix', 'Performance Optimization', 'Improved page load times and overall system performance.', true),
  ('2025-10-05', 'feature', 'User Role Management', 'Advanced role-based access control for team members and administrators.', true),
  ('2025-10-01', 'enhancement', 'Job Search', 'Enhanced search capabilities with filters for property, status, and date ranges.', true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_changelog_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_changelog_updated_at_trigger
  BEFORE UPDATE ON changelog
  FOR EACH ROW
  EXECUTE FUNCTION update_changelog_updated_at();
