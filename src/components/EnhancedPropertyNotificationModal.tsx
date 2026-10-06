import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { ExtraChargeLineItem } from '../types/extraCharges';
import { getLineItemBillHours, getLineItemSubPayHours } from '../utils/extraChargesCalculations';
import { getEmailRecipients } from '../lib/contacts/emailRecipientsAdapter';
import {
  CONTACT_TEMPLATE_VARIABLES,
  fetchContactTemplateTokens,
  replaceTemplateTokenValue,
  replaceTemplateTokens,
  splitFullName,
  type ContactTemplateTokens,
} from '../lib/emailTemplateVariables';
import { getPreviewUrl } from '../utils/storagePreviews';
import { FOLDER_KEY_TO_CATEGORY, LEGACY_CATEGORY_ALIASES, normalizeCategory } from '../utils/fileCategories';
import { RichTextEditor } from './RichTextEditor';
import { logJobActivity } from '../lib/jobActivity';
import { getMiscAdditionalCostAmounts } from '../lib/miscAdditionalCosts';
import { config } from '../config/environment';
import { detectImageMime, extensionForImageMime } from '../lib/utils/imageOptimization';

interface Job {
  id: string;
  job_number?: string;
  work_order_num?: number;
  unit_number?: string;
  scheduled_date?: string;
  completed_date?: string;
  assigned_to?: string | null;
  assigned_to_name?: string | null;
  assigned_to_email?: string | null;
  property?: {
    id?: string;
    name?: string;
    address?: string;
    address_2?: string;
    city?: string;
    state?: string;
    zip?: string;
    ap_email?: string;
    ap_name?: string;
    primary_contact_email?: string;
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
  repair_amount?: number | null;
  repair_sub_pay?: number | null;
  work_order?: {
    id?: string | null;
    has_extra_charges?: boolean;
    extra_charges_description?: string;
    extra_hours?: number;
    extra_charges_line_items?: ExtraChargeLineItem[];
    repair_cost?: number | null;
    repair_description?: string | null;
    additional_comments?: string | null;
    misc_additional_cost_items?: Array<{
      id?: string;
      description?: string | null;
      price?: number | string | null;
      subPay?: number | string | null;
    }>;
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
  category?: string | null;
  created_at: string;
}

type ImageBucket = 'before' | 'after' | 'sprinkler' | 'other';
type ApprovalImageType = 'before' | 'sprinkler_without_cover' | 'sprinkler_with_cover' | null;

interface JobImageWithMeta extends JobImage {
  normalizedType: ImageBucket;
  approvalType: ApprovalImageType;
  publicUrl: string;
  source: 'job_images' | 'files';
}

interface EmailConfiguration {
  from_email: string;
  from_name: string;
  default_bcc_emails: string[];
}

interface SelectableEmailRecipient {
  email: string;
  selected: boolean;
  source: 'property' | 'configuration';
}

interface PreparedInlineAttachment {
  filename: string;
  content: string;
  contentType: string;
  encoding: string;
  cid: string;
}

interface PreparedEmailImages {
  key: string;
  cidMap: Record<string, string>;
  inlineAttachments: PreparedInlineAttachment[];
  skippedInlineImages: string[];
}

interface ReviewSizeEstimate extends PreparedEmailImages {
  estimatedMessageBytes: number;
}

interface EnhancedPropertyNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: Job | null;
  notificationType: 'extra_charges' | 'sprinkler_paint' | 'drywall_repairs' | 'general_work_order';
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
  job_details_table: 'Job Details',
  billing_details: 'Billing Details',
  extra_charges_table: 'Billing Details',
  additional_comments: 'Additional Comments',
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
  'Images shown in this email are quick previews. The approval page automatically includes all Before Images and sprinkler images with or without a cover.';
const NOTIFICATION_TYPE_LABELS: Record<EnhancedPropertyNotificationModalProps['notificationType'], string> = {
  extra_charges: 'Extra Charges Approval',
  sprinkler_paint: 'Sprinkler Paint Notification',
  drywall_repairs: 'Drywall Repairs Notification',
  general_work_order: 'Work Order Email',
};
type SentEmailHistoryItem = {
  id: string;
  purpose: string;
  recipient: string;
  subject: string;
  sentAt: string;
};
const BLANK_GENERAL_WORK_ORDER_TEMPLATE_ID = '__blank_general_work_order__';
const EMAIL_SIZE_INFO_BYTES = 5 * 1024 * 1024;
const EMAIL_SIZE_WARNING_BYTES = 8 * 1024 * 1024;
const EMAIL_SIZE_STRONG_WARNING_BYTES = 12 * 1024 * 1024;
const EMAIL_SIZE_MAX_BYTES = 18 * 1024 * 1024;
const ADMIN_COPY_EMAIL = 'admin@jgpaintingprosinc.com';

const formatFileSize = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const estimateEncodedBase64Bytes = (base64: string) => {
  const encodedCharacters = base64.replace(/\s/g, '').length;
  return encodedCharacters + Math.ceil(encodedCharacters / 76) * 2;
};

const parseEmailList = (value: string) => value
  .split(/[;,]/)
  .map((email) => email.trim())
  .filter(Boolean);

const normalizeEmailAddress = (value: string) => {
  const bracketed = value.match(/<([^<>]+)>/);
  return (bracketed?.[1] || value).trim().toLowerCase();
};

const mergeRecipientOptions = (
  current: SelectableEmailRecipient[],
  emails: string[],
  source: SelectableEmailRecipient['source'],
) => {
  const merged = [...current];
  const known = new Set(current.map((recipient) => normalizeEmailAddress(recipient.email)));
  for (const email of emails) {
    const key = normalizeEmailAddress(email);
    if (!key || known.has(key)) continue;
    known.add(key);
    merged.push({ email: email.trim(), selected: true, source });
  }
  return merged;
};

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

const looksLikeHtml = (value: string) => /<\/?[a-z][\s\S]*>/i.test(value);

const plainTextTemplateToHtml = (value: string) => {
  const normalized = value.replace(/\r\n/g, '\n').trim();
  if (!normalized || looksLikeHtml(normalized)) return value;

  return normalized
    .split(/\n{2,}/)
    .map((paragraph) => {
      const lines = paragraph
        .split('\n')
        .map((line) => escapeHtml(line))
        .join('<br />');
      return `<p>${lines}</p>`;
    })
    .join('');
};

export function EnhancedPropertyNotificationModal({
  isOpen,
  onClose,
  job,
  notificationType,
  onSent,
  additionalServices = [],
}: EnhancedPropertyNotificationModalProps) {
  const subjectInputRef = useRef<HTMLInputElement>(null);
  const stepContentRef = useRef<HTMLDivElement>(null);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailContent, setEmailContent] = useState('');
  const [emailSignature, setEmailSignature] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [ccEmails, setCcEmails] = useState('');
  const [ccRecipientOptions, setCcRecipientOptions] = useState<SelectableEmailRecipient[]>([]);
  const [sendAdminCopy, setSendAdminCopy] = useState(true);
  const [showCCBCC, setShowCCBCC] = useState(false);
  const [emailConfig, setEmailConfig] = useState<EmailConfiguration | null>(null);
  const [jobImages, setJobImages] = useState<JobImageWithMeta[]>([]);
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
  const [emailImageChoiceMade, setEmailImageChoiceMade] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [apContactName, setApContactName] = useState('');
  const [primaryRecipientName, setPrimaryRecipientName] = useState('');
  const [contactTemplateTokens, setContactTemplateTokens] = useState<ContactTemplateTokens>({});
  const [sentEmailHistory, setSentEmailHistory] = useState<SentEmailHistoryItem[]>([]);
  const [assignedSubcontractorName, setAssignedSubcontractorName] = useState('');
  const [assignedSubcontractorEmail, setAssignedSubcontractorEmail] = useState('');
  const [reviewSizeEstimate, setReviewSizeEstimate] = useState<ReviewSizeEstimate | null>(null);
  const [reviewSizeLoading, setReviewSizeLoading] = useState(false);
  const isGeneralWorkOrderEmail = notificationType === 'general_work_order';

  useEffect(() => {
    stepContentRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [currentStep]);

  const safeSections = useMemo(() => selectedTemplate?.included_sections ?? [], [selectedTemplate]);
  const isSelectedApprovalTemplate = useMemo(() => {
    if (!selectedTemplate) return false;
    const templateType = selectedTemplate.template_type?.toLowerCase() ?? '';
    const triggerPhase = selectedTemplate.trigger_phase?.toLowerCase() ?? '';
    return templateType === 'approval' || triggerPhase.includes('extra_charges');
  }, [selectedTemplate]);
  const isApprovalEmail = notificationType === 'extra_charges' || isSelectedApprovalTemplate;
  const showsEmailImageSelection = isApprovalEmail || safeSections.some((section) =>
    ['before_images', 'after_images', 'sprinkler_images', 'other_images'].includes(section)
  );
  const steps = useMemo(
    () => isApprovalEmail
      ? [
          { id: 1, title: 'Select Template' },
          { id: 2, title: 'Email Details' },
          { id: 3, title: 'Review & Send' },
        ]
      : [
          { id: 1, title: 'Select Template' },
          { id: 2, title: 'Customize Email' },
          { id: 3, title: 'Review & Send' },
        ],
    [isApprovalEmail]
  );
  const reviewStepId = 3;
  const hasSection = useCallback(
    (...keys: string[]) => keys.some((key) => safeSections.includes(key)),
    [safeSections]
  );
  const selectedImages = useMemo(
    () => jobImages.filter((img) => selectedImageIds.includes(img.id)),
    [jobImages, selectedImageIds]
  );
  const approvalPageImages = useMemo(
    () => jobImages.filter((img) => img.approvalType !== null),
    [jobImages]
  );
  const imagesToEmbed = useMemo(() => selectedImages.filter((img) => {
    if (isApprovalEmail) return true;
    const sectionMap: Record<ImageBucket, string> = {
      before: 'before_images',
      after: 'after_images',
      sprinkler: 'sprinkler_images',
      other: 'other_images',
    };
    return safeSections.includes(sectionMap[img.normalizedType]);
  }), [isApprovalEmail, safeSections, selectedImages]);
  const imagePreparationKey = useMemo(
    () => imagesToEmbed.map((image) => `${image.id}:${image.publicUrl}`).sort().join('|'),
    [imagesToEmbed],
  );
  const finalRecipientLists = useMemo(() => {
    const toKeys = new Set(parseEmailList(recipientEmail).map(normalizeEmailAddress));
    const seen = new Set(toKeys);
    const unique = (values: string[]) => values.filter((email) => {
      const key = normalizeEmailAddress(email);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const cc = unique([
      ...ccRecipientOptions.filter((recipient) => recipient.selected).map((recipient) => recipient.email),
      ...parseEmailList(ccEmails),
    ]);
    const bcc = unique(sendAdminCopy ? [ADMIN_COPY_EMAIL] : []);
    return { cc, bcc };
  }, [ccEmails, ccRecipientOptions, recipientEmail, sendAdminCopy]);
  const additionalComments = useMemo(
    () => (job?.work_order?.additional_comments || '').trim(),
    [job?.work_order?.additional_comments]
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

  const templateVariables = useMemo(
    () => [
      { variable: '{{job_number}}', description: 'Job number (e.g., WO-000123)' },
      { variable: '{{work_order_number}}', description: 'Work order number' },
      { variable: '{{property_name}}', description: 'Property name' },
      { variable: '{{property_address}}', description: 'Full property address' },
      { variable: '{{unit_number}}', description: 'Unit number' },
      { variable: '{{subcontractor_name}}', description: 'Assigned subcontractor name' },
      { variable: '{{subcontractor_email}}', description: 'Assigned subcontractor email' },
      { variable: '{{job_type}}', description: 'Job type' },
      { variable: '{{job_phase}}', description: 'Current job phase' },
      { variable: '{{scheduled_date}}', description: 'Scheduled date' },
      { variable: '{{completion_date}}', description: 'Completed date' },
      { variable: '{{additional_comments}}', description: 'Work order additional comments' },
      { variable: '{{work_order.additional_comments}}', description: 'Work order additional comments' },
      ...CONTACT_TEMPLATE_VARIABLES,
      { variable: '{{extra_charges_description}}', description: 'Extra charges description' },
      { variable: '{{estimated_cost}}', description: 'Estimated extra charges amount (plain number)' },
      { variable: '{{extra_charges.bill_amount}}', description: 'Extra charges amount (formatted)' },
    ],
    []
  );

  const resolveSecondaryEmail = useCallback(async (
    propertyId: string,
    recipient: string,
    propertyData?: {
      community_manager_email?: string | null;
      community_manager_secondary_email?: string | null;
      maintenance_supervisor_email?: string | null;
      maintenance_supervisor_secondary_email?: string | null;
      ap_email?: string | null;
      ap_secondary_email?: string | null;
      primary_contact_email?: string | null;
      primary_contact_secondary_email?: string | null;
    } | null
  ) => {
    if (!recipient) return '';
    let propertyRecord = propertyData || null;

    if (!propertyRecord) {
      const { data, error } = await supabase
        .from('properties')
        .select(`
          community_manager_email,
          community_manager_secondary_email,
          maintenance_supervisor_email,
          maintenance_supervisor_secondary_email,
          ap_email,
          ap_secondary_email,
          primary_contact_email,
          primary_contact_secondary_email
        `)
        .eq('id', propertyId)
        .single();
      if (!error) {
        propertyRecord = data;
      }
    }

    if (propertyRecord) {
      if (propertyRecord.community_manager_email === recipient) {
        return propertyRecord.community_manager_secondary_email || '';
      }
      if (propertyRecord.maintenance_supervisor_email === recipient) {
        return propertyRecord.maintenance_supervisor_secondary_email || '';
      }
      if (propertyRecord.ap_email === recipient) {
        return propertyRecord.ap_secondary_email || '';
      }
      if (propertyRecord.primary_contact_email === recipient) {
        return propertyRecord.primary_contact_secondary_email || '';
      }
    }

    const { data: contact } = await supabase
      .from('property_contacts')
      .select('secondary_email')
      .eq('property_id', propertyId)
      .eq('email', recipient)
      .maybeSingle();
    return contact?.secondary_email || '';
  }, []);

  const initializeRecipient = useCallback(async () => {
    if (!job?.property?.id) return;
    
    // Determine if this is approval or notification email
    const mode = notificationType === 'extra_charges' ? 'approval' : 'notification';
    console.log(`📧 Initializing ${mode} recipients for property:`, job.property.id);
    
    try {
      // Use the centralized email recipients function
      const recipients = await getEmailRecipients(job.property.id, mode, {
        fallbackToManager: true
      });
      
      console.log(`📧 ${mode} email recipients loaded:`, recipients);
      
      // Set To field: primary recipient (with secondary email if available)
      if (recipients.to.length > 0) {
        setRecipientEmail(recipients.to.join(', '));
      }
      
      setCcRecipientOptions((current) => mergeRecipientOptions(current, recipients.cc, 'property'));
      
      // Show CC/BCC fields if there are any
      if (recipients.cc.length > 0) {
        setShowCCBCC(true);
      }
      
      const contactTokens = await fetchContactTemplateTokens(job.property.id);
      setContactTemplateTokens(contactTokens);
      setApContactName(contactTokens.ap_contact_name || job.property?.ap_name || '');
      setPrimaryRecipientName(
        contactTokens.recipient_name ||
        recipients.primaryRecipientName ||
        contactTokens.primary_approval_contact_name ||
        contactTokens.primary_contact_name ||
        ''
      );
      
    } catch (error) {
      console.error(`❌ Error loading ${mode} recipients:`, error);
      // Fallback to property AP email
      const fallback = job.property?.ap_email || '';
      setRecipientEmail(fallback);
      setApContactName(job.property?.ap_name || '');
      setPrimaryRecipientName(job.property?.ap_name || '');
      setContactTemplateTokens({});
    }
  }, [job, notificationType]);

  const fetchAssignedSubcontractor = useCallback(async () => {
    const existingName = job?.assigned_to_name || '';
    const existingEmail = job?.assigned_to_email || '';
    setAssignedSubcontractorName(existingName);
    setAssignedSubcontractorEmail(existingEmail);

    if ((!job?.assigned_to || existingName) && existingEmail) return;
    if (!job?.assigned_to) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', job.assigned_to)
      .maybeSingle();

    if (error) {
      console.warn('Failed to load assigned subcontractor for email template tokens:', error);
      return;
    }

    setAssignedSubcontractorName(data?.full_name || existingName);
    setAssignedSubcontractorEmail(data?.email || existingEmail);
  }, [job?.assigned_to, job?.assigned_to_name, job?.assigned_to_email]);

  const normalizeImageType = (image: JobImage): ImageBucket => {
    const category = normalizeCategory(image.category);
    if (category === 'before_images') return 'before';
    if (category === 'after_images') return 'after';
    if (category === 'sprinkler_images') return 'sprinkler';
    if (category === 'other_files' || category === 'job_files' || category === 'property_files') return 'other';

    const source = image.image_type || image.file_name || '';
    const lowered = source.toLowerCase();
    if (lowered.includes('before')) return 'before';
    if (lowered.includes('after')) return 'after';
    if (lowered.includes('sprinkler')) return 'sprinkler';
    return 'other';
  };

  const normalizeApprovalImageType = (image: JobImage): ApprovalImageType => {
    const category = normalizeCategory(image.category);
    if (category === 'before_images') return 'before';
    if (category === 'sprinkler_without_cover_images') return 'sprinkler_without_cover';
    if (category === 'sprinkler_with_cover_images') return 'sprinkler_with_cover';

    const source = `${image.image_type || ''} ${image.file_name || ''} ${image.file_path || ''}`.toLowerCase();
    if (source.includes('before')) return 'before';
    if (source.includes('sprinkler') && source.includes('without') && source.includes('cover')) {
      return 'sprinkler_without_cover';
    }
    if (source.includes('sprinkler') && source.includes('with') && source.includes('cover')) {
      return 'sprinkler_with_cover';
    }
    return null;
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
        approvalType: normalizeApprovalImageType(image),
        publicUrl: getPublicUrl(STORAGE_BUCKET, image.file_path),
        source: 'job_images'
      }));
    } catch (error) {
      console.error('Error loading job_images:', error);
      return [];
    }
  }, [job]);

