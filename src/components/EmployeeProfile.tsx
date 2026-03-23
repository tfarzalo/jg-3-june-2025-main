import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ArrowLeft, ExternalLink, FileText, Mail, Phone, RefreshCw, Save, Send, UserPlus } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { EMPLOYEE_FORM_STATUS_LABELS, countCompletedEmployeeForms, type EmployeeFormStatus } from '../../shared/employeeOnboarding';
import { EmployeeFormEditor } from './employees/EmployeeFormEditor';
import { Button } from './ui/Button';
import {
  createSubcontractorUserFromEmployee,
  getEmployeePdfUrl,
  getEmployeeProfile,
  previewEmployeeFormLink,
  previewEmployeeOnboardingEmail,
  sendEmployeeOnboardingPacket,
  updateEmployee,
} from '../features/employees/api';
import type { EmployeeEmailPreview, EmployeeProfileData, EmployeeRecord } from '../features/employees/types';

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

export function EmployeeProfile() {
  const navigate = useNavigate();
  const { employeeId } = useParams<{ employeeId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [profile, setProfile] = useState<EmployeeProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendingPacket, setSendingPacket] = useState(false);
  const [savingEmployee, setSavingEmployee] = useState(false);
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
    interview_date: '',
    hire_date: '',
    start_date: '',
    internal_office_notes: '',
  });
  const activeFormKey = searchParams.get('form');

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
      toast.success('Employee details saved.');
    } catch (error) {
      console.error('Error saving employee:', error);
      toast.error(error instanceof Error ? error.message : 'Unable to save employee details.');
    } finally {
      setSavingEmployee(false);
    }
  };

  const handlePreviewEmail = async () => {
    if (!employeeId) return;
    try {
      setPreviewingEmail(true);
      const preview = await previewEmployeeOnboardingEmail(employeeId);
      setEmailPreview(preview);
    } catch (error) {
      console.error('Error previewing onboarding email:', error);
      toast.error(error instanceof Error ? error.message : 'Unable to preview onboarding email.');
    } finally {
      setPreviewingEmail(false);
    }
  };

  const handlePreviewLink = async (formKey: string) => {
    if (!employeeId) return;
    try {
      setPreviewingLinkFormKey(formKey);
      const url = await previewEmployeeFormLink(employeeId, formKey);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Error previewing employee form link:', error);
      toast.error(error instanceof Error ? error.message : 'Unable to preview the form link.');
    } finally {
      setPreviewingLinkFormKey(null);
    }
  };

  const handleCreateSubcontractorUser = async () => {
    if (!profile) return;
    if (subcontractorPassword.length < 8) {
      toast.error('Password must be at least 8 characters long.');
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

  const linkedSubcontractorId = profile.employee.linked_subcontractor_profile_id;

  if (loading || !profile) {
    return (
      <div className="min-h-full bg-gray-100 px-6 py-6 dark:bg-[#0F172A]">
        <div className="mx-auto max-w-7xl rounded-2xl bg-white p-8 text-sm text-gray-500 shadow-sm dark:bg-[#111827]">
          Loading employee profile...
        </div>
      </div>
    );
  }

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

              <div className="flex flex-wrap gap-3">
                <Button icon={Save} onClick={handleSaveEmployee} loading={savingEmployee}>
                  Save Employee Details
                </Button>
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
                  >
                    Create Subcontractor User
                  </Button>
                )}
              </div>
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
          <div className="rounded-2xl bg-white p-6 shadow-sm dark:bg-[#111827]">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Onboarding email preview</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{emailPreview.subject}</p>
              </div>
              <Button variant="ghost" onClick={() => setEmailPreview(null)}>
                Close Preview
              </Button>
            </div>
            <div
              className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700"
              dangerouslySetInnerHTML={{ __html: emailPreview.html }}
            />
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
