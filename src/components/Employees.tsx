import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Briefcase, ChevronRight, Mail, Phone, Plus, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { EMPLOYEE_ONBOARDING_FORMS } from '../../shared/employeeOnboarding';
import { Button } from './ui/Button';
import { createEmployee, ensureEmployeeForProfile, listEmployeeRoster, sendEmployeeOnboardingPacket } from '../features/employees/api';
import type { EmployeeRosterItem, EmployeeStatus } from '../features/employees/types';
import { formatPhoneNumber } from '../lib/utils/formatUtils';

const EMPLOYEE_STATUS_OPTIONS: Array<{ value: EmployeeStatus; label: string }> = [
  { value: 'not_hired', label: 'Not Hired' },
  { value: 'hired', label: 'Hired' },
  { value: 'on_leave', label: 'On Leave' },
  { value: 'terminated', label: 'Terminated' },
];

const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  hired: 'Hired',
  not_hired: 'Not Hired',
  terminated: 'Terminated',
  on_leave: 'On Leave',
};

const ROLE_LABELS: Record<string, string> = {
  is_super_admin: 'Super Admin',
  admin: 'Admin',
  jg_management: 'JG Management',
  subcontractor: 'Subcontractor',
  user: 'User',
  unlinked: 'Unlinked Employee Records',
};

const ROLE_ORDER = ['is_super_admin', 'admin', 'jg_management', 'subcontractor', 'user', 'unlinked'];

const formatDate = (value: string | null, emptyLabel = 'Not available') => {
  if (!value) return emptyLabel;
  try {
    return format(new Date(value), 'MMM d, yyyy');
  } catch {
    return value;
  }
};

