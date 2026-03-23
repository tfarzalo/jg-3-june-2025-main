import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ArrowLeft, ExternalLink, FileText, Mail, PenSquare, Phone, RefreshCw, Save, Send, UserPlus, X } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { EMPLOYEE_FORM_STATUS_LABELS, countCompletedEmployeeForms, type EmployeeFormStatus } from '../../shared/employeeOnboarding';
import { EmployeeFormEditor } from './employees/EmployeeFormEditor';
import { Button } from './ui/Button';
import {
  createSubcontractorUserFromEmployee,
  getEmployeePdfUrl,
  getEmployeeProfile,
  sendEmployeeOnboardingPacket,
  updateEmployee,
} from '../features/employees/api';
import type { EmployeeEmailPreview, EmployeeProfileData, EmployeeRecord, EmployeeStatus } from '../features/employees/types';

const EMPLOYEE_STATUS_OPTIONS: Array<{ value: EmployeeStatus; label: string }> = [
  { value: 'not_hired', label: 'Not Hired' },
  { value: 'hired', label: 'Hired' },
  { value: 'on_leave', label: 'On Leave' },
  { value: 'terminated', label: 'Terminated' },
];

const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  hired: 'Hired',
  not_hired: 'Not Hired',
  terminated: 'Terminated',
  on_leave: 'On Leave',
};

const statusClasses: Record<EmployeeFormStatus, string> = {
  not_sent: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200',
  sent: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
  submitted: 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200',
  complete: 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-200',
};

const formatDateTime = (value: string | null) => {
  if (!value) return 'Not available';
  try {
    return format(new Date(value), 'MMM d, yyyy h:mm a');
  } catch {
    return value;
  }
};

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