  const fetchWorkOrderImages = useCallback(async (): Promise<JobImageWithMeta[]> => {
    if (!job?.id && !job?.work_order?.id) return [];

    try {
      const relevantCategories = Array.from(
        new Set([
          ...LEGACY_CATEGORY_ALIASES[FOLDER_KEY_TO_CATEGORY.before],
          ...LEGACY_CATEGORY_ALIASES[FOLDER_KEY_TO_CATEGORY.after],
          ...LEGACY_CATEGORY_ALIASES[FOLDER_KEY_TO_CATEGORY.sprinkler],
          ...LEGACY_CATEGORY_ALIASES[FOLDER_KEY_TO_CATEGORY.other],
        ])
      );

      let query = supabase
        .from('files')
        .select('id, name, path, storage_path, category, type, created_at, work_order_id, job_id')
        .in('category', relevantCategories)
        .order('created_at', { ascending: true });

      if (job?.work_order?.id && job?.id) {
        query = query.or(`work_order_id.eq.${job.work_order.id},job_id.eq.${job.id}`);
      } else if (job?.work_order?.id) {
        query = query.eq('work_order_id', job.work_order.id);
      } else if (job?.id) {
        query = query.eq('job_id', job.id);
      }

      const { data: filesData, error } = await query;
      if (error) throw error;
      if (!filesData?.length) return [];

      const resolvedFiles = await Promise.all(
        filesData.map(async (file) => {
          const storagePath = file.storage_path || file.path;
          if (!storagePath) return null;

          try {
            const previewResult = await getPreviewUrl(supabase, 'files', storagePath);
            return {
              id: file.id,
              file_name: file.name,
              file_path: storagePath,
              image_type: file.category || file.name,
              category: file.category,
              created_at: file.created_at,
              normalizedType: normalizeImageType({
                id: file.id,
                file_path: storagePath,
                file_name: file.name,
                image_type: file.category || file.name,
                category: file.category,
                created_at: file.created_at,
              }),
              approvalType: normalizeApprovalImageType({
                id: file.id,
                file_path: storagePath,
                file_name: file.name,
                image_type: file.category || file.name,
                category: file.category,
                created_at: file.created_at,
              }),
              publicUrl: previewResult.url,
              source: 'files' as const,
            };
          } catch (previewError) {
            console.error('Error creating preview URL for notification image:', storagePath, previewError);
            const publicUrl = getPublicUrl('files', storagePath);
            return {
              id: file.id,
              file_name: file.name,
              file_path: storagePath,
              image_type: file.category || file.name,
              category: file.category,
              created_at: file.created_at,
              normalizedType: normalizeImageType({
                id: file.id,
                file_path: storagePath,
                file_name: file.name,
                image_type: file.category || file.name,
                category: file.category,
                created_at: file.created_at,
              }),
              approvalType: normalizeApprovalImageType({
                id: file.id,
                file_path: storagePath,
                file_name: file.name,
                image_type: file.category || file.name,
                category: file.category,
                created_at: file.created_at,
              }),
              publicUrl,
              source: 'files' as const,
            };
          }
        })
      );

      return resolvedFiles.filter((file): file is JobImageWithMeta => Boolean(file));
    } catch (error) {
      console.error('Error loading work order images from files table:', error);
      return [];
    }
  }, [job]);

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

