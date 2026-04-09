import { EMPLOYEE_FORM_KEYS } from '../../../shared/employeeOnboarding';
import { supabase } from '../../utils/supabase';
import { formatPhoneNumber } from '../../lib/utils/formatUtils';
import type {
  EmployeeListItem,
  EmployeeProfileData,
  EmployeeRecord,
  EmployeeFormSubmissionRecord,
  PublicEmployeeTokenAccess,
  EmployeeEmailPreview,
  EmployeeStatus,
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
      phone: formatPhoneNumber(employee.phone),
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
  employee_status?: EmployeeStatus;
  interview_date?: string;
  hire_date?: string;
  start_date: string;
  internal_office_notes?: string;
  linked_subcontractor_profile_id?: string | null;
}): Promise<EmployeeRecord> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const payload = {
    ...input,
    phone: formatPhoneNumber(input.phone) || null,
    employee_status: input.employee_status || 'not_hired',
    interview_date: input.interview_date || null,
    hire_date: input.hire_date || null,
    internal_office_notes: input.internal_office_notes || null,
    linked_subcontractor_profile_id: input.linked_subcontractor_profile_id || null,
    updated_by: user?.id || null,
  };

  const { data, error } = await supabase.from('employees').insert(payload).select('*').single();

  if (error) {
    throw error;
  }

  return {
    ...(data as EmployeeRecord),
    phone: formatPhoneNumber((data as EmployeeRecord).phone),
  };
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
    employee: {
      ...(employee as EmployeeRecord),
      phone: formatPhoneNumber((employee as EmployeeRecord).phone),
    },
    submissions: sortSubmissionRecords((submissions || []) as EmployeeFormSubmissionRecord[]),
  };
};

export const updateEmployee = async (
  employeeId: string,
  input: Partial<
    Pick<
      EmployeeRecord,
      | 'full_name'
      | 'email'
      | 'phone'
      | 'position_title'
      | 'employee_status'
      | 'interview_date'
      | 'hire_date'
      | 'start_date'
      | 'internal_office_notes'
      | 'linked_subcontractor_profile_id'
    >
  >,
): Promise<EmployeeRecord> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const payload = {
    ...input,
    phone: input.phone === undefined ? undefined : formatPhoneNumber(input.phone) || null,
    updated_by: user?.id || null,
  };

  const { data, error } = await supabase
    .from('employees')
    .update(payload)
    .eq('id', employeeId)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return {
    ...(data as EmployeeRecord),
    phone: formatPhoneNumber((data as EmployeeRecord).phone),
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

export const previewEmployeeOnboardingEmail = async (employeeId: string) => {
  const result = await invokeEmployeeOnboardingFunction<{
    success: true;
    subject: string;
    html: string;
  }>({
    action: 'preview_email',
    employeeId,
    baseUrl: window.location.origin,
  });

  return result as EmployeeEmailPreview;
};

export const previewEmployeeFormLink = async (employeeId: string, formKey: string) => {
  const result = await invokeEmployeeOnboardingFunction<{
    success: true;
    url: string;
  }>({
    action: 'preview_link',
    employeeId,
    formKey,
    baseUrl: window.location.origin,
  });

  return result.url;
};

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

export const portSubcontractorToEmployee = async (subcontractorProfileId: string) => {
  const { data: existingEmployee, error: existingEmployeeError } = await supabase
    .from('employees')
    .select('*')
    .eq('linked_subcontractor_profile_id', subcontractorProfileId)
    .maybeSingle();

  if (existingEmployeeError) {
    throw existingEmployeeError;
  }

  if (existingEmployee) {
    return existingEmployee as EmployeeRecord;
  }

  const { data: subcontractor, error: subcontractorError } = await supabase
    .from('profiles')
    .select('id, email, full_name, phone, company_name, created_at')
    .eq('id', subcontractorProfileId)
    .eq('role', 'subcontractor')
    .single();

  if (subcontractorError || !subcontractor) {
    throw subcontractorError || new Error('Subcontractor profile not found.');
  }

  const fallbackDate = subcontractor.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10);

  return await createEmployee({
    full_name: subcontractor.full_name || subcontractor.email || 'Ported subcontractor',
    email: subcontractor.email || '',
    phone: subcontractor.phone || '',
    position_title: subcontractor.company_name || 'Ported from subcontractor',
    employee_status: 'not_hired',
    start_date: fallbackDate,
    internal_office_notes: 'Created from subcontractor profile.',
    linked_subcontractor_profile_id: subcontractor.id,
  });
};

export const createSubcontractorUserFromEmployee = async (params: {
  employee: EmployeeRecord;
  password: string;
}) => {
  const { employee, password } = params;
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('You must be signed in to create users.');
  }

  if (employee.linked_subcontractor_profile_id) {
    return employee.linked_subcontractor_profile_id;
  }

  if (employee.employee_status !== 'hired') {
    throw new Error('Only hired employees can be converted into subcontractor users.');
  }

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      email: employee.email,
      password,
      full_name: employee.full_name,
      role: 'subcontractor',
      working_days: {
        sunday: true,
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: false,
      },
      sendWelcomeEmail: true,
    }),
  });

  const result = await response.json();
  if (!response.ok || !result.success || !result.user?.id) {
    throw new Error(result.error || 'Unable to create subcontractor user.');
  }

  const newProfileId = result.user.id as string;

  const { error: profileUpdateError } = await supabase
    .from('profiles')
    .update({
      phone: employee.phone,
      company_name: employee.position_title,
    })
    .eq('id', newProfileId);

  if (profileUpdateError) {
    throw profileUpdateError;
  }

  await updateEmployee(employee.id, {
    linked_subcontractor_profile_id: newProfileId,
  });

  return newProfileId;
};
