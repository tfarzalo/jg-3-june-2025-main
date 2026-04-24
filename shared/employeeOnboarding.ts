export const EMPLOYEE_FORM_STATUSES = ['not_sent', 'sent', 'submitted', 'complete'] as const;

export type EmployeeFormStatus = (typeof EMPLOYEE_FORM_STATUSES)[number];

export type EmployeeFormFieldType =
  | 'text'
  | 'email'
  | 'phone'
  | 'date'
  | 'checkbox'
  | 'radio'
  | 'select'
  | 'signature';

export interface EmployeeFormFieldOption {
  label: string;
  value: string;
}

export interface EmployeeFormFieldDefinition {
  id: string;
  label: string;
  type: EmployeeFormFieldType;
  required?: boolean;
  placeholder?: string;
  options?: EmployeeFormFieldOption[];
}

export interface EmployeeFormSectionDefinition {
  id: string;
  title: string;
  description?: string;
  fields: EmployeeFormFieldDefinition[];
}

export interface EmployeeFormDefinition {
  key: string;
  title: string;
  sourceFileName: string;
  structureExtractedFromPdf: boolean;
  sections: EmployeeFormSectionDefinition[];
}

export const SMS_OPT_IN_FORM_KEY = 'new-hire-paperwork-7';
export const SMS_OPT_IN_POLICY_VERSION = 'v1.0';
export const SMS_OPT_IN_EFFECTIVE_DATE = 'April 14, 2026';
export const SMS_OPT_IN_METADATA_KEY = '__sms_opt_in_meta';

export const SMS_OPT_IN_FIELD_IDS = {
  employeeName: 'sms_opt_in_employee_name',
  email: 'sms_opt_in_email',
  phone: 'sms_opt_in_phone',
  consentDate: 'sms_opt_in_consent_date',
  consentCheckbox: 'sms_opt_in_consent_checkbox',
  optOutAcknowledgement: 'sms_opt_in_opt_out_acknowledgement',
  signature: 'sms_opt_in_signature',
} as const;

export interface EmployeeSmsOptInMetadata {
  consented_at: string | null;
  consent_ip: string | null;
  phone_e164: string | null;
  policy_version: string | null;
  effective_date: string | null;
}

export interface EmployeeSmsOptInSnapshot {
  phone: string | null;
  consented: boolean;
  consentDate: string | null;
  signature: string | null;
  metadata: EmployeeSmsOptInMetadata | null;
}

const makeSampleFields = (
  prefix: string,
  dateLabel: string,
  checkboxLabel: string,
  signatureLabel: string,
): EmployeeFormFieldDefinition[] => [
  {
    id: `${prefix}_employee_name`,
    label: 'Employee full name',
    type: 'text',
    required: true,
    placeholder: 'Enter full legal name',
  },
  {
    id: `${prefix}_effective_date`,
    label: dateLabel,
    type: 'date',
    required: true,
  },
  {
    id: `${prefix}_acknowledgement`,
    label: checkboxLabel,
    type: 'checkbox',
    required: true,
  },
  {
    id: `${prefix}_signature`,
    label: signatureLabel,
    type: 'signature',
    required: true,
  },
];

