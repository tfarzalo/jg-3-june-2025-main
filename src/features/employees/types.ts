import type { EmployeeFormStatus } from '../../../shared/employeeOnboarding';

export type EmployeeStatus = 'hired' | 'not_hired' | 'terminated' | 'on_leave';

export interface EmployeeRecord {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  position_title: string;
  employee_status: EmployeeStatus;
  interview_date: string | null;
  hire_date: string | null;
  start_date: string;
  internal_office_notes: string | null;
  onboarding_packet_sent_at: string | null;
  onboarding_packet_sent_by: string | null;
  linked_subcontractor_profile_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LinkedEmployeeProfileSummary {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
}

export interface EmployeeFormSubmissionRecord {
  id: string;
  employee_id: string;
  form_key: string;
  form_title: string;
  status: EmployeeFormStatus;
  sent_at: string | null;
  submitted_at: string | null;
  completed_at: string | null;
  form_payload: Record<string, unknown>;
  form_structure_snapshot: Record<string, unknown>;
  latest_pdf_file_id: string | null;
  pdf_revision: number;
  updated_at: string;
}

export interface EmployeeListItem extends EmployeeRecord {
  completed_forms_count: number;
  total_forms_count: number;
}

export interface EmployeePaperworkCounts {
  not_sent: number;
  sent: number;
  submitted: number;
  complete: number;
  total: number;
}

export interface EmployeeRosterItem {
  employee_id: string | null;
  profile_id: string | null;
  linked_profile_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  role: string;
  position_title: string;
  employee_status: EmployeeStatus;
  start_date: string | null;
  onboarding_packet_sent_at: string | null;
  paperwork_counts: EmployeePaperworkCounts;
  has_employee_record: boolean;
  source: 'profile' | 'employee';
}

export interface EmployeeProfileData {
  employee: EmployeeRecord;
  submissions: EmployeeFormSubmissionRecord[];
  linkedProfile: LinkedEmployeeProfileSummary | null;
}

export interface PublicEmployeeTokenAccess {
  employee: EmployeeRecord;
  formKey: string;
  status: EmployeeFormStatus;
  submittedAt: string | null;
  payload: Record<string, unknown>;
  alreadySubmitted: boolean;
  expiresAt: string;
}

export interface EmployeeEmailPreview {
  subject: string;
  html: string;
}
