export interface ChangelogEntry {
  date: string;
  type: 'feature' | 'fix' | 'enhancement' | 'update';
  title: string;
  description?: string;
}

export const changelog: ChangelogEntry[] = [
  {
    date: 'December 23, 2025',
    type: 'enhancement',
    title: 'Admin File Upload Limit Removal',
    description: 'Removed the 5MB file upload size limit for Admin and Management users, allowing for larger file uploads across the system.'
  },
  {
    date: 'December 23, 2025',
    type: 'enhancement',
    title: 'Job Import Improvements',
    description: 'Enhanced the Job Import Manager with better validation and file processing capabilities.'
  },
  {
    date: 'December 23, 2025',
    type: 'update',
    title: 'System Deployment & Performance',
    description: 'Deployed latest system updates and performance improvements to the main application repository.'
  },
  {
    date: 'November 24, 2025',
    type: 'fix',
    title: 'Critical Job Creation Fix',
    description: 'Fixed activity log trigger that was preventing new job requests from being created. Added comprehensive error handling to all database triggers.'
  },
  {
    date: 'November 24, 2025',
    type: 'enhancement',
    title: 'Job Phase Advancement',
    description: 'Job phase changes now update immediately without requiring a page refresh. Added loading indicators for better user feedback.'
  },
  {
    date: 'November 24, 2025',
    type: 'fix',
    title: 'Support Form Auto-Fill',
    description: 'Support ticket form now automatically populates with your name and email from your profile.'
  },
  {
    date: 'November 24, 2025',
    type: 'feature',
    title: 'Enhanced Notification System',
    description: 'Notifications now persist when you refresh the page. Pending Work Order notifications have special colored backgrounds.'
  },
  {
    date: 'November 24, 2025',
    type: 'enhancement',
    title: 'Wider Notification Dropdown',
    description: 'Made notification dropdown wider so phase badges display cleanly on one line.'
  },
  {
    date: 'November 24, 2025',
    type: 'feature',
    title: 'Activity Logging for Emails',
    description: 'System now logs when notification or extra charges emails are sent for Pending Work Order jobs.'
  },
  {
    date: 'November 18, 2025',
    type: 'feature',
    title: 'User Notifications',
    description: 'Added real-time notifications for job phase changes. You\'ll only see changes made by other users.'
  },
  {
    date: 'November 18, 2025',
    type: 'enhancement',
    title: 'Color-Coded Phase Badges',
    description: 'Job phase changes now show with color-coded badges matching your job phases.'
  },
  {
    date: 'November 18, 2025',
    type: 'feature',
    title: 'Mark All as Read',
    description: 'Added button to quickly mark all notifications as read.'
  },
  {
    date: 'November 13, 2025',
    type: 'fix',
    title: 'Calendar Feed Security',
    description: 'Fixed calendar feed authentication to work properly with external calendar apps.'
  },
  {
    date: 'November 13, 2025',
    type: 'enhancement',
    title: 'Improved Event Titles',
    description: 'Calendar events now show clearer titles with property names and unit numbers.'
  },
  {
    date: 'November 12, 2025',
    type: 'feature',
    title: 'Calendar Feed Subscriptions',
    description: 'Subscribe to your job schedules in your favorite calendar app (Google Calendar, Apple Calendar, Outlook).'
  },
  {
    date: 'November 10, 2025',
    type: 'enhancement',
    title: 'Improved Job Filtering',
    description: 'Enhanced job search and filtering capabilities for better workflow management.'
  },
  {
    date: 'November 8, 2025',
    type: 'fix',
    title: 'Invoice Generation',
    description: 'Fixed issues with invoice PDF generation and email delivery.'
  },
  {
    date: 'November 5, 2025',
    type: 'feature',
    title: 'Activity Timeline',
    description: 'Track all job changes and communications in a detailed activity timeline.'
  },
  {
    date: 'November 3, 2025',
    type: 'enhancement',
    title: 'Mobile Responsive Design',
    description: 'Improved mobile experience across all pages for on-the-go access.'
  },
  {
    date: 'November 1, 2025',
    type: 'feature',
    title: 'Approval Workflow',
    description: 'Streamlined approval process for property managers with email notifications and countdown timers.'
  },
  {
    date: 'October 28, 2025',
    type: 'fix',
    title: 'Email Delivery Improvements',
    description: 'Enhanced email reliability and delivery tracking for all system emails.'
  },
  {
    date: 'October 25, 2025',
    type: 'enhancement',
    title: 'Dashboard Analytics',
    description: 'Added comprehensive analytics and reporting to the main dashboard.'
  },
  {
    date: 'October 22, 2025',
    type: 'feature',
    title: 'Property Contact Management',
    description: 'Manage property owner and manager contacts directly from job details.'
  },
  {
    date: 'October 20, 2025',
    type: 'fix',
    title: 'Authentication Security',
    description: 'Enhanced security measures for user authentication and session management.'
  },
  {
    date: 'October 18, 2025',
    type: 'enhancement',
    title: 'Document Upload',
    description: 'Improved document upload interface with preview and drag-and-drop support.'
  },
  {
    date: 'October 15, 2025',
    type: 'feature',
    title: 'Extra Charges System',
    description: 'Added ability to add and track extra charges for jobs with client notifications.'
  },
  {
    date: 'October 12, 2025',
    type: 'enhancement',
    title: 'Dark Mode',
    description: 'Implemented system-wide dark mode for better viewing in low-light conditions.'
  },
  {
    date: 'October 10, 2025',
    type: 'feature',
    title: 'Job Phase Management',
    description: 'Comprehensive job phase tracking system with customizable phases and colors.'
  },
  {
    date: 'October 8, 2025',
    type: 'fix',
    title: 'Performance Optimization',
    description: 'Improved page load times and overall system performance.'
  },
  {
    date: 'October 5, 2025',
    type: 'feature',
    title: 'User Role Management',
    description: 'Advanced role-based access control for team members and administrators.'
  },
  {
    date: 'October 1, 2025',
    type: 'enhancement',
    title: 'Job Search',
    description: 'Enhanced search capabilities with filters for property, status, and date ranges.'
  }
];
