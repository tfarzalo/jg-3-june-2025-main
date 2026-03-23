import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Briefcase, ChevronRight, Mail, Phone, Plus, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from './ui/Button';
import { createEmployee, listEmployees } from '../features/employees/api';
import type { EmployeeListItem } from '../features/employees/types';

const formatDate = (value: string | null) => {
  if (!value) return 'Not sent';
  try {
    return format(new Date(value), 'MMM d, yyyy');
  } catch {
    return value;
  }
};

export function Employees() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<EmployeeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    position_title: '',
    start_date: '',
  });

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const data = await listEmployees();
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
      [employee.full_name, employee.email, employee.position_title]
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }, [employees, search]);

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
        start_date: '',
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Phone number</label>
                <input
                  value={formData.phone}
                  onChange={(event) => setFormData((current) => ({ ...current, phone: event.target.value }))}
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-[#0F172A] dark:text-white"
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

        <div className="overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-[#111827]">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-[#0F172A]">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Employee</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Position</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Start Date</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Onboarding</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Packet Sent</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Open</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-sm text-gray-500">
                      Loading employees...
                    </td>
                  </tr>
                ) : filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-sm text-gray-500">
                      No employees found.
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((employee) => (
                    <tr
                      key={employee.id}
                      className="cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-[#0F172A]"
                      onClick={() => navigate(`/dashboard/employees/${employee.id}`)}
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
                      </td>
                      <td className="px-6 py-5 text-sm text-gray-700 dark:text-gray-300">{employee.position_title}</td>
                      <td className="px-6 py-5 text-sm text-gray-700 dark:text-gray-300">{formatDate(employee.start_date)}</td>
                      <td className="px-6 py-5">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {employee.completed_forms_count}/{employee.total_forms_count} complete
                        </div>
                        <div className="mt-2 h-2 w-40 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                          <div
                            className="h-full rounded-full bg-teal-500"
                            style={{
                              width: `${(employee.completed_forms_count / employee.total_forms_count) * 100}%`,
                            }}
                          />
                        </div>
                      </td>
                      <td className="px-6 py-5 text-sm text-gray-700 dark:text-gray-300">
                        {formatDate(employee.onboarding_packet_sent_at)}
                      </td>
                      <td className="px-6 py-5 text-right">
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate(`/dashboard/employees/${employee.id}`);
                          }}
                        >
                          Open
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Employees;
