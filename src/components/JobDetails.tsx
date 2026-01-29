import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  FileText, 
  ArrowLeft, 
  Calendar, 
  MapPin, 
  Building2, 
  User, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Edit, 
  Trash2, 
  Plus, 
  ArrowRight, 
  AlertCircle,
  DollarSign,

  Download,

  Share2,
  MoreHorizontal,
  ChevronDown,
  ChevronUp,
  Star,
  Clipboard,
  ClipboardCheck,
  ClipboardList,

  Layers,
  Droplets,
  MessageSquare,
  Image,
  Mail,
  CheckCircle2,
  X,
  AlertTriangle,
  Eye,
  Minus,
  FileImage,
  FolderOpen,
  Bell,
  Mailbox
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { formatDate, formatDisplayDate, formatTime } from '../lib/dateUtils';
import { formatAddress, formatCurrency } from '../lib/utils/formatUtils';
import { getPreviewUrl } from '../utils/storagePreviews';
import { getAdditionalBillingLines } from '../lib/billing/additional';
import { useJobDetails } from '../hooks/useJobDetails';
import { useJobPhaseChanges } from '../hooks/useJobPhaseChanges';
import { usePhases } from '../hooks/usePhases';
import { useUserRole } from '../contexts/UserRoleContext';
import { FLAGS } from '../config/flags';
import { BillingBreakdownV2 } from '../features/jobs/JobDetails/BillingBreakdownV2';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import { ExtraChargeLineItem } from '../types/extraCharges';
import ImageUpload from './ImageUpload';
import { PropertyMap } from './PropertyMap';
import { ImageGallery } from './ImageGallery';
import NotificationEmailModal from './NotificationEmailModal';
import { EnhancedPropertyNotificationModal } from './EnhancedPropertyNotificationModal';
import { WorkOrderLink } from './shared/WorkOrderLink';
import { PropertyLink } from './shared/PropertyLink';
import { getBackNavigationPath } from '../lib/utils';

type Property = {
  id: string;
  name: string;
  address: string;
  address_2: string | null;
  city: string;
  state: string;
  zip: string;
  ap_name: string | null;
  ap_email: string | null;
  quickbooks_number: string | null;
  is_archived: boolean;
};

type EmailData = {
  to: string;
  subject: string;
  content: string;
  attachment?: Blob | null;
};

interface BillingDetails {
  id: string;
  bill_amount: number | null;
  sub_pay_amount: number | null;
  profit_amount: number | null;
  is_hourly: boolean;
  category_id: string | null;
  unit_size: {
    id: string;
    label: string;
  };
}

interface WorkOrder {
  id: string;
  submission_date: string;
  created_at?: string;
  submitted_by_name?: string;
  is_occupied: boolean;
  is_full_paint: boolean;
  job_category: string;
  job_category_id: string;
  has_sprinklers: boolean;
  sprinklers_painted: boolean;
  painted_ceilings: boolean;
  ceiling_rooms_count: number;
  individual_ceiling_count?: number | null;
  ceiling_display_label?: string | null;
  painted_patio: boolean;
  painted_garage: boolean;
  painted_cabinets: boolean;
  painted_crown_molding: boolean;
  painted_front_door: boolean;
  has_accent_wall: boolean;
  accent_wall_type?: string;
  accent_wall_count?: number;
  has_extra_charges: boolean;
  extra_charges_description?: string;
  extra_hours?: number;
  extra_charges_line_items?: ExtraChargeLineItem[];
  additional_comments?: string;
}

interface Job {
  id: string;
  work_order_num: string;
  property: Property;
  unit_number: string;
  unit_size: {
    id: string;
    label: string;
  };
  job_type: {
    id: string;
    label: string;
  };
  job_category?: {
    id: string;
    name: string;
    description: string | null;
  };
  scheduled_date: string;
  job_phase: {
    id: string;
    label: string;
    color_light_mode: string;
    color_dark_mode: string;
  };
  purchase_order?: string | null;
  assigned_to?: string;
  assigned_to_name?: string;
  billing_details?: BillingDetails;
  hourly_billing_details?: BillingDetails;
  extra_charges_details?: {
    description: string;
    hours: number;
    bill_amount: number;
    sub_pay_amount: number;
    profit_amount: number;
    hourly_rate: number;
    sub_pay_rate: number;
    is_hourly: boolean;
    display_order: number;
    section_name: string;
    debug: {
      property_id: string;
      billing_category_id: string;
      billing_category_name: string;
      unit_size_id: string;
      job_category_name: string;
      bill_amount: number;
      sub_pay_amount: number;
      raw_record: any;
      record_count: number;
      billing_category_exists: boolean;
      unit_size_exists: boolean;
      matching_billing_categories: any[];
      query_params: {
        property_id: string;
        billing_category_id: string;
        unit_size_id: string;
        is_hourly: boolean;
      };
    };
  };
  work_order?: WorkOrder;
  invoice_sent?: boolean;
  invoice_paid?: boolean;
  invoice_sent_date?: string;
  invoice_paid_date?: string;
}

async function sendEmail(data: EmailData) {
  console.log('Sending email:', data);
  return Promise.resolve();
}

