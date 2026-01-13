import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  Image as ImageIcon,
  Mail,
  Send,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../utils/supabase';
import { formatDisplayDate } from '../lib/dateUtils';

interface Job {
  id: string;
  job_number?: string;
  work_order_num?: number;
  unit_number?: string;
  scheduled_date?: string;
  completed_date?: string;
  property?: {
    name?: string;
    address?: string;
    address_2?: string;
    city?: string;
    state?: string;
    zip?: string;
    ap_email?: string;
    ap_name?: string;
  };
  job_type?: {
    label?: string;
  };
  job_phase?: {
    label?: string;
  };
  extra_charges_details?: {
    description?: string;
    hours?: number;
    bill_amount?: number;
    sub_pay_amount?: number;
    profit_amount?: number;
  };
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  signature: string;
  template_type: string;
  trigger_phase?: string;
  description?: string | null;
  included_sections?: string[] | null;
}

interface JobImage {
  id: string;
  file_path: string;
  file_name: string;
  image_type?: string;
  created_at: string;
}

type ImageBucket = 'before' | 'after' | 'sprinkler' | 'other';

interface JobImageWithMeta extends JobImage {
  normalizedType: ImageBucket;
  publicUrl: string;
  source: 'job_images' | 'files';
}

interface EmailConfiguration {
  from_email: string;
  from_name: string;
  default_bcc_emails: string[];
}

interface EnhancedPropertyNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: Job | null;
  notificationType: 'extra_charges' | 'sprinkler_paint' | 'drywall_repairs';
  onSent?: () => void;
  additionalServices?: Array<{
    label: string;
    quantity: number;
    unit_label?: string;
    bill_amount: number;
  }>;
}

const STORAGE_BUCKET = 'job-images';
const INPUT_FIELD_CLASSES =
  'mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/60 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100';
const TEXTAREA_CLASSES =
  'mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-base text-gray-900 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/60 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100';
const SECTION_LABELS: Record<string, string> = {
  job_details: 'Job Details',
  billing_details: 'Billing Details',
  before_images: 'Before Images',
  after_images: 'After Images',
  sprinkler_images: 'Sprinkler Images',
  other_images: 'Additional Images'
};

const IMAGE_TYPE_LABELS: Record<ImageBucket, string> = {
  before: 'Before',
  after: 'After',
  sprinkler: 'Sprinkler',
  other: 'Other'
};

const IMAGE_PREVIEW_DISCLAIMER =
  'Images shown in this email are quick previews—the full-resolution files remain available on the approval review page.';

const formatCurrency = (value?: number | null) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '$0.00';
  }
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
};

const formatPlainCurrency = (value?: number | null) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '';
  }
  return value.toFixed(2);
};