      const normalizedTemplates = (templateData || []).map((template) => ({
          ...template,
          included_sections: template.included_sections ?? [],
        }));

      if (notificationType === 'general_work_order') {
        const blankTemplate: EmailTemplate = {
          id: BLANK_GENERAL_WORK_ORDER_TEMPLATE_ID,
          name: 'Write Custom Work Order Email',
          subject: 'Work Order Update - {{job_number}} - {{property_name}}',
          body: '',
          signature: '',
          template_type: 'notification',
          template_category: 'property_notification',
          trigger_phase: 'general_work_order',
          description: 'Start with a blank rich text email and insert variables as needed.',
          included_sections: ['job_details', 'before_images', 'after_images', 'sprinkler_images', 'other_images'],
        } as EmailTemplate;
        setTemplates([blankTemplate, ...normalizedTemplates]);
        setSelectedTemplate(blankTemplate);
      } else {
        setTemplates(normalizedTemplates);
      }

      const [jobImageResults, workOrderImageResults] = await Promise.all([
        fetchJobImagesFromTable(),
        fetchWorkOrderImages(),
      ]);
      const combined = [...jobImageResults, ...workOrderImageResults];
      setJobImages(combined);
      // Images are intentionally opt-in. Selecting every available image by
      // default can increase attachment scanning and quarantine risk.
      setSelectedImageIds([]);
      setEmailImageChoiceMade(false);

