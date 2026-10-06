import React, { useEffect, useMemo, useState } from 'react';
import { FileImage, Lock, ExternalLink } from 'lucide-react';
import { supabase } from '../utils/supabase';

interface Props {
  workOrderId: string;
}

interface OriginalSubmission {
  id: string;
  submitted_at: string;
  snapshot_payload: {
    work_order?: Record<string, unknown>;
    job_context?: Record<string, unknown>;
  };
  submitter?: { full_name?: string | null; email?: string | null } | null;
}

interface OriginalFile {
  id: string;
  bucket: string;
  storage_path: string;
  category?: string | null;
  file_name: string;
  original_filename?: string | null;
  mime_type?: string | null;
  url?: string;
}

const FIELD_LABELS: Record<string, string> = {
  unit_number: 'Unit', unit_size: 'Unit Size', is_occupied: 'Occupied',
  is_full_paint: 'Full Paint', has_sprinklers: 'Has Sprinklers',
  sprinklers_painted: 'Paint on Sprinklers', sprinkler_form_left_in_unit: 'Signed Sprinkler Form Left in Unit',
  painted_ceilings: 'Painted Ceilings', ceiling_display_label: 'Ceiling Service',
  individual_ceiling_count: 'Individual Ceiling Count', painted_patio: 'Painted Patio',
  painted_garage: 'Painted Garage', painted_cabinets: 'Painted Cabinets',
  painted_crown_molding: 'Painted Crown Molding', painted_front_door: 'Painted Front Door',
  has_accent_wall: 'Accent Wall', accent_wall_type: 'Accent Wall Type',
  accent_wall_count: 'Accent Wall Count', has_extra_charges: 'Extra Charges',
  extra_charges_description: 'Extra Charge Description', extra_hours: 'Extra Hours',
  extra_charges_line_items: 'Extra Charge Items', misc_additional_cost_items: 'Miscellaneous Additional Costs',
  repair_cost: 'Repair / Miscellaneous Cost', repair_description: 'Repair / Miscellaneous Description',
  additional_services: 'Additional Services', additional_comments: 'Additional Comments',
  submission_date: 'Submission Date', bill_amount: 'Bill Amount', sub_pay_amount: 'Subcontractor Pay',
  profit_amount: 'Profit Amount', is_hourly: 'Hourly Work',
};

const formatValue = (value: unknown) => {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) {
    if (value.length === 0) return 'None';
    return value.map(item => typeof item === 'object' ? JSON.stringify(item) : String(item)).join('\n');
  }
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
};

export function OriginalWorkOrderSubmission({ workOrderId }: Props) {
  const [submission, setSubmission] = useState<OriginalSubmission | null>(null);
  const [files, setFiles] = useState<OriginalFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      const { data, error: submissionError } = await supabase
        .from('work_order_original_submissions')
        .select('id, submitted_at, submitted_by, snapshot_payload')
        .eq('work_order_id', workOrderId)
        .maybeSingle();
      if (!active) return;
      if (submissionError) {
        setError(submissionError.message);
        setLoading(false);
        return;
      }
      if (!data) {
        setSubmission(null);
        setLoading(false);
        return;
      }

      const [{ data: profile }, { data: fileRows, error: filesError }] = await Promise.all([
        supabase.from('profiles').select('full_name, email').eq('id', data.submitted_by).maybeSingle(),
        supabase.from('work_order_original_submission_files').select('*').eq('original_submission_id', data.id).order('uploaded_at'),
      ]);
      if (!active) return;
      if (filesError) {
        setError(filesError.message);
        setLoading(false);
        return;
      }
      const resolvedFiles = await Promise.all(((fileRows || []) as OriginalFile[]).map(async file => {
        const { data: signed } = await supabase.storage.from(file.bucket || 'files').createSignedUrl(file.storage_path, 3600);
        return { ...file, url: signed?.signedUrl };
      }));
      if (!active) return;
      setSubmission({ ...data, submitter: profile || null } as OriginalSubmission);
      setFiles(resolvedFiles);
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [workOrderId]);

  const fields = useMemo(() => Object.entries(submission?.snapshot_payload?.work_order || {})
    .filter(([key]) => Boolean(FIELD_LABELS[key])), [submission]);

  if (loading) return <div className="p-6 text-sm text-gray-600 dark:text-gray-300">Loading original submission…</div>;
  if (error) return <div className="p-6 text-sm text-red-700 dark:text-red-300">Unable to load Original Submission: {error}</div>;
  if (!submission) {
    return (
      <div className="p-6">
        <h3 className="font-semibold text-gray-900 dark:text-white">Original submission unavailable</h3>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          This work order predates Original Submission history, so its initial subcontractor submission cannot be reliably reconstructed.
        </p>
      </div>
    );
  }

  const submitterName = submission.submitter?.full_name || submission.submitter?.email || 'Subcontractor';
  const jobContext = submission.snapshot_payload?.job_context || {};
  return (
    <div className="p-6 space-y-6">
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
        <div className="flex items-start gap-3">
          <Lock className="mt-0.5 h-5 w-5 text-blue-700 dark:text-blue-300" />
          <div>
            <h3 className="font-semibold text-blue-900 dark:text-blue-100">Original Subcontractor Submission</h3>
            <p className="mt-1 text-sm text-blue-800 dark:text-blue-200">
              This preserved, read-only record reflects the subcontractor’s initial submission and does not include subsequent office edits.
            </p>
            <dl className="mt-3 text-sm text-blue-900 dark:text-blue-100">
              <div><dt className="inline font-semibold">Submitted by:</dt> <dd className="inline">{submitterName}</dd></div>
              <div><dt className="inline font-semibold">Originally submitted:</dt> <dd className="inline">{new Date(submission.submitted_at).toLocaleString()}</dd></div>
              <div><dt className="inline font-semibold">Property:</dt> <dd className="inline">{String(jobContext.property_name || '—')}</dd></div>
              <div><dt className="inline font-semibold">Work order:</dt> <dd className="inline">{jobContext.work_order_num ? `WO-${String(jobContext.work_order_num).padStart(6, '0')}` : '—'}</dd></div>
            </dl>
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {fields.map(([key, value]) => (
          <div key={key} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
            <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {FIELD_LABELS[key] || key.replace(/_/g, ' ')}
            </dt>
            <dd className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-900 dark:text-white">{formatValue(value)}</dd>
          </div>
        ))}
      </dl>

      <section>
        <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">Original Submitted Photos and Files</h3>
        {files.length === 0 ? <p className="text-sm text-gray-600 dark:text-gray-300">No files were included in the original submission.</p> : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {files.map(file => (
              <a key={file.id} href={file.url} target="_blank" rel="noreferrer" className="group rounded-lg border border-gray-200 p-2 dark:border-gray-700">
                {file.url && file.mime_type?.startsWith('image/') ? (
                  <img src={file.url} alt={file.original_filename || file.file_name} className="aspect-square w-full rounded object-cover" />
                ) : (
                  <div className="flex aspect-square items-center justify-center rounded bg-gray-100 dark:bg-gray-800"><FileImage className="h-8 w-8 text-gray-500" /></div>
                )}
                <div className="mt-2 flex items-center gap-1 text-xs text-gray-700 dark:text-gray-200">
                  <span className="truncate">{file.original_filename || file.file_name}</span><ExternalLink className="h-3 w-3 shrink-0" />
                </div>
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
