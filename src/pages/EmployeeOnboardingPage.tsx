import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { CheckCircle2, FileWarning } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { EmployeeFormEditor } from '../components/employees/EmployeeFormEditor';
import { validateEmployeeOnboardingToken } from '../features/employees/api';
import type { PublicEmployeeTokenAccess } from '../features/employees/types';

export default function EmployeeOnboardingPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [access, setAccess] = useState<PublicEmployeeTokenAccess | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!token) {
        setError('This onboarding link is missing its token.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const result = await validateEmployeeOnboardingToken(token);
        setAccess(result);
      } catch (err) {
        console.error('Error validating onboarding token:', err);
        setError(err instanceof Error ? err.message : 'This onboarding link is invalid.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 px-4 py-10 dark:bg-[#0F172A]">
        <div className="mx-auto max-w-4xl rounded-2xl bg-white p-8 text-sm text-gray-500 shadow-sm dark:bg-[#111827]">
          Loading your onboarding form...
        </div>
      </div>
    );
  }

  if (error || !access) {
    return (
      <div className="min-h-screen bg-gray-100 px-4 py-10 dark:bg-[#0F172A]">
        <div className="mx-auto max-w-3xl rounded-2xl bg-white p-8 shadow-sm dark:bg-[#111827]">
          <div className="flex items-start gap-3">
            <FileWarning className="mt-1 h-5 w-5 text-red-500" />
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Unable to open onboarding form</h1>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{error || 'This onboarding link is not available.'}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (access.alreadySubmitted) {
    return (
      <div className="min-h-screen bg-gray-100 px-4 py-10 dark:bg-[#0F172A]">
        <div className="mx-auto max-w-3xl rounded-2xl bg-white p-8 shadow-sm dark:bg-[#111827]">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-1 h-5 w-5 text-green-600" />
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Form already submitted</h1>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                This onboarding form was already submitted on{' '}
                {access.submittedAt ? format(new Date(access.submittedAt), 'MMM d, yyyy h:mm a') : 'a previous visit'}.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-10 dark:bg-[#0F172A]">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-2xl bg-white p-8 shadow-sm dark:bg-[#111827]">
          <div className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-700 dark:bg-blue-950/40 dark:text-blue-200">
            JG Painting Pros
          </div>
          <h1 className="mt-4 text-3xl font-semibold text-gray-900 dark:text-white">Welcome to onboarding</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Complete the requested form for {access.employee.full_name}. This secure link expires on{' '}
            {format(new Date(access.expiresAt), 'MMM d, yyyy h:mm a')}.
          </p>
        </div>

        <EmployeeFormEditor
          employee={access.employee}
          formKey={access.formKey}
          initialValues={access.payload}
          initialStatus={access.status}
          mode="public"
          token={token}
          onSaved={(result) => {
            toast.success('Thank you. Your onboarding form has been submitted.');
            setAccess((current) =>
              current
                ? {
                    ...current,
                    alreadySubmitted: true,
                    status: result.status as PublicEmployeeTokenAccess['status'],
                    submittedAt: result.submittedAt,
                  }
                : current,
            );
          }}
        />
      </div>
    </div>
  );
}
