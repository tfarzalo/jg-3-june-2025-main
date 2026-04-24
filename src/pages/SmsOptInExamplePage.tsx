import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, MessageSquareQuote } from 'lucide-react';
import { toast } from 'sonner';
import { SMS_OPT_IN_FORM_KEY } from '../../shared/employeeOnboarding';
import { EmployeeFormEditor } from '../components/employees/EmployeeFormEditor';
import type { EmployeeRecord } from '../features/employees/types';

const exampleEmployee: EmployeeRecord = {
  id: 'sms-opt-in-example',
  full_name: 'Jordan Example',
  email: 'jordan@example.com',
  phone: '704-555-0188',
  position_title: 'Field Painter',
  employee_status: 'hired',
  interview_date: null,
  hire_date: '2026-04-14',
  start_date: '2026-04-21',
  internal_office_notes: null,
  onboarding_packet_sent_at: null,
  onboarding_packet_sent_by: null,
  linked_subcontractor_profile_id: null,
  created_at: '2026-04-21T00:00:00.000Z',
  updated_at: '2026-04-21T00:00:00.000Z',
};

export default function SmsOptInExamplePage() {
  return (
    <div className="min-h-screen bg-gray-100 px-4 py-10 dark:bg-[#0F172A]">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-2xl bg-white p-8 shadow-sm dark:bg-[#111827]">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-700 dark:bg-blue-950/40 dark:text-blue-200">
            <MessageSquareQuote className="h-4 w-4" />
            Public SMS Opt-In Example
          </div>
          <h1 className="mt-4 text-3xl font-semibold text-gray-900 dark:text-white">
            Employee SMS Messaging Opt-In Form
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
            This public page demonstrates the same SMS consent form used in the employee onboarding flow. Production
            employee submissions use secure tokenized links and save directly into the employee documentation area.
          </p>
          <div className="mt-5 flex flex-wrap gap-3 text-sm">
            <Link
              to="/sms-consent"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 font-medium text-gray-700 transition hover:border-blue-300 hover:text-blue-700 dark:border-gray-700 dark:text-gray-200 dark:hover:border-blue-700 dark:hover:text-blue-300"
            >
              View SMS Policy
              <ExternalLink className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <EmployeeFormEditor
          employee={exampleEmployee}
          formKey={SMS_OPT_IN_FORM_KEY}
          initialStatus="submitted"
          mode="public"
          onSubmitOverride={() => {
            toast.success('Example only. Live employee links submit through the secure onboarding route.');
          }}
        />
      </div>
    </div>
  );
}
