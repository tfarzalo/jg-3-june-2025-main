import {
  EMPLOYEE_FORM_KEYS,
  EMPLOYEE_FORM_MAP,
  SMS_OPT_IN_FORM_KEY,
  extractEmployeeSmsOptInSnapshot,
} from '../../../shared/employeeOnboarding';
import { supabase } from '../../utils/supabase';
import { formatPhoneNumber } from '../../lib/utils/formatUtils';
import { normalizeToE164US } from '../../lib/utils/phoneE164';
import type {
  EmployeeListItem,
  EmployeeProfileData,
  EmployeeRecord,
  EmployeeFormSubmissionRecord,
  EmployeePaperworkCounts,
  EmployeeRosterItem,
  PublicEmployeeTokenAccess,
  EmployeeEmailPreview,
  EmployeeStatus,
  LinkedEmployeeProfileSummary,
} from './types';

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/employee-onboarding`;

type ProfileRosterRecord = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  phone: string | null;
  company_name: string | null;
  created_at: string | null;
};

const sortSubmissionRecords = (items: EmployeeFormSubmissionRecord[]) => {
  const order = new Map(EMPLOYEE_FORM_KEYS.map((key, index) => [key, index]));
  return [...items]
    .map((item) => ({
      ...item,
      form_title: EMPLOYEE_FORM_MAP[item.form_key]?.title || item.form_title,
    }))
    .sort((a, b) => (order.get(a.form_key) ?? 999) - (order.get(b.form_key) ?? 999));
};

const createEmptyPaperworkCounts = (): EmployeePaperworkCounts => ({
  not_sent: EMPLOYEE_FORM_KEYS.length,
  sent: 0,
  submitted: 0,
  complete: 0,
  total: EMPLOYEE_FORM_KEYS.length,
});

const normalizeEmployeeRecord = (employee: EmployeeRecord): EmployeeRecord => ({
  ...employee,
  phone: formatPhoneNumber(employee.phone),
});

const buildPaperworkCountsByEmployee = (
  submissions: Array<{ employee_id: string; status: string }>,
) => {
  const counts = new Map<string, EmployeePaperworkCounts>();

  submissions.forEach((submission) => {
    const current = counts.get(submission.employee_id) || {
      not_sent: 0,
      sent: 0,
      submitted: 0,
      complete: 0,
      total: 0,
    };

    current.total += 1;

    if (submission.status === 'sent') current.sent += 1;
    else if (submission.status === 'submitted') current.submitted += 1;
    else if (submission.status === 'complete') current.complete += 1;
    else current.not_sent += 1;

    counts.set(submission.employee_id, current);
  });

  return counts;
};

const getDefaultPositionTitleForProfile = (profile: ProfileRosterRecord) => {
  if (profile.role === 'subcontractor') {
    return profile.company_name || 'Subcontractor';
  }

  if (profile.role === 'jg_management') {
    return 'JG Management';
  }

  if (profile.role === 'is_super_admin') {
    return 'Super Admin';
  }

  if (profile.role === 'admin') {
    return 'Admin';
  }

  return 'Employee';
};

const getDefaultEmployeeStatusForProfile = (): EmployeeStatus => 'hired';

const toLinkedProfileSummary = (profile: ProfileRosterRecord | null | undefined): LinkedEmployeeProfileSummary | null =>
  profile && profile.email
    ? {
        id: profile.id,
        full_name: profile.full_name,
        email: profile.email,
        role: profile.role,
      }
    : null;

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
      ...normalizeEmployeeRecord(employee),
      completed_forms_count: employeeCounts.complete,
      total_forms_count: employeeCounts.total || EMPLOYEE_FORM_KEYS.length,
    };
  });
};

export const listEmployeeRoster = async (): Promise<EmployeeRosterItem[]> => {
  const [{ data: employees, error: employeesError }, { data: profiles, error: profilesError }, { data: submissions, error: submissionsError }] =
    await Promise.all([
      supabase.from('employees').select('*').order('created_at', { ascending: false }),
      supabase
        .from('profiles')
        .select('id, email, full_name, role, phone, company_name, created_at')
        .order('role', { ascending: true })
        .order('full_name', { ascending: true }),
      supabase.from('employee_form_submissions').select('employee_id, status'),
    ]);

  if (employeesError) throw employeesError;
  if (profilesError) throw profilesError;
  if (submissionsError) throw submissionsError;

  const employeeList = (employees || []) as EmployeeRecord[];
  const profileList = ((profiles || []) as ProfileRosterRecord[]).filter((profile) => Boolean(profile.email));
  const paperworkCounts = buildPaperworkCountsByEmployee(
    (submissions || []) as Array<{ employee_id: string; status: string }>,
  );

  const employeesByLinkedProfileId = new Map<string, EmployeeRecord>();
  const employeesByEmail = new Map<string, EmployeeRecord>();
  const consumedEmployeeIds = new Set<string>();

  employeeList.forEach((employee) => {
    if (employee.linked_subcontractor_profile_id) {
      employeesByLinkedProfileId.set(employee.linked_subcontractor_profile_id, employee);
    }
    if (employee.email) {
      employeesByEmail.set(employee.email.trim().toLowerCase(), employee);
    }
  });

  const roster: EmployeeRosterItem[] = profileList.map((profile) => {
    const employee =
      employeesByLinkedProfileId.get(profile.id) ||
      employeesByEmail.get((profile.email || '').trim().toLowerCase()) ||
      null;

    if (employee) {
      consumedEmployeeIds.add(employee.id);
    }

    const counts = employee ? paperworkCounts.get(employee.id) || createEmptyPaperworkCounts() : createEmptyPaperworkCounts();

    return {
      employee_id: employee?.id || null,
      profile_id: profile.id,
      linked_profile_id: employee?.linked_subcontractor_profile_id || profile.id,
      full_name: employee?.full_name || profile.full_name || profile.email || 'Unnamed user',
      email: employee?.email || profile.email || '',
      phone: formatPhoneNumber(employee?.phone || profile.phone),
      role: profile.role,
      position_title: employee?.position_title || getDefaultPositionTitleForProfile(profile),
      employee_status: employee?.employee_status || getDefaultEmployeeStatusForProfile(),
      start_date: employee?.start_date || profile.created_at?.slice(0, 10) || null,
      onboarding_packet_sent_at: employee?.onboarding_packet_sent_at || null,
      paperwork_counts: counts,
      has_employee_record: Boolean(employee),
      source: 'profile',
    };
  });

  employeeList.forEach((employee) => {
    if (consumedEmployeeIds.has(employee.id)) return;

    roster.push({
      employee_id: employee.id,
      profile_id: employee.linked_subcontractor_profile_id || null,
      linked_profile_id: employee.linked_subcontractor_profile_id || null,
      full_name: employee.full_name,
      email: employee.email,
      phone: formatPhoneNumber(employee.phone),
      role: 'unlinked',
      position_title: employee.position_title,
      employee_status: employee.employee_status,
      start_date: employee.start_date,
      onboarding_packet_sent_at: employee.onboarding_packet_sent_at,
      paperwork_counts: paperworkCounts.get(employee.id) || createEmptyPaperworkCounts(),
      has_employee_record: true,
      source: 'employee',
    });
  });

  return roster;
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

  const linkedProfileId = (employee as EmployeeRecord).linked_subcontractor_profile_id;
  let linkedProfile: LinkedEmployeeProfileSummary | null = null;

  if (linkedProfileId) {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, phone, company_name, created_at')
      .eq('id', linkedProfileId)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    linkedProfile = toLinkedProfileSummary((profile as ProfileRosterRecord | null) ?? null);
  }

  return {
    employee: normalizeEmployeeRecord(employee as EmployeeRecord),
    submissions: sortSubmissionRecords((submissions || []) as EmployeeFormSubmissionRecord[]),
    linkedProfile,
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
    ...normalizeEmployeeRecord(data as EmployeeRecord),
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
    formKeysSent?: string[];
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

export const getEmployeePdfUrl = async (employeeId: string, formKey: string, regenerate = false) => {
  const result = await invokeEmployeeOnboardingFunction<{
    success: true;
    signedUrl: string;
  }>({
    action: 'pdf_url',
    employeeId,
    formKey,
    regenerate,
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
  return await ensureEmployeeForProfile(subcontractorProfileId);
};

export const ensureEmployeeForProfile = async (profileId: string): Promise<EmployeeRecord> => {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, phone, company_name, created_at')
    .eq('id', profileId)
    .single();

  if (profileError || !profile) {
    throw profileError || new Error('User profile not found.');
  }

  if (!profile.email) {
    throw new Error('This user profile is missing an email address and cannot be linked to employee paperwork.');
  }

  const { data: linkedEmployee, error: linkedEmployeeError } = await supabase
    .from('employees')
    .select('*')
    .eq('linked_subcontractor_profile_id', profileId)
    .maybeSingle();

  if (linkedEmployeeError) {
    throw linkedEmployeeError;
  }

  if (linkedEmployee) {
    return normalizeEmployeeRecord(linkedEmployee as EmployeeRecord);
  }

  const { data: emailMatchedEmployees, error: emailMatchedEmployeesError } = await supabase
    .from('employees')
    .select('*')
    .ilike('email', profile.email)
    .order('created_at', { ascending: false })
    .limit(1);

  if (emailMatchedEmployeesError) {
    throw emailMatchedEmployeesError;
  }

  const emailMatchedEmployee = ((emailMatchedEmployees || [])[0] as EmployeeRecord | undefined) || null;

  if (emailMatchedEmployee) {
    const updatedEmployee = await updateEmployee(emailMatchedEmployee.id, {
      linked_subcontractor_profile_id: profile.id,
      full_name: emailMatchedEmployee.full_name || profile.full_name || profile.email,
      phone: emailMatchedEmployee.phone || profile.phone,
    });

    return updatedEmployee;
  }

  return await createEmployee({
    full_name: profile.full_name || profile.email,
    email: profile.email,
    phone: profile.phone || '',
    position_title: getDefaultPositionTitleForProfile(profile as ProfileRosterRecord),
    employee_status: getDefaultEmployeeStatusForProfile(),
    start_date: profile.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
    internal_office_notes: `Auto-linked from existing ${profile.role} user profile.`,
    linked_subcontractor_profile_id: profile.id,
  });
};

const syncEmployeeSmsConsentToProfile = async (employeeId: string, profileId: string) => {
  const { data: smsSubmission, error: smsSubmissionError } = await supabase
    .from('employee_form_submissions')
    .select('submitted_at, form_payload')
    .eq('employee_id', employeeId)
    .eq('form_key', SMS_OPT_IN_FORM_KEY)
    .maybeSingle();

  if (smsSubmissionError) {
    throw smsSubmissionError;
  }

  const payload =
    smsSubmission?.form_payload && typeof smsSubmission.form_payload === 'object'
      ? (smsSubmission.form_payload as Record<string, unknown>)
      : null;

  if (!payload) {
    return;
  }

  const snapshot = extractEmployeeSmsOptInSnapshot(payload);
  if (!snapshot.consented) {
    return;
  }

  const smsPhone = snapshot.metadata?.phone_e164 ?? normalizeToE164US(snapshot.phone);
  if (!smsPhone) {
    return;
  }

  const consentedAt =
    snapshot.metadata?.consented_at ?? smsSubmission?.submitted_at ?? new Date().toISOString();

  const { error: profileSmsError } = await supabase
    .from('profiles')
    .update({
      sms_phone: smsPhone,
      sms_consent_given: true,
      sms_consent_given_at: consentedAt,
      sms_consent_ip: snapshot.metadata?.consent_ip ?? null,
    })
    .eq('id', profileId);

  if (profileSmsError) {
    throw profileSmsError;
  }

  const { data: existingSmsSettings, error: existingSmsSettingsError } = await supabase
    .from('user_sms_notification_settings')
    .select('*')
    .eq('user_id', profileId)
    .maybeSingle();

  if (existingSmsSettingsError) {
    throw existingSmsSettingsError;
  }

  const { error: settingsUpsertError } = await supabase
    .from('user_sms_notification_settings')
    .upsert(
      existingSmsSettings
        ? {
            user_id: profileId,
            sms_enabled: true,
            notify_chat_received: existingSmsSettings.notify_chat_received,
            notify_job_assigned: existingSmsSettings.notify_job_assigned,
            notify_charges_approved: existingSmsSettings.notify_charges_approved,
            notify_work_order_submitted: existingSmsSettings.notify_work_order_submitted,
            notify_job_accepted: existingSmsSettings.notify_job_accepted,
          }
        : {
            user_id: profileId,
            sms_enabled: true,
            notify_chat_received: true,
            notify_job_assigned: true,
            notify_charges_approved: true,
            notify_work_order_submitted: false,
            notify_job_accepted: false,
          },
      { onConflict: 'user_id' },
    );

  if (settingsUpsertError) {
    throw settingsUpsertError;
  }
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

  await syncEmployeeSmsConsentToProfile(employee.id, newProfileId);

  await updateEmployee(employee.id, {
    linked_subcontractor_profile_id: newProfileId,
  });

  return newProfileId;
};