export function EmployeeProfile() {
  const navigate = useNavigate();
  const { employeeId } = useParams<{ employeeId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [profile, setProfile] = useState<EmployeeProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendingPacket, setSendingPacket] = useState(false);
  const [savingEmployee, setSavingEmployee] = useState(false);
  const [isEditingEmployee, setIsEditingEmployee] = useState(false);
  const [previewingEmail, setPreviewingEmail] = useState(false);
  const [previewingLinkFormKey, setPreviewingLinkFormKey] = useState<string | null>(null);
  const [creatingSubcontractor, setCreatingSubcontractor] = useState(false);
  const [subcontractorPassword, setSubcontractorPassword] = useState('');
  const [confirmSubcontractorPassword, setConfirmSubcontractorPassword] = useState('');
  const [showCreateSubcontractorModal, setShowCreateSubcontractorModal] = useState(false);
  const [emailPreview, setEmailPreview] = useState<EmployeeEmailPreview | null>(null);
  const [employeeForm, setEmployeeForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    position_title: '',
    employee_status: 'not_hired' as EmployeeStatus,
    interview_date: '',
    hire_date: '',
    start_date: '',
    internal_office_notes: '',
  });
  const activeFormKey = searchParams.get('form');

  const buildAdminFormPreviewUrl = (formKey: string) => {
    const cleanOrigin = window.location.origin.replace(/\/$/, '');
    return `${cleanOrigin}/dashboard/employees/${employeeId}/forms/${formKey}/preview`;
  };

  const fetchProfile = async () => {
    if (!employeeId) return;
    try {
      setLoading(true);
      const data = await getEmployeeProfile(employeeId);
      setProfile(data);
    } catch (error) {
      console.error('Error loading employee profile:', error);
      toast.error('Unable to load employee profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [employeeId]);

  useEffect(() => {
    if (!profile) return;
    setEmployeeForm({
      full_name: profile.employee.full_name || '',
      email: profile.employee.email || '',
      phone: profile.employee.phone || '',
      position_title: profile.employee.position_title || '',
      employee_status: profile.employee.employee_status || 'not_hired',
      interview_date: profile.employee.interview_date || '',
      hire_date: profile.employee.hire_date || '',
      start_date: profile.employee.start_date || '',
      internal_office_notes: profile.employee.internal_office_notes || '',
    });
  }, [profile]);

  const completedFormsCount = useMemo(
    () => countCompletedEmployeeForms(profile?.submissions || []),
    [profile?.submissions],
  );

  const activeSubmission = profile?.submissions.find((submission) => submission.form_key === activeFormKey) || null;

  const handleSendPacket = async (formKey?: string) => {
    if (!employeeId) return;
    try {
      setSendingPacket(true);
      await sendEmployeeOnboardingPacket({
        employeeId,
        formKey,
        regenerate: true,
        baseUrl: window.location.origin,
      });
      toast.success(formKey ? 'Form link resent.' : 'Onboarding packet sent.');
      await fetchProfile();
    } catch (error) {
      console.error('Error sending onboarding packet:', error);
      toast.error(error instanceof Error ? error.message : 'Unable to send onboarding email.');
    } finally {
      setSendingPacket(false);
    }
  };

  const handleOpenPdf = async (formKey: string) => {
    if (!employeeId) return;
    try {
      const url = await getEmployeePdfUrl(employeeId, formKey);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Error opening PDF:', error);
      toast.error(error instanceof Error ? error.message : 'Unable to open PDF.');
    }
  };

  const handleSaveEmployee = async () => {
    if (!employeeId) return;
    try {
      setSavingEmployee(true);
      const updated = await updateEmployee(employeeId, {
        ...employeeForm,
        phone: employeeForm.phone || null,
        interview_date: employeeForm.interview_date || null,
        hire_date: employeeForm.hire_date || null,
        internal_office_notes: employeeForm.internal_office_notes || null,
      });
      setProfile((current) =>
        current
          ? {
              ...current,
              employee: updated,
            }
          : current,
      );
      setIsEditingEmployee(false);
      toast.success('Employee details saved.');
    } catch (error) {
      console.error('Error saving employee:', error);
      toast.error(error instanceof Error ? error.message : 'Unable to save employee details.');
    } finally {
      setSavingEmployee(false);
    }
  };

  const handleCancelEmployeeEdit = () => {
    if (!profile) return;
    setEmployeeForm({
      full_name: profile.employee.full_name || '',
      email: profile.employee.email || '',
      phone: profile.employee.phone || '',
      position_title: profile.employee.position_title || '',
      employee_status: profile.employee.employee_status || 'not_hired',
      interview_date: profile.employee.interview_date || '',
      hire_date: profile.employee.hire_date || '',
      start_date: profile.employee.start_date || '',
      internal_office_notes: profile.employee.internal_office_notes || '',
    });
    setIsEditingEmployee(false);
  };

  const handlePreviewEmail = async () => {
    if (!profile || !employeeId) return;
    try {
      setPreviewingEmail(true);
      const linksMarkup = profile.submissions
        .map(
          (submission) => `
            <li style="margin-bottom: 12px;">
              <a href="${buildAdminFormPreviewUrl(submission.form_key)}" style="color: #0f766e; font-weight: 600; text-decoration: none;">
                ${escapeHtml(submission.form_title)}
              </a>
              <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">
                Admin preview route. Sent emails use secure employee-specific links.
              </div>
            </li>
          `,
        )
        .join('');

      setEmailPreview({
        subject: 'Welcome to JG Painting Pros - onboarding packet',
        html: `
          <div style="font-family: Arial, sans-serif; background: #f3f4f6; padding: 32px;">
            <div style="max-width: 680px; margin: 0 auto; background: white; border-radius: 18px; overflow: hidden; border: 1px solid #e5e7eb;">
              <div style="padding: 28px 32px; background: linear-gradient(135deg, #0f766e, #1d4ed8); color: white;">
                <div style="font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; font-weight: 700; opacity: 0.9;">JG Painting Pros</div>
                <h1 style="margin: 14px 0 8px; font-size: 28px; line-height: 1.1;">Welcome to the team</h1>
                <p style="margin: 0; font-size: 15px; line-height: 1.6; opacity: 0.95;">Your onboarding packet is ready. Each form link below is unique to you and remains active for 30 days.</p>
              </div>
              <div style="padding: 28px 32px;">
                <p style="margin-top: 0; font-size: 15px; color: #111827;">Hello ${escapeHtml(profile.employee.full_name)},</p>
                <p style="font-size: 15px; line-height: 1.7; color: #374151;">
                  Please complete the required onboarding paperwork for your role as ${escapeHtml(profile.employee.position_title)}. Submit each item using the secure links below. Your responses will be automatically matched to your employee record inside the JG Painting Pros portal.
                </p>
                <div style="margin: 24px 0; padding: 20px; border-radius: 14px; background: #f9fafb; border: 1px solid #e5e7eb;">
                  <div style="font-size: 14px; font-weight: 700; color: #111827; margin-bottom: 12px;">Required forms</div>
                  <ol style="margin: 0; padding-left: 18px; color: #111827;">
                    ${linksMarkup}
                  </ol>
                </div>
                <p style="font-size: 14px; line-height: 1.7; color: #4b5563;">
                  If you have any trouble accessing a form, reply to this email and the admin team will resend a fresh link.
                </p>
                <p style="font-size: 14px; line-height: 1.7; color: #4b5563; margin-bottom: 0;">
                  Thank you,<br />
                  JG Painting Pros Admin
                </p>
              </div>
            </div>
          </div>
        `,
      });
    } catch (error) {
      console.error('Error previewing onboarding email:', error);
      toast.error(error instanceof Error ? error.message : 'Unable to preview onboarding email.');
    } finally {
      setPreviewingEmail(false);
    }
  };

  const handlePreviewLink = async (formKey: string) => {
    if (!employeeId) return;
    const previewWindow = window.open(buildAdminFormPreviewUrl(formKey), '_blank', 'noopener,noreferrer');
    if (!previewWindow) {
      toast.error('Allow pop-ups in your browser to preview the onboarding form.');
      return;
    }
    setPreviewingLinkFormKey(formKey);
    window.setTimeout(() => setPreviewingLinkFormKey((current) => (current === formKey ? null : current)), 250);
  };

  const handleCreateSubcontractorUser = async () => {
    if (!profile) return;
    if (subcontractorPassword.length < 8) {
      toast.error('Password must be at least 8 characters long.');
      return;
    }
    if (profile.employee.employee_status !== 'hired') {
      toast.error('Mark the employee as Hired before creating a subcontractor user.');
      return;
    }
    if (subcontractorPassword !== confirmSubcontractorPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    try {
      setCreatingSubcontractor(true);
      const profileId = await createSubcontractorUserFromEmployee({
        employee: profile.employee,
        password: subcontractorPassword,
      });
      toast.success('Subcontractor user created.');
      setShowCreateSubcontractorModal(false);
      setSubcontractorPassword('');
      setConfirmSubcontractorPassword('');
      await fetchProfile();
      navigate(`/dashboard/subcontractor/edit/${profileId}`);
    } catch (error) {
      console.error('Error creating subcontractor user from employee:', error);
      toast.error(error instanceof Error ? error.message : 'Unable to create subcontractor user.');
    } finally {
      setCreatingSubcontractor(false);
    }
  };

  if (loading || !profile) {
    return (
      <div className="min-h-full bg-gray-100 px-6 py-6 dark:bg-[#0F172A]">
        <div className="mx-auto max-w-7xl rounded-2xl bg-white p-8 text-sm text-gray-500 shadow-sm dark:bg-[#111827]">
          Loading employee profile...
        </div>
      </div>
    );
  }

  const linkedSubcontractorId = profile.employee.linked_subcontractor_profile_id;
  const canCreateSubcontractorUser = profile.employee.employee_status === 'hired' && !linkedSubcontractorId;

  return (
    <div className="min-h-full bg-gray-100 px-6 py-6 dark:bg-[#0F172A]">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-2xl bg-white p-6 shadow-sm dark:bg-[#111827]">
          <button
            type="button"
            onClick={() => navigate('/dashboard/employees')}
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Employees
          </button>

          <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_360px]">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Employee details</h2>
                {isEditingEmployee ? (
                  <div className="flex gap-2">
                    <Button variant="ghost" icon={X} onClick={handleCancelEmployeeEdit}>
                      Cancel
                    </Button>
                    <Button icon={Save} onClick={handleSaveEmployee} loading={savingEmployee}>
                      Save
                    </Button>
                  </div>
                ) : (
                  <Button variant="ghost" icon={PenSquare} onClick={() => setIsEditingEmployee(true)}>
                    Edit
                  </Button>
                )}
              </div>

              {isEditingEmployee ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Employee name</label>
                    <input
                      value={employeeForm.full_name}
                      onChange={(event) => setEmployeeForm((current) => ({ ...current, full_name: event.target.value }))}
                      className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-[#0F172A] dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Email</label>
                    <input
                      type="email"
                      value={employeeForm.email}
                      onChange={(event) => setEmployeeForm((current) => ({ ...current, email: event.target.value }))}
                      className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-[#0F172A] dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Phone</label>
                    <input
                      value={employeeForm.phone}
                      onChange={(event) => setEmployeeForm((current) => ({ ...current, phone: event.target.value }))}
                      className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-[#0F172A] dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Position / title</label>
                    <input
                      value={employeeForm.position_title}
                      onChange={(event) => setEmployeeForm((current) => ({ ...current, position_title: event.target.value }))}
                      className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-[#0F172A] dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Employee status</label>
                    <select
                      value={employeeForm.employee_status}
                      onChange={(event) => setEmployeeForm((current) => ({ ...current, employee_status: event.target.value as EmployeeStatus }))}
                      className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-[#0F172A] dark:text-white"
                    >
                      {EMPLOYEE_STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Interview date</label>
                    <input
                      type="date"
                      value={employeeForm.interview_date}
                      onChange={(event) => setEmployeeForm((current) => ({ ...current, interview_date: event.target.value }))}
                      className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-[#0F172A] dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Hire date</label>
                    <input
                      type="date"
                      value={employeeForm.hire_date}
                      onChange={(event) => setEmployeeForm((current) => ({ ...current, hire_date: event.target.value }))}
                      className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-[#0F172A] dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Start date</label>
                    <input
                      type="date"
                      value={employeeForm.start_date}
                      onChange={(event) => setEmployeeForm((current) => ({ ...current, start_date: event.target.value }))}
                      className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-[#0F172A] dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Sent onboarding forms</label>
                    <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-[#0F172A] dark:text-gray-200">
                      {profile.employee.onboarding_packet_sent_at
                        ? format(new Date(profile.employee.onboarding_packet_sent_at), 'MMM d, yyyy h:mm a')
                        : 'Not sent yet'}
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Internal office notes</label>
                    <textarea
                      value={employeeForm.internal_office_notes}
                      onChange={(event) => setEmployeeForm((current) => ({ ...current, internal_office_notes: event.target.value }))}
                      rows={4}
                      className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-[#0F172A] dark:text-white"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-[#0F172A]">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Employee name</div>
                    <div className="mt-2 text-sm text-gray-900 dark:text-white">{profile.employee.full_name || 'Not provided'}</div>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-[#0F172A]">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Email</div>
                    <div className="mt-2 text-sm text-gray-900 dark:text-white">{profile.employee.email || 'Not provided'}</div>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-[#0F172A]">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Phone</div>
                    <div className="mt-2 text-sm text-gray-900 dark:text-white">{profile.employee.phone || 'Not provided'}</div>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-[#0F172A]">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Position / title</div>
                    <div className="mt-2 text-sm text-gray-900 dark:text-white">{profile.employee.position_title || 'Not provided'}</div>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-[#0F172A]">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Employee status</div>
                    <div className="mt-2 text-sm text-gray-900 dark:text-white">{EMPLOYEE_STATUS_LABELS[profile.employee.employee_status]}</div>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-[#0F172A]">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Interview date</div>
                    <div className="mt-2 text-sm text-gray-900 dark:text-white">
                      {profile.employee.interview_date ? format(new Date(profile.employee.interview_date), 'MMM d, yyyy') : 'Not provided'}
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-[#0F172A]">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Hire date</div>
                    <div className="mt-2 text-sm text-gray-900 dark:text-white">
                      {profile.employee.hire_date ? format(new Date(profile.employee.hire_date), 'MMM d, yyyy') : 'Not provided'}
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-[#0F172A]">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Start date</div>
                    <div className="mt-2 text-sm text-gray-900 dark:text-white">
                      {profile.employee.start_date ? format(new Date(profile.employee.start_date), 'MMM d, yyyy') : 'Not provided'}
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-[#0F172A]">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Sent onboarding forms</div>
                    <div className="mt-2 text-sm text-gray-900 dark:text-white">
                      {profile.employee.onboarding_packet_sent_at
                        ? format(new Date(profile.employee.onboarding_packet_sent_at), 'MMM d, yyyy h:mm a')
                        : 'Not sent yet'}
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 md:col-span-2 dark:border-gray-700 dark:bg-[#0F172A]">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Internal office notes</div>
                    <div className="mt-2 whitespace-pre-wrap text-sm text-gray-900 dark:text-white">
                      {profile.employee.internal_office_notes || 'No notes yet'}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <Button variant="secondary" icon={Mail} onClick={handlePreviewEmail} loading={previewingEmail}>
                  Preview Email
                </Button>
                <Button icon={Send} onClick={() => handleSendPacket()} loading={sendingPacket}>
                  Send Onboarding Packet
                </Button>
                {linkedSubcontractorId ? (
                  <Button
                    variant="ghost"
                    icon={ExternalLink}
                    onClick={() => navigate(`/dashboard/subcontractor/edit/${linkedSubcontractorId}`)}
                  >
                    Open Linked Subcontractor
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    icon={UserPlus}
                    onClick={() => setShowCreateSubcontractorModal(true)}
                    disabled={!canCreateSubcontractorUser}
                  >
                    Create Subcontractor User
                  </Button>
                )}
              </div>
              {!canCreateSubcontractorUser && !linkedSubcontractorId && (
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Mark this employee as Hired before creating a subcontractor user.
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-teal-200 bg-teal-50 p-5 dark:border-teal-900 dark:bg-teal-950/30">
              <div className="text-sm font-medium text-teal-800 dark:text-teal-200">Onboarding summary</div>
              <div className="mt-2 text-3xl font-semibold text-teal-900 dark:text-white">
                {completedFormsCount}/{profile.submissions.length}
              </div>
              <p className="mt-2 text-sm text-teal-700 dark:text-teal-300">Forms marked complete.</p>
              <div className="mt-4 space-y-3 text-sm text-teal-800 dark:text-teal-200">
                <div className="inline-flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  {profile.employee.email}
                </div>
                {profile.employee.phone && (
                  <div className="inline-flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    {profile.employee.phone}
                  </div>
                )}
                <div>Linked subcontractor: {linkedSubcontractorId ? 'Yes' : 'No'}</div>
              </div>
            </div>
          </div>
        </div>

        {emailPreview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
            <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-[#111827]">
              <div className="flex items-center justify-between gap-4 border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Onboarding email preview</h2>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{emailPreview.subject}</p>
                </div>
                <Button variant="ghost" onClick={() => setEmailPreview(null)}>
                  Close Preview
                </Button>
              </div>
              <div className="max-h-[calc(90vh-88px)] overflow-auto p-6">
                <div
                  className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700"
                  dangerouslySetInnerHTML={{ __html: emailPreview.html }}
                />
              </div>
            </div>
          </div>
        )}

        <div className="rounded-2xl bg-white shadow-sm dark:bg-[#111827]">
          <div className="border-b border-gray-200 px-6 py-5 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Onboarding checklist</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              One row per required form, including current status, submission time, and review actions.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-[#0F172A]">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Form</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Submission Date</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {profile.submissions.map((submission) => (
                  <tr key={submission.id}>
                    <td className="px-6 py-5">
                      <div className="font-medium text-gray-900 dark:text-white">{submission.form_title}</div>
                      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">Revision {submission.pdf_revision || 0}</div>
                    </td>
                    <td className="px-6 py-5">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[submission.status]}`}>
                        {EMPLOYEE_FORM_STATUS_LABELS[submission.status]}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-sm text-gray-700 dark:text-gray-300">
                      {formatDateTime(submission.completed_at || submission.submitted_at || submission.sent_at)}
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={FileText}
                          disabled={!submission.latest_pdf_file_id}
                          onClick={() => handleOpenPdf(submission.form_key)}
                        >
                          View PDF
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSearchParams(new URLSearchParams({ form: submission.form_key }))}
                        >
                          Edit Submission
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handlePreviewLink(submission.form_key)}
                          loading={previewingLinkFormKey === submission.form_key}
                        >
                          Preview Link
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={RefreshCw}
                          onClick={() => handleSendPacket(submission.form_key)}
                          loading={sendingPacket}
                        >
                          Resend Link
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {activeSubmission && (
          <div className="rounded-2xl bg-white p-6 shadow-sm dark:bg-[#111827]">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Edit submission</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{activeSubmission.form_title}</p>
              </div>
              <Button
                variant="ghost"
                onClick={() => {
                  const nextParams = new URLSearchParams(searchParams);
                  nextParams.delete('form');
                  setSearchParams(nextParams);
                }}
              >
                Close Editor
              </Button>
            </div>

            <EmployeeFormEditor
              key={`${activeSubmission.form_key}-${activeSubmission.updated_at}`}
              employee={profile.employee}
              formKey={activeSubmission.form_key}
              initialValues={activeSubmission.form_payload}
              initialStatus={activeSubmission.status}
              mode="admin"
              onSaved={async () => {
                await fetchProfile();
              }}
            />
          </div>
        )}

        {showCreateSubcontractorModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-[#111827]">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Create Subcontractor User</h2>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                This will create a subcontractor login using the employee name and email, then link that user back to this employee entry.
              </p>

              <div className="mt-6 grid gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Temporary password</label>
                  <input
                    type="password"
                    value={subcontractorPassword}
                    onChange={(event) => setSubcontractorPassword(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-[#0F172A] dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Confirm password</label>
                  <input
                    type="password"
                    value={confirmSubcontractorPassword}
                    onChange={(event) => setConfirmSubcontractorPassword(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-[#0F172A] dark:text-white"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setShowCreateSubcontractorModal(false)}>
                  Cancel
                </Button>
                <Button icon={UserPlus} onClick={handleCreateSubcontractorUser} loading={creatingSubcontractor}>
                  Create User
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default EmployeeProfile;
