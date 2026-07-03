import React, { useState, useEffect } from 'react';
import { REPORT_COLUMNS, type ReportTemplate } from '../../lib/reports';

type TemplateDraft = Pick<ReportTemplate, 'id' | 'name' | 'columns' | 'preset' | 'filters'>;

const COLUMN_CATEGORIES = [
  {
    title: 'Job Overview',
    description: 'Core job, property, schedule, assignment, and phase fields.',
    keys: [
      'work_order_num',
      'scheduled_date',
      'property',
      'unit_number',
      'unit_size',
      'job_type',
      'job_category',
      'phase',
      'assigned_to',
      'purchase_order',
      'description',
      'approval',
      'created_at',
      'updated_at',
    ],
  },
  {
    title: 'Billing & Profit',
    description: 'Base billing, extras, subcontractor pay, profit, and margins.',
    keys: [
      'base_billing',
      'base_pay_to_sub',
      'base_profit',
      'base_profit_margin',
      'total_billing_amount',
      'sub_pay',
      'extra_items',
      'extra_charges_total',
      'extra_sub_total',
      'extra_profit',
      'extra_profit_margin',
      'total_profit',
      'profit_margin',
      'invoice_sent',
      'invoice_paid',
    ],
  },
  {
    title: 'Work Order Scope',
    description: 'Submitted work-order scope, unit condition, paint areas, and extra work.',
    keys: [
      'work_order_submitted',
      'occupied',
      'full_paint',
      'sprinklers',
      'sprinklers_painted',
      'painted_ceilings',
      'ceiling_rooms_count',
      'painted_patio',
      'painted_garage',
      'painted_cabinets',
      'painted_crown_molding',
      'painted_front_door',
      'accent_wall',
      'accent_wall_type',
      'accent_wall_count',
      'extra_charges',
      'extra_hours',
      'extra_charges_description',
      'additional_comments',
    ],
  },
  {
    title: 'Quality Control Summary',
    description: 'QC card status, dates, comments, media, and subcontractor QC averages.',
    keys: [
      'qc_submitted',
      'qc_submitted_date',
      'qc_updated_date',
      'qc_submission_count',
      'qc_score_total',
      'qc_score_percent',
      'qc_painter_name',
      'qc_date_painted',
      'qc_date_walked',
      'qc_comments',
      'qc_media_count',
      'qc_subcontractor_submission_total',
      'qc_subcontractor_score_total',
      'qc_subcontractor_score_average',
      'qc_subcontractor_score_average_percent',
    ],
  },
  {
    title: 'Quality Control Section Totals',
    description: 'QC matrix subtotal fields by major inspection section.',
    prefixes: ['qc_section_'],
  },
  {
    title: 'Quality Control Matrix Items',
    description: 'Individual QC matrix score inputs.',
    prefixes: ['qc_score_'],
  },
] as const;

function getColumnCategories() {
  const assigned = new Set<string>();
  const byKey = new Map(REPORT_COLUMNS.map(column => [column.key, column]));

  const categories = COLUMN_CATEGORIES.map(category => {
    const exactColumns = 'keys' in category
      ? category.keys.map(key => byKey.get(key)).filter((column): column is typeof REPORT_COLUMNS[number] => Boolean(column))
      : [];
    const prefixColumns = 'prefixes' in category
      ? REPORT_COLUMNS.filter(column => category.prefixes.some(prefix => column.key.startsWith(prefix)))
      : [];
    const columns = [...exactColumns, ...prefixColumns].filter(column => {
      if (assigned.has(column.key)) return false;
      assigned.add(column.key);
      return true;
    });

    return {
      title: category.title,
      description: category.description,
      columns,
    };
  });

  const otherColumns = REPORT_COLUMNS.filter(column => !assigned.has(column.key));
  if (otherColumns.length > 0) {
    categories.push({
      title: 'Other',
      description: 'Additional report fields.',
      columns: otherColumns,
    });
  }

  return categories.filter(category => category.columns.length > 0);
}