export const EMPLOYEE_ONBOARDING_FORMS: EmployeeFormDefinition[] = [
  {
    key: 'new-hire-paperwork',
    title: 'New Hire Paperwork',
    sourceFileName: 'New Hire Paperwork.pdf',
    structureExtractedFromPdf: false,
    sections: [
      {
        id: 'employee-details',
        title: 'Employee Details',
        description: 'Placeholder structure pending extraction from the source PDF.',
        fields: makeSampleFields('form_0', 'Start date', 'I confirm my employee details are accurate', 'Employee signature'),
      },
    ],
  },
  {
    key: 'new-hire-paperwork-1',
    title: 'New Hire Paperwork 1',
    sourceFileName: 'New Hire Paperwork 1.pdf',
    structureExtractedFromPdf: false,
    sections: [
      {
        id: 'tax-and-holdings',
        title: 'Tax and Withholding',
        description: 'Placeholder structure pending extraction from the source PDF.',
        fields: makeSampleFields('form_1', 'Withholding effective date', 'I reviewed the withholding selections', 'Tax form signature'),
      },
    ],
  },
  {
    key: 'new-hire-paperwork-2',
    title: 'New Hire Paperwork 2',
    sourceFileName: 'New Hire Paperwork 2.pdf',
    structureExtractedFromPdf: false,
    sections: [
      {
        id: 'eligibility',
        title: 'Employment Eligibility',
        description: 'Placeholder structure pending extraction from the source PDF.',
        fields: makeSampleFields('form_2', 'Verification date', 'I certify my eligibility information is correct', 'Eligibility signature'),
      },
    ],
  },
  {
    key: 'new-hire-paperwork-3',
    title: 'New Hire Paperwork 3',
    sourceFileName: 'New Hire Paperwork 3.pdf',
    structureExtractedFromPdf: false,
    sections: [
      {
        id: 'direct-deposit',
        title: 'Payroll and Banking',
        description: 'Placeholder structure pending extraction from the source PDF.',
        fields: makeSampleFields('form_3', 'Payroll enrollment date', 'I authorize payroll processing as entered', 'Payroll signature'),
      },
    ],
  },
  {
    key: 'new-hire-paperwork-4',
    title: 'New Hire Paperwork 4',
    sourceFileName: 'New Hire Paperwork 4.pdf',
    structureExtractedFromPdf: false,
    sections: [
      {
        id: 'policy-acknowledgement',
        title: 'Policy Acknowledgement',
        description: 'Placeholder structure pending extraction from the source PDF.',
        fields: makeSampleFields('form_4', 'Acknowledgement date', 'I acknowledge receipt of the listed policies', 'Policy acknowledgement signature'),
      },
    ],
  },
  {
    key: 'new-hire-paperwork-5',
    title: 'New Hire Paperwork 5',
    sourceFileName: 'New Hire Paperwork 5.pdf',
    structureExtractedFromPdf: false,
    sections: [
      {
        id: 'safety-compliance',
        title: 'Safety and Compliance',
        description: 'Placeholder structure pending extraction from the source PDF.',
        fields: makeSampleFields('form_5', 'Safety review date', 'I confirm I completed the safety acknowledgement', 'Safety signature'),
      },
    ],
  },
  {
    key: 'new-hire-paperwork-6',
    title: 'New Hire Paperwork 6',
    sourceFileName: 'New Hire Paperwork 6.pdf',
    structureExtractedFromPdf: false,
    sections: [
      {
        id: 'benefits',
        title: 'Benefits and Authorizations',
        description: 'Placeholder structure pending extraction from the source PDF.',
        fields: makeSampleFields('form_6', 'Benefits election date', 'I reviewed and approved the listed authorizations', 'Benefits signature'),
      },
    ],
  },
  {
    key: SMS_OPT_IN_FORM_KEY,
    title: 'SMS Messaging Opt-In Authorization',
    sourceFileName: 'SMS Messaging Opt-In Authorization.pdf',
    structureExtractedFromPdf: true,
    sections: [
      {
        id: 'sms-contact',
        title: 'Mobile Contact Details',
        description: 'Provide the mobile number that should receive work-related text notifications from JG Painting Pros, Inc.',
        fields: [
          {
            id: SMS_OPT_IN_FIELD_IDS.employeeName,
            label: 'Employee full name',
            type: 'text',
            required: true,
            placeholder: 'Enter full legal name',
          },
          {
            id: SMS_OPT_IN_FIELD_IDS.email,
            label: 'Email address',
            type: 'email',
            required: true,
            placeholder: 'name@example.com',
          },
          {
            id: SMS_OPT_IN_FIELD_IDS.phone,
            label: 'Mobile phone number for SMS notifications',
            type: 'phone',
            required: true,
            placeholder: '123-456-7890',
          },
        ],
      },
      {
        id: 'sms-consent',
        title: 'SMS Consent',
        description:
          'By opting in, you agree to receive work-related SMS notifications about assignments, scheduling, work orders, approvals, and internal messaging. Message frequency varies. Message and data rates may apply.',
        fields: [
          {
            id: SMS_OPT_IN_FIELD_IDS.consentDate,
            label: 'Date of consent',
            type: 'date',
            required: true,
          },
          {
            id: SMS_OPT_IN_FIELD_IDS.consentCheckbox,
            label:
              'I authorize JG Painting Pros, Inc. to send me automated and non-automated SMS text messages at the mobile number listed above. I understand consent is voluntary and is not a condition of employment or contract.',
            type: 'checkbox',
            required: true,
          },
          {
            id: SMS_OPT_IN_FIELD_IDS.optOutAcknowledgement,
            label:
              'I understand I can opt out at any time by replying STOP, and I can reply HELP for assistance. I confirm I am the account holder or authorized user for this number.',
            type: 'checkbox',
            required: true,
          },
          {
            id: SMS_OPT_IN_FIELD_IDS.signature,
            label: 'Electronic signature',
            type: 'signature',
            required: true,
          },
        ],
      },
    ],
  },
];