// Use shared utility to ensure consistent date formatting without timezone issues
const formatDate = (value?: string) => {
  return formatDisplayDate(value);
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const buildApprovalLinkHtml = (link: string) => `
  <div style="margin: 24px 0">
    <a
      href="${link}"
      style="
        background-color:#2563eb;
        color:#ffffff;
        padding:12px 20px;
        border-radius:9999px;
        text-decoration:none;
        font-weight:600;
        display:inline-block;
      "
      target="_blank"
      rel="noopener noreferrer"
    >
      Review & Approve
    </a>
    <div style="margin-top:12px;font-size:12px;color:#6b7280">
      If the button above does not work, copy and paste this link into your browser:<br/>
      <span>${escapeHtml(link)}</span>
    </div>
  </div>
`;

const formatAddress = (job: Job | null): string => {
  if (!job?.property) return '';
  const segments = [
    job.property.address,
    job.property.address_2,
    [job.property.city, job.property.state].filter(Boolean).join(', '),
    job.property.zip,
  ].filter(Boolean);
  return segments.join(', ');
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function EnhancedPropertyNotificationModal({
  isOpen,
  onClose,
  job,
  notificationType,
  onSent,
  additionalServices = [],
}: EnhancedPropertyNotificationModalProps) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailContent, setEmailContent] = useState('');
  const [emailSignature, setEmailSignature] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [ccEmails, setCcEmails] = useState('');
  const [bccEmails, setBccEmails] = useState('');
  const [showCCBCC, setShowCCBCC] = useState(false);
  const [emailConfig, setEmailConfig] = useState<EmailConfiguration | null>(null);
  const [jobImages, setJobImages] = useState<JobImageWithMeta[]>([]);
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [apContactName, setApContactName] = useState('');
  const [pendingApproval, setPendingApproval] = useState<{ expiresAt: string } | null>(null);
  const [countdownTime, setCountdownTime] = useState('');

  const steps = useMemo(
    () => [
      { id: 1, title: 'Select Template' },
      { id: 2, title: 'Customize Email' },
      { id: 3, title: 'Review & Send' },
    ],
    []
  );

  const safeSections = useMemo(() => selectedTemplate?.included_sections ?? [], [selectedTemplate]);
  const selectedImages = useMemo(
    () => jobImages.filter((img) => selectedImageIds.includes(img.id)),
    [jobImages, selectedImageIds]
  );

  const jobDetailsData = useMemo(() => ({
    property_name: job?.property?.name || '',
    property_address: formatAddress(job) || '',
    unit_number: job?.unit_number || '',
    job_type: job?.job_type?.label || '',
    // Just pass the date string through - dates should be handled as-is
    scheduled_date: job?.scheduled_date || '',
    work_order_num: job?.work_order_num || null,
  }), [job]);

  const initializeRecipient = useCallback(async () => {
    if (!job?.property?.id) return;
    try {
      const { data: prop, error } = await supabase
        .from('properties')
        .select('primary_contact_email, ap_email, ap_name')
        .eq('id', job.property.id)
        .single();
      if (error) {
        const fallback = job.property?.primary_contact_email || job.property?.ap_email || '';
        setRecipientEmail(fallback);
        setApContactName(job.property?.ap_name || '');
        return;
      }
      const defaultEmail = prop?.primary_contact_email || prop?.ap_email || '';
      setRecipientEmail(defaultEmail || '');
      setApContactName(prop?.ap_name || job.property?.ap_name || '');
    } catch {
      const fallback = job.property?.primary_contact_email || job.property?.ap_email || '';
      setRecipientEmail(fallback);
      setApContactName(job.property?.ap_name || '');
    }
  }, [job]);

  const normalizeImageType = (image: JobImage): ImageBucket => {
    const source = image.image_type || image.file_name || '';
    const lowered = source.toLowerCase();
    if (lowered.includes('before')) return 'before';
    if (lowered.includes('after')) return 'after';
    if (lowered.includes('sprinkler')) return 'sprinkler';
    return 'other';
  };

  const getPublicUrl = (bucket: string, filePath: string) => {
    if (!filePath) return '';
    const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
    return data.publicUrl;
  };

  const fetchJobImagesFromTable = useCallback(async (): Promise<JobImageWithMeta[]> => {
    if (!job) return [];
    try {
      const { data, error } = await supabase
        .from('job_images')
        .select('*')
        .eq('job_id', job.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []).map((image) => ({
        ...image,
        normalizedType: normalizeImageType(image),
        publicUrl: getPublicUrl(STORAGE_BUCKET, image.file_path),
        source: 'job_images'
      }));
    } catch (error) {
      console.error('Error loading job_images:', error);
      return [];
    }
  }, [job]);

  const findWorkOrderFolderId = useCallback(async (): Promise<string | null> => {
    if (!job?.property?.id || !job?.id || !job?.work_order_num) {
      return null;
    }
    const workOrderCode = `WO-${String(job.work_order_num).padStart(6, '0')}`;
    const { data, error } = await supabase
      .from('files')
      .select('id')
      .eq('job_id', job.id)
      .eq('type', 'folder/directory')
      .eq('name', workOrderCode)
      .maybeSingle();
    if (error || !data?.id) {
      return null;
    }
    return data.id;
  }, [job?.property?.name, job?.work_order_num]);

  const fetchWorkOrderImages = useCallback(async (): Promise<JobImageWithMeta[]> => {
    const folderId = await findWorkOrderFolderId();
    if (!folderId) return [];
    const folderNames: { bucket: ImageBucket; name: string }[] = [
      { bucket: 'before', name: 'Before Images' },
      { bucket: 'after', name: 'After Images' },
      { bucket: 'sprinkler', name: 'Sprinkler Images' },
      { bucket: 'other', name: 'Other Files' },
    ];
    const allFiles: JobImageWithMeta[] = [];
    for (const entry of folderNames) {
      const { data: subfolder } = await supabase
        .from('files')
        .select('id')
        .eq('name', entry.name)
        .eq('folder_id', folderId)
        .eq('type', 'folder/directory')
        .maybeSingle();
      if (!subfolder?.id) continue;
      const { data: filesData } = await supabase
        .from('files')
        .select('id, name, path, type, created_at')
        .eq('folder_id', subfolder.id)
        .order('created_at', { ascending: true });
      if (!filesData?.length) continue;
      for (const file of filesData) {
        const { data: signedData } = await supabase.storage
          .from('files')
          .createSignedUrl(file.path, 60 * 60);
        const publicUrl = signedData?.signedUrl || getPublicUrl('files', file.path);
        allFiles.push({
          id: file.id,
          file_name: file.name,
          file_path: file.path,
          image_type: entry.bucket,
          created_at: file.created_at,
          normalizedType: entry.bucket,
          publicUrl,
          source: 'files'
        });
      }
    }
    return allFiles;
  }, [findWorkOrderFolderId]);

  const fetchModalData = useCallback(async () => {
    if (!job) return;
    try {
      setLoading(true);

      const { data: templateData, error: templateError } = await supabase
        .from('email_templates')
        .select('*')
        .eq('template_category', 'property_notification')
        .eq('is_active', true)
        .order('name');

      if (templateError) throw templateError;

      setTemplates(
        (templateData || []).map((template) => ({
          ...template,
          included_sections: template.included_sections ?? [],
        }))
      );

      const [jobImageResults, workOrderImageResults] = await Promise.all([
        fetchJobImagesFromTable(),
        fetchWorkOrderImages(),
      ]);
      const combined = [...jobImageResults, ...workOrderImageResults];
      setJobImages(combined);
      setSelectedImageIds(combined.map((img) => img.id));

      const { data: configData, error: configError } = await supabase.rpc('get_active_email_configuration');
      if (configError) throw configError;
      setEmailConfig(configData);
    } catch (error) {
      console.error('Error loading modal data:', error);
      toast.error('Failed to load email data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [job, fetchJobImagesFromTable, fetchWorkOrderImages]);

  const processTemplate = useCallback(
    (template: EmailTemplate | null) => {
      if (!template || !job) return { subject: '', body: '', signature: '' };

      const workOrderCode = job.work_order_num
        ? `WO-${String(job.work_order_num).padStart(6, '0')}`
        : job.job_number || job.id?.slice(0, 8)?.toUpperCase() || '';
      const scheduledDate = job.scheduled_date ? formatDate(job.scheduled_date) : '';
      const completionDate = job.completed_date ? formatDate(job.completed_date) : '';
      const propertyAddress = formatAddress(job);
      const apName = apContactName || job.property?.ap_name || '';
      const extraCharges = job.extra_charges_details;

      const replacements: Record<string, string> = {};
      const assignTokens = (value: string | number | null | undefined, tokens: string[]) => {
        if (!tokens.length) return;
        let normalized = '';
        if (typeof value === 'number') {
          normalized = Number.isFinite(value) ? String(value) : '';
        } else if (value) {
          normalized = value;
        }
        tokens.forEach((token) => {
          replacements[token] = normalized;
        });
      };

      assignTokens(job.property?.name, ['property.name', 'property_name']);
      assignTokens(propertyAddress, ['property.address', 'property_address']);
      assignTokens(job.property?.city, ['property.city', 'property_city']);
      assignTokens(job.property?.state, ['property.state', 'property_state']);
      assignTokens(job.property?.zip, ['property.zip', 'property_zip']);
      assignTokens(job.property?.ap_email, ['property.ap_email', 'ap_email']);
      assignTokens(job.property?.ap_name, ['property.ap_name']);

      assignTokens(job.unit_number, ['job.unit_number', 'unit_number']);
      assignTokens(workOrderCode, ['job.work_order_num', 'job_number', 'work_order_number']);
      assignTokens(job.job_type?.label, ['job.type', 'job_type']);
      assignTokens(job.job_phase?.label, ['job.phase', 'job_phase']);
      assignTokens(scheduledDate, ['job.scheduled_date', 'scheduled_date']);
      assignTokens(completionDate, ['job.completed_date', 'completion_date']);

      assignTokens(apName, ['ap_contact.name', 'ap_contact_name']);

      // Add common recipient name variations that might appear in templates
      assignTokens(apName, [
        'recipient_name',
        'contact_name', 
        'name',
        'property_owner',
        'property_owner_name',
        'manager_name',
        'recipient'
      ]);

      assignTokens(extraCharges?.description, ['extra_charges.description', 'extra_charges_description']);
      assignTokens(
        typeof extraCharges?.hours === 'number' ? extraCharges.hours.toString() : '',
        ['extra_charges.hours', 'extra_hours']
      );
      assignTokens(formatPlainCurrency(extraCharges?.bill_amount), [
        'estimated_cost',
        'extra_charges.bill_amount_plain',
      ]);
      assignTokens(formatCurrency(extraCharges?.bill_amount), [
        'extra_charges.bill_amount',
        'extra_charges.bill_amount_formatted',
      ]);
      assignTokens(formatCurrency(extraCharges?.sub_pay_amount), [
        'extra_charges.sub_pay_amount',
        'extra_charges.sub_pay_amount_formatted',
      ]);
      assignTokens(formatCurrency(extraCharges?.profit_amount), [
        'extra_charges.profit_amount',
        'extra_charges.profit_amount_formatted',
      ]);

      const applyTokens = (text: string) => {
        let processed = text;
        
        // First pass: Replace all known tokens
        Object.entries(replacements).forEach(([token, value]) => {
          const single = new RegExp(`\\{\\s*${escapeRegExp(token)}\\s*\\}`, 'gi');
          const double = new RegExp(`\\{\\{\\s*${escapeRegExp(token)}\\s*\\}\\}`, 'gi');
          processed = processed.replace(single, value).replace(double, value);
        });
        
        // Second pass: Clean up any remaining unmatched brackets with content
        // This prevents {SomeName} or {SomeValue} from showing if they weren't in our token list
        // But preserve the content inside the brackets
        processed = processed.replace(/\{([^{}]+)\}/g, '$1');
        
        return processed;
      };

      return {
        subject: applyTokens(template.subject),
        body: applyTokens(template.body),
        signature: applyTokens(template.signature),
      };
    },
    [job, apContactName]
  );

  const checkPendingApproval = useCallback(async () => {
    if (!job || notificationType !== 'extra_charges') {
      setPendingApproval(null);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('approval_tokens')
        .select('id, expires_at, used_at')
        .eq('job_id', job.id)
        .eq('approval_type', 'extra_charges')
        .is('used_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        setPendingApproval(null);
        return;
      }

      const expiresAt = new Date(data.expires_at);
      if (expiresAt.getTime() <= Date.now()) {
        setPendingApproval(null);
        return;
      }

      setPendingApproval({ expiresAt: data.expires_at });
    } catch (error) {
      console.error('Error checking pending approval:', error);
      setPendingApproval(null);
    }
  }, [job, notificationType]);

  useEffect(() => {
    if (isOpen && job) {
      initializeRecipient();
      fetchModalData();
      checkPendingApproval();
      setCurrentStep(1);
      setSelectedTemplate(null);
    }
  }, [isOpen, job, fetchModalData, initializeRecipient, checkPendingApproval]);

  useEffect(() => {
    if (selectedTemplate) {
      const processed = processTemplate(selectedTemplate);
      setEmailSubject(processed.subject);
      setEmailContent(processed.body);
      setEmailSignature(processed.signature);
    }
  }, [selectedTemplate, processTemplate]);

  useEffect(() => {
    if (!pendingApproval) {
      setCountdownTime('');
      return;
    }

    const interval = setInterval(() => {
      const timeLeft = new Date(pendingApproval.expiresAt).getTime() - Date.now();
      if (timeLeft <= 0) {
        setPendingApproval(null);
        setCountdownTime('');
        clearInterval(interval);
      } else {
        const minutes = Math.floor(timeLeft / 60000);
        const seconds = Math.floor((timeLeft % 60000) / 1000);
        setCountdownTime(`${minutes}:${seconds.toString().padStart(2, '0')}`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [pendingApproval]);

  const toggleImageSelection = (imageId: string) => {
    setSelectedImageIds((prev) =>
      prev.includes(imageId) ? prev.filter((id) => id !== imageId) : [...prev, imageId]
    );
  };

  const selectAllImages = () => setSelectedImageIds(jobImages.map((img) => img.id));
  const clearImages = () => setSelectedImageIds([]);

  const buildJobDetailsRows = () => [
    { label: 'Property', value: jobDetailsData.property_name || '—' },
    { label: 'Address', value: jobDetailsData.property_address || '—' },
    { label: 'Unit', value: jobDetailsData.unit_number || '—' },
    { label: 'Job Type', value: jobDetailsData.job_type || '—' },
    { label: 'Scheduled', value: jobDetailsData.scheduled_date ? formatDate(jobDetailsData.scheduled_date) : '—' },
    {
      label: 'Work Order #',
      value: jobDetailsData.work_order_num ? `WO-${String(jobDetailsData.work_order_num).padStart(6, '0')}` : '—',
    },
  ];

  const buildBillingItems = () => {
    const items: Array<{
      description: string;
      hours?: number;
      quantity?: number;
      unit?: string;
      bill_amount: number;
      sub_pay_amount?: number;
      profit_amount?: number;
    }> = [];

    // Add Additional Services
    if (additionalServices?.length) {
      items.push(...additionalServices.map(svc => ({
        description: svc.label,
        quantity: svc.quantity,
        unit: svc.unit_label,
        bill_amount: svc.bill_amount,
      })));
    }

    // Add Extra Charges (Labor)
    if (job?.extra_charges_details) {
      const details = job.extra_charges_details;
      items.push({
        description: details.description || 'Extra Charges',
        hours: details.hours,
        bill_amount: details.bill_amount || 0,
        sub_pay_amount: details.sub_pay_amount,
        profit_amount: details.profit_amount,
      });
    }

    return items;
  };

  const renderJobDetailsPreview = () => {
    if (!safeSections.includes('job_details') || !job) return null;
    const rows = buildJobDetailsRows();
    return (
      <div className="space-y-3">
        <h4 className="text-base font-semibold text-gray-900 dark:text-white">Job Details</h4>
        <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
          {rows.map((row) => (
            <div key={row.label}>
              <dt className="text-sm text-gray-500 dark:text-gray-400">{row.label}</dt>
              <dd className="mt-1 text-sm font-medium text-gray-900 dark:text-white">{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    );
  };

  const renderBillingPreview = () => {
    if (!safeSections.includes('billing_details')) return null;
    const items = buildBillingItems();
    if (!items.length) {
      return (
        <div>
          <h4 className="text-base font-semibold text-gray-900 dark:text-white">Billing Details</h4>
          <p className="text-sm text-gray-500 dark:text-gray-400">No billing details available for this job.</p>
        </div>
      );
    }

    const total = items.reduce((sum, item) => sum + (item.bill_amount || 0), 0);

    return (
      <div>
        <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2">Billing Details</h4>
        <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-600">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600 text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">Description</th>
                <th className="px-4 py-2 text-right font-semibold">Hours</th>
                <th className="px-4 py-2 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={`${item.description}-${idx}`} className="bg-white dark:bg-gray-800">
                  <td className="px-4 py-2 text-gray-900 dark:text-white">{item.description}</td>
                  <td className="px-4 py-2 text-right text-gray-600 dark:text-gray-300">{item.hours ?? '—'}</td>
                  <td className="px-4 py-2 text-right font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(item.bill_amount)}
                  </td>
                </tr>
              ))}
              <tr className="bg-gray-50 dark:bg-gray-700">
                <td className="px-4 py-2 font-semibold">Total</td>
                <td className="px-4 py-2" />
                <td className="px-4 py-2 text-right font-semibold">{formatCurrency(total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderImagePreview = (bucket: ImageBucket, sectionKey: string) => {
    if (!safeSections.includes(sectionKey)) return null;
    const images = selectedImages.filter((img) => img.normalizedType === bucket);
    if (!images.length) return null;

    return (
      <div>
        <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2">{IMAGE_TYPE_LABELS[bucket]} Images</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {images.map((image) => (
            <div key={image.id} className="space-y-2">
              <div className="relative">
                <img src={image.publicUrl} alt={image.file_name} className="h-28 w-full object-cover rounded-lg border border-gray-200 dark:border-gray-600" />
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-300 truncate">{image.file_name}</p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const buildSectionHtml = () => {
    const sections: string[] = [];
    const rows = buildJobDetailsRows();

    if (safeSections.includes('job_details') && rows.length) {
      const rowsHtml = rows
        .map((row) => `
          <tr>
            <td style="padding:8px 16px;background:#f9fafb;font-weight:600;width:160px;">${escapeHtml(row.label)}</td>
            <td style="padding:8px 16px;">${escapeHtml(row.value)}</td>
          </tr>
        `)
        .join('');
      sections.push(`
        <h3 style="margin:24px 0 8px;font-size:16px;color:#111827;">Job Details</h3>
        <table style="width:100%;border-collapse:collapse;font-size:14px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
          <tbody>${rowsHtml}</tbody>
        </table>
      `);
    }

    if (safeSections.includes('billing_details')) {
      const items = buildBillingItems();
      if (items.length) {
        const rowsHtml = items
          .map(
            (item) => `
              <tr>
                <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;">${escapeHtml(item.description || '')}</td>
                <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;text-align:right;">${item.hours ?? ''}</td>
                <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">${formatCurrency(item.bill_amount)}</td>
              </tr>
            `
          )
          .join('');
        const total = items.reduce((sum, item) => sum + (item.bill_amount || 0), 0);
        sections.push(`
          <h3 style="margin:24px 0 8px;font-size:16px;color:#111827;">Billing Details</h3>
          <table style="width:100%;border-collapse:collapse;font-size:14px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
            <thead>
              <tr style="background:#f9fafb;">
                <th style="padding:12px 16px;text-align:left;">Description</th>
                <th style="padding:12px 16px;text-align:right;">Hours</th>
                <th style="padding:12px 16px;text-align:right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
              <tr>
                <td></td>
                <td style="padding:12px 16px;text-align:right;font-weight:600;">Total</td>
                <td style="padding:12px 16px;text-align:right;font-weight:700;">${formatCurrency(total)}</td>
              </tr>
            </tbody>
          </table>
        `);
      }
    }

    const imageSection = (bucket: ImageBucket, key: string) => {
      if (!safeSections.includes(key)) return;
      const images = selectedImages.filter((img) => img.normalizedType === bucket);
      if (!images.length) return;
      const cards = images
        .map(
          (image) => `
            <td style="padding:8px;">
              <img src="${image.publicUrl}" alt="${escapeHtml(image.file_name)}" style="width:100%;max-width:160px;height:120px;object-fit:cover;border-radius:8px;border:1px solid #e5e7eb;" />
              <p style="font-size:12px;color:#6b7280;margin-top:4px;">${escapeHtml(image.file_name)}</p>
            </td>
          `
        )
        .join('');
      sections.push(`
        <h3 style="margin:24px 0 8px;font-size:16px;color:#111827;">${IMAGE_TYPE_LABELS[bucket]} Images</h3>
        <table style="width:100%;border-collapse:collapse;font-size:14px;"><tbody><tr>${cards}</tr></tbody></table>
      `);
    };

    imageSection('before', 'before_images');
    imageSection('after', 'after_images');
    imageSection('sprinkler', 'sprinkler_images');
    imageSection('other', 'other_images');

    return sections.join('\n');
  };

  const buildExtraChargesData = () => {
    const billingItems = buildBillingItems().map((item) => ({
      description: item.description || '',
      cost: item.bill_amount || 0,
      hours: item.hours,
      quantity: item.quantity,
      unit: item.unit,
    }));

    const total = billingItems.reduce((sum, item) => sum + (item.cost || 0), 0);

  return {
    items: billingItems,
    total,
    job_details: jobDetailsData,
    selected_images: selectedImageIds,
    selected_image_types: selectedImages.map((img) => img.normalizedType),
    selected_image_entries: selectedImages.map((img) => ({
      id: img.id,
      source: img.source,
      file_path: img.file_path,
      file_name: img.file_name,
      bucket: img.source === 'files' ? 'files' : STORAGE_BUCKET,
      normalized_type: img.normalizedType,
    })),
  };
};

  const createApprovalToken = async (params: { isPreview?: boolean }) => {
    if (!job) throw new Error('Job not available');
    const extraData = buildExtraChargesData();
    if (!extraData.items.length) {
      throw new Error('Billing details are required for approval emails.');
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + (params.isPreview ? 10 : 30) * 60 * 1000).toISOString();

    const { error } = await supabase.from('approval_tokens').insert({
      job_id: job.id,
      token,
      approval_type: params.isPreview ? 'extra_charges_preview' : 'extra_charges',
      approver_email: recipientEmail,
      approver_name: apContactName || null,
      expires_at: expiresAt,
      extra_charges_data: extraData,
    });

    if (error) throw error;
    return { token, expiresAt };
  };

  const buildFinalEmailHtml = (approvalLink?: string) => {
    const bodyHtml = emailContent.trim().startsWith('<')
      ? emailContent
      : emailContent.replace(/\n/g, '<br />');
    const signatureHtml = emailSignature.trim().startsWith('<')
      ? emailSignature
      : emailSignature.replace(/\n/g, '<br />');

    let composedBody = bodyHtml;
    if (approvalLink) {
      composedBody = composedBody
        .replace(/{{\s*approval_link\s*}}/gi, approvalLink)
        .replace(/{{\s*approval_button\s*}}/gi, buildApprovalLinkHtml(approvalLink));
    }

    const sectionHtml = buildSectionHtml();
    const previewDisclaimerHtml =
      notificationType === 'extra_charges' && selectedImages.length > 0
        ? `<p style="margin-top:16px;font-size:12px;color:#6b7280;">${escapeHtml(IMAGE_PREVIEW_DISCLAIMER)}</p>`
        : '';

    return `
      <div style="font-family: 'Inter', Arial, sans-serif; font-size: 14px; color: #111827; line-height: 1.6;">
        ${composedBody}
        ${!composedBody.includes('approval_button') && approvalLink ? buildApprovalLinkHtml(approvalLink) : ''}
        ${sectionHtml}
        ${previewDisclaimerHtml}
        <div style="margin-top: 24px;">${signatureHtml}</div>
      </div>
    `;
  };

  const handlePreview = async () => {
    if (notificationType !== 'extra_charges') {
      toast.info('Preview is only available for approval emails.');
      return;
    }

    try {
      setIsPreviewing(true);
      const tokenRecord = await createApprovalToken({ isPreview: true });
      toast.success('Preview ready in a new tab');
      window.open(`${window.location.origin}/approval/${tokenRecord.token}`, '_blank');
    } catch (error) {
      console.error('Preview error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate preview');
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleSendEmail = async () => {
    if (!selectedTemplate || !job) {
      toast.error('Select a template before sending.');
      return;
    }

    if (!recipientEmail) {
      toast.error('Recipient email is required.');
      return;
    }

    try {
      setSending(true);
      let approvalLink: string | undefined;

      if (notificationType === 'extra_charges') {
        const tokenRecord = await createApprovalToken({ isPreview: false });
        approvalLink = `${window.location.origin}/approval/${tokenRecord.token}`;
        await checkPendingApproval();
      }

      const finalHtml = buildFinalEmailHtml(approvalLink);
      const allBcc = [
        ...(emailConfig?.default_bcc_emails || []),
        ...bccEmails.split(',').map((email) => email.trim()).filter(Boolean),
      ];

      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          to: recipientEmail,
          subject: emailSubject,
          html: finalHtml,
          cc: ccEmails.split(',').map((email) => email.trim()).filter(Boolean),
          bcc: allBcc.filter(Boolean),
          from: emailConfig ? `${emailConfig.from_name} <${emailConfig.from_email}>` : undefined,
        },
      });

      if (error) throw error;

      // If the job is in "Pending Work Order" phase, handle based on notification type
      if (job?.job_phase?.label === 'Pending Work Order') {
        const { data: sessionData } = await supabase.auth.getSession();
        const currentUserId = sessionData?.session?.user?.id;

        if (currentUserId) {
          if (notificationType === 'extra_charges') {
            // For extra charges, just log activity (approval is still needed)
            const { data: phaseData } = await supabase
              .from('job_phases')
              .select('id')
              .eq('job_phase_label', 'Pending Work Order')
              .single();

            if (phaseData) {
              // Log activity as a phase change (to same phase) to track the approval email
              await supabase.from('job_phase_changes').insert({
                job_id: job.id,
                from_phase_id: phaseData.id,
                to_phase_id: phaseData.id,
                changed_by: currentUserId,
                changed_at: new Date().toISOString(),
                notes: `Extra charges approval email sent to ${recipientEmail}`
              });
            }
          } else {
            // For notification-only emails (sprinkler_paint, drywall_repairs), 
            // auto-advance from Pending Work Order to Work Order
            const { data: pendingPhaseData } = await supabase
              .from('job_phases')
              .select('id')
              .eq('job_phase_label', 'Pending Work Order')
              .single();

            const { data: workOrderPhaseData } = await supabase
              .from('job_phases')
              .select('id')
              .eq('job_phase_label', 'Work Order')
              .single();

            if (pendingPhaseData && workOrderPhaseData) {
              // Update the job phase to Work Order
              await supabase
                .from('jobs')
                .update({ current_phase_id: workOrderPhaseData.id })
                .eq('id', job.id);

              // Log the phase change
              await supabase.from('job_phase_changes').insert({
                job_id: job.id,
                from_phase_id: pendingPhaseData.id,
                to_phase_id: workOrderPhaseData.id,
                changed_by: currentUserId,
                changed_at: new Date().toISOString(),
                notes: `Notification email (${notificationType === 'sprinkler_paint' ? 'Sprinkler Paint' : 'Drywall Repairs'}) sent to ${recipientEmail} - Job auto-advanced to Work Order`
              });
            }
          }
        }
      }

      toast.success('Email sent successfully');
      onSent?.();
      onClose();
    } catch (error) {
      console.error('Send error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  const renderImageSelection = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium text-gray-900 dark:text-white">Images to include</h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">Selected images will be shown on the approval page.</p>
        </div>
        {jobImages.length > 0 && (
          <div className="space-x-2">
            <button onClick={selectAllImages} type="button" className="text-xs font-medium text-blue-600 dark:text-blue-400">Select all</button>
            <button onClick={clearImages} type="button" className="text-xs font-medium text-gray-500 dark:text-gray-300">Clear</button>
          </div>
        )}
      </div>
      {loading ? (
        <div className="flex items-center space-x-2 rounded-md border border-dashed border-gray-300 dark:border-gray-600 p-4 text-sm text-gray-500 dark:text-gray-300">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <span>Loading images…</span>
        </div>
      ) : jobImages.length === 0 ? (
        <div className="flex items-center space-x-2 rounded-md border border-dashed border-gray-300 dark:border-gray-600 p-4 text-sm text-gray-500 dark:text-gray-300">
          <ImageIcon className="h-4 w-4" />
          <span>No job or work order images found.</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {jobImages.map((image) => {
            const selected = selectedImageIds.includes(image.id);
            return (
              <button
                type="button"
                key={image.id}
                onClick={() => toggleImageSelection(image.id)}
                className={`relative overflow-hidden rounded-lg border text-left transition ${selected ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800' : 'border-gray-200 dark:border-gray-700'}`}
              >
                <img src={image.publicUrl} alt={image.file_name} className="h-28 w-full object-cover" />
                <div className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full border border-white bg-black/50">
                  {selected ? <Check className="h-3 w-3 text-white" /> : <span className="h-2 w-2 rounded-full bg-white" />}
                </div>
                <div className="p-2">
                  <p className="truncate text-xs font-medium text-gray-900 dark:text-white">{image.file_name}</p>
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    <span>{IMAGE_TYPE_LABELS[image.normalizedType]}</span>
                    <span>{image.source === 'files' ? 'File Manager' : 'Job Uploads'}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderTemplateStep = () => (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-gray-600 dark:text-gray-400">Choose the template that best matches the email you need to send.</p>
      </div>
      {loading ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-300">
          Loading templates…
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-300">
          No templates available.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {templates.map((template) => {
            const isSelected = selectedTemplate?.id === template.id;
            const sections = template.included_sections ?? [];
            return (
              <button
                key={template.id}
                type="button"
                onClick={() => setSelectedTemplate(template)}
                className={`text-left rounded-xl border bg-white/70 p-4 shadow-sm transition dark:bg-gray-900/60 ${
                  isSelected
                    ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-600'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-base font-semibold text-gray-900 dark:text-white">{template.name}</p>
                    <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      {template.template_type === 'extra_charges' ? 'Approval' : 'Notification'} Template
                    </p>
                  </div>
                  {isSelected && <Check className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
                </div>
                {template.description && (
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{template.description}</p>
                )}
                {template.trigger_phase && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Triggers on phase: {template.trigger_phase}</p>
                )}
                {sections.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {sections.map((section) => (
                      <span key={section} className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
                        {SECTION_LABELS[section] || section}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderComposeStep = () => {
    if (!selectedTemplate) {
      return (
        <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-300">
          Select a template to continue.
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">To</label>
            <input
              type="email"
              value={recipientEmail}
              onChange={(event) => setRecipientEmail(event.target.value)}
              className={INPUT_FIELD_CLASSES}
            />
          </div>
          <div>
            <button
              type="button"
              onClick={() => setShowCCBCC((value) => !value)}
              className="text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              {showCCBCC ? 'Hide CC/BCC' : 'Add CC/BCC'}
            </button>
            {showCCBCC && (
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">CC</label>
                  <input
                    type="text"
                    value={ccEmails}
                    onChange={(event) => setCcEmails(event.target.value)}
                    placeholder="user@example.com, another@example.com"
                    className={INPUT_FIELD_CLASSES}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">BCC</label>
                  <input
                    type="text"
                    value={bccEmails}
                    onChange={(event) => setBccEmails(event.target.value)}
                    placeholder="user@example.com, another@example.com"
                    className={INPUT_FIELD_CLASSES}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subject</label>
          <input
            type="text"
            value={emailSubject}
            onChange={(event) => setEmailSubject(event.target.value)}
            className={INPUT_FIELD_CLASSES}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Message</label>
          <textarea
            rows={6}
            value={emailContent}
            onChange={(event) => setEmailContent(event.target.value)}
            className={`${TEXTAREA_CLASSES} min-h-[180px]`}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Signature</label>
          <textarea
            rows={3}
            value={emailSignature}
            onChange={(event) => setEmailSignature(event.target.value)}
            className={`${TEXTAREA_CLASSES} min-h-[120px]`}
          />
        </div>

        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Included Sections</h4>
          {safeSections.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No additional sections will be included.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {safeSections.map((section) => (
                <span key={section} className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">
                  {SECTION_LABELS[section] || section}
                </span>
              ))}
            </div>
          )}
        </div>

        {notificationType === 'extra_charges' && renderImageSelection()}
      </div>
    );
  };

  const renderReviewStep = () => (
    <div className="space-y-6">
      {pendingApproval && countdownTime && (
        <div className="flex items-center space-x-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
          <AlertCircle className="h-5 w-5" />
          <div>
            <p className="text-sm font-medium">Pending approval</p>
            <p className="text-xs">A previous approval link is active for {countdownTime}.</p>
          </div>
        </div>
      )}

      {notificationType === 'extra_charges' && (
        <div className="flex items-start space-x-3 rounded-md border border-blue-200 bg-blue-50 p-4 text-blue-800 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-200">
          <Mail className="h-5 w-5 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">Internal Notification Enabled</p>
            <p className="text-xs mt-1">
              When the property owner approves or declines these Extra Charges, your configured internal notification emails will automatically receive an update. 
              <a href="/dashboard/settings" target="_blank" className="underline font-medium hover:text-blue-900 dark:hover:text-blue-100 ml-1">
                Configure notification emails in Email Settings →
              </a>
            </p>
          </div>
        </div>
      )}

      <div className="space-y-4 rounded-lg border border-gray-200 p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/50">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">Email Preview</h3>
        <div className="prose prose-sm max-w-none text-gray-900 dark:text-gray-100 dark:prose-invert" dangerouslySetInnerHTML={{ __html: emailContent.replace(/\n/g, '<br/>') }} />
        {renderJobDetailsPreview()}
        {renderBillingPreview()}
        {renderImagePreview('before', 'before_images')}
        {renderImagePreview('after', 'after_images')}
        {renderImagePreview('sprinkler', 'sprinkler_images')}
        {renderImagePreview('other', 'other_images')}
        {notificationType === 'extra_charges' && selectedImages.length > 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-300">
            {IMAGE_PREVIEW_DISCLAIMER}
          </p>
        )}
        <div className="prose prose-sm max-w-none text-gray-900 dark:text-gray-100 dark:prose-invert" dangerouslySetInnerHTML={{ __html: emailSignature.replace(/\n/g, '<br/>') }} />
      </div>
    </div>
  );

  if (!isOpen) return null;

  const totalSteps = steps.length;
  const canProceedToNext = currentStep === 1
    ? Boolean(selectedTemplate)
    : currentStep === 2
      ? Boolean(selectedTemplate && recipientEmail.trim() && emailSubject.trim())
      : false;
  const isFinalStep = currentStep === totalSteps;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[95vh] w-full max-w-4xl flex-col rounded-lg bg-white shadow-2xl dark:bg-gray-800">
        <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <Mail className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Send Property Notification</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <ol className="flex items-center space-x-4 text-sm">
            {steps.map((step, index) => (
              <li key={step.id} className="flex items-center">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${currentStep >= step.id ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-300'}`}>
                  {step.id}
                </div>
                <span className={`ml-2 text-sm font-medium ${currentStep >= step.id ? 'text-blue-600 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400'}`}>
                  {step.title}
                </span>
                {index < steps.length - 1 && (
                  <div className={`ml-4 mr-4 h-0.5 w-10 ${currentStep > step.id ? 'bg-blue-500 dark:bg-blue-400' : 'bg-gray-200 dark:bg-gray-700'}`} />
                )}
              </li>
            ))}
          </ol>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {currentStep === 1 && renderTemplateStep()}
          {currentStep === 2 && renderComposeStep()}
          {currentStep === 3 && renderReviewStep()}
        </div>

        <div className="flex items-center justify-between border-t border-gray-200 p-4 dark:border-gray-700">
          <button
            type="button"
            disabled={currentStep === 1}
            onClick={() => setCurrentStep((step) => Math.max(1, step - 1))}
            className="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <ChevronLeft className="mr-2 h-4 w-4" /> Back
          </button>
          <div className="flex items-center space-x-3">
            {isFinalStep && notificationType === 'extra_charges' && (
              <button
                type="button"
                onClick={handlePreview}
                disabled={isPreviewing || !recipientEmail}
                className="inline-flex items-center rounded-md bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed dark:bg-blue-900/30 dark:text-blue-200"
              >
                {isPreviewing ? <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" /> : <Eye className="mr-2 h-4 w-4" />}
                Preview Recipient View
              </button>
            )}
            {isFinalStep ? (
              <button
                type="button"
                onClick={handleSendEmail}
                disabled={sending || !selectedTemplate || !recipientEmail}
                className="inline-flex items-center rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-green-300"
              >
                {sending ? <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Send className="mr-2 h-4 w-4" />}
                Send Email
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setCurrentStep((step) => Math.min(totalSteps, step + 1))}
                disabled={!canProceedToNext}
                className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                Next <ChevronRight className="ml-2 h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