      const { data: configData, error: configError } = await supabase.rpc('get_active_email_configuration');
      if (configError) throw configError;
      setEmailConfig(configData);
    } catch (error) {
      console.error('Error loading modal data:', error);
      toast.error('Failed to load email data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [job, notificationType, fetchJobImagesFromTable, fetchWorkOrderImages]);

  const applyEmailTokens = useCallback(
    (text: string) => {
      if (!job) return text;
      const workOrderCode = job.work_order_num
        ? `WO-${String(job.work_order_num).padStart(6, '0')}`
        : job.job_number || job.id?.slice(0, 8)?.toUpperCase() || '';
      const scheduledDate = job.scheduled_date ? formatDate(job.scheduled_date) : '';
      const completionDate = job.completed_date ? formatDate(job.completed_date) : '';
      const propertyAddress = formatAddress(job);
      const apName = apContactName || job.property?.ap_name || '';
      const recipientName = primaryRecipientName || contactTemplateTokens.recipient_name || apName;
      const recipientNameParts = splitFullName(recipientName);
      const subcontractorName = job.assigned_to_name || assignedSubcontractorName || '';
      const subcontractorEmail = job.assigned_to_email || assignedSubcontractorEmail || '';
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
      Object.entries(contactTemplateTokens).forEach(([token, value]) => {
        assignTokens(value, [token]);
      });

      assignTokens(job.unit_number, ['job.unit_number', 'unit_number']);
      assignTokens(workOrderCode, ['job.work_order_num', 'job_number', 'work_order_number']);
      assignTokens(subcontractorName, [
        'subcontractor_name',
        'assigned_subcontractor_name',
        'assigned_to_name',
        'subcontractor.name',
        'assigned_subcontractor.name',
      ]);
      assignTokens(subcontractorEmail, [
        'subcontractor_email',
        'assigned_subcontractor_email',
        'assigned_to_email',
        'subcontractor.email',
        'assigned_subcontractor.email',
      ]);
      assignTokens(job.job_type?.label, ['job.type', 'job_type']);
      assignTokens(job.job_phase?.label, ['job.phase', 'job_phase']);
      assignTokens(scheduledDate, ['job.scheduled_date', 'scheduled_date']);
      assignTokens(completionDate, ['job.completed_date', 'completion_date']);
      assignTokens(additionalComments, [
        'additional_comments',
        'work_order.additional_comments',
        'work_order_additional_comments',
        'job.additional_comments',
      ]);

      assignTokens(apName, ['ap_contact.name', 'ap_contact_name']);

      // Add common recipient name variations that might appear in templates
      assignTokens(recipientName, [
        'recipient_name',
        'recipient_full_name',
        'recipient.full_name',
        'contact_name', 
        'name',
        'property_owner',
        'property_owner_name',
        'manager_name',
        'recipient'
      ]);
      assignTokens(recipientNameParts.firstName, ['recipient_first_name', 'recipient.first_name']);
      assignTokens(recipientNameParts.lastName, ['recipient_last_name', 'recipient.last_name']);
      assignTokens(recipientEmail, ['recipient_email', 'recipient.email']);

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

      let processed = text || '';
        
      // First pass: Replace all known tokens
      Object.entries(replacements).forEach(([token, value]) => {
        processed = replaceTemplateTokenValue(processed, token, value);
      });
        
      return replaceTemplateTokens(processed, contactTemplateTokens);
    },
    [job, apContactName, primaryRecipientName, contactTemplateTokens, assignedSubcontractorName, assignedSubcontractorEmail, recipientEmail, additionalComments]
  );

  const processTemplate = useCallback(
    (template: EmailTemplate | null) => {
      if (!template || !job) return { subject: '', body: '', signature: '' };

      return {
        subject: applyEmailTokens(template.subject),
        body: isGeneralWorkOrderEmail
          ? plainTextTemplateToHtml(applyEmailTokens(template.body))
          : applyEmailTokens(template.body),
        signature: applyEmailTokens(template.signature),
      };
    },
    [job, applyEmailTokens, isGeneralWorkOrderEmail]
  );

  const fetchSentEmailHistory = useCallback(async () => {
    if (!job?.id) {
      setSentEmailHistory([]);
      return;
    }

    const { data, error } = await supabase
      .from('activity_log')
      .select('id, description, metadata, created_at')
      .eq('entity_type', 'job')
      .eq('entity_id', job.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.warn('Failed to load sent email history:', error);
      setSentEmailHistory([]);
      return;
    }

    const history = (data || [])
      .map((activity): SentEmailHistoryItem | null => {
        const metadata = (activity.metadata || {}) as Record<string, unknown>;
        const eventType = typeof metadata.event_type === 'string' ? metadata.event_type : '';
        if (!eventType.endsWith('_email_sent')) return null;

        const notificationTypeValue = typeof metadata.notification_type === 'string'
          ? metadata.notification_type
          : '';
        const purpose = typeof metadata.email_purpose === 'string'
          ? metadata.email_purpose
          : NOTIFICATION_TYPE_LABELS[notificationTypeValue as EnhancedPropertyNotificationModalProps['notificationType']] || 'Email';
        const recipient = typeof metadata.recipient_email === 'string'
          ? metadata.recipient_email
          : activity.description?.replace(/^.* sent to /i, '') || 'Unknown recipient';
        const subject = typeof metadata.subject === 'string' ? metadata.subject : '';

        return {
          id: activity.id,
          purpose,
          recipient,
          subject,
          sentAt: activity.created_at,
        };
      })
      .filter((item): item is SentEmailHistoryItem => Boolean(item));

    setSentEmailHistory(history);
  }, [job?.id]);

  useEffect(() => {
    if (isOpen && job) {
      initializeRecipient();
      fetchAssignedSubcontractor();
      fetchModalData();
      fetchSentEmailHistory();
      setCurrentStep(1);
      setSelectedTemplate(null);
      setRecipientEmail('');
      setCcEmails('');
      setCcRecipientOptions([]);
      setSendAdminCopy(true);
      setShowCCBCC(true);
    }
  }, [isOpen, job, fetchModalData, initializeRecipient, fetchAssignedSubcontractor, fetchSentEmailHistory]);

  useEffect(() => {
    if (selectedTemplate) {
      const processed = processTemplate(selectedTemplate);
      setEmailSubject(processed.subject);
      setEmailContent(processed.body);
      setEmailSignature(processed.signature);
    }
  }, [selectedTemplate, processTemplate]);

  // Keep the recipient controls visible when automatic CC recipients exist.
  useEffect(() => {
    if (
      (ccEmails && ccEmails.trim()) ||
      ccRecipientOptions.length > 0
    ) {
      setShowCCBCC(true);
    }
  }, [ccEmails, ccRecipientOptions.length]);

  const toggleImageSelection = (imageId: string) => {
    setEmailImageChoiceMade(true);
    setSelectedImageIds((prev) =>
      prev.includes(imageId) ? prev.filter((id) => id !== imageId) : [...prev, imageId]
    );
  };

  const selectAllImages = () => {
    setEmailImageChoiceMade(true);
    setSelectedImageIds(jobImages.map((img) => img.id));
  };
  const selectNoEmailImages = () => {
    setEmailImageChoiceMade(true);
    setSelectedImageIds([]);
  };
  const getIdsForBucket = (bucket: ImageBucket) =>
    jobImages.filter((img) => img.normalizedType === bucket).map((img) => img.id);
  const addImagesForBucket = (bucket: ImageBucket) => {
    setEmailImageChoiceMade(true);
    const ids = getIdsForBucket(bucket);
    if (ids.length === 0) return;
    setSelectedImageIds((prev) => Array.from(new Set([...prev, ...ids])));
  };
  const removeImagesForBucket = (bucket: ImageBucket) => {
    setEmailImageChoiceMade(true);
    const ids = new Set(getIdsForBucket(bucket));
    setSelectedImageIds((prev) => prev.filter((id) => !ids.has(id)));
  };

  const insertVariableIntoSubject = (variable: string) => {
    const element = subjectInputRef.current;
    if (!element) {
      setEmailSubject((current) => `${current}${variable}`);
      return;
    }

    const start = element.selectionStart || 0;
    const end = element.selectionEnd || 0;
    const nextValue = emailSubject.substring(0, start) + variable + emailSubject.substring(end);
    setEmailSubject(nextValue);
    setTimeout(() => {
      const cursorPosition = start + variable.length;
      element.setSelectionRange(cursorPosition, cursorPosition);
      element.focus();
    }, 0);
  };

  const insertVariableIntoBody = (variable: string) => {
    setEmailContent((current) => `${current}${current ? ' ' : ''}${variable}`);
  };

  const renderVariableButtons = (onInsert: (variable: string) => void) => (
    <div className="rounded-lg border border-blue-100 bg-blue-50/70 p-3 dark:border-blue-900/40 dark:bg-blue-900/20">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-800 dark:text-blue-200">
        Insert Variables
      </p>
      <div className="flex flex-wrap gap-1.5">
        {templateVariables.map((variable) => (
          <button
            key={variable.variable}
            type="button"
            onClick={() => onInsert(variable.variable)}
            className="rounded bg-white px-2 py-1 text-xs font-mono text-blue-800 shadow-sm hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-100 dark:hover:bg-blue-900"
            title={variable.description}
          >
            {variable.variable}
          </button>
        ))}
      </div>
    </div>
  );

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
      bill_hours?: number;
      sub_pay_hours?: number;
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

    const extraChargeLineItems = Array.isArray(job?.work_order?.extra_charges_line_items)
      ? job?.work_order?.extra_charges_line_items
      : [];

    if (extraChargeLineItems.length > 0) {
      items.push(
        ...extraChargeLineItems.map((item) => {
          const quantity = Number(item.quantity) || 0;
          const billRate = Number(item.billRate) || 0;
          const billHours = getLineItemBillHours(item);
          const subPayHours = getLineItemSubPayHours(item);
          const billAmount = Number(item.calculatedBillAmount ?? quantity * billRate) || 0;
          const descriptionBase = item.description?.trim() || `${item.categoryName || 'Extra Charges'} - ${item.detailName || 'Item'}`;
          const description = item.notes ? `${descriptionBase} (${item.notes})` : descriptionBase;
          return {
            description,
            hours: item.isHourly ? quantity : undefined,
            bill_hours: item.isHourly ? billHours : undefined,
            sub_pay_hours: item.isHourly ? subPayHours : undefined,
            quantity: item.isHourly ? undefined : quantity,
            unit: item.isHourly ? 'hrs' : 'units',
            bill_amount: billAmount,
            sub_pay_amount: Number(item.calculatedSubAmount ?? (quantity * Number(item.subRate || 0))) || undefined,
            profit_amount:
              billAmount -
              (Number(item.calculatedSubAmount ?? (quantity * Number(item.subRate || 0))) || 0),
          };
        })
      );
    } else if (job?.extra_charges_details) {
      const details = job.extra_charges_details;
      items.push({
        description: details.description || 'Extra Charges',
        hours: details.hours,
        bill_amount: details.bill_amount || 0,
        sub_pay_amount: details.sub_pay_amount,
        profit_amount: details.profit_amount,
      });
    }

    const miscItems = Array.isArray(job?.work_order?.misc_additional_cost_items)
      ? job.work_order.misc_additional_cost_items
      : [];

    if (miscItems.length > 0) {
      miscItems.forEach((item) => {
        const { billAmount, subPayAmount } = getMiscAdditionalCostAmounts(item);
        const normalizedSubPay = subPayAmount ?? 0;
        if (billAmount <= 0 && normalizedSubPay <= 0 && !item.description?.trim()) return;

        items.push({
          description: item.description?.trim() || 'Miscellaneous additional cost',
          quantity: 1,
          unit: 'item',
          bill_amount: billAmount,
          sub_pay_amount: normalizedSubPay,
          profit_amount: billAmount - normalizedSubPay,
        });
      });
    } else {
      const repairAmount = Number(job?.repair_amount ?? job?.work_order?.repair_cost ?? 0) || 0;
      if (repairAmount > 0) {
        const repairSubPay = Number(job?.repair_sub_pay ?? 0) || 0;
        items.push({
          description: job?.work_order?.repair_description?.trim() || 'Miscellaneous additional cost',
          quantity: 1,
          unit: 'item',
          bill_amount: repairAmount,
          sub_pay_amount: repairSubPay,
          profit_amount: repairAmount - repairSubPay,
        });
      }
    }

    return items;
  };

  const renderJobDetailsPreview = () => {
    if (!hasSection('job_details', 'job_details_table') || !job) return null;
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
    if (!hasSection('billing_details', 'extra_charges_table')) return null;
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

    const formatQty = (item: { hours?: number; bill_hours?: number; quantity?: number; unit?: string }) => {
      if (typeof item.bill_hours === 'number') {
        return `${item.bill_hours} hrs`;
      }
      if (typeof item.hours === 'number') return `${item.hours} hrs`;
      if (typeof item.quantity === 'number') {
        return item.unit ? `${item.quantity} ${item.unit}` : `${item.quantity}`;
      }
      return '—';
    };

    return (
      <div>
        <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2">Billing Details</h4>
        <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-600">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600 text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">Description</th>
                <th className="px-4 py-2 text-right font-semibold">Qty / Hours</th>
                <th className="px-4 py-2 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={`${item.description}-${idx}`} className="bg-white dark:bg-gray-800">
                  <td className="px-4 py-2 text-gray-900 dark:text-white">{item.description}</td>
                  <td className="px-4 py-2 text-right text-gray-600 dark:text-gray-300">
                    {formatQty(item)}
                  </td>
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

  const renderAdditionalCommentsPreview = () => {
    if (!hasSection('additional_comments') || !additionalComments) return null;

    return (
      <div>
        <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2">Additional Comments</h4>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm leading-relaxed text-gray-800 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 whitespace-pre-wrap">
          {additionalComments}
        </div>
      </div>
    );
  };

  const renderImagePreview = (bucket: ImageBucket, sectionKey: string) => {
    // Approval emails honor the user's explicit selection even when the base
    // template did not originally include that image section.
    if (!isApprovalEmail && !safeSections.includes(sectionKey)) return null;
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

  /**
   * Fetch an image URL and return it as a base64-encoded data URI string,
   * along with the detected content type.  Returns null on failure.
   */
  const fetchImageAsBase64 = async (url: string): Promise<{ base64: string; contentType: string; extension: string } | null> => {
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      const declaredContentType = (response.headers.get('content-type') || '').toLowerCase().split(';')[0].trim();
      const arrayBuffer = await response.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);
      const detectedContentType = detectImageMime(uint8);
      const supportedInlineTypes = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

      // SVG and non-image data are never embedded. HEIC/HEIF and other formats
      // remain safely stored in the application but are not broadly renderable
      // as inline email images.
      if (!detectedContentType || !supportedInlineTypes.has(detectedContentType)) return null;
      if (
        declaredContentType &&
        declaredContentType !== 'application/octet-stream' &&
        declaredContentType !== detectedContentType
      ) {
        console.warn('Skipping inline image with mismatched declared and detected MIME types', {
          declaredContentType,
          detectedContentType,
        });
        return null;
      }

      let binary = '';
      for (let i = 0; i < uint8.byteLength; i++) {
        binary += String.fromCharCode(uint8[i]);
      }
      const base64 = btoa(binary);
      return {
        base64,
        contentType: detectedContentType,
        extension: extensionForImageMime(detectedContentType),
      };
    } catch {
      return null;
    }
  };

  const prepareInlineImages = async (): Promise<PreparedEmailImages> => {
    const cidMap: Record<string, string> = {};
    const inlineAttachments: PreparedInlineAttachment[] = [];
    const skippedInlineImages: string[] = [];

    if (imagesToEmbed.length > 0) {
      const results = await Promise.all(imagesToEmbed.map(async (img) => ({
        img,
        data: await fetchImageAsBase64(img.publicUrl),
      })));

      for (const { img, data } of results) {
        if (!data) {
          skippedInlineImages.push(img.file_name);
          continue;
        }
        const cid = `img_${img.id.replace(/-/g, '')}@jgpaintingprosinc.com`;
        cidMap[img.id] = cid;
        const baseFilename = img.file_name.replace(/\.[^.]+$/, '') || `image_${img.id}`;
        inlineAttachments.push({
          filename: `${baseFilename}.${data.extension}`,
          content: data.base64,
          contentType: data.contentType,
          encoding: 'base64',
          cid,
        });
      }
    }

    return { key: imagePreparationKey, cidMap, inlineAttachments, skippedInlineImages };
  };

  /**
   * Build section HTML for the email body.
   * When cidMap is provided, images are referenced via cid: URIs (inline attachments).
   * When not provided, images are referenced via their public/signed URLs (fallback).
   */
  const buildSectionHtml = (cidMap?: Record<string, string>) => {
    const sections: string[] = [];
    const rows = buildJobDetailsRows();
    const formatQty = (item: { hours?: number; bill_hours?: number; quantity?: number; unit?: string }) => {
      if (typeof item.bill_hours === 'number') {
        return `${item.bill_hours} hrs`;
      }
      if (typeof item.hours === 'number') return `${item.hours} hrs`;
      if (typeof item.quantity === 'number') {
        return item.unit ? `${item.quantity} ${item.unit}` : `${item.quantity}`;
      }
      return '';
    };

    if (hasSection('job_details', 'job_details_table') && rows.length) {
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

    if (hasSection('billing_details', 'extra_charges_table')) {
      const items = buildBillingItems();
      if (items.length) {
        const rowsHtml = items
          .map(
            (item) => `
              <tr>
                <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;">${escapeHtml(item.description || '')}</td>
                <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;text-align:right;">${escapeHtml(formatQty(item))}</td>
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
                <th style="padding:12px 16px;text-align:right;">Qty / Hours</th>
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

    if (hasSection('additional_comments') && additionalComments) {
      sections.push(`
        <h3 style="margin:24px 0 8px;font-size:16px;color:#111827;">Additional Comments</h3>
        <div style="padding:14px 16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;font-size:14px;white-space:pre-wrap;">${escapeHtml(additionalComments)}</div>
      `);
    }

    const imageSection = (bucket: ImageBucket, key: string) => {
      // For approval emails, an explicit image selection overrides the
      // template's default image-section list. Other notification types retain
      // their template-controlled behavior.
      if (!isApprovalEmail && !safeSections.includes(key)) return;
      const images = selectedImages.filter((img) => img.normalizedType === bucket);
      if (!images.length) return;
      const cards = images
        .map(
          (image) => {
            // Use CID inline reference if available; fall back to public URL
            const src = cidMap?.[image.id]
              ? `cid:${cidMap[image.id]}`
              : image.publicUrl;
            return `
              <td style="padding:8px;">
                <img src="${src}" alt="${escapeHtml(image.file_name)}" style="width:100%;max-width:200px;height:150px;object-fit:cover;border-radius:8px;border:1px solid #e5e7eb;" />
                <p style="font-size:12px;color:#6b7280;margin-top:4px;">${escapeHtml(image.file_name)}</p>
              </td>
            `;
          }
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
      bill_hours: item.bill_hours,
      quantity: item.quantity,
      unit: item.unit,
    }));

    const total = billingItems.reduce((sum, item) => sum + (item.cost || 0), 0);

  return {
    items: billingItems,
    total,
    job_details: jobDetailsData,
    additional_comments: additionalComments,
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
    approval_page_images: approvalPageImages.map((img) => img.id),
    approval_page_image_types: approvalPageImages.map((img) => img.approvalType),
    approval_page_image_entries: approvalPageImages.map((img) => ({
      id: img.id,
      source: img.source,
      file_path: img.file_path,
      file_name: img.file_name,
      bucket: img.source === 'files' ? 'files' : STORAGE_BUCKET,
      normalized_type: img.approvalType,
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
      approver_name: primaryRecipientName || apContactName || null,
      expires_at: expiresAt,
      extra_charges_data: extraData,
    });

    if (error) throw error;
    return { token, expiresAt };
  };

  const buildFinalEmailHtml = (approvalLink?: string, cidMap?: Record<string, string>) => {
    const processedEmailContent = applyEmailTokens(emailContent);
    const processedEmailSignature = applyEmailTokens(emailSignature);
    const bodyHtml = processedEmailContent.trim().startsWith('<')
      ? processedEmailContent
      : processedEmailContent.replace(/\n/g, '<br />');
    const signatureHtml = processedEmailSignature.trim().startsWith('<')
      ? processedEmailSignature
      : processedEmailSignature.replace(/\n/g, '<br />');

    let composedBody = bodyHtml;
    const hasApprovalButtonToken = /{{\s*approval_button\s*}}/i.test(composedBody);
    if (approvalLink) {
      composedBody = composedBody
        .replace(/\{+\s*(?:\{+\s*)?approval_link\s*(?:\}+\s*)?\}+/gi, approvalLink)
        .replace(/\{+\s*(?:\{+\s*)?approval_button\s*(?:\}+\s*)?\}+/gi, buildApprovalLinkHtml(approvalLink));
    }

    const sectionHtml = buildSectionHtml(cidMap);
    const previewDisclaimerHtml =
      isApprovalEmail && selectedImages.length > 0
        ? `<p style="margin-top:16px;font-size:12px;color:#6b7280;">${escapeHtml(IMAGE_PREVIEW_DISCLAIMER)}</p>`
        : '';

    return `
      <div style="font-family: 'Inter', Arial, sans-serif; font-size: 14px; color: #111827; line-height: 1.6;">
        ${composedBody}
        ${!hasApprovalButtonToken && approvalLink ? buildApprovalLinkHtml(approvalLink) : ''}
        ${sectionHtml}
        ${previewDisclaimerHtml}
        <div style="margin-top: 24px;">${signatureHtml}</div>
      </div>
    `;
  };

  useEffect(() => {
    if (!isOpen || currentStep !== reviewStepId || !selectedTemplate) return;
    let cancelled = false;

    const calculateReviewSize = async () => {
      setReviewSizeLoading(true);
      try {
        const prepared = reviewSizeEstimate?.key === imagePreparationKey
          ? reviewSizeEstimate
          : await prepareInlineImages();
        const preliminaryHtml = buildFinalEmailHtml(undefined, prepared.cidMap);
        const encodedAttachmentBytes = prepared.inlineAttachments.reduce(
          (sum, attachment) => sum + estimateEncodedBase64Bytes(attachment.content),
          0,
        );
        const preliminaryBodyBytes = new TextEncoder().encode(preliminaryHtml).byteLength;
        const estimatedMessageBytes = preliminaryBodyBytes
          + encodedAttachmentBytes
          + 4096
          + prepared.inlineAttachments.length * 600;
        if (!cancelled) setReviewSizeEstimate({ ...prepared, estimatedMessageBytes });
      } catch (error) {
        console.error('Unable to calculate the email size preview', error);
        if (!cancelled) setReviewSizeEstimate(null);
      } finally {
        if (!cancelled) setReviewSizeLoading(false);
      }
    };

    void calculateReviewSize();
    return () => { cancelled = true; };
    // The preparation key captures image changes. Content fields are included
    // so the body estimate refreshes when the user returns and edits the email.
  }, [currentStep, emailContent, emailSignature, emailSubject, imagePreparationKey, isOpen, reviewStepId, selectedTemplate?.id]);

  const handlePreview = async () => {
    if (!isApprovalEmail) {
      toast.info('Preview is only available for approval emails.');
      return;
    }

    try {
      setIsPreviewing(true);
      const tokenRecord = await createApprovalToken({ isPreview: true });
      toast.success('Preview ready in a new tab');
      window.open(`${config.portalBaseUrl}/approval/${tokenRecord.token}`, '_blank');
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
      const effectiveNotificationType = isApprovalEmail ? 'extra_charges' : notificationType;
      const effectiveEmailPurpose = NOTIFICATION_TYPE_LABELS[effectiveNotificationType];

      // Reuse the exact image preparation used for the Review & Send estimate.
      // If selections changed, prepare a fresh set before any token or message is created.
      const preparedImages = reviewSizeEstimate?.key === imagePreparationKey
        ? reviewSizeEstimate
        : await prepareInlineImages();
      const { cidMap, inlineAttachments, skippedInlineImages } = preparedImages;

      if (skippedInlineImages.length > 0) {
        const skippedSummary = skippedInlineImages.slice(0, 3).join(', ');
        const remainingCount = skippedInlineImages.length - Math.min(3, skippedInlineImages.length);
        const detail = remainingCount > 0 ? `${skippedSummary}, and ${remainingCount} more` : skippedSummary;
        const shouldContinue = window.confirm(
          `${skippedInlineImages.length} selected image${skippedInlineImages.length === 1 ? '' : 's'} could not be embedded (${detail}). ` +
          'Automatically included approval-page images will remain available there. Send the email with the remaining attachments?',
        );
        if (!shouldContinue) return;
      }

      // Estimate before creating an approval token so cancelling a large send
      // does not leave an unused token behind. The final approval link adds only
      // a small amount of markup and does not materially change the estimate.
      const preliminaryHtml = buildFinalEmailHtml(undefined, cidMap);
      const encodedAttachmentBytes = inlineAttachments.reduce(
        (sum, attachment) => sum + estimateEncodedBase64Bytes(attachment.content),
        0,
      );
      const preliminaryBodyBytes = new TextEncoder().encode(preliminaryHtml).byteLength;
      const estimatedMessageBytes = preliminaryBodyBytes + encodedAttachmentBytes + 4096 + inlineAttachments.length * 600;
      const estimatedSizeLabel = formatFileSize(estimatedMessageBytes);

      if (estimatedMessageBytes >= EMAIL_SIZE_MAX_BYTES) {
        toast.error(
          `This email is approximately ${estimatedSizeLabel}, above the 18 MB attachment-email limit. ` +
          'Remove some selected images; all original job images will remain available in the application.',
          { duration: 10000 },
        );
        return;
      }

      if (estimatedMessageBytes >= EMAIL_SIZE_WARNING_BYTES) {
        const warning = estimatedMessageBytes >= EMAIL_SIZE_STRONG_WARNING_BYTES
          ? `This email is approximately ${estimatedSizeLabel}. Messages this large have an elevated risk of delay, rejection, or quarantine. Send it with the selected images?`
          : `This email is approximately ${estimatedSizeLabel}. Some recipient systems may delay or quarantine larger messages. Send it with the selected images?`;
        if (!window.confirm(warning)) return;
      } else if (estimatedMessageBytes >= EMAIL_SIZE_INFO_BYTES) {
        toast.info(`Estimated email size: ${estimatedSizeLabel}.`, { duration: 5000 });
      }

      if (isApprovalEmail) {
        const tokenRecord = await createApprovalToken({ isPreview: false });
        approvalLink = `${config.portalBaseUrl}/approval/${tokenRecord.token}`;
      }

      const finalHtml = buildFinalEmailHtml(approvalLink, cidMap);
      const { data: sendResult, error } = await supabase.functions.invoke('send-email', {
        body: {
          to: recipientEmail,
          subject: applyEmailTokens(emailSubject),
          html: finalHtml,
          cc: finalRecipientLists.cc,
          bcc: finalRecipientLists.bcc,
          from: emailConfig ? `${emailConfig.from_name} <${emailConfig.from_email}>` : undefined,
          attachments: inlineAttachments.length > 0 ? inlineAttachments : undefined,
          emailType: effectiveNotificationType === 'extra_charges'
            ? 'extra_charge_approval'
            : effectiveNotificationType === 'sprinkler_paint'
              ? 'sprinkler_notification'
              : effectiveNotificationType === 'drywall_repairs'
                ? 'drywall_notification'
                : 'general_work_order',
          jobId: job.id,
          metadata: {
            notification_type: effectiveNotificationType,
            selected_image_count: selectedImages.length,
            inline_attachment_count: inlineAttachments.length,
            skipped_inline_image_count: skippedInlineImages.length,
            skipped_inline_image_names: skippedInlineImages,
          },
        },
      });

      if (error) throw error;
      const failedCopies = Array.isArray(sendResult?.deliveryResults)
        ? sendResult.deliveryResults.filter((result: { success?: boolean }) => result.success !== true)
        : [];

      await logJobActivity({
        jobId: job.id,
        eventType: `${effectiveNotificationType}_email_sent`,
        title: `${effectiveEmailPurpose} sent`,
        description: `${effectiveEmailPurpose} sent to ${recipientEmail}`,
        action: 'other',
        metadata: {
          notification_type: effectiveNotificationType,
          original_notification_type: notificationType,
          email_purpose: effectiveEmailPurpose,
          recipient_email: recipientEmail,
          cc_emails: finalRecipientLists.cc,
          bcc_emails: finalRecipientLists.bcc,
          subject: applyEmailTokens(emailSubject),
          template_id: selectedTemplate.id,
          template_name: selectedTemplate.name,
          included_sections: safeSections,
          selected_image_count: selectedImages.length,
          inline_attachment_count: inlineAttachments.length,
          estimated_message_bytes: estimatedMessageBytes,
          approval_link_created: Boolean(approvalLink),
        },
      });

      // If the job is in "Pending Work Order" phase, handle based on notification type
      if (job?.job_phase?.label === 'Pending Work Order') {
        const { data: sessionData } = await supabase.auth.getSession();
        const currentUserId = sessionData?.session?.user?.id;

        if (currentUserId) {
          if (isApprovalEmail) {
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
          } else if (notificationType === 'sprinkler_paint' || notificationType === 'drywall_repairs') {
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

      if (failedCopies.length > 0) {
        toast.warning(
          `The email was submitted, but ${failedCopies.length} separate recipient cop${failedCopies.length === 1 ? 'y' : 'ies'} failed. Review Email Delivery for details.`,
          { duration: 8000 },
        );
      } else {
        toast.success('Email sent successfully');
      }
      onSent?.();
      onClose();
    } catch (error) {
      console.error('Send error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  const renderImageSelection = () => {
    const selectedCount = selectedImageIds.length;
    const attachmentGuidance = selectedCount === 0
      ? {
          label: 'No images selected',
          detail: 'Choose only the images needed for this message.',
          classes: 'border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-200',
          markerPosition: '2%',
        }
      : selectedCount <= 4
        ? {
            label: 'Recommended',
            detail: '1–4 images is the preferred range for email delivery.',
            classes: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200',
            markerPosition: `${Math.min(30, 7 + ((selectedCount - 1) * 7))}%`,
          }
        : selectedCount <= 7
          ? {
              label: 'Use caution',
              detail: 'More images can increase attachment scanning or filtering.',
              classes: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200',
              markerPosition: `${42 + ((selectedCount - 5) * 10)}%`,
            }
          : {
              label: 'Higher filtering risk',
              detail: 'Consider removing images and directing recipients to the approval page.',
              classes: 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200',
              markerPosition: `${Math.min(96, 75 + ((selectedCount - 8) * 4))}%`,
            };

    return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium text-gray-900 dark:text-white">
            Images to include <span className="text-red-600">*</span>
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {isApprovalEmail
              ? 'Selected images will be embedded in the email. Approval-page images are selected separately below.'
              : 'Selected images will be embedded directly in the email.'}
          </p>
        </div>
        <div className="space-x-2">
          {jobImages.length > 0 && (
            <button onClick={selectAllImages} type="button" className="text-xs font-medium text-blue-600 dark:text-blue-400">Select all</button>
          )}
          <button
            onClick={selectNoEmailImages}
            type="button"
            className={`rounded-full px-3 py-1 text-xs font-semibold ${emailImageChoiceMade && selectedImageIds.length === 0 ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'}`}
          >
            None
          </button>
        </div>
      </div>
      {!emailImageChoiceMade && (
        <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
          Required: select one or more images, or choose None.
        </p>
      )}
      <div className={`rounded-lg border p-3 ${attachmentGuidance.classes}`}>
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="font-semibold">{selectedCount} image{selectedCount === 1 ? '' : 's'} selected</span>
          <span className="font-semibold">{attachmentGuidance.label}</span>
        </div>
        <div className="relative mt-2 h-2 overflow-visible rounded-full bg-gradient-to-r from-emerald-500 from-0% via-amber-400 via-55% to-red-500 to-100%">
          <span
            className="absolute top-1/2 h-4 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-gray-900 shadow dark:bg-white"
            style={{ left: attachmentGuidance.markerPosition }}
            aria-hidden="true"
          />
        </div>
        <div className="mt-1 flex justify-between text-[10px] font-medium opacity-75">
          <span>1–4 recommended</span>
          <span>5–7 caution</span>
          <span>8+ higher risk</span>
        </div>
        <p className="mt-2 text-xs">{attachmentGuidance.detail} Images remain available in the application even when not attached.</p>
      </div>
      {jobImages.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {(['before', 'after', 'sprinkler', 'other'] as ImageBucket[]).map((bucket) => {
            const bucketIds = getIdsForBucket(bucket);
            const allSelected = bucketIds.length > 0 && bucketIds.every((id) => selectedImageIds.includes(id));
            const anySelected = bucketIds.some((id) => selectedImageIds.includes(id));
            const label = IMAGE_TYPE_LABELS[bucket];
            return (
              <div
                key={bucket}
                className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{label}</span>
                  <span className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {bucketIds.length} file{bucketIds.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => addImagesForBucket(bucket)}
                    disabled={bucketIds.length === 0 || allSelected}
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                      allSelected
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200'
                        : 'bg-gray-100 text-gray-700 hover:bg-green-100 hover:text-green-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-green-900/40 dark:hover:text-green-200'
                    } disabled:opacity-50`}
                  >
                    {allSelected ? 'Included' : 'Include'}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeImagesForBucket(bucket)}
                    disabled={bucketIds.length === 0 || !anySelected}
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                      !anySelected
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200'
                        : 'bg-gray-100 text-gray-700 hover:bg-red-100 hover:text-red-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-red-900/40 dark:hover:text-red-200'
                    } disabled:opacity-50`}
                  >
                    {!anySelected ? 'Excluded' : 'Exclude'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
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
  };

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
                      {template.template_type === 'extra_charges' ? 'Approval' : notificationType === 'general_work_order' ? 'Work Order Email' : 'Notification'} Template
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

  const renderSelectableRecipients = (
    label: 'CC' | 'BCC',
    options: SelectableEmailRecipient[],
    setOptions: React.Dispatch<React.SetStateAction<SelectableEmailRecipient[]>>,
    manualEmails: string,
    setManualEmails: React.Dispatch<React.SetStateAction<string>>,
    finalCount: number,
  ) => {
    const selectedCount = options.filter((recipient) => recipient.selected).length;
    const setAll = (selected: boolean) => {
      setOptions((current) => current.map((recipient) => ({ ...recipient, selected })));
    };

    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">{label} recipients</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              {finalCount} selected for this email
            </p>
          </div>
          {options.length > 0 && (
            <div className="flex gap-2 text-[11px] font-medium">
              <button type="button" onClick={() => setAll(true)} className="text-blue-600 hover:underline dark:text-blue-400">
                Select all
              </button>
              <button type="button" onClick={() => setAll(false)} className="text-gray-600 hover:underline dark:text-gray-300">
                Deselect all
              </button>
            </div>
          )}
        </div>

        {options.length > 0 ? (
          <div className="mt-3 space-y-2">
            {options.map((recipient) => (
              <label
                key={`${label}-${normalizeEmailAddress(recipient.email)}`}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs dark:border-gray-700 dark:bg-gray-900"
              >
                <span className="min-w-0 truncate text-gray-700 dark:text-gray-200">{recipient.email}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wide text-gray-400">
                    {recipient.source === 'configuration' ? 'Default' : 'Property'}
                  </span>
                  <input
                    type="checkbox"
                    checked={recipient.selected}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setOptions((current) => current.map((item) =>
                        normalizeEmailAddress(item.email) === normalizeEmailAddress(recipient.email)
                          ? { ...item, selected: checked }
                          : item
                      ));
                    }}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </span>
              </label>
            ))}
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              {selectedCount} of {options.length} automatic recipients enabled. Changes apply only to this email.
            </p>
          </div>
        ) : (
          <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">No automatic {label} recipients.</p>
        )}

        <label className="mt-3 block text-[11px] font-medium text-gray-600 dark:text-gray-400">
          Additional {label} addresses
        </label>
        <input
          type="text"
          value={manualEmails}
          onChange={(event) => setManualEmails(event.target.value)}
          placeholder="user@example.com, another@example.com"
          className={INPUT_FIELD_CLASSES}
        />
      </div>
    );
  };

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
                {renderSelectableRecipients(
                  'CC',
                  ccRecipientOptions,
                  setCcRecipientOptions,
                  ccEmails,
                  setCcEmails,
                  finalRecipientLists.cc.length,
                )}
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">BCC copy</p>
                  <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-md border border-gray-200 bg-white px-3 py-3 text-xs dark:border-gray-700 dark:bg-gray-900">
                    <span className="text-gray-700 dark:text-gray-200">
                      Send a separate copy to <span className="font-semibold">{ADMIN_COPY_EMAIL}</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={sendAdminCopy}
                      onChange={(event) => setSendAdminCopy(event.target.checked)}
                      className="h-4 w-4 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </label>
                  <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
                    Checked by default. Deselect it when no internal copy is needed.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subject</label>
          <input
            ref={subjectInputRef}
            type="text"
            value={emailSubject}
            onChange={(event) => setEmailSubject(event.target.value)}
            className={INPUT_FIELD_CLASSES}
          />
          {isGeneralWorkOrderEmail && (
            <div className="mt-2">
              {renderVariableButtons(insertVariableIntoSubject)}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Message</label>
          {isGeneralWorkOrderEmail ? (
            <div className="space-y-3">
              {renderVariableButtons(insertVariableIntoBody)}
              <RichTextEditor
                value={emailContent}
                onChange={setEmailContent}
                placeholder="Write the email message..."
                variables={templateVariables}
                height="280px"
              />
            </div>
          ) : (
            <textarea
              rows={6}
              value={emailContent}
              onChange={(event) => setEmailContent(event.target.value)}
              className={`${TEXTAREA_CLASSES} min-h-[180px]`}
            />
          )}
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
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            These sections appear in the email.{' '}
            {notificationType === 'extra_charges'
              ? 'Email attachments are selected below. Eligible approval-page images are included automatically.'
              : 'Image selection below controls which images are embedded in the email.'}
          </p>
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

        {isApprovalEmail && renderImageSelection()}
        {!isApprovalEmail && showsEmailImageSelection && renderImageSelection()}
      </div>
    );
  };

  const renderReviewStep = () => {
    const formatSentAt = (sentAt: string) =>
      new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }).format(new Date(sentAt));
    const previewEmailContent = applyEmailTokens(emailContent);
    const previewEmailSignature = applyEmailTokens(emailSignature);
    const currentSizeEstimate = reviewSizeEstimate?.key === imagePreparationKey ? reviewSizeEstimate : null;
    const estimatedBytes = currentSizeEstimate?.estimatedMessageBytes || 0;
    const sizeLevel = estimatedBytes >= EMAIL_SIZE_MAX_BYTES
      ? { label: 'Cannot send', detail: 'Remove selected images before sending.', classes: 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200' }
      : estimatedBytes >= EMAIL_SIZE_STRONG_WARNING_BYTES
        ? { label: 'High delivery risk', detail: 'A confirmation will be required before sending.', classes: 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200' }
        : estimatedBytes >= EMAIL_SIZE_WARNING_BYTES
          ? { label: 'Large message', detail: 'Some recipient systems may delay or quarantine it.', classes: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200' }
          : estimatedBytes >= EMAIL_SIZE_INFO_BYTES
            ? { label: 'Moderate size', detail: 'The message remains below the warning threshold.', classes: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200' }
            : { label: 'Within preferred range', detail: 'No size-related delivery warning is expected.', classes: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200' };

    return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm dark:border-gray-700 dark:bg-gray-900/40">
        <p className="font-semibold text-gray-900 dark:text-white">Final recipients</p>
        <div className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-300">
          <p><span className="font-medium">To:</span> {recipientEmail || '—'}</p>
          <p><span className="font-medium">CC ({finalRecipientLists.cc.length}):</span> {finalRecipientLists.cc.join(', ') || 'None'}</p>
          <p><span className="font-medium">Admin copy:</span> {finalRecipientLists.bcc.join(', ') || 'None'}</p>
          <p className="pt-1 text-gray-500 dark:text-gray-400">Each listed address will receive a separate, single-recipient email.</p>
        </div>
      </div>
      <div className={`rounded-lg border p-4 text-sm ${reviewSizeLoading || !currentSizeEstimate ? 'border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-200' : sizeLevel.classes}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold">Email size and attachments</p>
          <span className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-semibold dark:bg-black/20">
            {reviewSizeLoading || !currentSizeEstimate ? 'Calculating…' : sizeLevel.label}
          </span>
        </div>
        {reviewSizeLoading || !currentSizeEstimate ? (
          <p className="mt-2 text-xs">Checking the selected images and calculating their encoded email size.</p>
        ) : (
          <div className="mt-2 space-y-1 text-xs">
            <p><span className="font-medium">Estimated message size:</span> {formatFileSize(currentSizeEstimate.estimatedMessageBytes)}</p>
            <p><span className="font-medium">Images:</span> {selectedImages.length} selected · {currentSizeEstimate.inlineAttachments.length} ready to embed{currentSizeEstimate.skippedInlineImages.length ? ` · ${currentSizeEstimate.skippedInlineImages.length} unavailable for email embedding` : ''}</p>
            <p>{sizeLevel.detail} The approval page automatically includes eligible Before and sprinkler cover-condition images.</p>
            {isApprovalEmail && (
              <p><span className="font-medium">Approval page:</span> {approvalPageImages.length} eligible image{approvalPageImages.length === 1 ? '' : 's'} included automatically</p>
            )}
          </div>
        )}
      </div>
      {sentEmailHistory.length > 0 && (
        <div className="flex items-start space-x-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
          <AlertCircle className="h-5 w-5" />
          <div className="flex-1">
            <p className="text-sm font-medium">Email already sent for this job</p>
            <p className="text-xs">
              You can send another email now. Recent sent emails are listed below for context.
            </p>
            <div className="mt-3 space-y-2">
              {sentEmailHistory.slice(0, 5).map((item) => (
                <div key={item.id} className="rounded border border-amber-200 bg-white/70 px-3 py-2 text-xs dark:border-amber-700/70 dark:bg-amber-950/30">
                  <div className="font-semibold">{item.purpose} to {item.recipient}</div>
                  <div className="mt-0.5 opacity-90">Sent {formatSentAt(item.sentAt)}{item.subject ? ` • Subject: ${item.subject}` : ''}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {isApprovalEmail && (
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
        <p className="text-sm font-semibold text-gray-900 dark:text-white">
          Subject: {applyEmailTokens(emailSubject)}
        </p>
        <div className="prose prose-sm max-w-none text-gray-900 dark:text-gray-100 dark:prose-invert" dangerouslySetInnerHTML={{ __html: previewEmailContent.replace(/\n/g, '<br/>') }} />
        {renderJobDetailsPreview()}
        {renderBillingPreview()}
        {renderAdditionalCommentsPreview()}
        {(() => {
          const bucketCounts: { bucket: ImageBucket; label: string; count: number }[] = [
            { bucket: 'before', label: IMAGE_TYPE_LABELS.before, count: selectedImages.filter((img) => img.normalizedType === 'before').length },
            { bucket: 'after', label: IMAGE_TYPE_LABELS.after, count: selectedImages.filter((img) => img.normalizedType === 'after').length },
            { bucket: 'sprinkler', label: IMAGE_TYPE_LABELS.sprinkler, count: selectedImages.filter((img) => img.normalizedType === 'sprinkler').length },
            { bucket: 'other', label: IMAGE_TYPE_LABELS.other, count: selectedImages.filter((img) => img.normalizedType === 'other').length }
          ];
          const includedBuckets = bucketCounts.filter((entry) => entry.count > 0);
          if (!includedBuckets.length) return null;
          return (
            <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800 dark:border-blue-900/40 dark:bg-blue-900/30 dark:text-blue-200">
              <span className="font-semibold">Included Image Groups:</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {includedBuckets.map((entry) => (
                  <span
                    key={entry.bucket}
                    className="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-blue-700 shadow-sm dark:bg-blue-900/60 dark:text-blue-100"
                  >
                    {entry.label} · {entry.count}
                  </span>
                ))}
              </div>
            </div>
          );
        })()}
        {renderImagePreview('before', 'before_images')}
        {renderImagePreview('after', 'after_images')}
        {renderImagePreview('sprinkler', 'sprinkler_images')}
        {renderImagePreview('other', 'other_images')}
        {isApprovalEmail && selectedImages.length > 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-300">
            {IMAGE_PREVIEW_DISCLAIMER}
          </p>
        )}
        {!isApprovalEmail && selectedImages.length > 0 && (
          <p className="text-xs text-green-700 dark:text-green-300 font-medium">
            ✓ {selectedImages.length} image{selectedImages.length !== 1 ? 's' : ''} will be embedded directly in this email.
          </p>
        )}
        <div className="prose prose-sm max-w-none text-gray-900 dark:text-gray-100 dark:prose-invert" dangerouslySetInnerHTML={{ __html: previewEmailSignature.replace(/\n/g, '<br/>') }} />
      </div>
    </div>
    );
  };

  if (!isOpen) return null;

  const totalSteps = steps.length;
  const canProceedToNext = currentStep === 1
    ? Boolean(selectedTemplate)
    : currentStep === 2
      ? Boolean(
          selectedTemplate &&
          recipientEmail.trim() &&
          emailSubject.trim() &&
          (!showsEmailImageSelection || emailImageChoiceMade)
        )
      : false;
  const isFinalStep = currentStep === totalSteps;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[95vh] w-full max-w-6xl flex-col rounded-lg bg-white shadow-2xl dark:bg-gray-800">
        <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <Mail className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Send {NOTIFICATION_TYPE_LABELS[notificationType]}</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-x-auto border-b border-gray-200 px-4 py-4 sm:px-6 dark:border-gray-700">
          <ol className="flex min-w-[680px] items-center justify-between text-xs sm:text-sm">
            {steps.map((step, index) => (
              <li key={step.id} className="flex items-center">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${currentStep >= step.id ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-300'}`}>
                  {step.id}
                </div>
                <span className={`ml-2 text-sm font-medium ${currentStep >= step.id ? 'text-blue-600 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400'}`}>
                  {step.title}
                </span>
                {index < steps.length - 1 && (
                  <div className={`mx-3 h-0.5 w-6 lg:mx-5 lg:w-10 ${currentStep > step.id ? 'bg-blue-500 dark:bg-blue-400' : 'bg-gray-200 dark:bg-gray-700'}`} />
                )}
              </li>
            ))}
          </ol>
        </div>

        <div ref={stepContentRef} className="flex-1 overflow-y-auto p-6">
          {currentStep === 1 && renderTemplateStep()}
          {currentStep === 2 && renderComposeStep()}
          {currentStep === reviewStepId && renderReviewStep()}
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
            {isFinalStep && isApprovalEmail && (
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