export function JobDetails() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { job, loading: jobLoading, error: jobError, refetch: refetchJob } = useJobDetails(jobId);
  const { phaseChanges, loading: phaseChangesLoading, error: phaseChangesError, refetch: refetchPhaseChanges } = useJobPhaseChanges(jobId);
  const { phases, loading: phasesLoading } = usePhases();
  const { isAdmin, isJGManagement, isSubcontractor } = useUserRole();
  
  // Get job phase color (same approach as all jobs pages)
  const getJobPhaseColor = () => {
    return job?.job_phase?.color_dark_mode || '#6B7280';
  };

  // Null-safe accessors to prevent crashes during slow loads
  const phaseLabel = job?.job_phase?.label ?? '—';
  const unitSizeId = job?.unit_size?.id ?? null;
  const propertyName = job?.property?.name ?? '—';
  const workOrderNum = job?.work_order_num ?? '—';
  const workOrderId = job?.work_order?.id ?? null;
  const jobIdForFiles = job?.id ?? null;


  
  const [showPhaseChangeModal, setShowPhaseChangeModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCancelJobConfirm, setShowCancelJobConfirm] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState<string | null>(null);
  const [changeReason, setChangeReason] = useState('');
  const [changingPhase, setChangingPhase] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cancellingJob, setCancellingJob] = useState(false);
  const [reactivatingJob, setReactivatingJob] = useState(false);
  const [showPhaseHistory, setShowPhaseHistory] = useState(false);
  const [showWorkOrderDetails, setShowWorkOrderDetails] = useState(false);
  const [subcontractors, setSubcontractors] = useState<{id: string, full_name: string}[]>([]);
  const [selectedSubcontractor, setSelectedSubcontractor] = useState<string | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [emailContent, setEmailContent] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [ccEmails, setCcEmails] = useState('');
  const [bccEmails, setBccEmails] = useState('');
  const [includePDF, setIncludePDF] = useState(true);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | undefined>(undefined);
  const [showApproveButton, setShowApproveButton] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [showEnhancedNotificationModal, setShowEnhancedNotificationModal] = useState(false);
  const [notificationType, setNotificationType] = useState<'sprinkler_paint' | 'drywall_repairs' | 'extra_charges' | null>(null);
  const [additionalBillingLines, setAdditionalBillingLines] = useState<Array<{
    key: string;
    label: string;
    qty: number;
    unitLabel?: string;
    rateBill: number;
    rateSub: number;
    amountBill: number;
    amountSub: number;
  }>>([]);
  const supplementalBillingLines = useMemo(
    () => additionalBillingLines.filter(line => !line.key.startsWith('additional_')),
    [additionalBillingLines]
  );
  const [billingWarnings, setBillingWarnings] = useState<string[]>([]);
  const [updatingInvoiceStatus, setUpdatingInvoiceStatus] = useState(false);
  const [approvalTokenDecision, setApprovalTokenDecision] = useState<{
    decision: 'approved' | 'declined' | null;
    decision_at: string | null;
    approver_name: string | null;
    approver_email: string | null;
    decline_reason: string | null;
  } | null>(null);
  const [pendingApproval, setPendingApproval] = useState<{
    id: string;
    expiresAt: string;
    sentAt: string;
  } | null>(null);
  const [pendingApprovalCountdown, setPendingApprovalCountdown] = useState('');
  const [reactivatedFromDecline, setReactivatedFromDecline] = useState(false);
  const effectiveApprovalDecision = useMemo(() => {
    if (reactivatedFromDecline) return null;
    // Prefer explicit approval_tokens decision
    if (approvalTokenDecision?.decision) return approvalTokenDecision;

    // Fallback: derive from most recent phase change mentioning extra charges
    if (!phaseChanges || phaseChanges.length === 0) return null;
    const sorted = [...phaseChanges].sort(
      (a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime()
    );
    for (const change of sorted) {
      const reason = (change.change_reason || '').toLowerCase();
      if (!reason.includes('extra charges')) continue;
      if (reason.includes('declin')) {
        const declineReasonMatch = change.change_reason?.match(/reason:\s*(.+)$/i);
        return {
          decision: 'declined',
          decision_at: change.changed_at,
          approver_name: change.changed_by_name || null,
          approver_email: change.changed_by_email || null,
          decline_reason: declineReasonMatch ? declineReasonMatch[1] : null
        };
      }
      if (reason.includes('approv')) {
        return {
          decision: 'approved',
          decision_at: change.changed_at,
          approver_name: change.changed_by_name || null,
          approver_email: change.changed_by_email || null,
          decline_reason: null
        };
      }
    }
    return null;
  }, [approvalTokenDecision, phaseChanges, reactivatedFromDecline]);

  const hasDrywallSignal = useMemo(() => {
    const text = `${job?.work_order?.additional_comments ?? ''} ${job?.work_order?.extra_charges_description ?? ''}`.toLowerCase();
    const drywallInAdditional = supplementalBillingLines.some(line => /drywall/i.test(line.label));
    return /dry\s*wall/i.test(text) || drywallInAdditional;
  }, [job?.work_order?.additional_comments, job?.work_order?.extra_charges_description, supplementalBillingLines]);

  // Initialize recipient email with property AP contact when job loads
  useEffect(() => {
    if (!recipientEmail) {
      const preferred =
        job?.property?.primary_contact_email ||
        job?.property?.ap_email ||
        '';
      setRecipientEmail(preferred);
    }
  }, [job?.property?.primary_contact_email, job?.property?.ap_email, recipientEmail]);

  // Fetch approval token decision status for Extra Charges
  const fetchApprovalDecision = useCallback(async () => {
    if (!jobId) return;

    try {
      // Get the most recent approval token for this job with a decision
      const { data, error } = await supabase
        .from('approval_tokens')
        .select('decision, decision_at, approver_name, approver_email, decline_reason')
        .eq('job_id', jobId)
        .eq('approval_type', 'extra_charges')
        .not('decision', 'is', null)
        .order('decision_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching approval decision:', error);
        return;
      }

      if (data) {
        setApprovalTokenDecision(data);
      } else {
        // Clear the decision if no data found
        setApprovalTokenDecision(null);
      }
    } catch (err) {
      console.error('Error in fetchApprovalDecision:', err);
    }
  }, [jobId]);

  const fetchPendingApproval = useCallback(async () => {
    if (!jobId) return;

    try {
      const { data, error } = await supabase
        .from('approval_tokens')
        .select('id, expires_at, created_at, used_at')
        .eq('job_id', jobId)
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

      setPendingApproval({
        id: data.id,
        expiresAt: data.expires_at,
        sentAt: data.created_at
      });
    } catch (err) {
      console.error('Error fetching pending approval:', err);
      setPendingApproval(null);
    }
  }, [jobId]);

  // Fetch approval decision when component mounts or job changes
  useEffect(() => {
    fetchApprovalDecision();
    fetchPendingApproval();
  }, [fetchApprovalDecision, fetchPendingApproval, job]);

  // Refetch approval decision when page becomes visible (e.g., after declining on external page)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchApprovalDecision();
        fetchPendingApproval();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchApprovalDecision, fetchPendingApproval]);

  // Listen for approval/decline events from ApprovalPage popup/tab
  useEffect(() => {
    const handleApprovalMessage = (event: MessageEvent) => {
      // Only accept messages from same origin
      if (event.origin !== window.location.origin) return;
      
      // Check for approval or decline messages
      if (event.data?.type === 'APPROVAL_COMPLETED' || event.data?.type === 'APPROVAL_DECLINED') {
        console.log('Received approval/decline message from ApprovalPage:', event.data);
        // Refetch approval decision immediately
        fetchApprovalDecision();
        // Also refetch job data to get updated phase if approved
        refetchJob();
      }
    };

    const handleApprovalCustomEvent = (event: CustomEvent) => {
      console.log('Received approval/decline custom event:', event.detail);
      // Refetch approval decision immediately
      fetchApprovalDecision();
      // Also refetch job data
      refetchJob();
    };

    // Listen for postMessage from popup/tab
    window.addEventListener('message', handleApprovalMessage);
    
    // Listen for custom events (in case ApprovalPage is in same window)
    window.addEventListener('approvalCompleted' as any, handleApprovalCustomEvent);
    window.addEventListener('approvalDeclined' as any, handleApprovalCustomEvent);

    return () => {
      window.removeEventListener('message', handleApprovalMessage);
      window.removeEventListener('approvalCompleted' as any, handleApprovalCustomEvent);
      window.removeEventListener('approvalDeclined' as any, handleApprovalCustomEvent);
    };
  }, [fetchApprovalDecision, refetchJob]);

  // Listen for approval_tokens updates (same mechanism as phase history realtime)
  useEffect(() => {
    if (!jobId) return;

    const channel = supabase
      .channel(`job-${jobId}-approval-tokens`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'approval_tokens',
          filter: `job_id=eq.${jobId}`
        },
        (payload) => {
          const approvalType = (payload.new as any)?.approval_type || (payload.old as any)?.approval_type;
          if (approvalType === 'extra_charges') {
            fetchApprovalDecision();
            fetchPendingApproval();
            refetchJob(); // keep banner + phase badge in sync
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [jobId, fetchApprovalDecision, fetchPendingApproval, refetchJob]);

  useEffect(() => {
    if (!pendingApproval) {
      setPendingApprovalCountdown('');
      return;
    }

    const interval = setInterval(() => {
      const timeLeft = new Date(pendingApproval.expiresAt).getTime() - Date.now();
      if (timeLeft <= 0) {
        setPendingApproval(null);
        setPendingApprovalCountdown('');
        clearInterval(interval);
      } else {
        const minutes = Math.floor(timeLeft / 60000);
        const seconds = Math.floor((timeLeft % 60000) / 1000);
        setPendingApprovalCountdown(`${minutes}:${seconds.toString().padStart(2, '0')}`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [pendingApproval]);

  // Add effect to calculate and update total billing amount
  useEffect(() => {
    const calculateAndUpdateTotalBilling = async () => {
      if (!job || !jobId) return;

      // Get base billing amount from the job's billing category
      const standardBillAmount = job.billing_details?.bill_amount ?? 0;
      
      // Get extra charges amount from the calculated extra_charges_details
      const extraChargesBillAmount = job.extra_charges_details?.bill_amount ?? 0;
      
      // Get supplemental billing amount (ceilings/accent walls)
      const supplementalAmount = supplementalBillingLines.reduce((sum, line) => sum + line.amountBill, 0);
      
      // Calculate total billing amount (same as "Total to Invoice" calculation)
      const totalBillingAmount = standardBillAmount + extraChargesBillAmount + supplementalAmount;


      try {
        // Update the total_billing_amount in the jobs table
        const { error } = await supabase
          .from('jobs')
          .update({ total_billing_amount: totalBillingAmount })
          .eq('id', jobId);

        if (error) throw error;
      } catch (err) {
        console.error('Error updating total billing amount:', err);
      }
    };

    calculateAndUpdateTotalBilling();
  }, [job, jobId, supplementalBillingLines]);

  // Fetch additional billing lines for ceilings and accent walls
  useEffect(() => {
    const fetchAdditionalBillingLines = async () => {
      if (!job?.work_order) {
        setAdditionalBillingLines([]);
        setBillingWarnings([]);
        return;
      }

      try {
        const { lines, warnings } = await getAdditionalBillingLines(supabase, job.work_order);
        setAdditionalBillingLines(lines);
        setBillingWarnings(warnings);
      } catch (error) {
        console.error('Error fetching additional billing lines:', error);
        setAdditionalBillingLines([]);
        setBillingWarnings(['Error loading additional billing information']);
      }
    };

    fetchAdditionalBillingLines();
  }, [job?.work_order]);

  useEffect(() => {
    if (job?.assigned_to) {
      setSelectedSubcontractor(job?.assigned_to);
    }
    
    fetchSubcontractors();
  }, [job]);

  useEffect(() => {
    const ensureJobFilesSubfolder = async () => {
      if (!job?.property?.id || !job?.id) return;
      try {
        await supabase.rpc('get_upload_folder', {
          p_property_id: job.property.id,
          p_job_id: job.id,
          p_folder_type: 'job_files'
        });
      } catch {}
    };
    ensureJobFilesSubfolder();
  }, [job?.property?.id, job?.id]);

  const fetchSubcontractors = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'subcontractor')
        .order('full_name');
        
      if (error) throw error;
      setSubcontractors(data || []);
    } catch (err) {
      console.error('Error fetching subcontractors:', err);
    }
  };

  const handlePhaseChange = async (direction: 'next' | 'previous') => {
    if (!phases || !job) return;
    
    const phaseId = job?.job_phase?.id ?? null;
    const phasesSafe = Array.isArray(phases) ? phases : [];
    const currentPhaseIndex = phaseId
      ? phasesSafe.findIndex(p => p?.id === phaseId)
      : -1;
    if (currentPhaseIndex === -1) return;
    
    const newPhaseIndex = direction === 'next' ? currentPhaseIndex + 1 : currentPhaseIndex - 1;
    if (newPhaseIndex < 0 || newPhaseIndex >= phasesSafe.length) return;
    
    const newPhase = phasesSafe[newPhaseIndex];
    
    setChangingPhase(true);
    
    try {
      // Get current user
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) throw new Error('User not found');
      
      // Update job phase
      const { error: updateError } = await supabase
        .from('jobs')
        .update({ current_phase_id: newPhase.id })
        .eq('id', jobId);
        
      if (updateError) throw updateError;
      
      // Create phase change record
      const { error: phaseChangeError } = await supabase
        .from('job_phase_changes')
        .insert([{
          job_id: jobId,
          changed_by: userData.user.id,
          from_phase_id: job?.job_phase?.id,
          to_phase_id: newPhase.id,
          change_reason: `Phase ${direction === 'next' ? 'advanced' : 'reverted'} by ${userData.user.email}`
        }]);
        
      if (phaseChangeError) throw phaseChangeError;
      
      // Refresh job data (force refresh to bypass rate limiting)
      await refetchJob(true);
      await refetchPhaseChanges();
      
      toast.success(`Job phase ${direction === 'next' ? 'advanced' : 'reverted'} successfully`);
    } catch (err) {
      console.error('Error changing job phase:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to change job phase');
    } finally {
      setChangingPhase(false);
    }
  };

  const handleDeleteJob = async () => {
    if (!jobId) return;
    
    setDeleting(true);
    
    try {
      console.log('Starting job deletion process for job:', jobId);
      
      // 1. Delete files and clean up storage
      console.log('Step 1: Deleting files and cleaning up storage...');
      const { data: files, error: filesFetchError } = await supabase
        .from('files')
        .select('path, name')
        .eq('job_id', jobId);
        
      if (filesFetchError) {
        console.error('Error fetching files for deletion:', filesFetchError);
        throw filesFetchError;
      }
      
      // Delete files from storage
      if (files && files.length > 0) {
        const filePaths = files.map(file => file.path.replace(/^\//, '')); // Remove leading slash for storage paths
        const { error: storageDeleteError } = await supabase.storage
          .from('files')
          .remove(filePaths);
          
        if (storageDeleteError) {
          console.error('Error deleting files from storage:', storageDeleteError);
          // Continue with database cleanup even if storage deletion fails
        } else {
          console.log(`Deleted ${files.length} files from storage`);
        }
      }
      
      // Delete file records from database
      const { error: filesDeleteError } = await supabase
        .from('files')
        .delete()
        .eq('job_id', jobId);
        
      if (filesDeleteError) {
        console.error('Error deleting file records:', filesDeleteError);
        throw filesDeleteError;
      }
      console.log('Deleted file records from database');
      
      // 2. Delete job phase changes
      console.log('Step 2: Deleting job phase changes...');
      const { error: phaseChangeError } = await supabase
        .from('job_phase_changes')
        .delete()
        .eq('job_id', jobId);
        
      if (phaseChangeError) {
        console.error('Error deleting job phase changes:', phaseChangeError);
        throw phaseChangeError;
      }
      console.log('Deleted job phase changes');
      
      // 3. Delete work orders
      console.log('Step 3: Deleting work orders...');
      const { error: workOrderError } = await supabase
        .from('work_orders')
        .delete()
        .eq('job_id', jobId);
        
      if (workOrderError) {
        console.error('Error deleting work orders:', workOrderError);
        throw workOrderError;
      }
      console.log('Deleted work orders');
      
      // 4. Delete billing details (if any)
      console.log('Step 4: Deleting billing details...');
      const { error: billingError } = await supabase
        .from('billing_details')
        .delete()
        .eq('job_id', jobId);
        
      if (billingError) {
        console.error('Error deleting billing details:', billingError);
        // Don't throw here as billing details might not exist
        console.log('Note: No billing details to delete or error occurred');
      } else {
        console.log('Deleted billing details');
      }
      
      // 5. Delete messages/chat related to this job (if any)
      console.log('Step 5: Deleting job-related messages...');
      const { error: messagesError } = await supabase
        .from('messages')
        .delete()
        .eq('job_id', jobId);
        
      if (messagesError) {
        console.error('Error deleting messages:', messagesError);
        // Don't throw here as messages might not exist
        console.log('Note: No messages to delete or error occurred');
      } else {
        console.log('Deleted job-related messages');
      }
      
      // 6. Delete notifications related to this job (if any)
      console.log('Step 6: Deleting job-related notifications...');
      const { error: notificationsError } = await supabase
        .from('notifications')
        .delete()
        .eq('job_id', jobId);
        
      if (notificationsError) {
        console.error('Error deleting notifications:', notificationsError);
        // Don't throw here as notifications might not exist
        console.log('Note: No notifications to delete or error occurred');
      } else {
        console.log('Deleted job-related notifications');
      }
      
      // 7. Finally, delete the job itself
      console.log('Step 7: Deleting the job record...');
      const { error: jobError } = await supabase
        .from('jobs')
        .delete()
        .eq('id', jobId);
        
      if (jobError) {
        console.error('Error deleting job:', jobError);
        throw jobError;
      }
      console.log('Successfully deleted job record');
      
      console.log('Job deletion completed successfully');
      toast.success('Job deleted successfully');
      navigate(getBackNavigationPath('/dashboard/jobs', isSubcontractor));
    } catch (err) {
      console.error('Error deleting job:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to delete job');
      setDeleting(false);
    }
  };

  const handleAssignSubcontractor = async () => {
    if (!selectedSubcontractor) return;
    
    setAssigning(true);
    
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ 
          assigned_to: selectedSubcontractor,
          assignment_status: 'pending',
          assignment_decision_at: null,
          declined_reason_code: null,
          declined_reason_text: null
        })
        .eq('id', jobId);
        
      if (error) throw error;
      
      await refetchJob();
      setShowAssignModal(false);
      toast.success('Subcontractor assigned successfully');
    } catch (err) {
      console.error('Error assigning subcontractor:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to assign subcontractor');
    } finally {
      setAssigning(false);
    }
  };

  const formatWorkOrderNumber = (num: number) => {
    return `WO-${String(num).padStart(6, '0')}`;
  };

  const generatePDF = async () => {
    if (!job) return;
    
    const doc = new jsPDF();
    const pageWidth = 210;
    let y = 20; // Starting y position
    const pageHeight = 280; // Maximum height before new page
    const margin = 20; // Left margin
    
    // Add title
    doc.setFontSize(20);
    doc.text(`Work Order: ${formatWorkOrderNumber(job?.work_order_num ?? 0)}`, margin, y);
    y += 15;
    
    // Add job details
    doc.setFontSize(12);
    doc.text(`Property: ${job?.property?.name ?? '—'}`, margin, y);
    y += 10;
    doc.text(`Unit: ${job?.unit_number ?? '—'}`, margin, y);
    y += 10;
    doc.text(`Unit Size: ${job?.unit_size?.label ?? '—'}`, margin, y);
    y += 10;
    doc.text(`Job Type: ${job?.job_type?.label ?? '—'}`, margin, y);
    y += 10;
    doc.text(`Purchase Order: ${job?.purchase_order || 'None'}`, margin, y);
    y += 10;
    doc.text(`Scheduled Date: ${formatDate(job?.scheduled_date ?? '')}`, margin, y);
    y += 10;
    doc.text(`Status: ${phaseLabel}`, margin, y);
    y += 15;
    
    // Add description if available
    if (job?.description) {
      doc.setFontSize(14);
      doc.text('Description:', margin, y);
      y += 10;
      doc.setFontSize(12);
      const splitDescription = doc.splitTextToSize(job.description, 170);
      doc.text(splitDescription, margin, y);
      y += splitDescription.length * 7;
    }
    
    // Add work order details if available
    if (job.work_order) {
      // Check if we need a new page
      if (y > pageHeight - 100) {
        doc.addPage();
        y = 20;
      }
      
      doc.setFontSize(16);
      doc.text('Work Order Details', margin, y);
      y += 15;
      
      doc.setFontSize(12);
      doc.text(`Submission Date: ${formatDate(job?.work_order?.submission_date ?? '')}`, margin, y);
      y += 10;
      doc.text(`Occupied: ${job?.work_order?.is_occupied ? 'Yes' : 'No'}`, margin, y);
      y += 10;
      doc.text(`Full Paint: ${job?.work_order?.is_full_paint ? 'Yes' : 'No'}`, margin, y);
      y += 10;
      doc.text(`Job Category: ${job?.work_order?.job_category ?? '—'}`, margin, y);
      y += 15;
      
      // Add paint details
      if (job?.work_order?.has_sprinklers) {
        doc.text(`Has Sprinklers: Yes`, margin, y);
        y += 10;
        doc.text(`Sprinklers Painted: ${job?.work_order?.sprinklers_painted ? 'Yes' : 'No'}`, margin, y);
        y += 10;
      }
      
      if (job?.work_order?.painted_ceilings) {
        doc.text(`Painted Ceilings: Yes`, margin, y);
        y += 10;
        const ceilingInfo = job?.work_order?.ceiling_display_label === 'Paint Individual Ceiling' && job?.work_order?.individual_ceiling_count
          ? `${job?.work_order?.individual_ceiling_count} ceilings`
          : job?.work_order?.ceiling_display_label || 'Yes';
        doc.text(`Ceiling Details: ${ceilingInfo}`, margin, y);
        y += 10;
      }
      
      if (job?.work_order?.painted_patio) {
        doc.text(`Painted Patio: Yes`, margin, y);
        y += 10;
      }
      
      if (job?.work_order?.painted_garage) {
        doc.text(`Painted Garage: Yes`, margin, y);
        y += 10;
      }
      
      if (job?.work_order?.painted_cabinets) {
        doc.text(`Painted Cabinets: Yes`, margin, y);
        y += 10;
      }
      
      if (job?.work_order?.painted_crown_molding) {
        doc.text(`Painted Crown Molding: Yes`, margin, y);
        y += 10;
      }
      
      if (job?.work_order?.painted_front_door) {
        doc.text(`Painted Front Door: Yes`, margin, y);
        y += 10;
      }
      
      // Add extra charges if available
      if (hasExtraChargesForApproval) {
        // Check if we need a new page
        if (y > pageHeight - 100) {
          doc.addPage();
          y = 20;
        }
        
        y += 5;
        doc.text('Extra Charges:', margin, y);
        y += 8;

        if (extraChargeLineItems.length > 0) {
          extraChargeLineItems.forEach(item => {
            const quantity = Number(item.quantity) || 0;
            const billRate = Number(item.billRate) || 0;
            const billAmount = Number(item.calculatedBillAmount ?? quantity * billRate) || 0;
            const lineText = `${item.categoryName} - ${item.detailName} (${quantity} ${item.isHourly ? 'hrs' : 'units'}) = ${formatCurrency(billAmount)}`;
            const splitLine = doc.splitTextToSize(lineText, 170);
            doc.text(splitLine, margin, y);
            y += splitLine.length * 7;
          });
        } else {
          if (job?.work_order?.extra_charges_description) {
            const splitDescription = doc.splitTextToSize(job?.work_order?.extra_charges_description ?? '', 170);
            doc.text(splitDescription, margin, y);
            y += splitDescription.length * 7;
          }
          doc.text(`Extra Hours: ${job?.work_order?.extra_hours || 'N/A'}`, margin, y);
          y += 10;
        }
      }

      // Add additional comments if available
      if (job?.work_order?.additional_comments) {
        // Check if we need a new page
        if (y > pageHeight - 100) {
          doc.addPage();
          y = 20;
        }
        
        y += 5;
        doc.text('Additional Comments:', margin, y);
        y += 10;
        const splitComments = doc.splitTextToSize(job?.work_order?.additional_comments ?? '', 170);
        doc.text(splitComments, margin, y);
        y += splitComments.length * 7;
      }
    }
    
    // Add billing details if available
    if (job.billing_details) {
      // Check if we need a new page
      if (y > pageHeight - 150) {
        doc.addPage();
        y = 20;
      }
      
      doc.setFontSize(16);
      doc.text('Billing Breakdown', margin, y);
      y += 15;

      // Table header
      doc.setFontSize(10);
      
      // Admin sees full breakdown
      doc.text('Description', margin, y);
      doc.text('Qty', margin + 80, y);
      doc.text('Bill', margin + 100, y);
      doc.text('Pay', margin + 125, y);
      doc.text('Profit', margin + 150, y);
      
      y += 5;
      doc.setLineWidth(0.1);
      doc.line(margin, y, margin + (pageWidth - margin * 2), y);
      y += 6;

      let totalAmount = 0;
      let totalSubPay = 0;
      let totalProfit = 0;

      // Base Billing line item
      doc.setFontSize(10);
      const billingDescription = `${job?.work_order?.job_category || 'Standard Paint'} - ${job?.unit_size?.label ?? '—'}`;
      doc.text(billingDescription, margin, y);
      
      const baseAmount = job.billing_details?.bill_amount ?? 0;
      const baseSub = job.billing_details?.sub_pay_amount ?? 0;
      const baseProfitVal = baseAmount - baseSub;
      
      doc.text('1', margin + 80, y);
      doc.text(`${formatCurrency(baseAmount)}`, margin + 100, y);
      doc.text(`${formatCurrency(baseSub)}`, margin + 125, y);
      doc.text(`${formatCurrency(baseProfitVal)}`, margin + 150, y);
      
      totalAmount += baseAmount;
      totalSubPay += baseSub;
      totalProfit += baseProfitVal;
      
      y += 8;

      // Supplemental Billing Lines + Extra Charges (Unified)
      const unifiedExtraItems = [
        // Map supplemental billing lines (ceilings/accent walls)
        ...(supplementalBillingLines || []).map(line => ({
          description: line.label,
          qty_or_hours: line.qty,
          unit: line.unitLabel || 'items',
          rate: line.qty > 0 ? line.amountBill / line.qty : 0,
          amount: line.amountBill,
          sub_pay: line.amountSub,
          profit: line.amountBill - line.amountSub,
          is_hours: false
        })),
        // Map Extra Charges (Itemized)
        ...(extraChargeLineItems || []).map(item => {
          const quantity = Number(item.quantity) || 0;
          const billRate = Number(item.billRate) || 0;
          const subRate = Number(item.subRate) || 0;
          const billAmount = Number(item.calculatedBillAmount ?? quantity * billRate) || 0;
          const subAmount = Number(item.calculatedSubAmount ?? quantity * subRate) || 0;
          return {
            description: `Extra Charges - ${item.categoryName}: ${item.detailName}`,
            qty_or_hours: quantity,
            unit: item.isHourly ? 'hrs' : 'units',
            rate: billRate,
            amount: billAmount,
            sub_pay: subAmount,
            profit: billAmount - subAmount,
            is_hours: item.isHourly
          };
        }),
        // Legacy Extra Charges (Labor)
        ...(!extraChargesFromItems && job?.work_order?.has_extra_charges && job?.work_order?.extra_hours && job?.work_order?.extra_hours > 0 ? [{
          description: job?.work_order?.extra_charges_description || 'Extra Charges (Labor)',
          qty_or_hours: Number(job?.work_order?.extra_hours) || 0,
          unit: 'hrs',
          rate: Number(job.extra_charges_details?.hourly_rate ?? job.hourly_billing_details?.bill_amount ?? 0),
          amount: Number(job.extra_charges_details?.bill_amount) || (Number(job?.work_order?.extra_hours || 0) * Number(job.extra_charges_details?.hourly_rate ?? job.hourly_billing_details?.bill_amount ?? 0)),
          sub_pay: Number(job.extra_charges_details?.sub_pay_amount) || (Number(job?.work_order?.extra_hours || 0) * Number(job.extra_charges_details?.sub_pay_rate ?? job.hourly_billing_details?.sub_pay_amount ?? 0)),
          profit: (Number(job.extra_charges_details?.bill_amount) || (Number(job?.work_order?.extra_hours || 0) * Number(job.extra_charges_details?.hourly_rate ?? job.hourly_billing_details?.bill_amount ?? 0))) - 
                  (Number(job.extra_charges_details?.sub_pay_amount) || (Number(job?.work_order?.extra_hours || 0) * Number(job.extra_charges_details?.sub_pay_rate ?? job.hourly_billing_details?.sub_pay_amount ?? 0))),
          is_hours: true
        }] : [])
      ];

      if (unifiedExtraItems.length > 0) {
        doc.setFont(undefined, 'bold');
        doc.text('Extra Charges', margin, y);
        doc.setFont(undefined, 'normal');
        y += 6;

        unifiedExtraItems.forEach(item => {
          if (y > pageHeight - 50) {
             doc.addPage();
             y = 20;
          }
          
          const displayRate = Number(item.rate) || 0;
          const displayAmount = Number(item.amount) || 0;
          const displaySub = Number(item.sub_pay) || 0;
          const displayProfit = Number(item.profit) || 0;
          
          const descriptionText = `${item.description} (${formatCurrency(displayRate)}/${item.is_hours ? 'hr' : 'ea'})`;
          
          if (descriptionText.length > 40) {
             const splitDesc = doc.splitTextToSize(descriptionText, 80);
             doc.text(splitDesc, margin, y);
          } else {
             doc.text(descriptionText, margin, y);
          }

          const qtyText = item.is_hours ? `${item.qty_or_hours} hrs` : `${item.qty_or_hours}`;
          
          doc.text(qtyText, margin + 80, y);
          doc.text(`${formatCurrency(displayAmount)}`, margin + 100, y);
          doc.text(`${formatCurrency(displaySub)}`, margin + 125, y);
          doc.text(`${formatCurrency(displayProfit)}`, margin + 150, y);
          
          totalAmount += displayAmount;
          totalSubPay += displaySub;
          totalProfit += displayProfit;
          
          y += descriptionText.length > 40 ? 10 : 6;
        });
      }

      // Total line
      y += 4;
      doc.setLineWidth(0.2);
      doc.line(margin, y, margin + (pageWidth - margin * 2), y);
      y += 6;
      doc.setFont(undefined, 'bold');
      doc.text('Total', margin, y);
      
      doc.text(`${formatCurrency(totalAmount)}`, margin + 100, y);
      doc.text(`${formatCurrency(totalSubPay)}`, margin + 125, y);
      doc.text(`${formatCurrency(totalProfit)}`, margin + 150, y);
      doc.setFont(undefined, 'normal');
      
      y += 15;
    }
    
    // Add images if available
    if (job.work_order?.id) {
      try {
        const { data: images, error } = await supabase
          .storage
          .from('work_orders')
          .list(`${job?.work_order?.id ?? ''}`);
          
        if (!error && images && images.length > 0) {
          // Check if we need a new page for images
          if (y > pageHeight - 150) {
            doc.addPage();
            y = 20;
          }
          
          doc.setFontSize(16);
          doc.text('Job Images', margin, y);
          y += 15;
          
          for (const image of images) {
            try {
              const previewResult = await getPreviewUrl(supabase, 'work_orders', `${job?.work_order?.id ?? ''}/${image.name}`);
              
              if (previewResult) {
                const img = new window.Image();
                img.src = previewResult.url;
                await new Promise((resolve) => {
                  img.onload = resolve;
                });
                
                // Calculate dimensions to maintain aspect ratio
                const maxWidth = 170;
                const maxHeight = 100;
                let width = img.width;
                let height = img.height;
                
                if (width > maxWidth) {
                  height = (maxWidth * height) / width;
                  width = maxWidth;
                }
                
                if (height > maxHeight) {
                  width = (maxHeight * width) / height;
                  height = maxHeight;
                }
                
                // Check if we need a new page for this image
                if (y + height > pageHeight - 20) {
                  doc.addPage();
                  y = 20;
                }
                
                // Add image to PDF
                doc.addImage(img, 'JPEG', margin, y, width, height);
                y += height + 10;
              }
            } catch (err) {
              console.error('Error getting preview URL for image:', err);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching images:', err);
      }
    }
    
    doc.save(`work-order-${job?.work_order_num ?? 0}.pdf`);
  };

  // Handle marking notification as sent (for non-approval scenarios)
  // This advances the job from Pending Work Order to Work Order
  const handleMarkNotificationSent = async () => {
    if (!job) return;
    
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) throw new Error('User not found');

      // Get the Work Order phase ID
      const { data: phaseData, error: phaseError } = await supabase
        .from('job_phases')
        .select('id')
        .eq('job_phase_label', 'Work Order')
        .single();
        
      if (phaseError) throw phaseError;
      if (!phaseData) throw new Error('Work Order phase not found');

      // Update the job phase
      const { error: updateError } = await supabase
        .from('jobs')
        .update({ current_phase_id: phaseData.id })
        .eq('id', job.id);

      if (updateError) throw updateError;

      // Log the phase change
      const { error: phaseChangeError } = await supabase
        .from('job_phase_changes')
        .insert({
          job_id: job.id,
          changed_by: userData.user.id,
          from_phase_id: job?.job_phase?.id,
          to_phase_id: phaseData.id,
          change_reason: 'Notification manually marked as sent - job advanced to Work Order'
        });

      if (phaseChangeError) console.error('Error logging phase change:', phaseChangeError);

      // Refresh the job data
      await refetchJob();
      toast.success('Job advanced to Work Order phase');
    } catch (error) {
      console.error('Error marking notification as sent:', error);
      toast.error('Failed to advance job. Please try again.');
    }
  };

  const handleApproveExtraCharges = async () => {
    if (!job) return;
    
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) throw new Error('User not found');

      // Get the Work Order phase ID
      const { data: phaseData, error: phaseError } = await supabase
        .from('job_phases')
        .select('id')
        .eq('job_phase_label', 'Work Order')
        .single();
        
      if (phaseError) throw phaseError;
      if (!phaseData) throw new Error('Work Order phase not found');

      // Update the job phase
      const { error: updateError } = await supabase
        .from('jobs')
        .update({ current_phase_id: phaseData.id })
        .eq('id', job.id);

      if (updateError) throw updateError;

      // Log the phase change
      const { error: phaseChangeError } = await supabase
        .from('job_phase_changes')
        .insert({
          job_id: job.id,
          changed_by: userData.user.id,
          from_phase_id: job?.job_phase?.id,
          to_phase_id: phaseData.id,
          change_reason: 'Extra charges approved manually - job advanced to Work Order'
        });

      if (phaseChangeError) console.error('Error logging phase change:', phaseChangeError);

      // Refresh the job data
      await refetchJob();
      
      // Refetch approval decision to update the UI status
      await fetchApprovalDecision();
      
      setShowApproveButton(false);
      toast.success('Extra charges approved successfully!');
    } catch (error) {
      console.error('Error approving extra charges:', error);
      toast.error('Failed to approve extra charges. Please try again.');
    }
  };

  const handleCancelJobFromDecline = async () => {
    if (!job) return;

    setCancellingJob(true);

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) throw new Error('User not found');

      const { data: cancelledPhase, error: phaseError } = await supabase
        .from('job_phases')
        .select('id')
        .eq('job_phase_label', 'Cancelled')
        .single();

      if (phaseError) throw phaseError;

      const { error: updateError } = await supabase
        .from('jobs')
        .update({ current_phase_id: cancelledPhase.id })
        .eq('id', job.id);

      if (updateError) throw updateError;

      const { error: phaseChangeError } = await supabase
        .from('job_phase_changes')
        .insert({
          job_id: job.id,
          changed_by: userData.user.id,
          from_phase_id: job?.job_phase?.id,
          to_phase_id: cancelledPhase.id,
          change_reason: 'Job cancelled after extra charges were declined'
        });

      if (phaseChangeError) throw phaseChangeError;

      await refetchJob(true);
      await refetchPhaseChanges();
      setShowCancelJobConfirm(false);
      toast.success('Job moved to Cancelled phase');
      setReactivatedFromDecline(false);
    } catch (error) {
      console.error('Error cancelling job from decline banner:', error);
      toast.error('Failed to cancel job');
    } finally {
      setCancellingJob(false);
    }
  };

  const handleReactivateJob = async () => {
    if (!job) return;

    setReactivatingJob(true);

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) throw new Error('User not found');

      const { data: pendingPhase, error: phaseError } = await supabase
        .from('job_phases')
        .select('id')
        .eq('job_phase_label', 'Pending Work Order')
        .single();

      if (phaseError) throw phaseError;

      const { error: updateError } = await supabase
        .from('jobs')
        .update({ current_phase_id: pendingPhase.id })
        .eq('id', job.id);

      if (updateError) throw updateError;

      const { error: phaseChangeError } = await supabase
        .from('job_phase_changes')
        .insert({
          job_id: job.id,
          changed_by: userData.user.id,
          from_phase_id: job?.job_phase?.id,
          to_phase_id: pendingPhase.id,
          change_reason: 'Job re-activated after extra charges decline'
        });

      if (phaseChangeError) throw phaseChangeError;

      await refetchJob(true);
      await refetchPhaseChanges();
      setApprovalTokenDecision(null); // treat as pending until a new decision arrives
      setReactivatedFromDecline(true);
      toast.success('Job moved to Pending Work Order');
    } catch (error) {
      console.error('Error reactivating job:', error);
      toast.error('Failed to re-activate job');
    } finally {
      setReactivatingJob(false);
    }
  };

  // Add this function inside JobDetails component
  const generateInvoicePDF = async () => {
    try {
      if (!job) return;
      const doc = new jsPDF();
      let y = 15;
      const margin = 15;
      const pageWidth = 210; // A4 width in mm
      const contentWidth = pageWidth - (margin * 2);

      // Add logo with timeout and error handling
      const logo = new window.Image();
      logo.src = 'https://tbwtfimnbmvbgesidbxh.supabase.co/storage/v1/object/public/files/fb38963b-c67e-4924-860b-312045d19d2f/1750132407578_jg-logo-icon.png';
      let logoLoaded = false;
      await new Promise<void>((resolve) => {
        logo.onload = () => {
          logoLoaded = true;
          resolve();
        };
        // Timeout after 2 seconds
        setTimeout(() => {
          if (!logoLoaded) resolve();
        }, 2000);
      });
      if (logoLoaded) {
        // Smaller logo for single page
        doc.addImage(logo, 'PNG', margin, y, 12, 12);
        y += 12 + 8; // Logo height plus spacing
      }

      // --- INVOICE HEADER ---
      doc.setFontSize(18);
      doc.text('INVOICE', margin, y);
      y += 12;

      // Invoice details in compact format
      doc.setFontSize(8);
      doc.text(`Date: ${formatDate(new Date().toISOString())}`, margin, y);
      doc.text(`Invoice #: ${formatWorkOrderNumber(job?.work_order_num ?? 0)}`, margin + 60, y);
      y += 5;
      doc.text(`QB#: ${job?.property?.quickbooks_number || 'None Provided'}`, margin, y);
      y += 5;
      doc.text(`Property: ${job?.property?.name ?? '—'}`, margin, y);
      doc.text(`Unit: ${job?.unit_number ?? '—'}`, margin + 60, y);
      y += 5;
      doc.text(`Address: ${job?.property?.address ?? ''}, ${job?.property?.city ?? ''}, ${job?.property?.state ?? ''} ${job?.property?.zip ?? ''}`, margin, y);
      y += 5;
      doc.text(`Job Type: ${job?.job_type?.label ?? '—'}`, margin, y);
      y += 5;
      
      // Add Scheduled Work Date and Invoice Sent Date
      const scheduledDate = job?.scheduled_date ? formatDate(job.scheduled_date) : 'Not Scheduled';
      doc.text(`Scheduled Work Date: ${scheduledDate}`, margin, y);
      
      const invoiceSentDate = job?.invoice_sent_date ? formatDate(job.invoice_sent_date) : 'Not Sent';
      doc.text(`Invoice Sent Date: ${invoiceSentDate}`, margin + 60, y);
      y += 8;

      // Billing Breakdown Table
      doc.setFontSize(10);
      doc.text('Billing Breakdown', margin, y);
      y += 6;
      
      // Table header
      doc.setFontSize(8);
      
      // Define columns based on user role (Admin/Management sees more)
      const showFullBreakdown = false;
      
      if (showFullBreakdown) {
        doc.text('Description', margin, y);
        doc.text('Qty', margin + 80, y);
        doc.text('Bill', margin + 100, y);
        doc.text('Pay', margin + 125, y);
        doc.text('Profit', margin + 150, y);
      } else {
        doc.text('Description', margin, y);
        doc.text('Qty', margin + 100, y);
        doc.text('Amount', margin + 120, y);
      }
      
      y += 4;
      doc.setLineWidth(0.1);
      doc.line(margin, y, margin + contentWidth, y);
      y += 4;

      let totalAmount = 0;
      let totalSubPay = 0;
      let totalProfit = 0;

      // Base Billing line item
      const billingDescription = `${job?.work_order?.job_category || 'Standard Paint'} - ${job?.unit_size?.label ?? '—'}`;
      doc.text(billingDescription, margin, y);
      
      const baseAmount = job.billing_details?.bill_amount ?? 0;
      const baseSub = job.billing_details?.sub_pay_amount ?? 0;
      const baseProfitVal = baseAmount - baseSub;
      
      if (showFullBreakdown) {
        doc.text('1', margin + 80, y);
        doc.text(`${formatCurrency(baseAmount)}`, margin + 100, y);
        doc.text(`${formatCurrency(baseSub)}`, margin + 125, y);
        doc.text(`${formatCurrency(baseProfitVal)}`, margin + 150, y);
      } else {
        doc.text('1', margin + 100, y);
        doc.text(`${formatCurrency(baseAmount)}`, margin + 120, y);
      }
      
      totalAmount += baseAmount;
      totalSubPay += baseSub;
      totalProfit += baseProfitVal;
      
      y += 5;

      // Supplemental Billing Lines + Extra Charges (Unified)
      const unifiedExtraItems = [
        // Map supplemental billing lines (ceilings/accent walls)
        ...(supplementalBillingLines || []).map(line => ({
          description: line.label,
          qty_or_hours: line.qty,
          unit: line.unitLabel || 'items',
          rate: line.qty > 0 ? line.amountBill / line.qty : 0,
          amount: line.amountBill,
          sub_pay: line.amountSub,
          profit: line.amountBill - line.amountSub,
          is_hours: false
        })),
        // Map Extra Charges (Itemized)
        ...(extraChargeLineItems || []).map(item => {
          const quantity = Number(item.quantity) || 0;
          const billRate = Number(item.billRate) || 0;
          const subRate = Number(item.subRate) || 0;
          const billAmount = Number(item.calculatedBillAmount ?? quantity * billRate) || 0;
          const subAmount = Number(item.calculatedSubAmount ?? quantity * subRate) || 0;
          return {
            description: `Extra Charges - ${item.categoryName}: ${item.detailName}`,
            qty_or_hours: quantity,
            unit: item.isHourly ? 'hrs' : 'units',
            rate: billRate,
            amount: billAmount,
            sub_pay: subAmount,
            profit: billAmount - subAmount,
            is_hours: item.isHourly
          };
        }),
        // Legacy Extra Charges (Labor)
        ...(!extraChargesFromItems && job?.work_order?.has_extra_charges && job?.work_order?.extra_hours && job?.work_order?.extra_hours > 0 ? [{
          description: job?.work_order?.extra_charges_description || 'Extra Charges (Labor)',
          qty_or_hours: Number(job?.work_order?.extra_hours) || 0,
          unit: 'hrs',
          rate: Number(job.extra_charges_details?.hourly_rate ?? job.hourly_billing_details?.bill_amount ?? 0),
          amount: Number(job.extra_charges_details?.bill_amount) || (Number(job?.work_order?.extra_hours || 0) * Number(job.extra_charges_details?.hourly_rate ?? job.hourly_billing_details?.bill_amount ?? 0)),
          sub_pay: Number(job.extra_charges_details?.sub_pay_amount) || (Number(job?.work_order?.extra_hours || 0) * Number(job.extra_charges_details?.sub_pay_rate ?? job.hourly_billing_details?.sub_pay_amount ?? 0)),
          profit: (Number(job.extra_charges_details?.bill_amount) || (Number(job?.work_order?.extra_hours || 0) * Number(job.extra_charges_details?.hourly_rate ?? job.hourly_billing_details?.bill_amount ?? 0))) - 
                  (Number(job.extra_charges_details?.sub_pay_amount) || (Number(job?.work_order?.extra_hours || 0) * Number(job.extra_charges_details?.sub_pay_rate ?? job.hourly_billing_details?.sub_pay_amount ?? 0))),
          is_hours: true
        }] : [])
      ];

      if (unifiedExtraItems.length > 0) {
        // Section Header
        doc.setFont(undefined, 'bold');
        doc.text('Extra Charges', margin, y);
        doc.setFont(undefined, 'normal');
        y += 5;

        unifiedExtraItems.forEach(item => {
          if (y > 250) {
             doc.addPage();
             y = 20;
          }
          
          const displayRate = Number(item.rate) || 0;
          const displayAmount = Number(item.amount) || 0;
          const displaySub = Number(item.sub_pay) || 0;
          const displayProfit = Number(item.profit) || 0;
          
          // Description with Rate
          const descriptionText = `${item.description} (${formatCurrency(displayRate)}/${item.is_hours ? 'hr' : 'ea'})`;
          
          // Handle long descriptions
          if (descriptionText.length > 40) {
             const splitDesc = doc.splitTextToSize(descriptionText, 80);
             doc.text(splitDesc, margin, y);
          } else {
             doc.text(descriptionText, margin, y);
          }

          // Qty/Hrs
          const qtyText = item.is_hours ? `${item.qty_or_hours} hrs` : `${item.qty_or_hours}`;
          
          if (showFullBreakdown) {
            doc.text(qtyText, margin + 80, y);
            doc.text(`${formatCurrency(displayAmount)}`, margin + 100, y);
            doc.text(`${formatCurrency(displaySub)}`, margin + 125, y);
            doc.text(`${formatCurrency(displayProfit)}`, margin + 150, y);
          } else {
            doc.text(qtyText, margin + 100, y);
            doc.text(`${formatCurrency(displayAmount)}`, margin + 120, y);
          }
          
          totalAmount += displayAmount;
          totalSubPay += displaySub;
          totalProfit += displayProfit;
          
          y += descriptionText.length > 40 ? 10 : 5;
        });
      }

      // Total line
      y += 3;
      doc.setLineWidth(0.2);
      doc.line(margin, y, margin + contentWidth, y);
      y += 4;
      doc.setFontSize(9);
      doc.setFont(undefined, 'bold');
      doc.text('Total', margin, y);
      
      if (showFullBreakdown) {
        doc.text(`${formatCurrency(totalAmount)}`, margin + 100, y);
        doc.text(`${formatCurrency(totalSubPay)}`, margin + 125, y);
        doc.text(`${formatCurrency(totalProfit)}`, margin + 150, y);
      } else {
        doc.text(`${formatCurrency(totalAmount)}`, margin + 120, y);
      }
      
      y += 8;



      // Footer
      y = 280;
      doc.setFontSize(8);
      doc.text('Thank you for your business!', margin, y);

      // Add PAID watermark if job is marked as paid (regardless of current phase)
      if (job?.invoice_paid) {
        // Save current graphics state
        doc.saveGraphicsState();
        
        // Set watermark properties
        doc.setFontSize(48);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(0, 128, 0); // Green color
        doc.setGState(doc.GState({opacity: 0.15})); // Low opacity
        
        // Calculate center position
        const pageHeight = 297; // A4 height in mm
        const centerX = pageWidth / 2;
        const centerY = pageHeight / 2;
        
        // Rotate and position the text diagonally
        doc.text('PAID', centerX, centerY, {
          angle: 45, // 45 degrees clockwise
          align: 'center'
        });
        
        // Restore graphics state
        doc.restoreGraphicsState();
      }

      doc.save(`invoice-${job?.work_order_num ?? 0}.pdf`);
    } catch (error) {
      console.error('Error generating invoice PDF:', error);
      alert('Failed to generate invoice PDF. Please try again.');
    }
  };

  // Helper functions for notification emails
  const handleSendSprinklerPaintNotification = () => {
    setNotificationType('sprinkler_paint');
    setShowEnhancedNotificationModal(true);
  };

  const handleSendDrywallRepairsNotification = () => {
    setNotificationType('drywall_repairs');
    setShowEnhancedNotificationModal(true);
  };

  const handleSendExtraChargesNotification = () => {
    setNotificationType('extra_charges');
    setShowEnhancedNotificationModal(true);
  };

  const handleNotificationSent = () => {
    toast.success('Notification sent successfully');
    setShowNotificationModal(false);
    setNotificationType(null);
  };

  // Invoice status handlers
  const handleMarkInvoiceSent = async () => {
    if (!job?.id) return;
    
    setUpdatingInvoiceStatus(true);
    
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ 
          invoice_sent: true,
          invoice_sent_date: new Date().toISOString()
        })
        .eq('id', job.id);
        
      if (error) throw error;
      
      // Refresh job data to show updated status
      await refetchJob();
      
      
      toast.success('Invoice marked as sent successfully');
    } catch (error) {
      console.error('Error marking invoice as sent:', error);
      toast.error('Failed to mark invoice as sent');
    } finally {
      setUpdatingInvoiceStatus(false);
    }
  };

  const handleMarkInvoicePaid = async () => {
    if (!job?.id) return;
    
    setUpdatingInvoiceStatus(true);
    
    try {
      // Get current user for phase change tracking
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) throw new Error('User not found');

      // Get the "Completed" phase ID
      const { data: completedPhase, error: phaseError } = await supabase
        .from('job_phases')
        .select('id')
        .eq('job_phase_label', 'Completed')
        .single();

      if (phaseError) throw phaseError;

      // Update job to mark as paid and change phase to Completed
      const { error: updateError } = await supabase
        .from('jobs')
        .update({ 
          invoice_paid: true,
          invoice_paid_date: new Date().toISOString(),
          current_phase_id: completedPhase.id
        })
        .eq('id', job.id);
        
      if (updateError) throw updateError;

      // Create phase change record
      const { error: phaseChangeError } = await supabase
        .from('job_phase_changes')
        .insert({
          job_id: job.id,
          changed_by: userData.user.id,
          from_phase_id: job.job_phase?.id,
          to_phase_id: completedPhase.id,
          change_reason: 'Invoice marked as paid - auto-transitioned to completed'
        });

      if (phaseChangeError) throw phaseChangeError;
      
      // Refresh job data to show updated status
      await refetchJob();
      
      toast.success('Invoice marked as paid and job moved to completed phase');
    } catch (error) {
      console.error('Error marking invoice as paid:', error);
      toast.error('Failed to mark invoice as paid');
    } finally {
      setUpdatingInvoiceStatus(false);
    }
  };

  const extraChargeLineItems = useMemo(
    () => (Array.isArray(job?.work_order?.extra_charges_line_items) ? job.work_order.extra_charges_line_items : []),
    [job?.work_order?.extra_charges_line_items]
  );

  const extraChargeItemTotals = useMemo(() => {
    return extraChargeLineItems.reduce(
      (acc, item) => {
        const quantity = Number(item.quantity) || 0;
        const billRate = Number(item.billRate) || 0;
        const subRate = Number(item.subRate) || 0;
        const billAmount = Number(item.calculatedBillAmount ?? quantity * billRate) || 0;
        const subAmount = Number(item.calculatedSubAmount ?? quantity * subRate) || 0;
        acc.bill += billAmount;
        acc.sub += subAmount;
        return acc;
      },
      { bill: 0, sub: 0 }
    );
  }, [extraChargeLineItems]);

  const extraChargesFromItems = extraChargeLineItems.length > 0;

  // Use extra charges details from the job data; fall back to work order + hourly rates if the structured payload is missing
  const rawExtraHours = job?.extra_charges_details?.hours ?? job?.work_order?.extra_hours ?? 0;
  const extraHours = Number(rawExtraHours) || 0;
  const extraChargesDescription = extraChargesFromItems
    ? 'Itemized Extra Charges'
    : (job?.extra_charges_details?.description ?? job?.work_order?.extra_charges_description ?? '');
  const extraHourlyRate = job?.extra_charges_details?.hourly_rate ?? job?.hourly_billing_details?.bill_amount ?? 0;
  const extraSubPayRate = job?.extra_charges_details?.sub_pay_rate ?? job?.hourly_billing_details?.sub_pay_amount ?? 0;
  const legacyExtraChargesAmount = job?.extra_charges_details?.bill_amount ?? (extraHours > 0 ? extraHours * extraHourlyRate : 0);
  const legacyExtraChargesSubPay = job?.extra_charges_details?.sub_pay_amount ?? (extraHours > 0 ? extraHours * extraSubPayRate : 0);
  const extraChargesAmount = extraChargesFromItems ? extraChargeItemTotals.bill : legacyExtraChargesAmount;
  const extraChargesSubPay = extraChargesFromItems ? extraChargeItemTotals.sub : legacyExtraChargesSubPay;
  const derivedExtraCharges = extraChargesFromItems
    ? {
        description: 'Itemized Extra Charges',
        hours: 0,
        hourly_rate: 0,
        sub_pay_rate: 0,
        bill_amount: extraChargeItemTotals.bill,
        sub_pay_amount: extraChargeItemTotals.sub,
        profit_amount: extraChargeItemTotals.bill - extraChargeItemTotals.sub,
        section_name: 'Extra Charges',
      }
    : (job?.extra_charges_details ?? (
        job?.work_order?.has_extra_charges && (extraHours > 0 || extraHourlyRate > 0)
          ? {
              description: extraChargesDescription || 'Extra Charges',
              hours: extraHours,
              hourly_rate: extraHourlyRate,
              sub_pay_rate: extraSubPayRate,
              bill_amount: legacyExtraChargesAmount,
              sub_pay_amount: legacyExtraChargesSubPay,
              profit_amount: legacyExtraChargesAmount - legacyExtraChargesSubPay,
              section_name: 'Extra Charges',
            }
          : null
      ));
  const unifiedExtraLines = useMemo(() => {
    const lines: Array<{
      id: string;
      label: string;
      quantity: number;
      unit: string;
      rate?: number;
      billAmount: number;
      subAmount: number;
      notes?: string;
    }> = [];

    supplementalBillingLines.forEach((line) => {
      const qty = Number(line.qty) || 0;
      const billAmount = Number(line.amountBill) || 0;
      lines.push({
        id: `supplemental-${line.key}`,
        label: line.label,
        quantity: qty,
        unit: line.unitLabel ?? 'units',
        rate: qty > 0 ? billAmount / qty : billAmount,
        billAmount,
        subAmount: Number(line.amountSub) || 0
      });
    });

    extraChargeLineItems.forEach((item) => {
      const quantity = Number(item.quantity) || 0;
      const billRate = Number(item.billRate) || 0;
      const subRate = Number(item.subRate) || 0;
      const billAmount = Number(item.calculatedBillAmount ?? quantity * billRate) || 0;
      const subAmount = Number(item.calculatedSubAmount ?? quantity * subRate) || 0;
      lines.push({
        id: `extra-${item.id}`,
        label: `Extra Charges - ${item.categoryName}: ${item.detailName}`,
        quantity,
        unit: item.isHourly ? 'hrs' : 'units',
        rate: billRate,
        billAmount,
        subAmount,
        notes: item.notes ?? undefined
      });
    });

    const hasLegacyExtraCharges =
      !extraChargesFromItems &&
      (extraHours > 0 ||
        legacyExtraChargesAmount > 0 ||
        legacyExtraChargesSubPay > 0 ||
        (extraChargesDescription || '').trim().length > 0);

    if (hasLegacyExtraCharges) {
      lines.push({
        id: 'extra-legacy',
        label: extraChargesDescription || 'Extra Charges (Labor)',
        quantity: extraHours || 0,
        unit: 'hrs',
        rate: extraHourlyRate || 0,
        billAmount: legacyExtraChargesAmount,
        subAmount: legacyExtraChargesSubPay
      });
    }

    return lines;
  }, [
    extraChargeLineItems,
    extraChargesDescription,
    extraChargesFromItems,
    extraHourlyRate,
    extraHours,
    legacyExtraChargesAmount,
    legacyExtraChargesSubPay,
    supplementalBillingLines
  ]);

  const unifiedExtraTotals = useMemo(() => {
    return unifiedExtraLines.reduce(
      (acc, line) => {
        acc.bill += Number(line.billAmount) || 0;
        acc.sub += Number(line.subAmount) || 0;
        return acc;
      },
      { bill: 0, sub: 0 }
    );
  }, [unifiedExtraLines]);

  const hasExtraChargesForApproval = Boolean(
    job?.work_order?.has_extra_charges ||
    unifiedExtraLines.length > 0 ||
    derivedExtraCharges
  );
  const notificationJob = useMemo(() => {
    if (!job) return job;
    return {
      ...job,
      extra_charges_details: derivedExtraCharges ?? job.extra_charges_details,
    };
  }, [job, derivedExtraCharges]);

  if (jobLoading || phasesLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (jobError || !job) {
    if (jobLoading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading job details...</p>
          </div>
        </div>
      );
    }
    return (
      <div className="p-4 text-sm opacity-70">
        Unable to load job details.
      </div>
    );
  }

  // Safe accessors (already declared above)
  const unitSizeLabel = job?.unit_size?.label ?? '—';

  const canChangePhase = isAdmin || isJGManagement;
  const canEditJob = (isAdmin || isJGManagement) && phaseLabel === 'Job Request';
  const canDeleteJob = isAdmin && phaseLabel === 'Job Request';
  const canAssignSubcontractor = isAdmin || isJGManagement;
  const hasWorkOrder = !!job.work_order;
  const isJobRequest = phaseLabel === 'Job Request';
  const isPendingWorkOrder = phaseLabel === 'Pending Work Order';
  const isWorkOrder = phaseLabel === 'Work Order';
  const isInvoicing = phaseLabel === 'Invoicing';
  const isCompleted = phaseLabel === 'Completed';
  const isCancelled = phaseLabel === 'Cancelled';

  // Calculate profit if billing details are available
  const profitAmount = (job.billing_details?.bill_amount !== null && job.billing_details?.sub_pay_amount !== null && job.billing_details?.bill_amount !== undefined && job.billing_details?.sub_pay_amount !== undefined)
    ? job.billing_details.bill_amount - job.billing_details.sub_pay_amount
    : null;
  

  // Filter out 'Pending Work Order', 'Cancelled', and 'Archived' from the phases array used for navigation
  // Users cannot advance to Archived phase from job details - Invoicing is the final navigable phase
  const navPhases = phases ? phases.filter(p => 
    p.job_phase_label !== 'Pending Work Order' && 
    p.job_phase_label !== 'Cancelled' &&
    p.job_phase_label !== 'Archived'
  ) : [];
  const phaseId = job?.job_phase?.id ?? null;
  const navPhasesSafe = Array.isArray(navPhases) ? navPhases : [];
  const currentNavPhaseIndex = phaseId
    ? navPhasesSafe.findIndex(p => p?.id === phaseId)
    : -1;

  // Add a helper function to handle phase change by phase object
  const handlePhaseChangeTo = async (phase) => {
    if (!phase || !job) return;
    setChangingPhase(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) throw new Error('User not found');
      
      // Update job phase
      const { error: updateError } = await supabase
        .from('jobs')
        .update({ current_phase_id: phase.id })
        .eq('id', jobId);
      if (updateError) throw updateError;
      
      // Create phase change record
      const { error: phaseChangeError } = await supabase
        .from('job_phase_changes')
        .insert([{
          job_id: jobId,
          changed_by: userData.user.id,
          from_phase_id: job?.job_phase?.id,
          to_phase_id: phase.id,
          change_reason: `Phase changed by ${userData.user.email}`
        }]);
      if (phaseChangeError) throw phaseChangeError;
      
      // Force refresh to bypass rate limiting and ensure immediate UI update
      await refetchJob(true);
      await refetchPhaseChanges();
      
      toast.success('Job phase changed successfully');
    } catch (err) {
      console.error('Error changing job phase:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to change job phase');
    } finally {
      setChangingPhase(false);
    }
  };


  return (
    <div className="p-6 bg-gray-100 dark:bg-[#0F172A] min-h-screen">
      <div className="mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate(getBackNavigationPath('/dashboard/jobs', isSubcontractor))}
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
            <div className="flex items-center space-x-3">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {formatWorkOrderNumber(job?.work_order_num ?? 0)}
              </h1>
              <span 
                className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold"
                style={{ 
                  backgroundColor: getJobPhaseColor(),
                  color: 'white'
                }}
              >
                {phaseLabel}
              </span>
            </div>
          </div>
          <div className="flex space-x-3">
            {canChangePhase && !isPendingWorkOrder && !isCancelled && (
              <>
                {!isJobRequest && (
                  <button
                    onClick={() => {
                      if (currentNavPhaseIndex > 0) handlePhaseChangeTo(navPhases[currentNavPhaseIndex - 1]);
                    }}
                    disabled={currentNavPhaseIndex === 0 || changingPhase}
                    className="inline-flex items-center px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: currentNavPhaseIndex > 0 ? navPhases[currentNavPhaseIndex - 1].color_dark_mode : '#6B7280'
                    }}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    {changingPhase ? 'Changing...' : `Previous: ${currentNavPhaseIndex > 0 ? navPhases[currentNavPhaseIndex - 1].job_phase_label : 'N/A'}`}
                  </button>
                )}
                <button
                  onClick={() => {
                    if (currentNavPhaseIndex < navPhases.length - 1) handlePhaseChangeTo(navPhases[currentNavPhaseIndex + 1]);
                  }}
                  disabled={currentNavPhaseIndex === navPhases.length - 1 || changingPhase}
                  className="inline-flex items-center px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: currentNavPhaseIndex < navPhases.length - 1 ? navPhases[currentNavPhaseIndex + 1].color_dark_mode : '#6B7280'
                  }}
                >
                  <ArrowRight className="h-4 w-4 mr-2" />
                  {changingPhase ? 'Changing...' : `Next: ${currentNavPhaseIndex < navPhases.length - 1 ? navPhases[currentNavPhaseIndex + 1].job_phase_label : 'N/A'}`}
                </button>
              </>
            )}
            {canEditJob && (
              <button
                onClick={() => navigate(`/dashboard/jobs/${jobId}/edit`)}
                className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Job
              </button>
            )}
            {canDeleteJob && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="inline-flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Job
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Job Details */}
          <div className="lg:col-span-2 bg-white dark:bg-[#1E293B] rounded-xl shadow-lg overflow-hidden">
            {/* Header Section */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800 px-6 py-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-white flex items-center">
                  <FileText className="h-5 w-5 mr-2" />
                  Job Details
                </h2>
                <div className="flex items-center space-x-2 bg-white/10 backdrop-blur-sm rounded-lg px-3 py-1.5">
                  <span className="text-xs font-medium text-white/80">Job Type:</span>
                  <span className="text-sm font-semibold text-white">{job.job_type.label}</span>
                </div>
              </div>
            </div>

            {/* Content Section */}
            <div className="p-6">
              {(job.assignment_status === 'declined' || (job.assignment_status === 'pending' && job.assigned_to)) && (
                <div className={`mb-6 rounded-lg border px-4 py-3 flex items-start space-x-3 ${job.assignment_status === 'declined' ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300' : 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-300'}`}>
                  <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    {job.assignment_status === 'declined' ? (
                      <>
                        <p className="font-semibold">Assignment was declined{job.assignment_decision_at ? ` on ${formatDate(job.assignment_decision_at)}` : ''}.</p>
                        {job.declined_reason_code && (
                          <p className="mt-1">Reason: {job.declined_reason_code}{job.declined_reason_text ? ` – ${job.declined_reason_text}` : ''}</p>
                        )}
                      </>
                    ) : (
                      <p className="font-semibold">Assignment pending acceptance by subcontractor.</p>
                    )}
                  </div>
                </div>
              )}
              
              {/* Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Property */}
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center">
                    <Building2 className="h-4 w-4 mr-1.5" />
                    Property
                  </h3>
                  <div className="pl-5">
                    <Link 
                      to={`/dashboard/properties/${job?.property?.id ?? ''}`}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-semibold text-base block"
                    >
                      {job?.property?.name ?? '—'}
                    </Link>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1.5 leading-relaxed">
                      {job?.property?.address ?? '—'}
                      <br />
                      {job?.property?.city ?? '—'}, {job?.property?.state ?? '—'} {job?.property?.zip ?? '—'}
                    </p>
                  </div>
                </div>
                
                {/* Unit Information */}
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center">
                    <MapPin className="h-4 w-4 mr-1.5" />
                    Unit Information
                  </h3>
                  <div className="pl-5 space-y-2">
                    <div className="flex items-center text-gray-900 dark:text-white">
                      <span className="font-semibold">Unit #{job.unit_number}</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                      <ClipboardList className="h-4 w-4 mr-2 text-gray-400" />
                      <span>Size: {job.unit_size.label}</span>
                    </div>
                  </div>
                </div>
                
                {/* Schedule */}
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center">
                    <Calendar className="h-4 w-4 mr-1.5" />
                    Scheduled Date
                  </h3>
                  <div className="pl-5">
                    <span className="text-gray-900 dark:text-white font-medium">
                      {formatDate(job?.scheduled_date)}
                    </span>
                  </div>
                </div>
                
                {/* Purchase Order */}
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center">
                    <Clipboard className="h-4 w-4 mr-1.5" />
                    Purchase Order
                  </h3>
                  <div className="pl-5">
                    <span className="text-gray-900 dark:text-white font-medium">
                      {job?.purchase_order || <span className="text-gray-400 italic">None</span>}
                    </span>
                  </div>
                </div>
                
                {/* Assigned To */}
                <div className="space-y-2 md:col-span-2">
                  <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center">
                    <User className="h-4 w-4 mr-1.5" />
                    Assigned To
                  </h3>
                  <div className="pl-5 flex items-center justify-between">
                    <span className="text-gray-900 dark:text-white font-medium">
                      {job.assigned_to ? (
                        (() => {
                          const assignedId = job.assigned_to;
                          const subcontractorsSafe = Array.isArray(subcontractors) ? subcontractors : [];
                          const found = assignedId ? subcontractorsSafe.find(s => s?.id === assignedId) : null;
                          return found?.full_name || 'Unknown';
                        })()
                      ) : (
                        <span className="text-gray-400 italic">Not assigned</span>
                      )}
                    </span>
                    {canAssignSubcontractor && (
                      <Link
                        to={`/dashboard/sub-scheduler?jobId=${jobId}`}
                        className="inline-flex items-center text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                      >
                        {job.assigned_to ? 'Change' : 'Assign'}
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Property Map */}
            <div className="px-6 pb-6">
              <div className="relative z-0 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                <PropertyMap 
                  address={`${job?.property?.address ?? ''}, ${job?.property?.city ?? ''}, ${job?.property?.state ?? ''} ${job?.property?.zip ?? ''}`}
                  className="w-full h-[300px]"
                />
              </div>
            </div>
            
            {job.description && (
              <div className="px-6 pb-6">
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Description</h3>
                <p className="text-gray-900 dark:text-white whitespace-pre-wrap bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">{job.description}</p>
              </div>
            )}

            {/* Job Files display for Job Request phase */}
            {isJobRequest && jobIdForFiles && (
              <div className="px-6 pb-6">
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center">
                  <Image className="h-4 w-4 mr-1.5 text-blue-500" />
                  Job Files
                </h3>
                <div className="bg-gray-50 dark:bg-[#0F172A] p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                  <ImageGallery workOrderId={workOrderId} jobId={jobIdForFiles} folder="job_files" />
                </div>
              </div>
            )}
            
            <div className="px-6 pb-6 flex flex-wrap gap-3">
              {/* Show Work Order button for admins/managers if no work order exists */}
              {(isAdmin || isJGManagement) && !hasWorkOrder && (
                <Link
                  to={`/dashboard/jobs/${jobId}/new-work-order`}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Add Work Order
                </Link>
              )}
              
              {/* Show Work Order button for subcontractors only in Job Request phase */}
              {!isAdmin && !isJGManagement && isJobRequest && !hasWorkOrder && (
                <Link
                  to={`/dashboard/jobs/${jobId}/new-work-order`}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Work Order
                </Link>
              )}
            </div>
          </div>

          {/* Phase History */}
          <div className="bg-white dark:bg-[#1E293B] rounded-xl shadow-lg overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-purple-700 dark:from-purple-700 dark:to-purple-800 px-6 py-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-white flex items-center">
                  <Clock className="h-5 w-5 mr-2" />
                  Phase History
                </h2>
                <button
                  onClick={() => setShowPhaseHistory(!showPhaseHistory)}
                  className="text-sm text-white/80 hover:text-white font-medium transition-colors flex items-center"
                >
                  {showPhaseHistory ? (
                    <>
                      <ChevronUp className="h-4 w-4 mr-1" />
                      Show Less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4 mr-1" />
                      Show All
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {phaseChangesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
                </div>
              ) : phaseChangesError ? (
                <div className="text-red-500 dark:text-red-400 text-sm">
                  {phaseChangesError}
                </div>
              ) : phaseChanges.length === 0 ? (
                <div className="text-gray-500 dark:text-gray-400 text-center py-8">
                  No phase changes recorded
                </div>
              ) : (
                <div className="space-y-4">
                  {(showPhaseHistory ? phaseChanges : phaseChanges.slice(0, 3)).map((change, index) => (
                    <div key={change.id} className="relative pb-4">
                      {index < (showPhaseHistory ? phaseChanges.length : Math.min(3, phaseChanges.length)) - 1 && (
                        <div className="absolute left-4 top-10 h-full w-0.5 bg-gray-200 dark:bg-gray-700"></div>
                      )}
                      <div className="flex items-start">
                        <div 
                          className="rounded-full h-9 w-9 flex items-center justify-center flex-shrink-0 z-10 shadow-lg"
                          style={{ backgroundColor: change.to_phase_color || '#4B5563' }}
                        >
                          <Clock className="h-4 w-4 text-white" />
                        </div>
                        <div className="ml-4 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                              {change.to_phase_label}
                            </h3>
                            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                              {formatDate(change.changed_at)}
                            </span>
                          </div>
                          {change.from_phase_label && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              From: <span className="font-medium">{change.from_phase_label}</span>
                            </p>
                          )}
                          {change.change_reason && (
                            <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 bg-gray-50 dark:bg-gray-800/50 rounded px-2 py-1.5">
                              {change.change_reason}
                            </p>
                          )}
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex items-center">
                            <User className="h-3 w-3 mr-1" />
                            {change.changed_by_name || 'Unknown'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {!showPhaseHistory && phaseChanges.length > 3 && (
                    <button
                      onClick={() => setShowPhaseHistory(true)}
                      className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 font-medium w-full text-center mt-4 py-2 border-t border-gray-200 dark:border-gray-700 pt-4"
                    >
                      View {phaseChanges.length - 3} More Changes
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Work Order Details - Always show if work order exists */}
        {job.work_order && (
          <div className="bg-white dark:bg-[#1E293B] rounded-xl shadow-lg mb-6 overflow-hidden">
            {/* Header Section */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800 px-6 py-4">
              <h2 className="text-xl font-semibold text-white flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                Work Order Details
              </h2>
            </div>

            {/* Extra Charges Status - Shows different UI based on approval decision */}
            {hasExtraChargesForApproval && (
              <div>
                {/* Cancelled after decline - Re-activate option only */}
                {isCancelled && effectiveApprovalDecision?.decision === 'declined' && (
                  <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-700/30 text-red-800 dark:text-red-200 px-6 py-4 relative z-[50]">
                    <div className="flex items-start">
                      <AlertTriangle className="h-5 w-5 mr-2 text-red-600 dark:text-red-400 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium">Job Cancelled due to Declined Extra Charges</p>
                        <p className="mt-1 text-sm">
                          The extra charges were declined by {effectiveApprovalDecision.approver_name || effectiveApprovalDecision.approver_email || 'the approver'} on{' '}
                          {effectiveApprovalDecision.decision_at ? new Date(effectiveApprovalDecision.decision_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit'
                          }) : 'an unknown date'}.
                        </p>
                        {(isAdmin || isJGManagement) && (
                          <div className="mt-3">
                            <button
                              onClick={handleReactivateJob}
                              disabled={reactivatingJob}
                              className="inline-flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              {reactivatingJob ? 'Re-Activating...' : 'Re-Activate Job'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* DECLINED STATE - Red alert with resend/override options */}
                {!isCancelled && effectiveApprovalDecision?.decision === 'declined' && (
                  <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-700/30 text-red-800 dark:text-red-200 px-6 py-4 relative z-[50]">
                    <div className="flex items-start">
                      <XCircle className="h-5 w-5 mr-2 text-red-600 dark:text-red-400 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium">Extra Charges Declined</p>
                        <p className="mt-1 text-sm">
                          The extra charges were declined by {effectiveApprovalDecision.approver_name || effectiveApprovalDecision.approver_email || 'the approver'} on{' '}
                          {effectiveApprovalDecision.decision_at ? new Date(effectiveApprovalDecision.decision_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit'
                          }) : 'an unknown date'}.
                          {effectiveApprovalDecision.decline_reason && ` Reason: ${effectiveApprovalDecision.decline_reason}`}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-3">
                          <button
                            onClick={handleSendExtraChargesNotification}
                            className="inline-flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                          >
                            <Mail className="h-4 w-4 mr-2" />
                            Resend Approval Email
                          </button>
                          {(isAdmin || isJGManagement) && (
                            <button
                              onClick={handleApproveExtraCharges}
                              className="inline-flex items-center px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-lg transition-colors"
                              title="Override the decline and approve manually"
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Approve Manually
                            </button>
                          )}
                          {(isAdmin || isJGManagement) && !isCancelled && (
                            <button
                              onClick={() => setShowCancelJobConfirm(true)}
                              className="inline-flex items-center px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
                              title="Move the job to the Cancelled phase"
                              disabled={cancellingJob}
                            >
                              <AlertTriangle className="h-4 w-4 mr-2" />
                              {cancellingJob ? 'Cancelling...' : 'Cancel Job'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* APPROVED STATE - Green success message */}
                {effectiveApprovalDecision?.decision === 'approved' && (
                  <div className="bg-green-50 dark:bg-green-900/20 border-b border-green-200 dark:border-green-700/30 text-green-800 dark:text-green-200 px-6 py-4 relative z-[50]">
                    <div className="flex items-start">
                      <CheckCircle className="h-5 w-5 mr-2 text-green-600 dark:text-green-400 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium">Extra Charges Approved</p>
                        <p className="mt-1 text-sm">
                          The extra charges were approved by {effectiveApprovalDecision.approver_name || effectiveApprovalDecision.approver_email || 'the approver'} on{' '}
                          {effectiveApprovalDecision.decision_at ? new Date(effectiveApprovalDecision.decision_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit'
                          }) : 'an unknown date'}. The job has been moved to Work Order phase.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            )}

            {(() => {
              const needsExtraChargesApproval =
                isPendingWorkOrder && !effectiveApprovalDecision?.decision && hasExtraChargesForApproval;
              const hasActiveApprovalEmail = needsExtraChargesApproval && Boolean(pendingApproval);
              const showBlueVariant =
                isPendingWorkOrder &&
                !needsExtraChargesApproval &&
                !hasExtraChargesForApproval &&
                (job.work_order?.has_sprinklers || hasDrywallSignal);
              if (!hasWorkOrder || (!needsExtraChargesApproval && !showBlueVariant)) return null;
              const containerClasses = needsExtraChargesApproval
                ? 'bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-300 dark:border-yellow-700/30 text-yellow-900 dark:text-yellow-200'
                : 'bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-700/30 text-blue-800 dark:text-blue-200';
              const iconClasses = needsExtraChargesApproval
                ? 'text-yellow-600 dark:text-yellow-400'
                : 'text-blue-600 dark:text-blue-400';
              const heading = needsExtraChargesApproval
                ? (hasActiveApprovalEmail ? 'Approval Email Already Sent' : 'Extra Charges Approval Needed')
                : 'Notification Needed';
              const itemLabel = job.work_order?.has_sprinklers ? 'Sprinkler Paint' : 'Drywall Repairs';
              const message = needsExtraChargesApproval
                ? (hasActiveApprovalEmail
                    ? `An approval email was sent ${pendingApproval?.sentAt ? formatDate(pendingApproval.sentAt) : 'recently'}. A new approval can be sent in ${pendingApprovalCountdown || 'a moment'}.`
                    : (job.work_order?.has_sprinklers
                        ? 'Extra charges need approval. The sprinkler update should be included in the approval email via template sections.'
                        : 'Extra charges need approval. Recommended: send approval email.'))
                : `Notification email needed: ${itemLabel}`;
              const recommended: 'extra_charges' | 'sprinkler_paint' | 'drywall_repairs' =
                needsExtraChargesApproval ? 'extra_charges' : (job.work_order?.has_sprinklers ? 'sprinkler_paint' : 'drywall_repairs');
              return (
                <div className={`${containerClasses} px-6 py-4 relative z-[50]`}>
                  <div className="flex items-start">
                    <Mail className={`h-5 w-5 mr-2 ${iconClasses} mt-0.5`} />
                    <div className="flex-1">
                      <p className="font-medium">{heading}</p>
                      <p className="mt-1 text-sm">{message}</p>
                      <div className="mt-3 flex flex-col md:flex-row md:items-center gap-3">
                        <button
                          onClick={() => {
                            setNotificationType(recommended);
                            setShowEnhancedNotificationModal(true);
                          }}
                          disabled={hasActiveApprovalEmail}
                          title={hasActiveApprovalEmail ? 'An approval email is already active. Wait for it to expire to send a new one.' : undefined}
                          className="inline-flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Mail className="h-4 w-4 mr-2" />
                          Prepare Email
                        </button>
                        {(needsExtraChargesApproval && (isAdmin || isJGManagement)) && (
                          <button
                            onClick={handleApproveExtraCharges}
                            className="inline-flex items-center px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-lg transition-colors"
                            title="Bypass email and approve directly"
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Approve Manually
                          </button>
                        )}
                        {(!needsExtraChargesApproval && (isAdmin || isJGManagement)) && (
                          <button
                            onClick={handleMarkNotificationSent}
                            className="inline-flex items-center px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
                            title="Mark notification as sent and advance job to Work Order"
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Mark as Sent
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Content Section */}
            <div className="p-6">
              {/* Unit Information Section */}
              {job.work_order && (
                <div className="mb-8">
                  <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Work Order Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className={`p-4 rounded-lg border ${job?.work_order?.submission_date ? 'border-green-500/50 bg-green-50 dark:bg-green-900/30' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'} flex flex-col justify-center transition-all`}>
                      <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Submission Date</span>
                      <p className={`text-base font-bold mt-2 ${job?.work_order?.submission_date ? 'text-green-800 dark:text-green-200' : 'text-gray-900 dark:text-gray-100'}`}>{formatDate(job?.work_order?.submission_date)}</p>
                      {(job?.work_order?.created_at || job?.work_order?.submission_date) && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1.5">
                          {formatTime(job?.work_order?.created_at || job?.work_order?.submission_date)} | {job?.work_order?.submitted_by_name || 'Unknown User'}
                        </p>
                      )}
                    </div>
                    <div className={`p-4 rounded-lg border ${job?.work_order?.is_occupied ? 'border-green-500/50 bg-green-50 dark:bg-green-900/30' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'} flex flex-col justify-center transition-all`}>
                      <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Occupied Unit</span>
                      <p className={`text-base font-bold mt-2 ${job?.work_order?.is_occupied ? 'text-green-800 dark:text-green-200' : 'text-gray-900 dark:text-gray-100'}`}>{job?.work_order?.is_occupied ? 'Yes' : 'No'}</p>
                    </div>
                    <div className={`p-4 rounded-lg border ${job?.work_order?.is_full_paint ? 'border-green-500/50 bg-green-50 dark:bg-green-900/30' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'} flex flex-col justify-center transition-all`}>
                      <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Full Paint</span>
                      <p className={`text-base font-bold mt-2 ${job?.work_order?.is_full_paint ? 'text-green-800 dark:text-green-200' : 'text-gray-900 dark:text-gray-100'}`}>{job?.work_order?.is_full_paint ? 'Yes' : 'No'}</p>
                    </div>
                    <div className={`p-4 rounded-lg border ${job?.work_order?.job_category ? 'border-green-500/50 bg-green-50 dark:bg-green-900/30' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'} flex flex-col justify-center transition-all`}>
                      <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Job Category</span>
                      <p className={`text-base font-bold mt-2 ${job?.work_order?.job_category ? 'text-green-800 dark:text-green-200' : 'text-gray-900 dark:text-gray-100'}`}>{job?.work_order?.job_category || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Sprinkler Information Section */}
              {hasWorkOrder && job.work_order?.has_sprinklers && (
                <div className="mb-8">
                  <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center">
                    <Droplets className="h-4 w-4 mr-1.5 text-blue-500" />
                    Sprinkler Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className={`p-4 rounded-lg border ${job?.work_order?.has_sprinklers ? 'border-green-500/50 bg-green-50 dark:bg-green-900/30' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'} flex flex-col justify-center transition-all`}>
                      <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Has Sprinklers</span>
                      <p className={`text-base font-bold mt-2 ${job?.work_order?.has_sprinklers ? 'text-green-800 dark:text-green-200' : 'text-gray-900 dark:text-gray-100'}`}>
                        {job?.work_order?.has_sprinklers ? 'Yes' : 'No'}
                      </p>
                    </div>
                    {job?.work_order?.has_sprinklers && (
                      <div className={`p-4 rounded-lg border ${job?.work_order?.sprinklers_painted ? 'border-green-500/50 bg-green-50 dark:bg-green-900/30' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'} flex flex-col justify-center transition-all`}>
                        <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Sprinklers Painted</span>
                        <p className={`text-base font-bold mt-2 ${job?.work_order?.sprinklers_painted ? 'text-green-800 dark:text-green-200' : 'text-gray-900 dark:text-gray-100'}`}>
                          {job?.work_order?.sprinklers_painted ? 'Yes' : 'No'}
                        </p>
                      </div>
                    )}
                  </div>
                  {/* Sprinkler Images */}
                  {hasWorkOrder && job.work_order?.has_sprinklers && job.work_order?.id && (
                    <div className="mt-6">
                      <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-3">Sprinkler Images</h4>
                      <div className="bg-gray-50 dark:bg-[#0F172A] p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                        {jobIdForFiles && (
                          <ImageGallery workOrderId={workOrderId} jobId={jobIdForFiles} folder="sprinkler" />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Extra Charges Section */}
              {hasWorkOrder && hasExtraChargesForApproval && (
                <div className="mb-8">
                  <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-1.5 text-blue-500" />
                    Extra Charges
                  </h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className={`p-4 rounded-lg border ${hasExtraChargesForApproval ? 'border-green-500/50 bg-green-50 dark:bg-green-900/30' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'} flex flex-col justify-center transition-all`}>
                        <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Has Extra Charges</span>
                        <p className={`text-base font-bold mt-2 ${hasExtraChargesForApproval ? 'text-green-800 dark:text-green-200' : 'text-gray-900 dark:text-gray-100'}`}>
                          {hasExtraChargesForApproval ? 'Yes' : 'No'}
                        </p>
                      </div>
                      <div className={`p-4 rounded-lg border ${unifiedExtraTotals.bill > 0 ? 'border-green-500/50 bg-green-50 dark:bg-green-900/30' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'} flex flex-col justify-center transition-all`}>
                        <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Total Extra Charges</span>
                        <p className={`text-lg font-bold mt-2 ${unifiedExtraTotals.bill > 0 ? 'text-green-800 dark:text-green-200' : 'text-gray-900 dark:text-gray-100'}`}>
                          {formatCurrency(unifiedExtraTotals.bill)}
                        </p>
                      </div>
                      <div className={`p-4 rounded-lg border ${unifiedExtraLines.length > 0 ? 'border-green-500/50 bg-green-50 dark:bg-green-900/30' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'} flex flex-col justify-center transition-all`}>
                        <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Line Items</span>
                        <p className={`text-base font-bold mt-2 ${unifiedExtraLines.length > 0 ? 'text-green-800 dark:text-green-200' : 'text-gray-900 dark:text-gray-100'}`}>
                          {unifiedExtraLines.length}
                        </p>
                      </div>
                    </div>

                    {unifiedExtraLines.length > 0 ? (
                      <div className="space-y-3">
                        {unifiedExtraLines.map(line => {
                          const rate = Number(line.rate ?? (line.quantity ? line.billAmount / line.quantity : line.billAmount)) || 0;
                          return (
                            <div key={line.id} className="p-4 rounded-lg border border-green-500/50 bg-green-50 dark:bg-green-900/30">
                              <div className="flex justify-between items-start gap-4">
                                <div>
                                  <div className="text-base font-bold mt-1.5 text-green-800 dark:text-green-200">{line.label}</div>
                                  {line.notes && (
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic bg-white/50 dark:bg-black/20 rounded px-2 py-1">Notes: {line.notes}</div>
                                  )}
                                </div>
                                <div className="text-right">
                                  <div className="text-sm text-gray-600 dark:text-gray-400">
                                    {line.quantity} {line.unit} × {formatCurrency(rate)}
                                  </div>
                                  <div className="text-sm text-gray-600 dark:text-gray-400">Sub: {formatCurrency(line.subAmount)}</div>
                                  <div className="text-lg font-bold text-green-800 dark:text-green-200 mt-1">{formatCurrency(line.billAmount)}</div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        No extra charges line items.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Additional Comments Section */}
              {hasWorkOrder && job.work_order?.additional_comments && (
                <div className="mb-8">
                  <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center">
                    <MessageSquare className="h-4 w-4 mr-1.5 text-blue-500" />
                    Additional Comments
                  </h3>
                  <div className="bg-gray-50 dark:bg-[#0F172A] p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                    <p className="text-gray-900 dark:text-white whitespace-pre-wrap leading-relaxed">{job?.work_order?.additional_comments}</p>
                  </div>
                </div>
              )}

              {/* Job Images Section */}
              {hasWorkOrder && job.work_order?.id && (
                <div className="mb-0">
                  <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center">
                    <Image className="h-4 w-4 mr-1.5 text-blue-500" />
                    Work Order Images
                  </h3>
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-3">
                        Before Images
                      </h4>
                      <div className="bg-gray-50 dark:bg-[#0F172A] p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                        {jobIdForFiles && (
                          <ImageGallery workOrderId={workOrderId} jobId={jobIdForFiles} folder="before" />
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-3">
                        Other Files
                      </h4>
                      <div className="bg-gray-50 dark:bg-[#0F172A] p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                        {jobIdForFiles && (
                          <ImageGallery workOrderId={workOrderId} jobId={jobIdForFiles} folder="other" />
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-3">
                        Job Files
                      </h4>
                      <div className="bg-gray-50 dark:bg-[#0F172A] p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                        {jobIdForFiles && (
                          <ImageGallery workOrderId={workOrderId} jobId={jobIdForFiles} folder="job_files" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

        )}

        {/* Billing Breakdown - Show only for Admins and JG Management if billing details exist */}
        {(isAdmin || isJGManagement) && job.billing_details && !isJobRequest && (
          <div className="bg-white dark:bg-[#1E293B] rounded-xl shadow-lg mb-6 overflow-hidden">
            {/* Header Section */}
            <div className="bg-gradient-to-r from-green-600 to-green-700 dark:from-green-700 dark:to-green-800 px-6 py-4">
              <h2 className="text-xl font-semibold text-white flex items-center">
                <DollarSign className="h-5 w-5 mr-2" />
                Billing Breakdown
              </h2>
            </div>

            {/* Content Section */}
            <div className="p-6">
              {/* Warning banner for missing rates */}
              {billingWarnings.length > 0 && (
                <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/30 rounded-lg">
                  <div className="flex items-start">
                    <AlertCircle className="h-5 w-5 mr-2 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-yellow-800 dark:text-yellow-200">Missing Billing Rates</p>
                      <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
                        Some rates are missing in Property Billing. Items are saved but not billed until rates are configured.
                      </p>
                      <ul className="mt-2 text-sm text-yellow-700 dark:text-yellow-300 list-disc list-inside">
                        {billingWarnings.map((warning, index) => (
                          <li key={index}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Add Unit Size, Job Category, and QuickBooks Number here */}
              <div className="mb-6 bg-gray-50 dark:bg-[#0F172A] p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Unit Size</span>
                    <p className="text-base font-semibold text-gray-900 dark:text-white mt-1">{job.unit_size.label}</p>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Job Category</span>
                    <p className="text-base font-semibold text-gray-900 dark:text-white mt-1">
                      {job.work_order?.job_category || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">QuickBooks #</span>
                    <p className="text-base font-semibold text-gray-900 dark:text-white mt-1">
                      {job.property?.quickbooks_number || 'None Provided'}
                    </p>
                  </div>
                </div>
              </div>

            {FLAGS.BILLING_V2 ? (
              <BillingBreakdownV2 
                billing={{
                  billing_details: job.billing_details,
                  hourly_billing_details: job.hourly_billing_details,
                  extra_charges_details: derivedExtraCharges,
                  extra_charges_line_items: extraChargeLineItems,
                  additional_services: supplementalBillingLines.map(line => ({
                    code: line.key,
                    label: line.label,
                    unit_label: line.unitLabel,
                    quantity: line.qty,
                    billing_detail_id: line.key, // This should be the actual billing detail ID
                    bill_amount: line.amountBill,
                    sub_pay_amount: line.amountSub,
                    profit_amount: line.amountBill - line.amountSub
                  }))
                }} 
              />
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-gray-50 dark:bg-[#0F172A] p-4 rounded-lg">
                  {/* Bill Amount */}
                  <div className="p-3 rounded-lg border border-green-500/50">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Bill Amount</span>
                    <p className="text-lg font-semibold text-green-600 dark:text-green-400 mt-1">
                      {formatCurrency(
                        (job.billing_details?.bill_amount ?? 0) + extraChargesAmount + 
                        supplementalBillingLines.reduce((sum, line) => sum + line.amountBill, 0)
                      )}
                    </p>
                  </div>

                  {/* Subcontractor Pay Amount */}
                  <div className="p-3 rounded-lg border border-blue-500/50">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Subcontractor Pay</span>
                    <p className="text-lg font-semibold text-blue-600 dark:text-blue-400 mt-1">
                      {formatCurrency(
                        (job.billing_details?.sub_pay_amount ?? 0) + extraChargesSubPay + 
                        supplementalBillingLines.reduce((sum, line) => sum + line.amountSub, 0)
                      )}
                    </p>
                  </div>

                  {/* Profit Amount */}
                  <div className="p-3 rounded-lg border border-purple-500/50">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Profit</span>
                    <p className={`text-lg font-semibold ${profitAmount !== null ? (profitAmount >= 0 ? 'text-purple-600 dark:text-purple-400' : 'text-red-600 dark:text-red-400') : 'text-gray-900 dark:text-white'} mt-1`}>
                      {formatCurrency(
                        ((job.billing_details?.bill_amount ?? 0) - (job.billing_details?.sub_pay_amount ?? 0)) + 
                        (extraChargesAmount - extraChargesSubPay) +
                        supplementalBillingLines.reduce((sum, line) => sum + (line.amountBill - line.amountSub), 0)
                      )}
                    </p>
                  </div>
                </div>

                {/* Extra Charges Section */}
                {hasWorkOrder && hasExtraChargesForApproval && unifiedExtraLines.length > 0 && (
                  <div className="mt-8">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Extra Charges Breakdown</h3>
                    <div className="space-y-3">
                      {unifiedExtraLines.map((line) => {
                        const rate = Number(line.rate ?? (line.quantity ? line.billAmount / line.quantity : line.billAmount)) || 0;
                        return (
                          <div key={line.id} className="flex justify-between items-start p-3 bg-gray-50 dark:bg-[#0F172A] rounded-lg">
                            <div className="flex-1">
                              <div className="font-medium text-gray-900 dark:text-white">{line.label}</div>
                              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                {line.quantity} {line.unit} × {formatCurrency(rate)}
                              </div>
                              {line.notes && (
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">
                                  Notes: {line.notes}
                                </div>
                              )}
                            </div>
                            <div className="text-right">
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                Sub: {formatCurrency(line.subAmount)}
                              </div>
                              <div className="font-semibold text-gray-900 dark:text-white">
                                {formatCurrency(line.billAmount)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-gray-50 dark:bg-[#0F172A] p-4 rounded-lg mt-4">
                      <div className="p-3 rounded-lg border border-green-500/50">
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Bill</span>
                        <p className="text-lg font-semibold text-green-600 dark:text-green-400 mt-1">
                          {formatCurrency(unifiedExtraTotals.bill)}
                        </p>
                      </div>
                      <div className="p-3 rounded-lg border border-blue-500/50">
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Sub Pay</span>
                        <p className="text-lg font-semibold text-blue-600 dark:text-blue-400 mt-1">
                          {formatCurrency(unifiedExtraTotals.sub)}
                        </p>
                      </div>
                      <div className="p-3 rounded-lg border border-purple-500/50">
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Profit</span>
                        <p className="text-lg font-semibold text-purple-600 dark:text-purple-400 mt-1">
                          {formatCurrency(unifiedExtraTotals.bill - unifiedExtraTotals.sub)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Total to Invoice */}
                <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Total to Invoice</h3>
                  <span className="text-xl font-bold text-green-600 dark:text-green-400">
                    {formatCurrency(
                      (job.billing_details?.bill_amount ?? 0) + extraChargesAmount + 
                      supplementalBillingLines.reduce((sum, line) => sum + line.amountBill, 0)
                    )}
                  </span>
                </div>

                {/* Additional Total Rows */}
                {job.billing_details && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-base font-medium text-gray-700 dark:text-gray-300">Total Billing</span>
                      <span className="text-base font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(
                          (job.billing_details?.bill_amount ?? 0) + extraChargesAmount + 
                          supplementalBillingLines.reduce((sum, line) => sum + line.amountBill, 0)
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-base font-medium text-gray-700 dark:text-gray-300">Total Subcontractor Pay</span>
                      <span className="text-base font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(
                          (job.billing_details?.sub_pay_amount ?? 0) + (job.extra_charges_details?.sub_pay_amount ?? 0) +
                          supplementalBillingLines.reduce((sum, line) => sum + line.amountSub, 0)
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-base font-medium text-gray-700 dark:text-gray-300">Total Profit</span>
                      <span className={`text-base font-semibold ${profitAmount !== null ? (profitAmount >= 0 ? 'text-purple-600 dark:text-purple-400' : 'text-red-600 dark:text-red-400') : 'text-gray-900 dark:text-white'}`}>
                        {formatCurrency(
                          ((job.billing_details?.bill_amount ?? 0) - (job.billing_details?.sub_pay_amount ?? 0)) + 
                          ((job.extra_charges_details?.bill_amount ?? 0) - (job.extra_charges_details?.sub_pay_amount ?? 0)) +
                          supplementalBillingLines.reduce((sum, line) => sum + (line.amountBill - line.amountSub), 0)
                        )}
                      </span>
                    </div>
                    
                    {/* Calculation Breakdown */}
                    {extraChargesAmount > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400">
                        <div className="space-y-1">
                          <div>Base: {formatCurrency(job.billing_details?.bill_amount || 0)} - {formatCurrency(job.billing_details?.sub_pay_amount || 0)} = {formatCurrency((job.billing_details?.bill_amount || 0) - (job.billing_details?.sub_pay_amount || 0))}</div>
                          <div>Extra: {formatCurrency(job.extra_charges_details?.bill_amount || 0)} - {formatCurrency(job.extra_charges_details?.sub_pay_amount || 0)} = {formatCurrency((job.extra_charges_details?.bill_amount || 0) - (job.extra_charges_details?.sub_pay_amount || 0))}</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

              {/* Invoice Status Buttons - Only show when job is in Invoicing phase */}
              {job?.job_phase?.label === 'Invoicing' && (
                <div className="mt-6 flex justify-end space-x-4">
                  {!job.invoice_sent ? (
                    <button
                      onClick={handleMarkInvoiceSent}
                      disabled={updatingInvoiceStatus}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    >
                      {updatingInvoiceStatus ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                          Updating...
                        </>
                      ) : (
                        <>
                          <Mailbox className="h-4 w-4 mr-2" />
                          Mark Invoice as Sent
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="flex items-center space-x-2 px-4 py-2 bg-green-50 dark:bg-green-900/20 rounded-md border border-green-200 dark:border-green-800">
                      <Mailbox className={`h-6 w-6 ${job.invoice_sent ? 'text-green-500' : 'text-gray-300'}`} />
                      <span className="text-green-800 dark:text-green-300 font-semibold text-sm">
                        INVOICE SENT
                      </span>
                    </div>
                  )}
                  
                  {!job.invoice_paid ? (
                    <button
                      onClick={handleMarkInvoicePaid}
                      disabled={updatingInvoiceStatus}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    >
                      {updatingInvoiceStatus ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                          Updating...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Mark Invoice Paid
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="flex items-center space-x-2 px-4 py-2 bg-green-50 dark:bg-green-900/20 rounded-md border border-green-200 dark:border-green-800">
                      <CheckCircle className={`h-6 w-6 ${job.invoice_paid ? 'text-green-500' : 'text-gray-300'}`} />
                      <span className="text-green-800 dark:text-green-300 font-semibold text-sm">
                        INVOICE PAID
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 max-w-md w-full shadow-xl">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Delete Job</h3>
              <p className="text-gray-700 dark:text-gray-300 mb-6">
                Are you sure you want to delete this job? This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteJob}
                  disabled={deleting}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {deleting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                      Deleting...
                    </>
                  ) : (
                    'Delete Job'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Cancel Job Confirmation Modal */}
        {showCancelJobConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Cancel Job</h3>
              <p className="text-gray-700 dark:text-gray-300 mb-6">
                Are you sure you want to cancel this job? It will move to the Cancelled phase. To continue work later, you’ll need to use “Re-Activate Job” in the banner to return it to Pending Work Order.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCancelJobConfirm(false)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  Keep Job Active
                </button>
                <button
                  type="button"
                  onClick={handleCancelJobFromDecline}
                  disabled={cancellingJob}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {cancellingJob ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                      Cancelling...
                    </>
                  ) : (
                    'Yes, Cancel Job'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Assign Subcontractor Modal */}
        {showAssignModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 max-w-md w-full shadow-xl">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Assign Subcontractor</h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="subcontractor" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Select Subcontractor
                  </label>
                  <select
                    id="subcontractor"
                    value={selectedSubcontractor || ''}
                    onChange={(e) => setSelectedSubcontractor(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select subcontractor</option>
                    {subcontractors.map(sub => (
                      <option key={sub.id} value={sub.id}>
                        {sub.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAssignSubcontractor}
                  disabled={!selectedSubcontractor || assigning}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {assigning ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                      Assigning...
                    </>
                  ) : (
                    'Assign Subcontractor'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}


        {/* PDF Preview Modal */}
        {showPdfPreview && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[150]">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  PDF Preview
                </h3>
                <button
                  onClick={() => {
                    setShowPdfPreview(false);
                    setPreviewPdfUrl(undefined);
                  }}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                {previewPdfUrl ? (
                  <iframe
                    src={previewPdfUrl}
                    className="w-full h-[70vh]"
                    title="PDF Preview"
                  />
                ) : (
                  <div className="flex items-center justify-center h-[70vh]">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                )}
              </div>

              <div className="flex justify-end mt-4">
                <button
                  onClick={() => {
                    setShowPdfPreview(false);
                    setPreviewPdfUrl(undefined);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PDF and Print buttons at the bottom of the page */}
        {hasWorkOrder && (
          <div className="bg-white dark:bg-[#1E293B] rounded-xl shadow-lg mb-6 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-gray-600 to-gray-700 dark:from-gray-700 dark:to-gray-800 px-6 py-4">
              <h2 className="text-xl font-semibold text-white flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                Actions
              </h2>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  {hasWorkOrder && (
                    <Link
                      to={`/dashboard/jobs/${jobId}/new-work-order?edit=true`}
                      className="inline-flex items-center px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors shadow-md hover:shadow-lg"
                      style={{ 
                        backgroundColor: getJobPhaseColor()
                      }}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      {isAdmin || isJGManagement ? 'Edit Work Order' : 'View Work Order'}
                    </Link>
                  )}
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={generatePDF}
                    className="inline-flex items-center px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all shadow-md hover:shadow-lg"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </button>
                  {(isInvoicing || isCompleted) && (
                    <button
                      onClick={generateInvoicePDF}
                      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-all shadow-md hover:shadow-lg"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Invoice
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}


        {/* Notification Email Modal */}
        {showNotificationModal && notificationType && notificationType !== 'extra_charges' && (
          <NotificationEmailModal
            isOpen={showNotificationModal}
            onClose={() => {
              setShowNotificationModal(false);
              setNotificationType(null);
            }}
            job={notificationJob as any}
            notificationType={notificationType}
            onSent={handleNotificationSent}
            additionalServices={supplementalBillingLines.map(line => ({
              label: line.label,
              quantity: line.qty,
              unit_label: line.unitLabel,
              bill_amount: line.amountBill
            }))}
          />
        )}

        {/* Enhanced Property Notification Modal */}
        {showEnhancedNotificationModal && notificationType && (
          <EnhancedPropertyNotificationModal
            isOpen={showEnhancedNotificationModal}
            onClose={() => {
              setShowEnhancedNotificationModal(false);
              setNotificationType(null);
            }}
            job={job as any}
            notificationType={notificationType}
            onSent={handleNotificationSent}
            additionalServices={supplementalBillingLines.map(line => ({
              label: line.label,
              quantity: line.qty,
              unit_label: line.unitLabel,
              bill_amount: line.amountBill
            }))}
          />
        )}

      </div>
    </div>
  );
}
