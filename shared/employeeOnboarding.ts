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
    key: 'new-hire-paperwork-7',
    title: 'New Hire Paperwork 7',
    sourceFileName: 'New Hire Paperwork 7.pdf',
    structureExtractedFromPdf: false,
    sections: [
      {
        id: 'final-certification',
        title: 'Final Certification',
        description: 'Placeholder structure pending extraction from the source PDF.',
        fields: makeSampleFields('form_7', 'Certification date', 'I certify this onboarding submission is complete', 'Final certification signature'),
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