export default function TemplateEditor({ template, onSave, onCancel, onDelete, saving = false }: {
  template?: ReportTemplate;
  onSave: (template: TemplateDraft) => void;
  onCancel: () => void;
  onDelete?: (id: string) => void;
  saving?: boolean;
}) {
  const [name, setName] = useState(template?.name || '');
  const [columns, setColumns] = useState<string[]>(template?.columns || REPORT_COLUMNS.map(column => column.key));
  const [phases, setPhases] = useState<string[]>([]);
  const [phaseSelection, setPhaseSelection] = useState<string[]>(template?.filters?.phases as string[] || ['ALL']);
  const columnCategories = getColumnCategories();

  useEffect(() => {
    setName(template?.name || '');
    setColumns(template?.columns?.length ? template.columns : REPORT_COLUMNS.map(column => column.key));
    setPhaseSelection(template?.filters?.phases as string[] || ['ALL']);
  }, [template]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/reports/phases');
        if (!mounted) return;
        if (res.ok) {
          const data = await res.json();
          const labels = (data || []).map((p: any) => p.job_phase_label).filter(Boolean);
          setPhases(labels);
          return;
        }
      } catch (e) {
        // ignore - fallback below
      }
      if (mounted) setPhases(['Job Request','Work Order','Pending Work Order','Completed','Quality Control','Invoicing','Cancelled']);
    })();
    return () => { mounted = false; };
  }, []);

  const toggleColumn = (col: string) => {
    setColumns(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]);
  };

  const selectAllColumns = () => {
    setColumns(REPORT_COLUMNS.map(column => column.key));
  };

  const deselectAllColumns = () => {
    setColumns([]);
  };

  const selectCategoryColumns = (categoryColumns: Array<typeof REPORT_COLUMNS[number]>) => {
    setColumns(prev => {
      const next = new Set(prev);
      categoryColumns.forEach(column => next.add(column.key));
      return Array.from(next);
    });
  };

  const deselectCategoryColumns = (categoryColumns: Array<typeof REPORT_COLUMNS[number]>) => {
    const categoryKeys = new Set(categoryColumns.map(column => column.key));
    setColumns(prev => prev.filter(column => !categoryKeys.has(column)));
  };

  const move = (idx: number, dir: number) => {
    setColumns(prev => {
      const next = prev.slice();
      const [item] = next.splice(idx,1);
      next.splice(idx+dir,0,item);
      return next;
    });
  };

  const handleSave = () => {
    if (!name.trim()) return alert('Please name the template');
    const filters = {} as Record<string, unknown>;
    if (phaseSelection && phaseSelection.length) filters.phases = phaseSelection;
    onSave({ id: template?.id || `tmp-${Date.now()}`, name: name.trim(), columns, preset: template?.preset, filters });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#0F172A] rounded-lg p-6 w-full max-w-6xl max-h-[88vh] overflow-y-auto shadow-xl">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">{template ? 'Edit' : 'New'} Report Template</h3>
        <label className="block mb-3">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Name</div>
          <input value={name} onChange={e => setName(e.target.value)} className="w-full p-2 border rounded dark:bg-[#111827] dark:border-gray-700 dark:text-white" />
        </label>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6 mb-5">
          <div>
            <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-base font-semibold text-gray-700 dark:text-gray-200">Select Columns</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAllColumns}
                  className="rounded border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={deselectAllColumns}
                  className="rounded border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  Deselect All
                </button>
              </div>
            </div>
            <div className="space-y-4">
              {columnCategories.map(category => {
                const selectedCount = category.columns.filter(column => columns.includes(column.key)).length;
                return (
                  <section key={category.title} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#111827]">
                    <div className="flex flex-col gap-2 border-b border-gray-100 px-3 py-2 dark:border-gray-800 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">{category.title}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{category.description}</div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400">{selectedCount}/{category.columns.length}</span>
                        <button
                          type="button"
                          onClick={() => selectCategoryColumns(category.columns)}
                          className="rounded border border-gray-200 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                        >
                          Select
                        </button>
                        <button
                          type="button"
                          onClick={() => deselectCategoryColumns(category.columns)}
                          className="rounded border border-gray-200 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3">
                      {category.columns.map(col => (
                        <label key={col.key} className="flex items-center gap-2 rounded border border-gray-200 dark:border-gray-700 p-2 text-sm text-gray-800 dark:text-gray-100">
                          <input type="checkbox" checked={columns.includes(col.key)} onChange={() => toggleColumn(col.key)} />
                          <span>{col.label}</span>
                        </label>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>

            {/* Phase selection moved into left column so it's saved with template */}
            <div className="mt-4">
              <div className="text-base font-semibold text-gray-700 dark:text-gray-200 mb-2">Include Job Phases</div>
               <div className="flex flex-wrap gap-2 items-center">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={phaseSelection?.includes('ALL')} onChange={e => setPhaseSelection(e.target.checked ? ['ALL'] : [])} />
                  <span className="text-sm">All</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={phaseSelection?.includes('ALL_EXCEPT_ARCHIVED')} onChange={e => setPhaseSelection(e.target.checked ? ['ALL_EXCEPT_ARCHIVED'] : [])} />
                  <span className="text-sm">All except Archived</span>
                </label>
                {phases.map(p => (
                  <label key={p} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={phaseSelection ? phaseSelection.includes(p) : false}
                      onChange={e => {
                        setPhaseSelection(prev => {
                          const next = new Set(prev || []);
                          if (e.target.checked) {
                            next.delete('ALL');
                            next.delete('ALL_EXCEPT_ARCHIVED');
                            next.add(p);
                          } else {
                            next.delete(p);
                          }
                          return Array.from(next);
                        });
                      }}
                    />
                    <span className="text-sm">{p}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-base font-semibold text-gray-700 dark:text-gray-200">Order Columns</div>
               <div className="text-xs text-gray-500 dark:text-gray-400">{columns.length} selected</div>
             </div>
            <ul className="rounded border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800 max-h-[54vh] overflow-y-auto">
              {columns.map((col, idx) => (
                <li key={col} className="flex items-center justify-between gap-3 px-3 py-2 text-sm text-gray-800 dark:text-gray-100">
                  <span>{REPORT_COLUMNS.find(column => column.key === col)?.label || col}</span>
                  <span className="flex items-center gap-1">
                    <button onClick={() => move(idx, -1)} disabled={idx===0} className="px-2 py-1 rounded disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-800">▲</button>
                    <button onClick={() => move(idx, 1)} disabled={idx===columns.length-1} className="px-2 py-1 rounded disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-800">▼</button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex justify-end space-x-2">
          {onDelete && template && !template.preset && (
            <button onClick={() => onDelete(template.id)} className="px-3 py-2 rounded text-red-600">Delete</button>
          )}
          <button onClick={onCancel} className="px-3 py-2 rounded">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-60">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
