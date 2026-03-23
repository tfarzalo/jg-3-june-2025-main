import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ArrowLeft, FileText, Mail, Phone, RefreshCw, Send } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { EMPLOYEE_FORM_STATUS_LABELS, countCompletedEmployeeForms, type EmployeeFormStatus } from '../../shared/employeeOnboarding';
import { EmployeeFormEditor } from './employees/EmployeeFormEditor';
import { Button } from './ui/Button';
import { getEmployeePdfUrl, getEmployeeProfile, sendEmployeeOnboardingPacket } from '../features/employees/api';
import type { EmployeeProfileData } from '../features/employees/types';

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

          <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">{profile.employee.full_name}</h1>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{profile.employee.position_title}</p>
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-300">
                <span className="inline-flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  {profile.employee.email}
                </span>
                {profile.employee.phone && (
                  <span className="inline-flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    {profile.employee.phone}
                  </span>
                )}
                <span>Start date: {format(new Date(profile.employee.start_date), 'MMM d, yyyy')}</span>
              </div>
            </div>

            <div className="rounded-2xl border border-teal-200 bg-teal-50 p-5 dark:border-teal-900 dark:bg-teal-950/30">
              <div className="text-sm font-medium text-teal-800 dark:text-teal-200">Onboarding summary</div>
              <div className="mt-2 text-3xl font-semibold text-teal-900 dark:text-white">
                {completedFormsCount}/{profile.submissions.length}
              </div>
              <p className="mt-2 text-sm text-teal-700 dark:text-teal-300">Forms marked complete.</p>
              <div className="mt-4">
                <Button icon={Send} onClick={() => handleSendPacket()} loading={sendingPacket}>
                  Send Onboarding Packet
                </Button>
              </div>
            </div>
          </div>
        </div>

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
      </div>
    </div>
  );
}

export default EmployeeProfile;
