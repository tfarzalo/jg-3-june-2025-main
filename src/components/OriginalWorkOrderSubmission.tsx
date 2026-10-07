import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Camera, Droplets, ExternalLink, FileImage, FileText, Lock, MessageSquare, Paintbrush } from 'lucide-react';
import { formatCurrency } from '../lib/utils/formatUtils';
import { supabase } from '../utils/supabase';

interface Props { workOrderId: string }
interface OriginalSubmission {
  id: string; submitted_at: string;
  snapshot_payload: { work_order?: Record<string, unknown>; job_context?: Record<string, unknown> };
  submitter?: { full_name?: string | null; email?: string | null } | null;
  jobCategoryName?: string | null;
}
interface OriginalFile {
  id: string; bucket: string; storage_path: string; category?: string | null; file_name: string;
  original_filename?: string | null; mime_type?: string | null; url?: string;
}
type SnapshotRecord = Record<string, unknown>;

const record = (value: unknown): SnapshotRecord => value && typeof value === 'object' && !Array.isArray(value) ? value as SnapshotRecord : {};
const records = (value: unknown): SnapshotRecord[] => Array.isArray(value) ? value.map(record).filter(v => Object.keys(v).length) : [];
const yes = (value: unknown) => value === true;
const number = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
const text = (value: unknown, fallback = '—') => value === null || value === undefined || value === '' ? fallback : String(value);
const title = (value: string) => value.replace(/[_-]+/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
const dateTime = (value: unknown) => {
  if (!value) return '—';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
};

const fileSectionLabels: Record<string, string> = {
  before: 'Before Images', after: 'After Images', other: 'Other Files', job_files: 'Job Files',
  sprinkler_without_cover: 'Sprinkler Images without Cover', sprinkler_with_cover: 'Sprinkler Images with Cover',
  sprinkler_form: 'Signed Sprinkler Head Form',
};

function SectionHeading({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return <h3 className="mb-4 flex items-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"><span className="mr-1.5 text-blue-500">{icon}</span>{children}</h3>;
}

function DetailCard({ label, value, detail }: { label: string; value: React.ReactNode; detail?: React.ReactNode }) {
  return (
    <div className="flex min-h-[96px] flex-col justify-center rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
      <span className="text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">{label}</span>
      <div className="mt-2 break-words text-base font-bold text-gray-900 dark:text-gray-100">{value}</div>
      {detail && <div className="mt-1.5 text-xs text-gray-600 dark:text-gray-400">{detail}</div>}
    </div>
  );
}

function FileGrid({ files }: { files: OriginalFile[] }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{files.map(file => (
    <a key={file.id} href={file.url} target="_blank" rel="noreferrer" className="group min-w-0 rounded-lg border border-gray-200 bg-white p-2 transition-colors hover:border-blue-300 dark:border-gray-700 dark:bg-[#1E293B] dark:hover:border-blue-600">
      {file.url && file.mime_type?.startsWith('image/')
        ? <img src={file.url} alt={file.original_filename || file.file_name} className="aspect-square w-full rounded object-cover" />
        : <div className="flex aspect-square items-center justify-center rounded bg-gray-100 dark:bg-gray-800"><FileImage className="h-8 w-8 text-gray-500" /></div>}
      <div className="mt-2 flex items-center gap-1 text-xs text-gray-700 dark:text-gray-200"><span className="truncate">{file.original_filename || file.file_name}</span><ExternalLink className="h-3 w-3 shrink-0" /></div>
    </a>
  ))}</div>;
}

export function OriginalWorkOrderSubmission({ workOrderId }: Props) {
  const [submission, setSubmission] = useState<OriginalSubmission | null>(null);
  const [files, setFiles] = useState<OriginalFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true); setError(null);
      const { data, error: submissionError } = await supabase.from('work_order_original_submissions').select('id, submitted_at, submitted_by, snapshot_payload').eq('work_order_id', workOrderId).maybeSingle();
      if (!active) return;
      if (submissionError) { setError(submissionError.message); setLoading(false); return; }
      if (!data) { setSubmission(null); setLoading(false); return; }
      const workOrder = record(record(data.snapshot_payload).work_order);
      const categoryId = typeof workOrder.job_category_id === 'string' ? workOrder.job_category_id : null;
      const [profileResult, filesResult, categoryResult] = await Promise.all([
        supabase.from('profiles').select('full_name, email').eq('id', data.submitted_by).maybeSingle(),
        supabase.from('work_order_original_submission_files').select('*').eq('original_submission_id', data.id).order('uploaded_at'),
        categoryId ? supabase.from('job_categories').select('name').eq('id', categoryId).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      if (!active) return;
      if (filesResult.error) { setError(filesResult.error.message); setLoading(false); return; }
      const resolved = await Promise.all(((filesResult.data || []) as OriginalFile[]).map(async file => {
        const { data: signed } = await supabase.storage.from(file.bucket || 'files').createSignedUrl(file.storage_path, 3600);
        return { ...file, url: signed?.signedUrl };
      }));
      if (!active) return;
      setSubmission({ ...data, submitter: profileResult.data || null, jobCategoryName: categoryResult.data?.name || null } as OriginalSubmission);
      setFiles(resolved); setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [workOrderId]);

  const filesByCategory = useMemo(() => {
    const groups = new Map<string, OriginalFile[]>();
    files.forEach(file => { const key = file.category || 'other'; groups.set(key, [...(groups.get(key) || []), file]); });
    return groups;
  }, [files]);

  if (loading) return <div className="p-4 text-sm text-gray-600 dark:text-gray-300 sm:p-6">Loading original submission…</div>;
  if (error) return <div className="p-4 text-sm text-red-700 dark:text-red-300 sm:p-6">Unable to load Original Submission: {error}</div>;
  if (!submission) return <div className="p-4 sm:p-6"><h3 className="font-semibold text-gray-900 dark:text-white">Original submission unavailable</h3><p className="mt-2 text-sm text-gray-600 dark:text-gray-300">This work order predates Original Submission history, so its initial subcontractor submission cannot be reliably reconstructed.</p></div>;

  const submitter = submission.submitter?.full_name || submission.submitter?.email || 'Subcontractor';
  const workOrder = submission.snapshot_payload.work_order || {};
  const context = submission.snapshot_payload.job_context || {};
  const extraItems = records(workOrder.extra_charges_line_items);
  const miscItems = records(workOrder.misc_additional_cost_items);
  const additionalServices = Object.entries(record(workOrder.additional_services)).filter(([, value]) => typeof value === 'boolean' ? value : value !== null && value !== undefined && value !== '' && value !== 0);
  const services: Array<[string, unknown, unknown?]> = [
    ['Ceilings', workOrder.painted_ceilings, workOrder.ceiling_display_label || (number(workOrder.individual_ceiling_count) ? `${number(workOrder.individual_ceiling_count)} individual` : null)],
    ['Patio', workOrder.painted_patio], ['Garage', workOrder.painted_garage], ['Cabinets', workOrder.painted_cabinets],
    ['Crown Molding', workOrder.painted_crown_molding], ['Front Door', workOrder.painted_front_door],
    ['Accent Wall', workOrder.has_accent_wall, yes(workOrder.has_accent_wall) ? [workOrder.accent_wall_type, number(workOrder.accent_wall_count) ? `${number(workOrder.accent_wall_count)} wall(s)` : null].filter(Boolean).join(' · ') : null],
  ];

  return (
    <div className="space-y-8 p-4 sm:p-6">
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
        <div className="flex items-start gap-3"><Lock className="mt-0.5 h-5 w-5 shrink-0 text-blue-700 dark:text-blue-300" /><div className="min-w-0">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100">Original Subcontractor Submission</h3>
          <p className="mt-1 text-sm text-blue-800 dark:text-blue-200">This preserved, read-only record reflects the subcontractor’s initial submission and does not include subsequent office edits.</p>
          <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-sm text-blue-900 dark:text-blue-100 sm:grid-cols-2">
            <div><dt className="inline font-semibold">Submitted by:</dt> <dd className="inline">{submitter}</dd></div>
            <div><dt className="inline font-semibold">Originally submitted:</dt> <dd className="inline">{dateTime(submission.submitted_at)}</dd></div>
            <div><dt className="inline font-semibold">Property:</dt> <dd className="inline">{text(context.property_name)}</dd></div>
            <div><dt className="inline font-semibold">Work order:</dt> <dd className="inline">{context.work_order_num ? `WO-${String(context.work_order_num).padStart(6, '0')}` : '—'}</dd></div>
          </dl>
        </div></div>
      </div>

      <section><SectionHeading icon={<FileText className="h-4 w-4" />}>Work Order Information</SectionHeading><div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <DetailCard label="Submission Date" value={dateTime(workOrder.submission_date || submission.submitted_at)} detail={`Submitted by ${submitter}`} />
        <DetailCard label="Unit" value={text(workOrder.unit_number)} detail={workOrder.unit_size ? `Unit size: ${text(workOrder.unit_size)}` : undefined} />
        <DetailCard label="Occupied Unit" value={yes(workOrder.is_occupied) ? 'Yes' : 'No'} />
        <DetailCard label="Full Paint" value={yes(workOrder.is_full_paint) ? 'Yes' : 'No'} />
        <DetailCard label="Job Category" value={submission.jobCategoryName || text(workOrder.job_category, 'Not recorded')} />
      </div></section>

      <section><SectionHeading icon={<Droplets className="h-4 w-4" />}>Sprinkler Information</SectionHeading><div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <DetailCard label="Has Sprinklers" value={yes(workOrder.has_sprinklers) ? 'Yes' : 'No'} />
        {yes(workOrder.has_sprinklers) && <><DetailCard label="Sprinklers Painted" value={yes(workOrder.sprinklers_painted) ? 'Yes' : 'No'} /><DetailCard label="Signed Sprinkler Form Left in Unit" value={yes(workOrder.sprinkler_form_left_in_unit) ? 'Yes' : 'No'} /></>}
      </div></section>

      <section><SectionHeading icon={<Paintbrush className="h-4 w-4" />}>Paint &amp; Additional Services</SectionHeading><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {services.map(([label, selected, detail]) => <DetailCard key={label} label={label} value={yes(selected) ? 'Yes' : 'No'} detail={detail ? text(detail) : undefined} />)}
        {additionalServices.map(([key, value]) => <DetailCard key={key} label={title(key)} value={typeof value === 'boolean' ? 'Yes' : text(value)} />)}
      </div></section>

      <section><SectionHeading icon={<AlertCircle className="h-4 w-4" />}>Extra Charges</SectionHeading>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3"><DetailCard label="Has Extra Charges" value={yes(workOrder.has_extra_charges) ? 'Yes' : 'No'} /><DetailCard label="Extra Hours" value={number(workOrder.extra_hours)} /><DetailCard label="Miscellaneous Cost" value={formatCurrency(number(workOrder.repair_cost))} /></div>
        {extraItems.length > 0 && <div className="mt-4 space-y-3">{extraItems.map((item, index) => <div key={text(item.id, String(index))} className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-[#0F172A]"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="font-semibold text-gray-900 dark:text-white">{text(item.description || item.detailName || item.categoryName, `Extra charge ${index + 1}`)}</p>{item.notes ? <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-300">{text(item.notes)}</p> : null}</div><p className="shrink-0 text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(number(item.calculatedBillAmount || item.billAmount || item.price))}</p></div><p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Quantity: {number(item.quantity) || 1}{yes(item.isHourly) ? ' hour(s)' : ''}</p></div>)}</div>}
        {miscItems.length > 0 && <div className="mt-4 space-y-3"><h4 className="text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">Miscellaneous Additional Costs</h4>{miscItems.map((item, index) => <div key={text(item.id, String(index))} className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-[#0F172A] sm:flex-row sm:items-center sm:justify-between"><p className="font-semibold text-gray-900 dark:text-white">{text(item.description, `Miscellaneous cost ${index + 1}`)}</p><p className="shrink-0 text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(number(item.subPay ?? item.sub_pay ?? item.price))}</p></div>)}</div>}
        {workOrder.extra_charges_description ? <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-[#0F172A]"><p className="text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">Description</p><p className="mt-2 whitespace-pre-wrap text-gray-900 dark:text-white">{text(workOrder.extra_charges_description)}</p></div> : null}
      </section>

      {workOrder.additional_comments ? <section><SectionHeading icon={<MessageSquare className="h-4 w-4" />}>Additional Comments</SectionHeading><div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-[#0F172A]"><p className="whitespace-pre-wrap leading-relaxed text-gray-900 dark:text-white">{text(workOrder.additional_comments)}</p></div></section> : null}

      <section><SectionHeading icon={<Camera className="h-4 w-4" />}>Original Submitted Photos and Files</SectionHeading>
        {files.length === 0 ? <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-[#0F172A]"><p className="text-sm text-gray-600 dark:text-gray-300">No files were included in the original submission.</p></div> : <div className="space-y-6">{Array.from(filesByCategory.entries()).map(([category, categoryFiles]) => <div key={category}><h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">{fileSectionLabels[category] || title(category)}</h4><div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-[#0F172A] sm:p-4"><FileGrid files={categoryFiles} /></div></div>)}</div>}
      </section>
    </div>
  );
}
