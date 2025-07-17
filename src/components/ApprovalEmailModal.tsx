import React, { useState, useEffect } from 'react';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import { Job } from '../hooks/useJobDetails';
import { supabase } from '../utils/supabase';

interface DetailedJobData {
  id: string;
  work_order_num: string;
  unit_number: string;
  description: string;
  scheduled_date: string;
  status: string;
  property: {
    name: string;
    address: string;
    address_2: string | null;
    city: string;
    state: string;
    zip: string;
    ap_email: string | null;
  };
  work_orders: Array<any>;
}

interface ApprovalEmailModalProps {
  recipientEmail: string;
  ccEmails: string;
  bccEmails: string;
  emailContent: string;
  sendingEmail: boolean;
  job: Job | null;
  onClose: () => void;
  onSendEmail: () => void;
  onRecipientChange: (email: string) => void;
  onCCChange: (emails: string) => void;
  onBCCChange: (emails: string) => void;
  onContentChange: (content: string) => void;
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
  onRecipientChange,
  onCCChange,
  onBCCChange,
  onContentChange,
}) => {
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [emailViewMode, setEmailViewMode] = useState<'visual' | 'code'>('visual');
  const [showCCBCC, setShowCCBCC] = useState(false);
  const [loadingJobData, setLoadingJobData] = useState(false);
  const [detailedJobData, setDetailedJobData] = useState<DetailedJobData | null>(null);

  // Function to render email content for visual preview
  const renderEmailVisual = (content: string) => {
    // Convert plain text to HTML while preserving the embedded HTML approval button
    const lines = content.split('\n');
    let htmlContent = '';
    let inApprovalSection = false;
    let approvalHtml = '';
    let inJobInfo = false;
    let inWorkOrderInfo = false;
    let emptyLineCount = 0;

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.startsWith('<div style="text-align: center')) {
        inApprovalSection = true;
        approvalHtml = line;
        emptyLineCount = 0;
      } else if (inApprovalSection) {
        approvalHtml += '\n' + line;
        if (trimmedLine === '</div>') {
          // End of approval section, add the HTML directly
          htmlContent += approvalHtml;
          inApprovalSection = false;
          approvalHtml = '';
          emptyLineCount = 0;
        }
      } else if (trimmedLine === '') {
        emptyLineCount++;
        // Only add one line break for multiple empty lines
        if (emptyLineCount === 1) {
          htmlContent += '<br>';
        }
      } else if (trimmedLine === 'Job Information:') {
        inJobInfo = true;
        emptyLineCount = 0;
        htmlContent += `<div style="margin-top: 16px; margin-bottom: 8px; font-weight: bold; color: #374151;">${trimmedLine}</div>`;
      } else if (trimmedLine === 'Work Order Information:') {
        inJobInfo = false;
        inWorkOrderInfo = true;
        emptyLineCount = 0;
        htmlContent += `<div style="margin-top: 16px; margin-bottom: 8px; font-weight: bold; color: #374151;">${trimmedLine}</div>`;
      } else if (trimmedLine.startsWith('•')) {
        emptyLineCount = 0;
        const bgColor = inJobInfo ? '#dbeafe' : inWorkOrderInfo ? '#ecfdf5' : '#f3f4f6';
        const borderColor = inJobInfo ? '#3b82f6' : inWorkOrderInfo ? '#10b981' : '#6b7280';
        htmlContent += `<div style="margin-left: 20px; margin-bottom: 4px; padding: 6px 10px; background-color: ${bgColor}; border-left: 3px solid ${borderColor}; border-radius: 4px;">&bull; ${trimmedLine.substring(1).trim()}</div>`;
      } else if (trimmedLine.startsWith('Dear') || trimmedLine.startsWith('I hope') || trimmedLine.startsWith('Please review') || trimmedLine.startsWith('Thank you')) {
        emptyLineCount = 0;
        htmlContent += `<div style="margin-bottom: 12px; line-height: 1.5;">${trimmedLine}</div>`;
      } else if (trimmedLine !== '') {
        emptyLineCount = 0;
        // Reset section flags for non-bullet points
        if (!trimmedLine.startsWith('•') && !trimmedLine.includes('Information:')) {
          inJobInfo = false;
          inWorkOrderInfo = false;
        }
        htmlContent += `<div style="margin-bottom: 8px; line-height: 1.5;">${trimmedLine}</div>`;
      }
    }

    return htmlContent;
  };

  const [approvalToken, setApprovalToken] = useState<string | null>(null);

  // Generate approval token for extra charges
  const generateApprovalToken = async () => {
    if (!job?.id) {
      return null;
    }

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
          approver_email: recipientEmail || 'pending@example.com', // Allow placeholder email
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
    if (!approvalUrl) {
      return '';
    }

    // Get cost from various possible sources
    const totalCost = job?.extra_charges_details?.bill_amount || 
                     (job?.work_order?.extra_hours || 0) * 50 || // Estimate $50/hour if no bill amount
                     0;

    const buttonHtml = `
<div style="text-align: center; margin: 30px 0; padding: 20px; background-color: #f8f9fa; border-radius: 8px;">
  <h3 style="margin: 0 0 15px 0; color: #1f2937;">One-Click Approval</h3>
  <a href="${approvalUrl}" 
     style="display: inline-block; background-color: #22c55e; color: white; padding: 15px 30px; 
            text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;
            margin: 10px 0;">
    ✅ APPROVE EXTRA CHARGES${totalCost > 0 ? ` - $${totalCost.toFixed(2)}` : ''}
  </a>
  <p style="margin: 15px 0 5px 0; font-size: 14px; color: #6b7280;">
    Click the button above to approve these charges instantly and move the job to Work Order phase.
  </p>
  <p style="margin: 0; font-size: 12px; color: #9ca3af;">
    Secure link • Expires in 7 days • You'll receive confirmation after approval
  </p>
</div>`;

    return buttonHtml;
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
  // 📝 EMAIL TEMPLATE - EXTRA CHARGES APPROVAL  
  // ==========================================
  // Generate email template with approval link for extra charges
  const generateEmailTemplate = async (): Promise<string> => {
    // Get approval button HTML for extra charges templates
    const approvalButtonHtml = await generateApprovalButtonHtml();
    
    // Format work order number
    const workOrderNumber = job?.work_order_num ? `WO-${String(job.work_order_num).padStart(6, '0')}` : '[Work Order]';
    
    // 📝 PROFESSIONAL/FORMAL EXTRA CHARGES TEMPLATE - Edit text below:
    const template = `Dear Property Manager,

I hope this email finds you well. I am writing to request your approval for additional charges related to ${workOrderNumber}.

${job ? `Job Information:
• Work Order #: ${workOrderNumber}
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
JG Painting Pros Inc.`;

    return template;
  };

  // Auto-populate template content when job data is available
  useEffect(() => {
    const loadTemplate = async () => {
      if (job && emailContent === '') {
        const content = await generateEmailTemplate();
        onContentChange(content);
      }
    };
    
    loadTemplate();
  }, [job, emailContent, onContentChange]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
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
            <button
              type="button"
              onClick={() => setShowCCBCC(!showCCBCC)}
              className="flex items-center text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
            >
              {showCCBCC ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-1" />
                  Hide CC/BCC
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  Add CC/BCC
                </>
              )}
            </button>
            
            {showCCBCC && (
              <div className="mt-3 space-y-3">
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
              </div>
            )}
          </div>

          {/* Auto-populate with Extra Charges Template */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/30 rounded-lg p-3 mb-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Template:</strong> Extra Charges Approval Email
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-300">
                💡 Use Visual tab to see how the email will look to recipients
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Email Content
              </label>
              <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                <button
                  onClick={() => setEmailViewMode('visual')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    emailViewMode === 'visual'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  Visual
                </button>
                <button
                  onClick={() => setEmailViewMode('code')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    emailViewMode === 'code'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  Code
                </button>
              </div>
            </div>
            
            {emailViewMode === 'visual' ? (
              <div className="border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 min-h-[300px] max-h-[400px] overflow-y-auto">
                {/* Email header simulation */}
                <div className="bg-gray-50 dark:bg-gray-700 p-3 border-b border-gray-200 dark:border-gray-600 text-xs text-gray-600 dark:text-gray-400">
                  <div className="flex justify-between items-center mb-2">
                    <span><strong>To:</strong> {recipientEmail || 'recipient@example.com'}</span>
                    <span className="text-gray-400">📧</span>
                  </div>
                  {ccEmails && (
                    <div className="mb-1">
                      <strong>CC:</strong> {ccEmails}
                    </div>
                  )}
                  <div>
                    <strong>Subject:</strong> Extra Charges Approval Request - {job?.work_order_num ? `WO-${String(job.work_order_num).padStart(6, '0')}` : 'Work Order'}
                  </div>
                </div>
                
                {/* Email body */}
                <div className="p-4">
                  <div 
                    className="text-gray-900 dark:text-gray-100 text-sm leading-relaxed"
                    dangerouslySetInnerHTML={{ 
                      __html: renderEmailVisual(emailContent)
                    }}
                  />
                </div>
              </div>
            ) : (
              <textarea
                id="emailContent"
                name="emailContent"
                value={emailContent}
                onChange={(e) => onContentChange(e.target.value)}
                rows={12}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white font-mono text-sm"
                placeholder="Email content will be generated automatically..."
              />
            )}
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
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
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
                {/* Email header simulation */}
                <div className="bg-gray-50 dark:bg-gray-700 p-3 border border-gray-200 dark:border-gray-600 rounded-t-md text-xs text-gray-600 dark:text-gray-400">
                  <div className="flex justify-between items-center mb-2">
                    <span><strong>To:</strong> {recipientEmail || 'recipient@example.com'}</span>
                    <span className="text-gray-400">📧</span>
                  </div>
                  {ccEmails && (
                    <div className="mb-1">
                      <strong>CC:</strong> {ccEmails}
                    </div>
                  )}
                  <div>
                    <strong>Subject:</strong> Extra Charges Approval Request - {job?.work_order_num ? `WO-${String(job.work_order_num).padStart(6, '0')}` : 'Work Order'}
                  </div>
                </div>
                
                {/* Email body */}
                <div className="border border-t-0 border-gray-200 dark:border-gray-600 rounded-b-md p-4 bg-white dark:bg-gray-800">
                  <div 
                    className="text-gray-900 dark:text-gray-100 text-sm leading-relaxed"
                    dangerouslySetInnerHTML={{ 
                      __html: renderEmailVisual(emailContent)
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {showPdfPreview && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[150]">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
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
                <div className="bg-white p-6 border border-gray-200 rounded-md shadow-sm" style={{ fontFamily: 'Arial, sans-serif' }}>
                  <div className="text-center mb-4 pb-4 border-b border-gray-200">
                    <h2 className="text-lg font-bold text-gray-800">JG Painting Pros Inc.</h2>
                    <p className="text-sm text-gray-600">Extra Charges Approval Request</p>
                    <p className="text-xs text-gray-500">Work Order: {job?.work_order_num ? `WO-${String(job.work_order_num).padStart(6, '0')}` : 'N/A'}</p>
                  </div>
                  
                  <div 
                    className="text-gray-900 text-sm leading-relaxed"
                    dangerouslySetInnerHTML={{ 
                      __html: renderEmailVisual(emailContent)
                    }}
                  />
                  
                  <div className="mt-6 pt-4 border-t border-gray-200 text-center">
                    <p className="text-xs text-gray-500">This document was generated automatically by JG Painting Pros Inc.</p>
                    <p className="text-xs text-gray-500">Date: {new Date().toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ApprovalEmailModal;