export const EMPLOYEE_FORM_KEYS = EMPLOYEE_ONBOARDING_FORMS.map((form) => form.key);

export const EMPLOYEE_FORM_MAP = Object.fromEntries(
  EMPLOYEE_ONBOARDING_FORMS.map((form) => [form.key, form]),
) as Record<string, EmployeeFormDefinition>;

export const EMPLOYEE_FORM_STATUS_LABELS: Record<EmployeeFormStatus, string> = {
  not_sent: 'Not sent',
  sent: 'Sent',
  submitted: 'Submitted',
  complete: 'Complete',
};

export interface EmployeeChecklistSummaryInput {
  status: EmployeeFormStatus;
}

export const countCompletedEmployeeForms = (items: EmployeeChecklistSummaryInput[]) =>
  items.filter((item) => item.status === 'complete').length;

export const buildEmployeeOnboardingUrl = (baseUrl: string, token: string) => {
  const cleanBaseUrl = baseUrl.replace(/\/$/, '');
  return `${cleanBaseUrl}/employee-onboarding/${token}`;
};

export interface EmployeeBasicInfo {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  position_title?: string | null;
  start_date?: string | null;
}

export const buildEmployeeFieldDefaults = (
  employee: EmployeeBasicInfo,
  existingValues: Record<string, unknown> = {},
) => {
  const defaults: Record<string, unknown> = { ...existingValues };

  for (const form of EMPLOYEE_ONBOARDING_FORMS) {
    for (const section of form.sections) {
      for (const field of section.fields) {
        if (defaults[field.id] !== undefined && defaults[field.id] !== null && defaults[field.id] !== '') {
          continue;
        }

        if (field.id.includes('employee_name')) {
          defaults[field.id] = employee.full_name || '';
          continue;
        }

        if (field.type === 'email') {
          defaults[field.id] = employee.email || '';
          continue;
        }

        if (field.type === 'phone') {
          defaults[field.id] = employee.phone || '';
          continue;
        }

        if (field.type === 'date' && field.id.includes('effective_date')) {
          defaults[field.id] = employee.start_date || '';
          continue;
        }

        if (field.id === SMS_OPT_IN_FIELD_IDS.consentDate) {
          defaults[field.id] = new Date().toISOString().slice(0, 10);
        }
      }
    }
  }

  return defaults;
};

export const formatEmployeeFormValue = (value: unknown) => {
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (Array.isArray(value)) {
    return value.join(', ');
  }

  if (value === null || value === undefined || value === '') {
    return 'Not provided';
  }

  return String(value);
};

export const extractEmployeeSmsOptInSnapshot = (
  payload: Record<string, unknown>,
): EmployeeSmsOptInSnapshot => {
  const metadataCandidate = payload[SMS_OPT_IN_METADATA_KEY];
  const metadata =
    metadataCandidate && typeof metadataCandidate === 'object' && !Array.isArray(metadataCandidate)
      ? {
          consented_at:
            typeof (metadataCandidate as Record<string, unknown>).consented_at === 'string'
              ? ((metadataCandidate as Record<string, unknown>).consented_at as string)
              : null,
          consent_ip:
            typeof (metadataCandidate as Record<string, unknown>).consent_ip === 'string'
              ? ((metadataCandidate as Record<string, unknown>).consent_ip as string)
              : null,
          phone_e164:
            typeof (metadataCandidate as Record<string, unknown>).phone_e164 === 'string'
              ? ((metadataCandidate as Record<string, unknown>).phone_e164 as string)
              : null,
          policy_version:
            typeof (metadataCandidate as Record<string, unknown>).policy_version === 'string'
              ? ((metadataCandidate as Record<string, unknown>).policy_version as string)
              : null,
          effective_date:
            typeof (metadataCandidate as Record<string, unknown>).effective_date === 'string'
              ? ((metadataCandidate as Record<string, unknown>).effective_date as string)
              : null,
        }
      : null;

  return {
    phone:
      typeof payload[SMS_OPT_IN_FIELD_IDS.phone] === 'string'
        ? (payload[SMS_OPT_IN_FIELD_IDS.phone] as string)
        : null,
    consented: Boolean(payload[SMS_OPT_IN_FIELD_IDS.consentCheckbox]),
    consentDate:
      typeof payload[SMS_OPT_IN_FIELD_IDS.consentDate] === 'string'
        ? (payload[SMS_OPT_IN_FIELD_IDS.consentDate] as string)
        : null,
    signature:
      typeof payload[SMS_OPT_IN_FIELD_IDS.signature] === 'string'
        ? (payload[SMS_OPT_IN_FIELD_IDS.signature] as string)
        : null,
    metadata,
  };
};
