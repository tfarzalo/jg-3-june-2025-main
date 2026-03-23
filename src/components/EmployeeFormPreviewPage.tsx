import React, { useEffect, useState } from 'react';
import { ArrowLeft, Eye } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { EmployeeFormEditor } from './employees/EmployeeFormEditor';
import { getEmployeeProfile } from '../features/employees/api';
import type { EmployeeProfileData } from '../features/employees/types';
import { Button } from './ui/Button';

export function EmployeeFormPreviewPage() {
  const navigate = useNavigate();
  const { employeeId, formKey } = useParams<{ employeeId: string; formKey: string }>();
  const [profile, setProfile] = useState<EmployeeProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async () => {
    if (!employeeId) return;
    try {
      setLoading(true);
      const data = await getEmployeeProfile(employeeId);
      setProfile(data);
    } catch (error) {
      console.error('Error loading employee form preview:', error);
      toast.error('Unable to load employee form preview.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [employeeId]);

  if (loading) {
    return (
      <div className="min-h-full bg-gray-100 px-6 py-6 dark:bg-[#0F172A]">
        <div className="mx-auto max-w-5xl rounded-2xl bg-white p-8 text-sm text-gray-500 shadow-sm dark:bg-[#111827]">
          Loading form preview...
        </div>
      </div>
    );
  }

  if (!profile || !formKey) {
    return (
      <div className="min-h-full bg-gray-100 px-6 py-6 dark:bg-[#0F172A]">
        <div className="mx-auto max-w-5xl rounded-2xl bg-white p-8 text-sm text-red-600 shadow-sm dark:bg-[#111827] dark:text-red-300">
          Unable to load this employee form preview.
        </div>
      </div>
    );
  }

  const submission = profile.submissions.find((item) => item.form_key === formKey);

  if (!submission) {
    return (
      <div className="min-h-full bg-gray-100 px-6 py-6 dark:bg-[#0F172A]">
        <div className="mx-auto max-w-5xl rounded-2xl bg-white p-8 text-sm text-red-600 shadow-sm dark:bg-[#111827] dark:text-red-300">
          This employee form preview is not available.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gray-100 px-6 py-6 dark:bg-[#0F172A]">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-2xl bg-white p-6 shadow-sm dark:bg-[#111827]">
          <button
            type="button"
            onClick={() => navigate(`/dashboard/employees/${employeeId}`)}
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Employee Profile
          </button>

          <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-700 dark:bg-blue-950/40 dark:text-blue-200">
                <Eye className="h-4 w-4" />
                Admin Form Preview
              </div>
              <h1 className="mt-3 text-3xl font-semibold text-gray-900 dark:text-white">{submission.form_title}</h1>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                This preview uses the internal admin route. Employee email links still use secure tokenized URLs.
              </p>
            </div>
            <Button variant="ghost" onClick={() => navigate(`/dashboard/employees/${employeeId}?form=${formKey}`)}>
              Open In Profile Editor
            </Button>
          </div>
        </div>

        <EmployeeFormEditor
          employee={profile.employee}
          formKey={submission.form_key}
          initialValues={submission.form_payload}
          initialStatus={submission.status}
          mode="admin"
          onSaved={() => {
            void loadProfile();
          }}
        />
      </div>
    </div>
  );
}

export default EmployeeFormPreviewPage;
