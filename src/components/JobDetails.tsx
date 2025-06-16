import React, { useState, useEffect, useCallback } from 'react';
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
  FileEdit,
  Download,
  Printer,
  Share2,
  MoreHorizontal,
  ChevronDown,
  ChevronUp,
  Star,
  Clipboard,
  ClipboardCheck,
  ClipboardList,
  Paintbrush,
  Layers,
  Droplets,
  Palette,
  MessageSquare,
  Image,
  Paintbrush2,
  Mail,
  CheckCircle2,
  X
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { formatDate } from '../lib/dateUtils';
import { formatAddress, formatCurrency } from '../lib/utils/formatUtils';
import { useJobDetails } from '../hooks/useJobDetails';
import { useJobPhaseChanges } from '../hooks/useJobPhaseChanges';
import { usePhases } from '../hooks/usePhases';
import { useUserRole } from '../hooks/useUserRole';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import ImageUpload from './ImageUpload';
import { PropertyMap } from './PropertyMap';
import { ImageGallery } from './ImageGallery';

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
  is_occupied: boolean;
  is_full_paint: boolean;
  job_category: string;
  job_category_id: string;
  has_sprinklers: boolean;
  sprinklers_painted: boolean;
  painted_ceilings: boolean;
  ceiling_rooms_count: number;
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
  scheduled_date: string;
  job_phase: {
    id: string;
    job_phase_label: string;
    color_light_mode: string;
    color_dark_mode: string;
  };
  assigned_to?: string;
  assigned_to_name?: string;
  billing_details?: BillingDetails;
  hourly_billing_details?: BillingDetails;
  extra_charges_details?: BillingDetails;
  work_order?: WorkOrder;
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
  const { isAdmin, isJGManagement } = useUserRole();
  
  const [showPhaseChangeModal, setShowPhaseChangeModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState<string | null>(null);
  const [changeReason, setChangeReason] = useState('');
  const [changingPhase, setChangingPhase] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showPhaseHistory, setShowPhaseHistory] = useState(false);
  const [showWorkOrderDetails, setShowWorkOrderDetails] = useState(false);
  const [subcontractors, setSubcontractors] = useState<{id: string, full_name: string}[]>([]);
  const [selectedSubcontractor, setSelectedSubcontractor] = useState<string | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<'formal' | 'professional' | 'casual' | ''>('');
  const [emailContent, setEmailContent] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [ccEmails, setCcEmails] = useState('');
  const [bccEmails, setBccEmails] = useState('');
  const [includeJobDetails, setIncludeJobDetails] = useState(true);
  const [includeWorkOrderDetails, setIncludeWorkOrderDetails] = useState(true);
  const [includePDF, setIncludePDF] = useState(true);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | undefined>(undefined);
  const [showApproveButton, setShowApproveButton] = useState(false);
  const [workOrderFolderId, setWorkOrderFolderId] = useState<string | null>(null);

  // Add debug logging
  useEffect(() => {
    if (job) {
      console.log('Job Details:', {
        workOrder: {
          ...job.work_order,
          hasExtraCharges: job.work_order?.has_extra_charges,
          extraHours: job.work_order?.extra_hours,
          extraHoursType: typeof job.work_order?.extra_hours,
          extraHoursValue: job.work_order?.extra_hours
        },
        billingDetails: job.billing_details,
        extraCharges: {
          hasExtraCharges: job.work_order?.has_extra_charges,
          extraHours: job.work_order?.extra_hours,
          extraHoursType: typeof job.work_order?.extra_hours,
          extraHoursValue: job.work_order?.extra_hours
        }
      });
    }
  }, [job]);

  // Add effect to calculate and update total billing amount
  useEffect(() => {
    const calculateAndUpdateTotalBilling = async () => {
      if (!job || !jobId) return;

      const standardBillAmount = job.billing_details?.bill_amount ?? 0;
      const extraChargesBillAmount = job.work_order?.has_extra_charges && job.work_order?.extra_hours 
        ? job.work_order.extra_hours * 40 
        : 0;
      const totalBillingAmount = standardBillAmount + extraChargesBillAmount;

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
  }, [job, jobId]);

  useEffect(() => {
    if (job?.assigned_to) {
      setSelectedSubcontractor(job.assigned_to);
    }
    
    fetchSubcontractors();
  }, [job]);

  useEffect(() => {
    const fetchWorkOrderFolderId = async () => {
      if (!job?.work_order || !job?.property?.name) return;
      const workOrderNum = `WO-${String(job.work_order_num).padStart(6, '0')}`;
      const propertyName = job.property.name;
      // Build the full path to the work order folder
      const fullPath = `/${propertyName}/Work Orders/${workOrderNum}`;
      // Find the work order folder by full path
      const { data: folder, error } = await supabase
        .from('files')
        .select('id')
        .eq('path', fullPath)
        .eq('type', 'folder/directory')
        .maybeSingle();
      if (!error && folder && folder.id) {
        setWorkOrderFolderId(folder.id);
      } else {
        setWorkOrderFolderId(null);
      }
    };
    fetchWorkOrderFolderId();
  }, [job]);

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
    
    const currentPhaseIndex = phases.findIndex(p => p.id === job.job_phase.id);
    if (currentPhaseIndex === -1) return;
    
    const newPhaseIndex = direction === 'next' ? currentPhaseIndex + 1 : currentPhaseIndex - 1;
    if (newPhaseIndex < 0 || newPhaseIndex >= phases.length) return;
    
    const newPhase = phases[newPhaseIndex];
    
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
          from_phase_id: job.job_phase.id,
          to_phase_id: newPhase.id,
          change_reason: `Phase ${direction === 'next' ? 'advanced' : 'reverted'} by ${userData.user.email}`
        }]);
        
      if (phaseChangeError) throw phaseChangeError;
      
      // Refresh job data
      await refetchJob();
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
      // Delete job phase changes first
      const { error: phaseChangeError } = await supabase
        .from('job_phase_changes')
        .delete()
        .eq('job_id', jobId);
        
      if (phaseChangeError) throw phaseChangeError;
      
      // Delete work orders
      const { error: workOrderError } = await supabase
        .from('work_orders')
        .delete()
        .eq('job_id', jobId);
        
      if (workOrderError) throw workOrderError;
      
      // Delete the job
      const { error: jobError } = await supabase
        .from('jobs')
        .delete()
        .eq('id', jobId);
        
      if (jobError) throw jobError;
      
      toast.success('Job deleted successfully');
      navigate('/dashboard/jobs');
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
        .update({ assigned_to: selectedSubcontractor })
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
    let y = 20; // Starting y position
    const pageHeight = 280; // Maximum height before new page
    const margin = 20; // Left margin
    
    // Add title
    doc.setFontSize(20);
    doc.text(`Work Order: ${formatWorkOrderNumber(job.work_order_num)}`, margin, y);
    y += 15;
    
    // Add job details
    doc.setFontSize(12);
    doc.text(`Property: ${job.property.name}`, margin, y);
    y += 10;
    doc.text(`Unit: ${job.unit_number}`, margin, y);
    y += 10;
    doc.text(`Unit Size: ${job.unit_size.label}`, margin, y);
    y += 10;
    doc.text(`Job Type: ${job.job_type.label}`, margin, y);
    y += 10;
    doc.text(`Scheduled Date: ${formatDate(job.scheduled_date)}`, margin, y);
    y += 10;
    doc.text(`Status: ${job.job_phase.label}`, margin, y);
    y += 15;
    
    // Add description if available
    if (job.description) {
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
      doc.text(`Submission Date: ${formatDate(job.work_order.submission_date)}`, margin, y);
      y += 10;
      doc.text(`Occupied: ${job.work_order.is_occupied ? 'Yes' : 'No'}`, margin, y);
      y += 10;
      doc.text(`Full Paint: ${job.work_order.is_full_paint ? 'Yes' : 'No'}`, margin, y);
      y += 10;
      doc.text(`Job Category: ${job.work_order.job_category}`, margin, y);
      y += 15;
      
      // Add paint details
      if (job.work_order.has_sprinklers) {
        doc.text(`Has Sprinklers: Yes`, margin, y);
        y += 10;
        doc.text(`Sprinklers Painted: ${job.work_order.sprinklers_painted ? 'Yes' : 'No'}`, margin, y);
        y += 10;
      }
      
      if (job.work_order.painted_ceilings) {
        doc.text(`Painted Ceilings: Yes`, margin, y);
        y += 10;
        doc.text(`Ceiling Rooms: ${job.work_order.ceiling_rooms_count}`, margin, y);
        y += 10;
      }
      
      if (job.work_order.painted_patio) {
        doc.text(`Painted Patio: Yes`, margin, y);
        y += 10;
      }
      
      if (job.work_order.painted_garage) {
        doc.text(`Painted Garage: Yes`, margin, y);
        y += 10;
      }
      
      if (job.work_order.painted_cabinets) {
        doc.text(`Painted Cabinets: Yes`, margin, y);
        y += 10;
      }
      
      if (job.work_order.painted_crown_molding) {
        doc.text(`Painted Crown Molding: Yes`, margin, y);
        y += 10;
      }
      
      if (job.work_order.painted_front_door) {
        doc.text(`Painted Front Door: Yes`, margin, y);
        y += 10;
      }
      
      // Add extra charges if available
      if (job.work_order.has_extra_charges) {
        // Check if we need a new page
        if (y > pageHeight - 100) {
          doc.addPage();
          y = 20;
        }
        
        y += 5;
        doc.text(`Has Extra Charges: Yes`, margin, y);
        y += 10;
        if (job.work_order.extra_charges_description) {
          const splitDescription = doc.splitTextToSize(job.work_order.extra_charges_description, 170);
          doc.text(splitDescription, margin, y);
          y += splitDescription.length * 7;
        }
        doc.text(`Extra Hours: ${job.work_order.extra_hours || 'N/A'}`, margin, y);
        y += 10;
      }
      
      // Add additional comments if available
      if (job.work_order.additional_comments) {
        // Check if we need a new page
        if (y > pageHeight - 100) {
          doc.addPage();
          y = 20;
        }
        
        y += 5;
        doc.text('Additional Comments:', margin, y);
        y += 10;
        const splitComments = doc.splitTextToSize(job.work_order.additional_comments, 170);
        doc.text(splitComments, margin, y);
        y += splitComments.length * 7;
      }
    }
    
    // Add billing details if available
    if (job.billing_details) {
      // Check if we need a new page
      if (y > pageHeight - 100) {
        doc.addPage();
        y = 20;
      }
      
      doc.setFontSize(16);
      doc.text('Billing Details', margin, y);
      y += 15;
      
      doc.setFontSize(12);
      doc.text(`Bill Amount: ${formatCurrency(job.billing_details.bill_amount)}`, margin, y);
      y += 10;
      doc.text(`Subcontractor Pay: ${formatCurrency(job.billing_details.sub_pay_amount)}`, margin, y);
      y += 10;
      if (job.billing_details.profit_amount !== null) {
        doc.text(`Profit: ${formatCurrency(job.billing_details.profit_amount)}`, margin, y);
        y += 10;
      }
      
      // Add extra charges billing if available
      if (job.extra_charges_details) {
        y += 5;
        doc.text('Extra Charges Billing:', margin, y);
        y += 10;
        doc.text(`Hours: ${job.extra_charges_details.hours || 0}`, margin, y);
        y += 10;
        doc.text(`Bill Amount: ${formatCurrency(job.extra_charges_details.bill_amount)}`, margin, y);
        y += 10;
        doc.text(`Subcontractor Pay: ${formatCurrency(job.extra_charges_details.sub_pay_amount)}`, margin, y);
        y += 10;
        if (job.extra_charges_details.profit_amount !== null) {
          doc.text(`Profit: ${formatCurrency(job.extra_charges_details.profit_amount)}`, margin, y);
          y += 10;
        }
      }
    }
    
    // Add images if available
    if (job.work_order?.id) {
      try {
        const { data: images, error } = await supabase
          .storage
          .from('work_orders')
          .list(`${job.work_order.id}`);
          
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
            const { data: imageUrl } = await supabase
              .storage
              .from('work_orders')
              .getPublicUrl(`${job.work_order.id}/${image.name}`);
              
            if (imageUrl) {
              try {
                const img = new Image();
                img.src = imageUrl.publicUrl;
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
              } catch (err) {
                console.error('Error adding image to PDF:', err);
              }
            }
          }
        }
      } catch (err) {
        console.error('Error fetching images:', err);
      }
    }
    
    doc.save(`work-order-${job.work_order_num}.pdf`);
  };

  const handleTemplateChange = (template: 'formal' | 'professional' | 'casual') => {
    setSelectedTemplate(template);
    const templates = {
      formal: `Dear ${job?.property?.name || 'Property Manager'},

I am writing to request your approval for additional charges related to Job #${job?.id}.

${includeJobDetails ? `Job Details:
- Property: ${job?.property?.name}
- Address: ${job?.property?.address}
- Description: ${job?.description}
` : ''}

${includeWorkOrderDetails ? `Work Order Details:
- Extra Hours: ${job?.work_order?.extra_hours}
- Extra Charges Description: ${job?.work_order?.extra_charges_description}
` : ''}

Please review these charges and let us know if you approve.

Best regards,
${job?.assigned_to ? subcontractors.find(s => s.id === job.assigned_to)?.full_name : 'Your Name'}`,
      professional: `Hello ${job?.property?.name || 'Property Manager'},

I hope this email finds you well. We need your approval for some additional charges for Job #${job?.id}.

${includeJobDetails ? `Job Information:
• Property: ${job?.property?.name}
• Location: ${job?.property?.address}
• Scope: ${job?.description}
` : ''}

${includeWorkOrderDetails ? `Additional Charges:
• Extra Hours: ${job?.work_order?.extra_hours}
• Charge Details: ${job?.work_order?.extra_charges_description}
` : ''}

Please review and approve these charges at your earliest convenience.

Thank you,
${job?.assigned_to ? subcontractors.find(s => s.id === job.assigned_to)?.full_name : 'Your Name'}`,
      casual: `Hi ${job?.property?.name || 'Property Manager'},

Quick note about some extra charges for Job #${job?.id} that need your approval.

${includeJobDetails ? `Quick Job Info:
- Property: ${job?.property?.name}
- Address: ${job?.property?.address}
- What we're doing: ${job?.description}
` : ''}

${includeWorkOrderDetails ? `Extra Charges:
- Extra Hours: ${job?.work_order?.extra_hours}
- Why extra charges: ${job?.work_order?.extra_charges_description}
` : ''}

Let me know if you're good with these charges!

Thanks,
${job?.assigned_to ? subcontractors.find(s => s.id === job.assigned_to)?.full_name : 'Your Name'}`
    };
    setEmailContent(templates[template]);
  };

  const handleSendEmail = async () => {
    if (!recipientEmail) {
      alert('Please enter a recipient email address');
      return;
    }

    if (!selectedTemplate) {
      alert('Please select an email template');
      return;
    }

    setSendingEmail(true);
    try {
      // TODO: Implement actual email sending logic here
      console.log('Sending email:', {
        to: recipientEmail,
        cc: ccEmails,
        bcc: bccEmails,
        subject: `Extra Charges Approval Request - Job #${job?.id}`,
        content: emailContent,
        includeJobDetails,
        includeWorkOrderDetails,
        includePDF
      });

      // For now, just show success message
      alert('Email sent successfully!');
      setShowEmailModal(false);
      setShowApproveButton(true);
    } catch (error) {
      console.error('Error sending email:', error);
      alert('Failed to send email. Please try again.');
    } finally {
      setSendingEmail(false);
    }
  };

  const handleApproveExtraCharges = async () => {
    if (!job) return;
    
    try {
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

      // Refresh the job data
      await refetchJob();
      setShowApproveButton(false);
      alert('Extra charges approved successfully!');
    } catch (error) {
      console.error('Error approving extra charges:', error);
      alert('Failed to approve extra charges. Please try again.');
    }
  };

  const generatePreviewPdf = async () => {
    if (!job) return;
    
    setShowPdfPreview(true); // Show preview immediately with loading state
    
    try {
      const doc = new jsPDF();
      
      // Add job details if selected
      if (includeJobDetails) {
        doc.setFontSize(20);
        doc.text(`Work Order: ${formatWorkOrderNumber(job.work_order_num)}`, 20, 20);
        doc.setFontSize(12);
        doc.text(`Property: ${job.property.name}`, 20, 35);
        doc.text(`Unit: ${job.unit_number}`, 20, 45);
        doc.text(`Unit Size: ${job.unit_size.label}`, 20, 55);
        doc.text(`Job Type: ${job.job_type.label}`, 20, 65);
        doc.text(`Scheduled Date: ${formatDate(job.scheduled_date)}`, 20, 75);
      }

      // Add work order details if selected
      if (includeWorkOrderDetails && job.work_order) {
        let y = includeJobDetails ? 100 : 20;
        doc.setFontSize(16);
        doc.text('Work Order Details', 20, y);
        y += 15;

        doc.setFontSize(12);
        doc.text(`Submission Date: ${formatDate(job.work_order.submission_date)}`, 20, y);
        y += 10;
        doc.text(`Occupied: ${job.work_order.is_occupied ? 'Yes' : 'No'}`, 20, y);
        y += 10;
        doc.text(`Full Paint: ${job.work_order.is_full_paint ? 'Yes' : 'No'}`, 20, y);
        y += 10;
        doc.text(`Job Category: ${job.work_order.job_category}`, 20, y);
        y += 10;

        if (job.work_order.has_sprinklers) {
          doc.text(`Has Sprinklers: Yes`, 20, y);
          y += 10;
          doc.text(`Sprinklers Painted: ${job.work_order.sprinklers_painted ? 'Yes' : 'No'}`, 20, y);
          y += 10;
        }

        if (job.work_order.painted_ceilings) {
          doc.text(`Painted Ceilings: Yes`, 20, y);
          y += 10;
          doc.text(`Ceiling Rooms: ${job.work_order.ceiling_rooms_count}`, 20, y);
          y += 10;
        }

        if (job.work_order.painted_patio) {
          doc.text(`Painted Patio: Yes`, 20, y);
          y += 10;
        }

        if (job.work_order.painted_garage) {
          doc.text(`Painted Garage: Yes`, 20, y);
          y += 10;
        }

        if (job.work_order.painted_cabinets) {
          doc.text(`Painted Cabinets: Yes`, 20, y);
          y += 10;
        }

        if (job.work_order.painted_crown_molding) {
          doc.text(`Painted Crown Molding: Yes`, 20, y);
          y += 10;
        }

        if (job.work_order.painted_front_door) {
          doc.text(`Painted Front Door: Yes`, 20, y);
          y += 10;
        }

        if (job.work_order.has_extra_charges) {
          doc.text(`Has Extra Charges: Yes`, 20, y);
          y += 10;
          if (job.work_order.extra_charges_description) {
            doc.text(`Extra Charges Description: ${job.work_order.extra_charges_description}`, 20, y);
            y += 10;
          }
          doc.text(`Extra Hours: ${job.work_order.extra_hours || 'N/A'}`, 20, y);
          y += 10;
        }
      }
      
      // Convert PDF to base64 string
      const pdfBase64 = doc.output('datauristring');
      setPreviewPdfUrl(pdfBase64);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF preview. Please try again.');
      setShowPdfPreview(false);
    }
  };

  // Add this function inside JobDetails component
  const generateInvoicePDF = async () => {
    try {
      if (!job) return;
      const doc = new jsPDF();
      let y = 20;
      const margin = 20;

      // Add logo with timeout and error handling
      const logo = new window.Image();
      logo.src = '/src/assets/jg-logo.png';
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
        doc.addImage(logo, 'PNG', margin, y, 40, 20);
        y += 25;
      }

      // --- PAGE 1: Invoice ---
      doc.setFontSize(22);
      doc.text('INVOICE', margin + 50, y);
      y += 15;

      doc.setFontSize(10); // Reduced font size for better formatting
      doc.text(`Date: ${formatDate(new Date().toISOString())}`, margin, y);
      y += 6;
      doc.text(`Invoice #: ${formatWorkOrderNumber(job.work_order_num)}`, margin, y);
      y += 6;
      doc.text(`Property: ${job.property.name}`, margin, y);
      y += 6;
      doc.text(`Unit: ${job.unit_number}`, margin, y);
      y += 6;
      doc.text(`Address: ${formatAddress(job.property)}`, margin, y);
      y += 6;
      doc.text(`Job Type: ${job.job_type.label}`, margin, y);
      y += 10;

      // Billing Breakdown Table
      doc.setFontSize(12);
      doc.text('Billing Breakdown', margin, y);
      y += 6;
      doc.setFontSize(9); // Reduced font size for line items
      doc.text('Description', margin, tableY);
      doc.text('Amount', margin + 120, tableY);
      tableY += 6;
      doc.setLineWidth(0.1);
      doc.line(margin, tableY, margin + 170, tableY);
      tableY += 4;

      // Bill Amount line item
      const billingDescription = `${job.work_order?.job_category || 'Standard Paint'} - ${job.unit_size.label}`;
      doc.text(billingDescription, margin, tableY);
      doc.text(`${formatCurrency(job.billing_details?.bill_amount ?? 0)}`, margin + 120, tableY);
      tableY += 6;

      // Extra Charges line item (if any)
      if (job.work_order?.has_extra_charges && job.work_order.extra_hours && job.work_order.extra_hours > 0) {
        const desc = job.work_order.extra_charges_description || 'Extra Charges';
        const hours = job.work_order.extra_hours;
        const hourlyRate = 40;
        const extraChargesText = `Extra Charges: ${desc} (${hours} hrs @ $${hourlyRate}/hr)`;
        const splitText = doc.splitTextToSize(extraChargesText, 110); // Split text if too long
        doc.text(splitText, margin, tableY);
        doc.text(`${formatCurrency(hours * hourlyRate)}`, margin + 120, tableY);
        tableY += (splitText.length * 6); // Adjust spacing based on split text
      }

      // Total
      tableY += 4;
      doc.setFontSize(10);
      doc.text('Total', margin, tableY);
      let total = (job.billing_details?.bill_amount ?? 0);
      if (job.work_order?.has_extra_charges && job.work_order.extra_hours && job.work_order.extra_hours > 0) {
        total += job.work_order.extra_hours * 40;
      }
      doc.text(`${formatCurrency(total)}`, margin + 120, tableY);

      // Footer
      tableY += 15;
      doc.setFontSize(9);
      doc.text('Thank you for your business!', margin, tableY);

      // --- PAGE 2: Work Order Info (minus billing breakdown) ---
      doc.addPage();
      let y2 = 20;
      doc.setFontSize(14);
      doc.text('Work Order Information', margin, y2);
      y2 += 8;
      doc.setFontSize(9);
      doc.text(`Work Order #: ${formatWorkOrderNumber(job.work_order_num)}`, margin, y2);
      y2 += 6;
      doc.text(`Property: ${job.property.name}`, margin, y2);
      y2 += 6;
      doc.text(`Unit: ${job.unit_number}`, margin, y2);
      y2 += 6;
      doc.text(`Unit Size: ${job.unit_size.label}`, margin, y2);
      y2 += 6;
      doc.text(`Job Type: ${job.job_type.label}`, margin, y2);
      y2 += 6;
      doc.text(`Scheduled Date: ${formatDate(job.scheduled_date)}`, margin, y2);
      y2 += 6;
      doc.text(`Status: ${job.job_phase.label}`, margin, y2);
      y2 += 8;
      if (job.work_order) {
        doc.setFontSize(11);
        doc.text('Work Order Details', margin, y2);
        y2 += 6;
        doc.setFontSize(9);
        doc.text(`Submission Date: ${formatDate(job.work_order.submission_date)}`, margin, y2);
        y2 += 6;
        doc.text(`Occupied: ${job.work_order.is_occupied ? 'Yes' : 'No'}`, margin, y2);
        y2 += 6;
        doc.text(`Full Paint: ${job.work_order.is_full_paint ? 'Yes' : 'No'}`, margin, y2);
        y2 += 6;
        doc.text(`Job Category: ${job.work_order.job_category}`, margin, y2);
        y2 += 6;
        if (job.work_order.has_sprinklers) {
          doc.text(`Has Sprinklers: Yes`, margin, y2);
          y2 += 6;
          doc.text(`Sprinklers Painted: ${job.work_order.sprinklers_painted ? 'Yes' : 'No'}`, margin, y2);
          y2 += 6;
        }
        if (job.work_order.painted_ceilings) {
          doc.text(`Painted Ceilings: Yes`, margin, y2);
          y2 += 6;
          doc.text(`Ceiling Rooms: ${job.work_order.ceiling_rooms_count}`, margin, y2);
          y2 += 6;
        }
        if (job.work_order.painted_patio) {
          doc.text(`Painted Patio: Yes`, margin, y2);
          y2 += 6;
        }
        if (job.work_order.painted_garage) {
          doc.text(`Painted Garage: Yes`, margin, y2);
          y2 += 6;
        }
        if (job.work_order.painted_cabinets) {
          doc.text(`Painted Cabinets: Yes`, margin, y2);
          y2 += 6;
        }
        if (job.work_order.painted_crown_molding) {
          doc.text(`Painted Crown Molding: Yes`, margin, y2);
          y2 += 6;
        }
        if (job.work_order.painted_front_door) {
          doc.text(`Painted Front Door: Yes`, margin, y2);
          y2 += 6;
        }
        if (job.work_order.has_accent_wall) {
          doc.text(`Accent Wall: ${job.work_order.accent_wall_type || ''} (${job.work_order.accent_wall_count || 1})`, margin, y2);
          y2 += 6;
        }
        if (job.work_order.has_extra_charges) {
          doc.text(`Has Extra Charges: Yes`, margin, y2);
          y2 += 6;
          if (job.work_order.extra_charges_description) {
            const splitDesc = doc.splitTextToSize(job.work_order.extra_charges_description, 170);
            doc.text(splitDesc, margin, y2);
            y2 += splitDesc.length * 6;
          }
          doc.text(`Extra Hours: ${job.work_order.extra_hours || 'N/A'}`, margin, y2);
          y2 += 6;
        }
        if (job.work_order.additional_comments) {
          doc.text('Additional Comments:', margin, y2);
          y2 += 6;
          const splitComments = doc.splitTextToSize(job.work_order.additional_comments, 170);
          doc.text(splitComments, margin, y2);
          y2 += splitComments.length * 6;
        }
      }
      doc.save(`invoice-${job.work_order_num}.pdf`);
    } catch (error) {
      console.error('Error generating invoice PDF:', error);
      alert('Failed to generate invoice PDF. Please try again.');
    }
  };

  if (jobLoading || phasesLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (jobError || !job) {
    return (
      <div className="p-6 bg-gray-100 dark:bg-[#0F172A]">
        <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-500/50 text-red-700 dark:text-red-200 px-4 py-3 rounded">
          {jobError || 'Job not found'}
        </div>
      </div>
    );
  }

  const canChangePhase = isAdmin || isJGManagement;
  const canEditJob = (isAdmin || isJGManagement) && job.job_phase.label === 'Job Request';
  const canDeleteJob = isAdmin && job.job_phase.label === 'Job Request';
  const canAssignSubcontractor = isAdmin || isJGManagement;
  const hasWorkOrder = !!job.work_order;
  const isJobRequest = job.job_phase.label === 'Job Request';
  const isPendingWorkOrder = job.job_phase.label === 'Pending Work Order';
  const isWorkOrder = job.job_phase.label === 'Work Order';
  const isInvoicing = job.job_phase.label === 'Invoicing';
  const isCompleted = job.job_phase.label === 'Completed';
  const isCancelled = job.job_phase.label === 'Cancelled';

  // Calculate profit if billing details are available
  const profitAmount = (job.billing_details?.bill_amount !== null && job.billing_details?.sub_pay_amount !== null && job.billing_details?.bill_amount !== undefined && job.billing_details?.sub_pay_amount !== undefined)
    ? job.billing_details.bill_amount - job.billing_details.sub_pay_amount
    : null;

  // Use extra charges details from the job data
  const extraChargesBillAmount = job.extra_charges_details?.bill_amount ?? 0;
  const extraChargesSubPayAmount = job.extra_charges_details?.sub_pay_amount ?? 0;
  const extraChargesProfitAmount = job.extra_charges_details?.profit_amount ?? 0;
  const extraHours = job.extra_charges_details?.hours ?? 0;
  const extraChargesDescription = job.extra_charges_details?.description ?? '';

  // Filter out 'Pending Work Order' from the phases array used for navigation
  const navPhases = phases ? phases.filter(p => p.job_phase_label !== 'Pending Work Order') : [];
  const currentNavPhaseIndex = navPhases.findIndex(p => p.id === job.job_phase.id);

  // Add a helper function to handle phase change by phase object
  const handlePhaseChangeTo = async (phase) => {
    if (!phase) return;
    setChangingPhase(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) throw new Error('User not found');
      const { error: updateError } = await supabase
        .from('jobs')
        .update({ current_phase_id: phase.id })
        .eq('id', jobId);
      if (updateError) throw updateError;
      const { error: phaseChangeError } = await supabase
        .from('job_phase_changes')
        .insert([{
          job_id: jobId,
          changed_by: userData.user.id,
          from_phase_id: job.job_phase.id,
          to_phase_id: phase.id,
          change_reason: `Phase changed by ${userData.user.email}`
        }]);
      if (phaseChangeError) throw phaseChangeError;
      await refetchJob();
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
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/dashboard/jobs')}
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatWorkOrderNumber(job.work_order_num)}
            </h1>
            <span 
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
              style={{ 
                backgroundColor: job.job_phase.color_dark_mode,
                color: 'white'
              }}
            >
              {job.job_phase.label}
            </span>
          </div>
          <div className="flex space-x-3">
            {canChangePhase && (
              <>
                <button
                  onClick={() => {
                    if (currentNavPhaseIndex > 0) handlePhaseChangeTo(navPhases[currentNavPhaseIndex - 1]);
                  }}
                  disabled={currentNavPhaseIndex === 0}
                  className="inline-flex items-center px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: currentNavPhaseIndex > 0 ? navPhases[currentNavPhaseIndex - 1].color_dark_mode : '#6B7280'
                  }}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Previous: {currentNavPhaseIndex > 0 ? navPhases[currentNavPhaseIndex - 1].job_phase_label : 'N/A'}
                </button>
                <button
                  onClick={() => {
                    if (currentNavPhaseIndex < navPhases.length - 1) handlePhaseChangeTo(navPhases[currentNavPhaseIndex + 1]);
                  }}
                  disabled={currentNavPhaseIndex === navPhases.length - 1}
                  className="inline-flex items-center px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: currentNavPhaseIndex < navPhases.length - 1 ? navPhases[currentNavPhaseIndex + 1].color_dark_mode : '#6B7280'
                  }}
                >
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Next: {currentNavPhaseIndex < navPhases.length - 1 ? navPhases[currentNavPhaseIndex + 1].job_phase_label : 'N/A'}
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
            {hasWorkOrder && (
              <Link
                to={`/dashboard/jobs/${jobId}/new-work-order?edit=true`}
                className="inline-flex items-center px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors"
                style={{ backgroundColor: job.job_phase.color_dark_mode }}
              >
                <FileEdit className="h-4 w-4 mr-2" />
                {isAdmin || isJGManagement ? 'Edit Work Order' : 'View Work Order'}
              </Link>
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
          <div className="lg:col-span-2 bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow-lg">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Job Details</h2>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Job Type:
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {job.job_type.label}
                </span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Property</h3>
                <div className="flex items-start">
                  <Building2 className="h-5 w-5 text-gray-500 dark:text-gray-400 mt-0.5 mr-2" />
                  <div>
                    <Link 
                      to={`/dashboard/properties/${job.property.id}`}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
                    >
                      {job.property.name}
                    </Link>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {job.property.address}
                      {job.property.address_2 && <span>, {job.property.address_2}</span>}
                      <br />
                      {job.property.city}, {job.property.state} {job.property.zip}
                    </p>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Unit Information</h3>
                <div className="space-y-2">
                  <div className="flex items-center">
                    <MapPin className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2" />
                    <span className="text-gray-900 dark:text-white">Unit #{job.unit_number}</span>
                  </div>
                  <div className="flex items-center">
                    <ClipboardList className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2" />
                    <span className="text-gray-900 dark:text-white">Size: {job.unit_size.label}</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Schedule</h3>
                <div className="flex items-center">
                  <Calendar className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2" />
                  <span className="text-gray-900 dark:text-white">{formatDate(job.scheduled_date)}</span>
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Assigned To</h3>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <User className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2" />
                    <span className="text-gray-900 dark:text-white">
                      {job.assigned_to ? (
                        subcontractors.find(s => s.id === job.assigned_to)?.full_name || 'Unknown'
                      ) : (
                        'Not assigned'
                      )}
                    </span>
                  </div>
                  {canAssignSubcontractor && (
                    <Link
                      to={`/dashboard/sub-scheduler?jobId=${jobId}`}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                    >
                      {job.assigned_to ? 'Change' : 'Assign'}
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {/* Property Map */}
            <div className="mt-6 relative z-0">
              <PropertyMap 
                address={`${job.property.address}${job.property.address_2 ? `, ${job.property.address_2}` : ''}, ${job.property.city}, ${job.property.state} ${job.property.zip}`}
                className="w-full h-[300px]"
                onMapClick={() => {
                  const mapElement = document.querySelector('.leaflet-container');
                  if (mapElement) {
                    mapElement.classList.add('map-active');
                  }
                }}
                onMapLoad={(map) => {
                  // Disable scroll wheel zoom by default
                  map.scrollWheelZoom.disable();
                  
                  // Add click handler to enable scroll wheel zoom
                  map.on('click', () => {
                    map.scrollWheelZoom.enable();
                  });
                  
                  // Disable scroll wheel zoom when mouse leaves the map
                  map.on('mouseout', () => {
                    map.scrollWheelZoom.disable();
                  });
                }}
              />
            </div>
            
            {job.description && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Description</h3>
                <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{job.description}</p>
              </div>
            )}
            
            <div className="mt-6 flex flex-wrap gap-4">
              {/* Show Work Order button for admins/managers if no work order exists */}
              {(isAdmin || isJGManagement) && !hasWorkOrder && (
                <Link
                  to={`/dashboard/jobs/${jobId}/new-work-order`}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <FileEdit className="h-4 w-4 mr-2" />
                  Add Work Order
                </Link>
              )}
              
              {/* Show Work Order button for subcontractors only in Job Request phase */}
              {!isAdmin && !isJGManagement && isJobRequest && !hasWorkOrder && (
                <Link
                  to={`/dashboard/jobs/${jobId}/new-work-order`}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <FileEdit className="h-4 w-4 mr-2" />
                  Work Order
                </Link>
              )}
            </div>
          </div>

          {/* Phase History */}
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Phase History</h2>
              <button
                onClick={() => setShowPhaseHistory(!showPhaseHistory)}
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                {showPhaseHistory ? 'Show Less' : 'Show All'}
              </button>
            </div>
            
            {phaseChangesLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : phaseChangesError ? (
              <div className="text-red-500 dark:text-red-400 text-sm">
                {phaseChangesError}
              </div>
            ) : phaseChanges.length === 0 ? (
              <div className="text-gray-500 dark:text-gray-400 text-center py-4">
                No phase changes recorded
              </div>
            ) : (
              <div className="space-y-4">
                {(showPhaseHistory ? phaseChanges : phaseChanges.slice(0, 3)).map((change, index) => (
                  <div key={change.id} className="relative pb-4">
                    {index < phaseChanges.length - 1 && (
                      <div className="absolute left-4 top-4 h-full w-0.5 bg-gray-200 dark:bg-gray-700" style={{ marginLeft: '0.5px' }}></div>
                    )}
                    <div className="flex items-start">
                      <div 
                        className="rounded-full h-9 w-9 flex items-center justify-center flex-shrink-0 z-10"
                        style={{ backgroundColor: change.to_phase_color || '#4B5563' }}
                      >
                        <Clock className="h-5 w-5 text-white" />
                      </div>
                      <div className="ml-4 flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                            {change.to_phase_label}
                          </h3>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(change.changed_at)}
                          </span>
                        </div>
                        {change.from_phase_label && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            From: {change.from_phase_label}
                          </p>
                        )}
                        {change.change_reason && (
                          <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                            {change.change_reason}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          By: {change.changed_by_name || 'Unknown'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                
                {!showPhaseHistory && phaseChanges.length > 3 && (
                  <button
                    onClick={() => setShowPhaseHistory(true)}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 w-full text-center mt-2"
                  >
                    Show More History
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Work Order Details - Always show if work order exists */}
        {job.work_order && (
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow-lg mb-6">
            {isPendingWorkOrder && job.work_order.has_extra_charges && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/30 text-yellow-800 dark:text-yellow-200 px-4 py-3 rounded-lg mb-6 relative z-[50]">
                <div className="flex items-start">
                  <AlertCircle className="h-5 w-5 mr-2 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium">Extra Charges Pending Approval</p>
                    <p className="mt-1 text-sm">This work order has extra charges that require approval before proceeding.</p>
                    <div className="mt-3 flex space-x-3">
                      {!showApproveButton ? (
                        <button
                          onClick={() => setShowEmailModal(true)}
                          className="inline-flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          <Mail className="h-4 w-4 mr-2" />
                          Send Approval Email
                        </button>
                      ) : (
                        <button
                          onClick={handleApproveExtraCharges}
                          className="inline-flex items-center px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Approve Extra Charges
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">Work Order Details</h2>
            {/* Unit Information Section */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <FileText className="h-5 w-5 mr-2 text-blue-500" />
                Work Order Details
              </h3>
              {job.work_order && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 dark:bg-[#0F172A] p-4 rounded-lg">
                  <div className={`p-3 rounded-lg border ${job.work_order.submission_date ? 'border-green-500/50 bg-green-50 dark:bg-green-900/30' : 'border-gray-200 dark:border-gray-700'} flex flex-col justify-center`}>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Submission Date</span>
                    <p className={`text-lg font-bold ${job.work_order.submission_date ? 'text-green-800 dark:text-green-200' : ''} mt-1`}>{formatDate(job.work_order.submission_date)}</p>
                  </div>
                  <div className={`p-3 rounded-lg border ${job.work_order.is_occupied ? 'border-green-500/50 bg-green-50 dark:bg-green-900/30' : 'border-gray-200 dark:border-gray-700'} flex flex-col justify-center`}>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Occupied Unit</span>
                    <p className={`text-lg font-bold ${job.work_order.is_occupied ? 'text-green-800 dark:text-green-200' : ''} mt-1`}>{job.work_order.is_occupied ? 'Yes' : 'No'}</p>
                  </div>
                  <div className={`p-3 rounded-lg border ${job.work_order.is_full_paint ? 'border-green-500/50 bg-green-50 dark:bg-green-900/30' : 'border-gray-200 dark:border-gray-700'} flex flex-col justify-center`}>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Full Paint</span>
                    <p className={`text-lg font-bold ${job.work_order.is_full_paint ? 'text-green-800 dark:text-green-200' : ''} mt-1`}>{job.work_order.is_full_paint ? 'Yes' : 'No'}</p>
                  </div>
                  <div className={`p-3 rounded-lg border ${job.work_order.job_category ? 'border-green-500/50 bg-green-50 dark:bg-green-900/30' : 'border-gray-200 dark:border-gray-700'} flex flex-col justify-center`}>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Job Category</span>
                    <p className={`text-lg font-bold ${job.work_order.job_category ? 'text-green-800 dark:text-green-200' : ''} mt-1`}>{job.work_order.job_category || 'N/A'}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Paint Information Section */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <Paintbrush className="h-5 w-5 mr-2 text-blue-500" />
                Paint Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 dark:bg-[#0F172A] p-4 rounded-lg">
                <div className={`p-3 rounded-lg border ${job.work_order.is_full_paint !== undefined ? (job.work_order.is_full_paint ? 'border-green-500/50 bg-green-50 dark:bg-green-900/30' : 'border-gray-200 dark:border-gray-700') : 'border-gray-200 dark:border-gray-700'} flex flex-col justify-center`}>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Full Paint</span>
                  <p className={`text-lg font-bold ${job.work_order.is_full_paint ? 'text-green-800 dark:text-green-200' : ''} mt-1`}>
                    {job.work_order.is_full_paint ? 'Yes' : 'No'}
                  </p>
                </div>
                <div className={`p-3 rounded-lg border ${job.work_order.job_category ? 'border-green-500/50 bg-green-50 dark:bg-green-900/30' : 'border-gray-200 dark:border-gray-700'} flex flex-col justify-center`}>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Job Category</span>
                  <p className={`text-lg font-bold ${job.work_order.job_category ? 'text-green-800 dark:text-green-200' : ''} mt-1`}>{job.work_order.job_category || 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* Sprinkler Information Section */}
            {hasWorkOrder && job.work_order?.has_sprinklers && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                  <Droplets className="h-5 w-5 mr-2 text-blue-500" />
                  Sprinkler Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 dark:bg-[#0F172A] p-4 rounded-lg">
                  <div className={`p-3 rounded-lg border ${job.work_order.has_sprinklers ? 'border-green-500/50 bg-green-50 dark:bg-green-900/30' : 'border-gray-200 dark:border-gray-700'} flex flex-col justify-center`}>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Has Sprinklers</span>
                    <p className={`text-lg font-bold ${job.work_order.has_sprinklers ? 'text-green-800 dark:text-green-200' : ''} mt-1`}>
                      {job.work_order.has_sprinklers ? 'Yes' : 'No'}
                    </p>
                  </div>
                  {job.work_order.has_sprinklers && (
                    <div className={`p-3 rounded-lg border ${job.work_order.sprinklers_painted ? 'border-green-500/50 bg-green-50 dark:bg-green-900/30' : 'border-gray-200 dark:border-gray-700'} flex flex-col justify-center`}>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Sprinklers Painted</span>
                      <p className={`text-lg font-bold ${job.work_order.sprinklers_painted ? 'text-green-800 dark:text-green-200' : ''} mt-1`}>
                        {job.work_order.sprinklers_painted ? 'Yes' : 'No'}
                      </p>
                    </div>
                  )}
                </div>
                {/* Sprinkler Images */}
                {hasWorkOrder && job.work_order?.has_sprinklers && job.work_order?.id && (
                  <div className="mt-4">
                    <h4 className="text-base font-medium text-gray-700 dark:text-gray-200 mb-2">Sprinkler Images</h4>
                    {workOrderFolderId && (
                      <ImageGallery workOrderId={workOrderFolderId} folder="sprinkler" />
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Painted Areas Section */}
            {hasWorkOrder && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                  <Paintbrush2 className="h-5 w-5 mr-2 text-blue-500" />
                  Painted Areas
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 dark:bg-[#0F172A] p-4 rounded-lg">
                  <div className={`p-3 rounded-lg border ${job.work_order.painted_ceilings ? 'border-green-500/50 bg-green-50 dark:bg-green-900/30' : 'border-gray-200 dark:border-gray-700'} flex flex-col justify-center`}>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Ceilings</span>
                    <p className={`text-lg font-bold ${job.work_order.painted_ceilings ? 'text-green-800 dark:text-green-200' : ''} mt-1`}>
                      {job.work_order.painted_ceilings ? (
                        <><span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                          ({job.work_order.ceiling_rooms_count} rooms)
                        </span></>
                      ) : 'No'}
                    </p>
                  </div>
                  <div className={`p-3 rounded-lg border ${job.work_order.painted_patio ? 'border-green-500/50 bg-green-50 dark:bg-green-900/30' : 'border-gray-200 dark:border-gray-700'} flex flex-col justify-center`}>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Patio</span>
                    <p className={`text-lg font-bold ${job.work_order.painted_patio ? 'text-green-800 dark:text-green-200' : ''} mt-1`}>
                      {job.work_order.painted_patio ? 'Yes' : 'No'}
                    </p>
                  </div>
                  <div className={`p-3 rounded-lg border ${job.work_order.painted_garage ? 'border-green-500/50 bg-green-50 dark:bg-green-900/30' : 'border-gray-200 dark:border-gray-700'} flex flex-col justify-center`}>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Garage</span>
                    <p className={`text-lg font-bold ${job.work_order.painted_garage ? 'text-green-800 dark:text-green-200' : ''} mt-1`}>
                      {job.work_order.painted_garage ? 'Yes' : 'No'}
                    </p>
                  </div>
                  <div className={`p-3 rounded-lg border ${job.work_order.painted_cabinets ? 'border-green-500/50 bg-green-50 dark:bg-green-900/30' : 'border-gray-200 dark:border-gray-700'} flex flex-col justify-center`}>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Cabinets</span>
                    <p className={`text-lg font-bold ${job.work_order.painted_cabinets ? 'text-green-800 dark:text-green-200' : ''} mt-1`}>
                      {job.work_order.painted_cabinets ? 'Yes' : 'No'}
                    </p>
                  </div>
                  <div className={`p-3 rounded-lg border ${job.work_order.painted_crown_molding ? 'border-green-500/50 bg-green-50 dark:bg-green-900/30' : 'border-gray-200 dark:border-gray-700'} flex flex-col justify-center`}>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Crown Molding</span>
                    <p className={`text-lg font-bold ${job.work_order.painted_crown_molding ? 'text-green-800 dark:text-green-200' : ''} mt-1`}>
                      {job.work_order.painted_crown_molding ? 'Yes' : 'No'}
                    </p>
                  </div>
                  <div className={`p-3 rounded-lg border ${job.work_order.painted_front_door ? 'border-green-500/50 bg-green-50 dark:bg-green-900/30' : 'border-gray-200 dark:border-gray-700'} flex flex-col justify-center`}>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Front Door</span>
                    <p className={`text-lg font-bold ${job.work_order.painted_front_door ? 'text-green-800 dark:text-green-200' : ''} mt-1`}>
                      {job.work_order.painted_front_door ? 'Yes' : 'No'}
                    </p>
                  </div>
                </div>
              </div>
            )}
            {/* Accent Wall Section */}
            {hasWorkOrder && job.work_order?.has_accent_wall && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                  <Palette className="h-5 w-5 mr-2 text-blue-500" />
                  Accent Wall Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-gray-50 dark:bg-[#0F172A] p-4 rounded-lg">
                  <div className={`p-3 rounded-lg border ${job.work_order.accent_wall_type ? 'border-green-500/50 bg-green-50 dark:bg-green-900/30' : 'border-gray-200 dark:border-gray-700'} flex flex-col justify-center`}>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Type</span>
                    <p className={`text-lg font-bold ${job.work_order.accent_wall_type ? 'text-green-800 dark:text-green-200' : ''} mt-1`}>
                      {job.work_order.accent_wall_type || 'N/A'}
                    </p>
                  </div>
                  <div className={`p-3 rounded-lg border ${job.work_order.accent_wall_count > 0 ? 'border-green-500/50 bg-green-50 dark:bg-green-900/30' : 'border-gray-200 dark:border-gray-700'} flex flex-col justify-center`}>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Count</span>
                    <p className={`text-lg font-bold ${job.work_order.accent_wall_count > 0 ? 'text-green-800 dark:text-green-200' : ''} mt-1`}>
                      {job.work_order.accent_wall_count || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Extra Charges Section */}
            {hasWorkOrder && job.work_order?.has_extra_charges && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                  <AlertCircle className="h-5 w-5 mr-2 text-blue-500" />
                  Extra Charges
                </h3>
                <div className="bg-gray-50 dark:bg-[#0F172A] p-4 rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className={`p-3 rounded-lg border ${job.work_order.has_extra_charges ? 'border-green-500/50 bg-green-50 dark:bg-green-900/30' : 'border-gray-200 dark:border-gray-700'} flex flex-col justify-center`}>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Has Extra Charges</span>
                      <p className={`text-sm font-bold ${job.work_order.has_extra_charges ? 'text-green-800 dark:text-green-200' : ''}`}>
                        {job.work_order.has_extra_charges ? 'Yes' : 'No'}
                      </p>
                    </div>
                    <div className={`p-3 rounded-lg border ${typeof job.work_order.extra_hours === 'number' && job.work_order.extra_hours > 0 ? 'border-green-500/50 bg-green-50 dark:bg-green-900/30' : 'border-gray-200 dark:border-gray-700'} flex flex-col justify-center`}>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Extra Hours</span>
                      <p className={`text-lg font-bold ${typeof job.work_order.extra_hours === 'number' && job.work_order.extra_hours > 0 ? 'text-green-800 dark:text-green-200' : ''} mt-1`}>
                        {typeof job.work_order.extra_hours === 'number' ? job.work_order.extra_hours : 'N/A'}
                      </p>
                    </div>
                  </div>
                  {job.work_order.extra_charges_description && (
                    <div className="p-3 rounded-lg border border-green-500/50 bg-green-50 dark:bg-green-900/30 mt-6">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Description</span>
                      <p className="text-lg font-bold text-green-800 dark:text-green-200 mt-1">{job.work_order.extra_charges_description}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Additional Comments Section */}
            {hasWorkOrder && job.work_order?.additional_comments && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                  <MessageSquare className="h-5 w-5 mr-2 text-blue-500" />
                  Additional Comments
                </h3>
                <div className="bg-gray-50 dark:bg-[#0F172A] p-4 rounded-lg">
                  <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{job.work_order.additional_comments}</p>
                </div>
              </div>
            )}

            {/* Job Images Section */}
            {hasWorkOrder && job.work_order?.id && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                  <Image className="h-5 w-5 mr-2 text-blue-500" />
                  Work Order Images
                </h3>
                <div className="space-y-6">
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                      Before Images
                    </h4>
                    {workOrderFolderId && (
                      <ImageGallery workOrderId={workOrderFolderId} folder="before" />
                    )}
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                      Other Files
                    </h4>
                    {workOrderFolderId && (
                      <ImageGallery workOrderId={workOrderFolderId} folder="other" />
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Billing Breakdown - Show only for Admins and JG Management if billing details exist */}
        {(isAdmin || isJGManagement) && job.billing_details && !isJobRequest && (
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow-lg mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">Billing Breakdown</h2>

            {/* Add Unit Size and Job Category here */}
            <div className="mb-6 text-gray-700 dark:text-gray-300">
              <p className="text-lg">Unit Size: <span className="font-semibold text-gray-900 dark:text-white">{job.unit_size.label}</span></p>
              <p className="text-lg mt-1">Job Category: <span className="font-semibold text-gray-900 dark:text-white">{job.work_order?.job_category || 'N/A'}</span></p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-gray-50 dark:bg-[#0F172A] p-4 rounded-lg">
              {/* Bill Amount */}
              <div className="p-3 rounded-lg border border-green-500/50">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Bill Amount</span>
                <p className="text-lg font-semibold text-green-600 dark:text-green-400 mt-1">
                  {job.billing_details?.bill_amount !== null ? formatCurrency(job.billing_details.bill_amount) : 'N/A'}
                </p>
              </div>

              {/* Subcontractor Pay Amount */}
              <div className="p-3 rounded-lg border border-blue-500/50">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Subcontractor Pay</span>
                <p className="text-lg font-semibold text-blue-600 dark:text-blue-400 mt-1">
                  {job.billing_details?.sub_pay_amount !== null ? formatCurrency(job.billing_details.sub_pay_amount) : 'N/A'}
                </p>
              </div>

              {/* Profit Amount */}
              <div className="p-3 rounded-lg border border-purple-500/50">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Profit</span>
                <p className={`text-lg font-semibold ${profitAmount !== null ? (profitAmount >= 0 ? 'text-purple-600 dark:text-purple-400' : 'text-red-600 dark:text-red-400') : 'text-gray-900 dark:text-white'} mt-1`}>
                  {profitAmount !== null ? formatCurrency(profitAmount) : 'N/A'}
                </p>
              </div>
            </div>

            {/* Extra Charges Section - Show if work order has extra hours */}
            {hasWorkOrder && job.work_order?.has_extra_charges && job.work_order.extra_hours > 0 && (
              <div className="mt-8">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Extra Charges Breakdown</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-gray-50 dark:bg-[#0F172A] p-4 rounded-lg">
                  <div className="p-3 rounded-lg border border-green-500/50">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Bill Amount</span>
                    <p className="text-lg font-semibold text-green-600 dark:text-green-400 mt-1">
                      {formatCurrency(extraChargesBillAmount)}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg border border-blue-500/50">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Sub Pay Amount</span>
                    <p className="text-lg font-semibold text-blue-600 dark:text-blue-400 mt-1">
                      {formatCurrency(extraChargesSubPayAmount)}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg border border-purple-500/50">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Profit</span>
                    <p className={`text-lg font-semibold ${extraChargesProfitAmount >= 0 ? 'text-purple-600 dark:text-purple-400' : 'text-red-600 dark:text-red-400'} mt-1`}>
                      {formatCurrency(extraChargesProfitAmount)}
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
                  (job.billing_details?.bill_amount ?? 0) + extraChargesBillAmount
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
                      (job.billing_details?.bill_amount ?? 0) + extraChargesBillAmount
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-base font-medium text-gray-700 dark:text-gray-300">Total Subcontractor Pay</span>
                  <span className="text-base font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(
                      (job.billing_details?.sub_pay_amount ?? 0) + extraChargesSubPayAmount
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-base font-medium text-gray-700 dark:text-gray-300">Total Profit</span>
                  <span className={`text-base font-semibold ${profitAmount !== null ? (profitAmount >= 0 ? 'text-purple-600 dark:text-purple-400' : 'text-red-600 dark:text-red-400') : 'text-gray-900 dark:text-white'}`}>
                    {formatCurrency(
                      ((job.billing_details?.bill_amount ?? 0) - (job.billing_details?.sub_pay_amount ?? 0)) + extraChargesProfitAmount
                    )}
                  </span>
                </div>
              </div>
            )}
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

        {/* Email Template Modal */}
        {showEmailModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Send Approval Request
                </h3>
                <button
                  onClick={() => setShowEmailModal(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Recipient Email
                  </label>
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="Enter recipient email"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    CC (optional)
                  </label>
                  <input
                    type="text"
                    value={ccEmails}
                    onChange={(e) => setCcEmails(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="Enter CC emails (comma-separated)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    BCC (optional)
                  </label>
                  <input
                    type="text"
                    value={bccEmails}
                    onChange={(e) => setBccEmails(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="Enter BCC emails (comma-separated)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email Template
                  </label>
                  <select
                    value={selectedTemplate}
                    onChange={(e) => handleTemplateChange(e.target.value as 'formal' | 'professional' | 'casual')}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">Select an option</option>
                    <option value="formal">Formal</option>
                    <option value="professional">Professional</option>
                    <option value="casual">Casual</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Include in Email
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={includeJobDetails}
                        onChange={(e) => setIncludeJobDetails(e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Job Details</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={includeWorkOrderDetails}
                        onChange={(e) => setIncludeWorkOrderDetails(e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Work Order Details</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email Content
                  </label>
                  <textarea
                    value={emailContent}
                    onChange={(e) => setEmailContent(e.target.value)}
                    rows={10}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <div className="flex justify-end space-x-4">
                  <button
                    onClick={() => setShowEmailPreview(true)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    Preview Email
                  </button>
                  <button
                    onClick={() => setShowPdfPreview(true)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    Preview PDF
                  </button>
                  <button
                    onClick={handleSendEmail}
                    disabled={sendingEmail}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {sendingEmail ? 'Sending...' : 'Send Email'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Email Preview Modal */}
        {showEmailPreview && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[150]">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Email Preview
                </h3>
                <button
                  onClick={() => setShowEmailPreview(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">To: {recipientEmail}</p>
                  {ccEmails && <p className="text-sm font-medium text-gray-700 dark:text-gray-300">CC: {ccEmails}</p>}
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                    {emailContent}
                  </pre>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => setShowEmailPreview(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    Close
                  </button>
                </div>
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
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow-lg mb-6">
            <div className="flex justify-between items-center">
              <div>
                {hasWorkOrder && (
                  <Link
                    to={`/dashboard/jobs/${jobId}/new-work-order?edit=true`}
                    className="inline-flex items-center px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors"
                    style={{ backgroundColor: job.job_phase.color_dark_mode }}
                  >
                    <FileEdit className="h-4 w-4 mr-2" />
                    {isAdmin || isJGManagement ? 'Edit Work Order' : 'View Work Order'}
                  </Link>
                )}
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={generatePDF}
                  className="inline-flex items-center px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </button>
                
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add the Print Invoice button at the bottom, only if in Invoicing phase */}
        {isInvoicing && (
          <div className="flex justify-end mb-6">
            <button
              onClick={generateInvoicePDF}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Printer className="h-4 w-4 mr-2" />
              Print Invoice
            </button>
          </div>
        )}
      </div>
    </div>
  );
}