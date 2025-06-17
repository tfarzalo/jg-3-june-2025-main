import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Job } from '../hooks/useJobDetails';
import { supabase } from '../utils/supabase';

interface ApprovalEmailModalProps {
  recipientEmail: string;
  ccEmails: string;
  bccEmails: string;
  emailContent: string;
  sendingEmail: boolean;
  job: Job | null;
  onClose: () => void;
  onSendEmail: () => void;
  onPreviewEmail: () => void;
  onRecipientChange: (email: string) => void;
  onCCChange: (emails: string) => void;
  onBCCChange: (emails: string) => void;
  onContentChange: (content: string) => void;
}

interface DetailedJobData {
  id: string;
  work_order_num: number;
  unit_number: string;
  description?: string;
  scheduled_date?: string;
  status?: string;
  property: {
    name: string;
    address: string;
    address_2?: string;
    city: string;
    state: string;
    zip: string;
    ap_email?: string;
  };
  work_orders: Array<{
    id: string;
    submission_date?: string;
    unit_number: string;
    is_occupied: boolean;
    is_full_paint: boolean;
    job_category?: string;
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
    accent_wall_count: number;
    has_extra_charges: boolean;
    extra_charges_description?: string;
    extra_hours: number;
    additional_comments?: string;
  }>;
}

