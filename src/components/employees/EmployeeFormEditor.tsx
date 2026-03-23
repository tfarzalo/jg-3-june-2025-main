import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  EMPLOYEE_FORM_MAP,
  EMPLOYEE_FORM_STATUS_LABELS,
  EMPLOYEE_FORM_STATUSES,
  buildEmployeeFieldDefaults,
  type EmployeeFormFieldDefinition,
  type EmployeeFormStatus,
} from '../../../shared/employeeOnboarding';
import type { EmployeeRecord } from '../../features/employees/types';
import { saveEmployeeFormSubmission } from '../../features/employees/api';
import { Button } from '../ui/Button';
import { SignaturePad } from './SignaturePad';

interface EmployeeFormEditorProps {
  employee: EmployeeRecord;
  formKey: string;
  initialValues?: Record<string, unknown>;
  initialStatus?: EmployeeFormStatus;
  mode: 'admin' | 'public';
  token?: string;
  onSaved?: (result: { status: string; submittedAt: string | null }) => void;
}

const inputClassName =
  'mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-gray-600 dark:bg-[#0F172A] dark:text-white';

export function EmployeeFormEditor({
  employee,
  formKey,
  initialValues = {},
  initialStatus = 'submitted',
  mode,
  token,
  onSaved,
}: EmployeeFormEditorProps) {
  const formDefinition = EMPLOYEE_FORM_MAP[formKey];
  const resolvedFormDefinition = formDefinition || null;
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<EmployeeFormStatus>(
    initialStatus === 'not_sent' ? 'submitted' : initialStatus,
  );
  const [values, setValues] = useState<Record<string, unknown>>(() =>
    buildEmployeeFieldDefaults(employee, initialValues),
  );

  useEffect(() => {
    setValues(buildEmployeeFieldDefaults(employee, initialValues));
    setStatus(initialStatus === 'not_sent' ? 'submitted' : initialStatus);
  }, [employee, formKey, initialStatus, initialValues]);

  const allFields = resolvedFormDefinition
    ? resolvedFormDefinition.sections.flatMap((section) => section.fields)
    : [];

  if (!resolvedFormDefinition) {
    return null;
  }

  const updateFieldValue = (fieldId: string, value: unknown) => {
    setValues((current) => ({ ...current, [fieldId]: value }));
  };

  const validateForm = () => {
    for (const field of allFields) {
      if (!field.required) continue;
      const value = values[field.id];
      if (field.type === 'checkbox') {
        if (!value) {
          toast.error(`Complete the required field: ${field.label}`);
          return false;
        }
        continue;
      }

      if (!value || String(value).trim() === '') {
        toast.error(`Complete the required field: ${field.label}`);
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validateForm()) return;

    try {
      setSaving(true);
      const result = await saveEmployeeFormSubmission({
        employeeId: mode === 'admin' ? employee.id : undefined,
        formKey,
        token,
        payload: values,
        status: mode === 'admin' ? status : 'submitted',
      });

      toast.success(mode === 'admin' ? 'Submission saved and PDF regenerated.' : 'Form submitted successfully.');
      onSaved?.({ status: result.status, submittedAt: result.submittedAt });
    } catch (error) {
      console.error('Error saving employee form submission:', error);
      toast.error(error instanceof Error ? error.message : 'Unable to save this form.');
    } finally {
      setSaving(false);
    }
  };

  const renderField = (field: EmployeeFormFieldDefinition) => {
    const value = values[field.id];

    if (field.type === 'checkbox') {
      return (
        <label key={field.id} className="flex items-start gap-3 rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-700">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => updateFieldValue(field.id, event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700 dark:text-gray-200">{field.label}</span>
        </label>
      );
    }

    if (field.type === 'signature') {
      return (
        <SignaturePad
          key={field.id}
          label={field.label}
          value={typeof value === 'string' ? value : ''}
          onChange={(nextValue) => updateFieldValue(field.id, nextValue)}
        />
      );
    }

    if (field.type === 'radio' && field.options?.length) {
      return (
        <div key={field.id} className="space-y-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">{field.label}</label>
          <div className="flex flex-wrap gap-3">
            {field.options.map((option) => (
              <label
                key={option.value}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700"
              >
                <input
                  type="radio"
                  name={field.id}
                  checked={value === option.value}
                  onChange={() => updateFieldValue(field.id, option.value)}
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>
      );
    }

    if (field.type === 'select' && field.options?.length) {
      return (
        <div key={field.id}>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">{field.label}</label>
          <select
            value={typeof value === 'string' ? value : ''}
            onChange={(event) => updateFieldValue(field.id, event.target.value)}
            className={inputClassName}
          >
            <option value="">Select an option</option>
            {field.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      );
    }

    return (
      <div key={field.id}>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">{field.label}</label>
        <input
          type={field.type === 'phone' ? 'tel' : field.type}
          value={typeof value === 'string' ? value : ''}
          placeholder={field.placeholder}
          onChange={(event) => updateFieldValue(field.id, event.target.value)}
          className={inputClassName}
        />
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
        {`Placeholder form — production version pending. Form structure based on ${formDefinition.title}.`}
      </div>

      {!resolvedFormDefinition.structureExtractedFromPdf && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-800/60 dark:bg-blue-950/30 dark:text-blue-200">
          Source PDF extraction has not been completed in this workspace yet, so the section headings and fields below are temporary placeholders wired into the real submission pipeline.
        </div>
      )}

      {mode === 'admin' && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-[#111827]">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Checklist status after save</label>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as EmployeeFormStatus)}
            className={inputClassName}
          >
            {EMPLOYEE_FORM_STATUSES.filter((item) => item !== 'not_sent').map((item) => (
              <option key={item} value={item}>
                {EMPLOYEE_FORM_STATUS_LABELS[item]}
              </option>
            ))}
          </select>
        </div>
      )}

      {resolvedFormDefinition.sections.map((section) => (
        <section key={section.id} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-[#111827]">
          <div className="mb-5">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{section.title}</h3>
            {section.description && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{section.description}</p>
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {section.fields.map(renderField)}
          </div>
        </section>
      ))}

      <div className="flex justify-end">
        <Button type="submit" loading={saving}>
          {mode === 'admin' ? 'Save Changes and Regenerate PDF' : 'Submit Form'}
        </Button>
      </div>
    </form>
  );
}
