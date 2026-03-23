import { EMPLOYEE_FORM_KEYS } from '../../../shared/employeeOnboarding';
import { supabase } from '../../utils/supabase';
import type {
  EmployeeListItem,
  EmployeeProfileData,
  EmployeeRecord,
  EmployeeFormSubmissionRecord,
  PublicEmployeeTokenAccess,
} from './types';

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/employee-onboarding`;

const sortSubmissionRecords = (items: EmployeeFormSubmissionRecord[]) => {
  const order = new Map(EMPLOYEE_FORM_KEYS.map((key, index) => [key, index]));
  return [...items].sort((a, b) => (order.get(a.form_key) ?? 999) - (order.get(b.form_key) ?? 999));
};

const getAuthHeaders = async () => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('You must be signed in to perform this action.');
  }

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  };
};

const invokeEmployeeOnboardingFunction = async <T>(
  body: Record<string, unknown>,
  requireAuth = true,
): Promise<T> => {
  const headers = requireAuth ? await getAuthHeaders() : { 'Content-Type': 'application/json' };
  const response = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const payload = await response.json();

  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error || 'Employee onboarding request failed.');
  }

  return payload as T;
};

export const listEmployees = async (): Promise<EmployeeListItem[]> => {
  const { data: employees, error: employeesError } = await supabase
    .from('employees')
    .select('*')
    .order('created_at', { ascending: false });

  if (employeesError) {
    throw employeesError;
  }

  const { data: submissions, error: submissionsError } = await supabase
    .from('employee_form_submissions')
    .select('employee_id, status');

  if (submissionsError) {
    throw submissionsError;
  }

  const counts = new Map<string, { complete: number; total: number }>();

  (submissions || []).forEach((submission: { employee_id: string; status: string }) => {
    const current = counts.get(submission.employee_id) || { complete: 0, total: 0 };
    current.total += 1;
    if (submission.status === 'complete') {
      current.complete += 1;
    }
    counts.set(submission.employee_id, current);
  });

  return (employees || []).map((employee: EmployeeRecord) => {
    const employeeCounts = counts.get(employee.id) || { complete: 0, total: EMPLOYEE_FORM_KEYS.length };
    return {
      ...employee,
      completed_forms_count: employeeCounts.complete,
      total_forms_count: employeeCounts.total || EMPLOYEE_FORM_KEYS.length,
    };
  });
};

export const createEmployee = async (input: {
  full_name: string;
  email: string;
  phone: string;
  position_title: string;
  start_date: string;
}): Promise<EmployeeRecord> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const payload = {
    ...input,
    phone: input.phone || null,
    updated_by: user?.id || null,
  };

  const { data, error } = await supabase.from('employees').insert(payload).select('*').single();

  if (error) {
    throw error;
  }

  return data as EmployeeRecord;
};

export const getEmployeeProfile = async (employeeId: string): Promise<EmployeeProfileData> => {
  const { data: employee, error: employeeError } = await supabase
    .from('employees')
    .select('*')
    .eq('id', employeeId)
    .single();

  if (employeeError) {
    throw employeeError;
  }

  const { data: submissions, error: submissionsError } = await supabase
    .from('employee_form_submissions')
    .select('*')
    .eq('employee_id', employeeId);

  if (submissionsError) {
    throw submissionsError;
  }

  return {
    employee: employee as EmployeeRecord,
    submissions: sortSubmissionRecords((submissions || []) as EmployeeFormSubmissionRecord[]),
  };
};

export const sendEmployeeOnboardingPacket = async (params: {
  employeeId: string;
  formKey?: string;
  regenerate?: boolean;
  baseUrl?: string;
}) =>
  invokeEmployeeOnboardingFunction<{
    success: true;
    message: string;
    linksSent: number;
  }>({
    action: 'send_packet',
    employeeId: params.employeeId,
    formKey: params.formKey,
    regenerate: params.regenerate ?? true,
    baseUrl: params.baseUrl || window.location.origin,
  });

export const getEmployeePdfUrl = async (employeeId: string, formKey: string) => {
  const result = await invokeEmployeeOnboardingFunction<{
    success: true;
    signedUrl: string;
  }>({
    action: 'pdf_url',
    employeeId,
    formKey,
  });

  return result.signedUrl;
};

export const saveEmployeeFormSubmission = async (params: {
  employeeId?: string;
  formKey: string;
  token?: string;
  payload: Record<string, unknown>;
  status?: string;
}) =>
  invokeEmployeeOnboardingFunction<{
    success: true;
    status: string;
    submittedAt: string | null;
  }>(
    {
      action: 'save_submission',
      employeeId: params.employeeId,
      formKey: params.formKey,
      token: params.token,
      payload: params.payload,
      status: params.status,
    },
    !params.token,
  );

export const validateEmployeeOnboardingToken = async (token: string) => {
  const result = await invokeEmployeeOnboardingFunction<{
    success: true;
    employee: EmployeeRecord;
    formKey: string;
    status: string;
    submittedAt: string | null;
    payload: Record<string, unknown>;
    alreadySubmitted: boolean;
    expiresAt: string;
  }>(
    {
      action: 'validate_token',
      token,
    },
    false,
  );

  return result as PublicEmployeeTokenAccess;
};