export function Employees() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<EmployeeRosterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openingRowKey, setOpeningRowKey] = useState<string | null>(null);
  const [sendingRowKey, setSendingRowKey] = useState<string | null>(null);
  const [selectedFormByRowKey, setSelectedFormByRowKey] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    position_title: '',
    employee_status: 'not_hired' as EmployeeStatus,
    interview_date: '',
    hire_date: '',
    start_date: '',
    internal_office_notes: '',
  });

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const data = await listEmployeeRoster();
      setEmployees(data);
    } catch (error) {
      console.error('Error loading employees:', error);
      toast.error('Unable to load employees.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const filteredEmployees = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return employees;
    return employees.filter((employee) =>
      [employee.full_name, employee.email, employee.position_title, ROLE_LABELS[employee.role] || employee.role]
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }, [employees, search]);

  const groupedEmployees = useMemo(() => {
    const grouped = new Map<string, EmployeeRosterItem[]>();

    filteredEmployees.forEach((employee) => {
      const key = employee.role;
      const current = grouped.get(key) || [];
      current.push(employee);
      grouped.set(key, current);
    });

    return ROLE_ORDER
      .map((role) => ({
        role,
        label: ROLE_LABELS[role] || role,
        items: (grouped.get(role) || []).sort((a, b) => a.full_name.localeCompare(b.full_name)),
      }))
      .filter((group) => group.items.length > 0);
  }, [filteredEmployees]);

  const handleOpenEmployee = async (employee: EmployeeRosterItem) => {
    const rowKey = employee.profile_id || employee.employee_id || employee.email;

    try {
      setOpeningRowKey(rowKey);

      if (employee.employee_id) {
        navigate(`/dashboard/employees/${employee.employee_id}`);
        return;
      }

      if (!employee.profile_id) {
        toast.error('This row is missing a linked user profile.');
        return;
      }

      const ensuredEmployee = await ensureEmployeeForProfile(employee.profile_id);
      await fetchEmployees();
      navigate(`/dashboard/employees/${ensuredEmployee.id}`);
    } catch (error) {
      console.error('Error opening employee paperwork:', error);
      toast.error(error instanceof Error ? error.message : 'Unable to open employee paperwork.');
    } finally {
      setOpeningRowKey(null);
    }
  };

  const ensureEmployeeForRosterItem = async (employee: EmployeeRosterItem) => {
    if (employee.employee_id) {
      return employee.employee_id;
    }

    if (!employee.profile_id) {
      throw new Error('This row is missing a linked user profile.');
    }

    const ensuredEmployee = await ensureEmployeeForProfile(employee.profile_id);
    return ensuredEmployee.id;
  };

  const handleSendPaperwork = async (employee: EmployeeRosterItem, formKey?: string) => {
    const rowKey = employee.profile_id || employee.employee_id || employee.email;

    try {
      setSendingRowKey(`${rowKey}:${formKey || 'bundle'}`);
      const ensuredEmployeeId = await ensureEmployeeForRosterItem(employee);
      await sendEmployeeOnboardingPacket({
        employeeId: ensuredEmployeeId,
        formKey,
        regenerate: true,
        baseUrl: window.location.origin,
      });
      toast.success(formKey ? 'Individual paperwork link sent.' : 'Full paperwork bundle sent.');
      await fetchEmployees();
    } catch (error) {
      console.error('Error sending employee paperwork:', error);
      toast.error(error instanceof Error ? error.message : 'Unable to send employee paperwork.');
    } finally {
      setSendingRowKey(null);
    }
  };

  const handleCreateEmployee = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setSaving(true);
      const employee = await createEmployee(formData);
      toast.success('Employee created.');
      setShowCreateForm(false);
      setFormData({
        full_name: '',
        email: '',
        phone: '',
        position_title: '',
        employee_status: 'not_hired' as EmployeeStatus,
        interview_date: '',
        hire_date: '',
        start_date: '',
        internal_office_notes: '',
      });
      await fetchEmployees();
      navigate(`/dashboard/employees/${employee.id}`);
    } catch (error) {
      console.error('Error creating employee:', error);
      toast.error(error instanceof Error ? error.message : 'Unable to create employee.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-full bg-gray-100 px-6 py-6 dark:bg-[#0F172A]">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm dark:bg-[#111827]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-teal-700 dark:bg-teal-950/40 dark:text-teal-200">
                <Briefcase className="h-4 w-4" />
                Employees
              </div>
              <h1 className="mt-3 text-3xl font-semibold text-gray-900 dark:text-white">Internal employees and onboarding</h1>
              <p className="mt-2 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
                Create employee records, send onboarding packets, and track all eight required forms from first send through final completion.
              </p>
            </div>
            <Button icon={Plus} onClick={() => setShowCreateForm((current) => !current)}>
              {showCreateForm ? 'Close' : 'New Employee'}
            </Button>
          </div>

          <div className="relative max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search employees by name, email, or title"
              className="w-full rounded-xl border border-gray-300 bg-white py-3 pl-10 pr-4 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-gray-600 dark:bg-[#0F172A] dark:text-white"
            />
          </div>
        </div>

        {showCreateForm && (
          <form onSubmit={handleCreateEmployee} className="rounded-2xl bg-white p-6 shadow-sm dark:bg-[#111827]">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Employee name</label>
                <input
                  required
                  value={formData.full_name}
                  onChange={(event) => setFormData((current) => ({ ...current, full_name: event.target.value }))}
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-[#0F172A] dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Email address</label>
                <input
                  required
                  type="email"
                  value={formData.email}
                  onChange={(event) => setFormData((current) => ({ ...current, email: event.target.value }))}
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-[#0F172A] dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Position / title</label>
                <input
                  required
                  value={formData.position_title}
                  onChange={(event) => setFormData((current) => ({ ...current, position_title: event.target.value }))}
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-[#0F172A] dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Employee status</label>
                <select
                  value={formData.employee_status}
                  onChange={(event) => setFormData((current) => ({ ...current, employee_status: event.target.value as EmployeeStatus }))}
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-[#0F172A] dark:text-white"
                >
                  {EMPLOYEE_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Interview date</label>
                <input
                  type="date"
                  value={formData.interview_date}
                  onChange={(event) => setFormData((current) => ({ ...current, interview_date: event.target.value }))}
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-[#0F172A] dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Hire date</label>
                <input
                  type="date"
                  value={formData.hire_date}
                  onChange={(event) => setFormData((current) => ({ ...current, hire_date: event.target.value }))}
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-[#0F172A] dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Start date</label>
                <input
                  required
                  type="date"
                  value={formData.start_date}
                  onChange={(event) => setFormData((current) => ({ ...current, start_date: event.target.value }))}
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-[#0F172A] dark:text-white"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Internal office notes</label>
                <textarea
                  value={formData.internal_office_notes}
                  onChange={(event) => setFormData((current) => ({ ...current, internal_office_notes: event.target.value }))}
                  rows={3}
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-[#0F172A] dark:text-white"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Phone number</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(event) => setFormData((current) => ({ ...current, phone: formatPhoneNumber(event.target.value) }))}
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-[#0F172A] dark:text-white"
                  placeholder="123-456-7890"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button type="submit" loading={saving}>
                Create Employee
              </Button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="rounded-2xl bg-white px-6 py-10 text-center text-sm text-gray-500 shadow-sm dark:bg-[#111827]">
            Loading employee roster...
          </div>
        ) : groupedEmployees.length === 0 ? (
          <div className="rounded-2xl bg-white px-6 py-10 text-center text-sm text-gray-500 shadow-sm dark:bg-[#111827]">
            No employees or user profiles matched your search.
          </div>
        ) : (
          groupedEmployees.map((group) => (
            <div key={group.role} className="overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-[#111827]">
              <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{group.label}</h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {group.items.length} {group.items.length === 1 ? 'record' : 'records'} in this role group.
                    </p>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-[#0F172A]">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Employee / User</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Position</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Employee Status</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Paperwork</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Packet Sent</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {group.items.map((employee) => {
                      const rowKey = employee.profile_id || employee.employee_id || employee.email;
                      const completionWidth = employee.paperwork_counts.total
                        ? (employee.paperwork_counts.complete / employee.paperwork_counts.total) * 100
                        : 0;
                      const selectedFormKey = selectedFormByRowKey[rowKey] || EMPLOYEE_ONBOARDING_FORMS[0]?.key || '';

                      return (
                        <tr
                          key={rowKey}
                          className="cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-[#0F172A]"
                          onClick={() => handleOpenEmployee(employee)}
                        >
                          <td className="px-6 py-5">
                            <div className="font-medium text-gray-900 dark:text-white">{employee.full_name}</div>
                            <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400">
                              <span className="inline-flex items-center gap-2">
                                <Mail className="h-4 w-4" />
                                {employee.email}
                              </span>
                              {employee.phone && (
                                <span className="inline-flex items-center gap-2">
                                  <Phone className="h-4 w-4" />
                                  {employee.phone}
                                </span>
                              )}
                            </div>
                            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                              {employee.has_employee_record
                                ? `Paperwork record ready${employee.source === 'employee' && employee.role === 'unlinked' ? ' (not linked to a current user)' : ''}`
                                : 'Current user detected. Click open to create or attach paperwork tracking.'}
                            </div>
                          </td>
                          <td className="px-6 py-5 text-sm text-gray-700 dark:text-gray-300">
                            <div>{employee.position_title}</div>
                            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              Start {formatDate(employee.start_date, 'Not set')}
                            </div>
                          </td>
                          <td className="px-6 py-5 text-sm text-gray-700 dark:text-gray-300">
                            {EMPLOYEE_STATUS_LABELS[employee.employee_status]}
                          </td>
                          <td className="px-6 py-5">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {employee.paperwork_counts.complete}/{employee.paperwork_counts.total} complete
                            </div>
                            <div className="mt-2 h-2 w-40 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                              <div
                                className="h-full rounded-full bg-teal-500"
                                style={{ width: `${completionWidth}%` }}
                              />
                            </div>
                            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                              Pending review: {employee.paperwork_counts.submitted} · Sent: {employee.paperwork_counts.sent} · Not sent: {employee.paperwork_counts.not_sent}
                            </div>
                          </td>
                          <td className="px-6 py-5 text-sm text-gray-700 dark:text-gray-300">
                            {formatDate(employee.onboarding_packet_sent_at, 'Not sent')}
                          </td>
                          <td className="px-6 py-5 text-right">
                            <div className="flex min-w-[360px] flex-wrap items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                icon={Mail}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void handleSendPaperwork(employee);
                                }}
                                loading={sendingRowKey === `${rowKey}:bundle`}
                              >
                                Send Bundle
                              </Button>
                              <select
                                value={selectedFormKey}
                                onClick={(event) => event.stopPropagation()}
                                onChange={(event) => {
                                  event.stopPropagation();
                                  setSelectedFormByRowKey((current) => ({ ...current, [rowKey]: event.target.value }));
                                }}
                                className="h-9 max-w-[170px] rounded-lg border border-gray-300 bg-white px-2 text-xs text-gray-800 shadow-sm dark:border-gray-600 dark:bg-[#0F172A] dark:text-white"
                                aria-label={`Select individual paperwork form for ${employee.full_name}`}
                              >
                                {EMPLOYEE_ONBOARDING_FORMS.map((form) => (
                                  <option key={form.key} value={form.key}>
                                    {form.title}
                                  </option>
                                ))}
                              </select>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void handleSendPaperwork(employee, selectedFormKey);
                                }}
                                loading={sendingRowKey === `${rowKey}:${selectedFormKey}`}
                              >
                                Send One
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void handleOpenEmployee(employee);
                                }}
                                loading={openingRowKey === rowKey}
                              >
                                {employee.has_employee_record ? 'Open' : 'Create & Open'}
                                <ChevronRight className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default Employees;