const ApprovalEmailModal: React.FC<ApprovalEmailModalProps> = ({
  recipientEmail,
  ccEmails,
  bccEmails,
  emailContent,
  sendingEmail,
  job,
  onClose,
  onSendEmail,
  onPreviewEmail,
  onRecipientChange,
  onCCChange,
  onBCCChange,
  onContentChange,
}) => {
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<'template1' | 'template2' | 'template3' | 'completion1' | 'completion2' | 'completion3' | ''>('');
  const [detailedJobData, setDetailedJobData] = useState<DetailedJobData | null>(null);
  const [loadingJobData, setLoadingJobData] = useState(false);
  const [approvalToken, setApprovalToken] = useState<string | null>(null);

  // Generate approval token for extra charges
  const generateApprovalToken = async () => {
    if (!job?.id || !recipientEmail) return null;

    try {
      // Create a unique token
      const token = `${job.id}-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

      // Extract extra charges data from job/work order
      const extraChargesData = {
        items: job.work_order?.has_extra_charges ? [{
          description: job.work_order.extra_charges_description || 'Additional work required',
          cost: job.extra_charges_details?.bill_amount || 0,
          hours: job.work_order.extra_hours || 0
        }] : [],
        total: job.work_order?.has_extra_charges ? 
          (job.extra_charges_details?.bill_amount || 0) : 0,
        job_details: {
          id: job.id,
          work_order_num: job.work_order_num,
          unit_number: job.unit_number,
          property: job.property
        }
      };

      const { error } = await supabase
        .from('approval_tokens')
        .insert({
          job_id: job.id,
          token,
          approval_type: 'extra_charges',
          extra_charges_data: extraChargesData,
          approver_email: recipientEmail,
          approver_name: job.property?.name || 'Property Manager',
          expires_at: expiresAt.toISOString()
        });

      if (error) {
        console.error('Failed to create approval token:', error);
        return null;
      }

      return token;
    } catch (error) {
      console.error('Error generating approval token:', error);
      return null;
    }
  };

  // Generate approval URL
  const getApprovalUrl = async () => {
    if (!approvalToken) {
      const token = await generateApprovalToken();
      if (token) {
        setApprovalToken(token);
        return `${window.location.origin}/approval/${token}`;
      }
      return null;
    }
    return `${window.location.origin}/approval/${approvalToken}`;
  };

  // Create approval button HTML for email templates
  const generateApprovalButtonHtml = async () => {
    const approvalUrl = await getApprovalUrl();
    if (!approvalUrl || !job?.work_order?.has_extra_charges) return '';

    const totalCost = job.extra_charges_details?.bill_amount || 0;

    return `
<div style="text-align: center; margin: 30px 0; padding: 20px; background-color: #f8f9fa; border-radius: 8px;">
  <h3 style="margin: 0 0 15px 0; color: #1f2937;">One-Click Approval</h3>
  <a href="${approvalUrl}" 
     style="display: inline-block; background-color: #22c55e; color: white; padding: 15px 30px; 
            text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;
            margin: 10px 0;">
    ✅ APPROVE EXTRA CHARGES - $${totalCost.toFixed(2)}
  </a>
  <p style="margin: 15px 0 5px 0; font-size: 14px; color: #6b7280;">
    Click the button above to approve these charges instantly and move the job to Work Order phase.
  </p>
  <p style="margin: 0; font-size: 12px; color: #9ca3af;">
    Secure link • Expires in 7 days • You'll receive confirmation after approval
  </p>
</div>`;
  };

  // Fetch detailed job data when component mounts
  useEffect(() => {
    if (job?.id) {
      fetchDetailedJobData(job.id);
    }
  }, [job?.id]);

  const fetchDetailedJobData = async (jobId: string) => {
    setLoadingJobData(true);
    try {
      // Get job details
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select(`
          id,
          work_order_num,
          unit_number,
          description,
          scheduled_date,
          status,
          property_id
        `)
        .eq('id', jobId)
        .single();

      if (jobError) throw jobError;

      // Get property details
      const { data: property, error: propertyError } = await supabase
        .from('properties')
        .select(`
          property_name,
          address,
          address_2,
          city,
          state,
          zip,
          ap_email
        `)
        .eq('id', jobData.property_id)
        .single();

      if (propertyError) throw propertyError;

      // Get work orders
      const { data: workOrders, error: workOrderError } = await supabase
        .from('work_orders')
        .select(`
          id,
          submission_date,
          unit_number,
          is_occupied,
          is_full_paint,
          job_category_id,
          has_sprinklers,
          sprinklers_painted,
          painted_ceilings,
          ceiling_rooms_count,
          painted_patio,
          painted_garage,
          painted_cabinets,
          painted_crown_molding,
          painted_front_door,
          has_accent_wall,
          accent_wall_type,
          accent_wall_count,
          has_extra_charges,
          extra_charges_description,
          extra_hours,
          additional_comments
        `)
        .eq('job_id', jobId);

      if (workOrderError) throw workOrderError;

      const detailedData: DetailedJobData = {
        id: jobData.id,
        work_order_num: jobData.work_order_num,
        unit_number: jobData.unit_number,
        description: jobData.description,
        scheduled_date: jobData.scheduled_date,
        status: jobData.status,
        property: {
          name: property.property_name,
          address: property.address,
          address_2: property.address_2,
          city: property.city,
          state: property.state,
          zip: property.zip,
          ap_email: property.ap_email
        },
        work_orders: workOrders?.map(wo => ({
          id: wo.id,
          submission_date: wo.submission_date,
          unit_number: wo.unit_number,
          is_occupied: wo.is_occupied,
          is_full_paint: wo.is_full_paint,
          job_category: 'Work Order',
          has_sprinklers: wo.has_sprinklers,
          sprinklers_painted: wo.sprinklers_painted,
          painted_ceilings: wo.painted_ceilings,
          ceiling_rooms_count: wo.ceiling_rooms_count,
          painted_patio: wo.painted_patio,
          painted_garage: wo.painted_garage,
          painted_cabinets: wo.painted_cabinets,
          painted_crown_molding: wo.painted_crown_molding,
          painted_front_door: wo.painted_front_door,
          has_accent_wall: wo.has_accent_wall,
          accent_wall_type: wo.accent_wall_type,
          accent_wall_count: wo.accent_wall_count,
          has_extra_charges: wo.has_extra_charges,
          extra_charges_description: wo.extra_charges_description,
          extra_hours: wo.extra_hours,
          additional_comments: wo.additional_comments
        })) || []
      };

      setDetailedJobData(detailedData);

      // Auto-populate recipient email if not set and we have AP email
      if (!recipientEmail && property.ap_email) {
        onRecipientChange(property.ap_email);
      }

    } catch (error) {
      console.error('Error fetching detailed job data:', error);
    } finally {
      setLoadingJobData(false);
    }
  };

  // ==========================================
  // 📝 EDIT COMPLETION EMAIL TEMPLATES HERE
  // ==========================================
  const generateCompletionEmailContent = (templateType: 'completion1' | 'completion2' | 'completion3'): string => {
    if (!detailedJobData) return '';
    
    const woNumber = String(detailedJobData.work_order_num).padStart(6, '0');
    const propertyAddress = `${detailedJobData.property.address}${detailedJobData.property.address_2 ? `, ${detailedJobData.property.address_2}` : ''}, ${detailedJobData.property.city}, ${detailedJobData.property.state} ${detailedJobData.property.zip}`;
    
    if (templateType === 'completion1') {
      // 📝 PROFESSIONAL/FORMAL COMPLETION TEMPLATE - Edit text below:
      return `Dear Property Manager,

We have completed the work for Work Order #${woNumber} and are requesting your approval.

JOB DETAILS:
• Work Order #: ${woNumber}
• Property: ${detailedJobData.property.name}
• Address: ${propertyAddress}
• Unit: ${detailedJobData.unit_number}
• Status: ${detailedJobData.status || 'Completed'}
${detailedJobData.scheduled_date ? `• Scheduled Date: ${new Date(detailedJobData.scheduled_date).toLocaleDateString()}` : ''}
${detailedJobData.description ? `• Description: ${detailedJobData.description}` : ''}

WORK ORDER DETAILS:
${detailedJobData.work_orders.map(wo => `
Work Order ID: ${wo.id}
${wo.submission_date ? `• Submission Date: ${new Date(wo.submission_date).toLocaleDateString()}` : ''}
${wo.job_category ? `• Category: ${wo.job_category}` : ''}
• Unit Occupied: ${wo.is_occupied ? 'Yes' : 'No'}
• Full Paint Job: ${wo.is_full_paint ? 'Yes' : 'No'}

PAINTING DETAILS:
• Sprinklers: ${wo.has_sprinklers ? 'Yes' : 'No'}${wo.has_sprinklers ? ` (Painted: ${wo.sprinklers_painted ? 'Yes' : 'No'})` : ''}
• Ceilings Painted: ${wo.painted_ceilings ? 'Yes' : 'No'}${wo.painted_ceilings ? ` (${wo.ceiling_rooms_count} rooms)` : ''}
• Patio Painted: ${wo.painted_patio ? 'Yes' : 'No'}
• Garage Painted: ${wo.painted_garage ? 'Yes' : 'No'}
• Cabinets Painted: ${wo.painted_cabinets ? 'Yes' : 'No'}
• Crown Molding Painted: ${wo.painted_crown_molding ? 'Yes' : 'No'}
• Front Door Painted: ${wo.painted_front_door ? 'Yes' : 'No'}
• Accent Wall: ${wo.has_accent_wall ? 'Yes' : 'No'}${wo.has_accent_wall ? ` (Type: ${wo.accent_wall_type || 'N/A'}, Count: ${wo.accent_wall_count})` : ''}

${wo.has_extra_charges ? `EXTRA CHARGES:
• Extra Hours: ${wo.extra_hours}
• Description: ${wo.extra_charges_description || 'N/A'}` : ''}

${wo.additional_comments ? `ADDITIONAL COMMENTS:
${wo.additional_comments}` : ''}
`).join('\n')}

Please review the completed work and provide your approval by replying to this email.

If you have any questions or concerns about the work performed, please don't hesitate to contact us.

Thank you for your business.

Best regards,
JG Contracting Team

---
This is an automated message regarding job completion for Work Order #${woNumber}.`;

    } else if (templateType === 'completion2') {
      // 📝 BRIEF/SUMMARY COMPLETION TEMPLATE - Edit text below:
      return `Hello,

Work Order #${woNumber} at ${detailedJobData.property.name} (Unit ${detailedJobData.unit_number}) has been completed and is ready for your approval.

SUMMARY:
• Property: ${detailedJobData.property.name}
• Unit: ${detailedJobData.unit_number}
• Work Orders Completed: ${detailedJobData.work_orders.length}
${detailedJobData.work_orders.map(wo => `
• Unit Occupied: ${wo.is_occupied ? 'Yes' : 'No'}
• Full Paint: ${wo.is_full_paint ? 'Yes' : 'No'}
• Sprinklers: ${wo.has_sprinklers ? (wo.sprinklers_painted ? 'Painted' : 'Present, Not Painted') : 'None'}
• Ceilings: ${wo.painted_ceilings ? `Painted (${wo.ceiling_rooms_count} rooms)` : 'Not Painted'}
• Additional: ${[
  wo.painted_patio ? 'Patio' : null,
  wo.painted_garage ? 'Garage' : null,
  wo.painted_cabinets ? 'Cabinets' : null,
  wo.painted_crown_molding ? 'Crown Molding' : null,
  wo.painted_front_door ? 'Front Door' : null
].filter(Boolean).join(', ') || 'None'}
${wo.has_extra_charges ? `• Extra Charges: ${wo.extra_hours} hours - ${wo.extra_charges_description}` : ''}
`).join('')}

Please confirm completion approval at your earliest convenience.

Thanks,
JG Contracting Team`;

    } else if (templateType === 'completion3') {
      // 📝 FRIENDLY/CASUAL COMPLETION TEMPLATE - Edit text below:
      return `Hi there!

Great news! We've finished up the work on Work Order #${woNumber} at ${detailedJobData.property.name}.

WHAT WE COMPLETED:
📍 Property: ${detailedJobData.property.name}, Unit ${detailedJobData.unit_number}
📅 Work completed as of today
${detailedJobData.work_orders.map(wo => `
🏠 Unit Details:
  • ${wo.is_occupied ? 'Unit was occupied during work' : 'Unit was vacant during work'}
  • ${wo.is_full_paint ? 'Complete paint job' : 'Touch-up work'}

🎨 Painting Work:
${wo.has_sprinklers ? `  • Sprinklers: ${wo.sprinklers_painted ? '✅ Painted around them' : '⚠️ Worked around them (not painted)'}` : '  • No sprinklers to work around'}
${wo.painted_ceilings ? `  • ✅ Painted ceilings in ${wo.ceiling_rooms_count} rooms` : '  • Ceilings not included'}
  • Patio: ${wo.painted_patio ? '✅ Painted' : '❌ Not included'}
  • Garage: ${wo.painted_garage ? '✅ Painted' : '❌ Not included'}  
  • Cabinets: ${wo.painted_cabinets ? '✅ Painted' : '❌ Not included'}
  • Crown Molding: ${wo.painted_crown_molding ? '✅ Painted' : '❌ Not included'}
  • Front Door: ${wo.painted_front_door ? '✅ Painted' : '❌ Not included'}
${wo.has_accent_wall ? `  • ✅ Accent wall work (${wo.accent_wall_count} walls, ${wo.accent_wall_type})` : '  • No accent wall work'}

${wo.has_extra_charges ? `💰 Extra Work:
  • Additional ${wo.extra_hours} hours for: ${wo.extra_charges_description}` : ''}

${wo.additional_comments ? `📝 Notes: ${wo.additional_comments}` : ''}
`).join('\n')}

Everything's looking great! Please take a look and let us know you're happy with the work.

Cheers!
The JG Team 🎨`;
    }
    
    return '';
  };

  // ==========================================
  // 📝 EDIT EMAIL TEMPLATES HERE
  // ==========================================
  // Generate email templates with approval links for extra charges
  const generateEmailTemplates = async (): Promise<Record<'template1' | 'template2' | 'template3' | 'completion1' | 'completion2' | 'completion3', string>> => {
    // Get approval button HTML for extra charges templates
    const approvalButtonHtml = await generateApprovalButtonHtml();
    
    return {
      // 📝 EXTRA CHARGES TEMPLATES - Edit text below:
      completion1: generateCompletionEmailContent('completion1'),
      completion2: generateCompletionEmailContent('completion2'),
      completion3: generateCompletionEmailContent('completion3'),
      // 📝 TEMPLATE 1: PROFESSIONAL/FORMAL EXTRA CHARGES - Edit text below:
      template1: `Dear Property Manager,

I hope this email finds you well. I am writing to request your approval for additional charges related to Job #${job?.id || '[Job ID]'}.

${job ? `Job Information:
• Property: ${job.property?.name || 'N/A'}
• Address: ${job.property?.address || 'N/A'}
• Unit: ${job.unit_number || 'N/A'}
• Job Type: ${job.job_type?.label || 'N/A'}
• Phase: ${job.job_phase?.label || 'N/A'}
• Scheduled Date: ${job.scheduled_date ? new Date(job.scheduled_date).toLocaleDateString() : 'N/A'}
` : ''}

${job?.work_order ? `Work Order Information:
• Submission Date: ${job.work_order.submission_date ? new Date(job.work_order.submission_date).toLocaleDateString() : 'N/A'}
• Unit Occupied: ${job.work_order.is_occupied ? 'Yes' : 'No'}
• Full Paint: ${job.work_order.is_full_paint ? 'Yes' : 'No'}
• Extra Charges: ${job.work_order.has_extra_charges ? 'Yes' : 'No'}
• Extra Hours: ${job.work_order.extra_hours || '0'}
• Description: ${job.work_order.extra_charges_description || 'N/A'}
` : ''}

${approvalButtonHtml}

Please review these charges and let us know if you approve so we can proceed accordingly.

Thank you,
JG Painting Pros Inc.`,
      // 📝 TEMPLATE 2: STANDARD BUSINESS EXTRA CHARGES - Edit text below:
      template2: `Hello,

We need your approval for some additional work on Job #${job?.id || '[Job ID]'}.

${job ? `Job Information:
• Property: ${job.property?.name || 'N/A'}
• Address: ${job.property?.address || 'N/A'}
• Unit: ${job.unit_number || 'N/A'}
• Job Type: ${job.job_type?.label || 'N/A'}
• Phase: ${job.job_phase?.label || 'N/A'}
• Scheduled Date: ${job.scheduled_date ? new Date(job.scheduled_date).toLocaleDateString() : 'N/A'}
` : ''}

${job?.work_order ? `Work Order Information:
• Submission Date: ${job.work_order.submission_date ? new Date(job.work_order.submission_date).toLocaleDateString() : 'N/A'}
• Unit Occupied: ${job.work_order.is_occupied ? 'Yes' : 'No'}
• Full Paint: ${job.work_order.is_full_paint ? 'Yes' : 'No'}
• Extra Charges: ${job.work_order.has_extra_charges ? 'Yes' : 'No'}
• Extra Hours: ${job.work_order.extra_hours || '0'}
• Description: ${job.work_order.extra_charges_description || 'N/A'}
` : ''}

${approvalButtonHtml}

Please review and approve these charges at your earliest convenience.

Thank you,
JG Painting Pros Inc.`,
      // 📝 TEMPLATE 3: CASUAL/FRIENDLY EXTRA CHARGES - Edit text below:
      template3: `Hi there,

Quick note about some extra charges for Job #${job?.id || '[Job ID]'} that need your approval.

${job ? `Job Information:
• Property: ${job.property?.name || 'N/A'}
• Address: ${job.property?.address || 'N/A'}
• Unit: ${job.unit_number || 'N/A'}
• Job Type: ${job.job_type?.label || 'N/A'}
• Phase: ${job.job_phase?.label || 'N/A'}
• Scheduled Date: ${job.scheduled_date ? new Date(job.scheduled_date).toLocaleDateString() : 'N/A'}
` : ''}

${job?.work_order ? `Work Order Information:
• Submission Date: ${job.work_order.submission_date ? new Date(job.work_order.submission_date).toLocaleDateString() : 'N/A'}
• Unit Occupied: ${job.work_order.is_occupied ? 'Yes' : 'No'}
• Full Paint: ${job.work_order.is_full_paint ? 'Yes' : 'No'}
• Extra Charges: ${job.work_order.has_extra_charges ? 'Yes' : 'No'}
• Extra Hours: ${job.work_order.extra_hours || '0'}
• Description: ${job.work_order.extra_charges_description || 'N/A'}
` : ''}

${approvalButtonHtml}

Let me know if you're good with these charges!

Thank you,
JG Painting Pros Inc.`,
    };
  };

  const handleTemplateChange = async (templateId: string) => {
    setSelectedTemplate(templateId as 'template1' | 'template2' | 'template3' | 'completion1' | 'completion2' | 'completion3');
    
    if (templateId) {
      const templates = await generateEmailTemplates();
      if (templates[templateId as keyof typeof templates]) {
        onContentChange(templates[templateId as keyof typeof templates]);
      } else {
        onContentChange('');
      }
    } else {
      onContentChange('');
    }
  };

  const generateEmailContent = async () => {
    if (!selectedTemplate) {
      return emailContent;
    }
    
    const templates = await generateEmailTemplates();
    if (templates[selectedTemplate as keyof typeof templates]) {
      return templates[selectedTemplate as keyof typeof templates];
    }
    
    return emailContent;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Send Approval Request
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Loading indicator for detailed job data */}
          {loadingJobData && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent mr-3"></div>
                <span className="text-blue-700 dark:text-blue-300 text-sm">Loading detailed job information...</span>
              </div>
            </div>
          )}

          {/* Enhanced Job Summary when detailed data is available */}
          {detailedJobData && (
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-4">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Enhanced Job Information</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Work Order #:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                    {String(detailedJobData.work_order_num).padStart(6, '0')}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Property:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">{detailedJobData.property.name}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Unit:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">{detailedJobData.unit_number}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Work Orders:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">{detailedJobData.work_orders.length}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500 dark:text-gray-400">AP Email:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                    {detailedJobData.property.ap_email || 'No email on file'}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Recipient Email
            </label>
            <input
              type="email"
              value={recipientEmail}
              onChange={(e) => onRecipientChange(e.target.value)}
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
              onChange={(e) => onCCChange(e.target.value)}
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
              onChange={(e) => onBCCChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Enter BCC emails (comma-separated)"
            />
          </div>

          <div>
            <label htmlFor="template" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              Select Template
            </label>
            <select
              id="template"
              name="template"
              value={selectedTemplate}
              onChange={(e) => handleTemplateChange(e.target.value)}
              className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="" disabled>
                - Select Email Template -
              </option>
              <optgroup label="Job Completion Templates">
                <option value="completion1">Completion - Professional/Detailed</option>
                <option value="completion2">Completion - Brief/Summary</option>
                <option value="completion3">Completion - Friendly/Casual</option>
              </optgroup>
              <optgroup label="Extra Charges Templates">
                <option value="template1">Extra Charges - Template 1</option>
                <option value="template2">Extra Charges - Template 2</option>
                <option value="template3">Extra Charges - Template 3</option>
              </optgroup>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email Content
            </label>
            <textarea
              id="emailContent"
              name="emailContent"
              value={emailContent}
              onChange={(e) => onContentChange(e.target.value)}
              rows={10}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div className="flex justify-end space-x-4">
            <button
              onClick={onPreviewEmail}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              Preview Email
            </button>
            <button
              onClick={() => setShowPdfPreview(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm flex items-center"
            >
              Preview PDF
            </button>
            <button
              onClick={onSendEmail}
              disabled={sendingEmail}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {sendingEmail ? 'Sending...' : 'Send Email'}
            </button>
          </div>
        </div>

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
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                  {emailContent}
                </pre>
              </div>
            </div>
          </div>
        )}

        {showPdfPreview && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[150]">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  PDF Preview
                </h3>
                <button
                  onClick={() => setShowPdfPreview(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  Close
                </button>
              </div>
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                  {generateEmailContent()}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ApprovalEmailModal;
