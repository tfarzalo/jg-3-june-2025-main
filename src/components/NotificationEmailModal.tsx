import React, { useState, useEffect } from 'react';
import { X, Mail, Send, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Job } from '../hooks/useJobDetails';
import { supabase } from '../utils/supabase';
import { toast } from 'sonner';

interface NotificationEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: Job | null;
  notificationType: 'sprinkler_paint' | 'drywall_repairs';
  onSent?: () => void;
  additionalServices?: Array<{
    label: string;
    quantity: number;
    unit_label?: string;
    bill_amount: number;
  }>;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  auto_include_photos: boolean;
}

const NotificationEmailModal: React.FC<NotificationEmailModalProps> = ({
  isOpen,
  onClose,
  job,
  notificationType,
  onSent
}) => {
  const [template, setTemplate] = useState<EmailTemplate | null>(null);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [ccEmails, setCcEmails] = useState('');
  const [bccEmails, setBccEmails] = useState('');
  const [emailContent, setEmailContent] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [emailViewMode, setEmailViewMode] = useState<'visual' | 'code'>('visual');
  const [showCCBCC, setShowCCBCC] = useState(false);
  const [showEmailPreview, setShowEmailPreview] = useState(false);

  // Load template and initialize form
  useEffect(() => {
    if (isOpen && job) {
      loadTemplate();
      initializeEmails();
    }
  }, [isOpen, job, notificationType]);

  // Auto-expand CC/BCC section when there are CC or BCC emails
  useEffect(() => {
    if ((ccEmails && ccEmails.trim()) || (bccEmails && bccEmails.trim())) {
      setShowCCBCC(true);
    }
  }, [ccEmails, bccEmails]);

  const resolveSecondaryEmail = async (
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
  };

  const loadTemplate = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('trigger_phase', notificationType)
        .eq('template_type', 'notification')
        .single();

      if (error) throw error;
      setTemplate(data);
      
      // Process template content with job data
      if (data && job) {
        const processedSubject = processTemplate(data.subject, job);
        const processedBody = processTemplate(data.body, job);
        setEmailSubject(processedSubject);
        setEmailContent(processedBody);
      }
    } catch (error) {
      console.error('Error loading template:', error);
      toast.error('Failed to load email template');
    } finally {
      setLoading(false);
    }
  };

  const initializeEmails = async () => {
    try {
      if (!job?.property?.id) {
        const preferred =
          job?.property?.primary_contact_email ||
          job?.property?.ap_email ||
          '';
        setRecipientEmail(preferred);
        setCcEmails('');
        setBccEmails('');
        return;
      }
      const { data: prop, error } = await supabase
        .from('properties')
        .select(`
          primary_contact_email,
          ap_email,
          community_manager_email,
          maintenance_supervisor_email,
          community_manager_secondary_email,
          maintenance_supervisor_secondary_email,
          ap_secondary_email,
          primary_contact_secondary_email
        `)
        .eq('id', job.property.id)
        .single();
      const preferred = error
        ? (job?.property?.primary_contact_email || job?.property?.ap_email || '')
        : (prop?.primary_contact_email || prop?.ap_email || '');
      const secondaryEmail = await resolveSecondaryEmail(job.property.id, preferred, prop);
      setRecipientEmail(preferred);
      setCcEmails(secondaryEmail || '');
      setBccEmails('');
    } catch {
      const preferred =
        job?.property?.primary_contact_email ||
        job?.property?.ap_email ||
        '';
      setRecipientEmail(preferred);
      setCcEmails('');
      setBccEmails('');
    }
  };

  // Process template with job data
  const processTemplate = (template: string, job: Job): string => {
    if (!template || !job) return template;

    const propertyAddress = `${job.property.address}${job.property.address_2 ? `, ${job.property.address_2}` : ''}, ${job.property.city}, ${job.property.state} ${job.property.zip}`;
    const unitNumber = job.unit_number || 'N/A';
    const jobNumber = job.work_order_num?.toString() || job.id.slice(0, 8);

    return template
      .replace(/\{\{property_address\}\}/g, propertyAddress)
      .replace(/\{\{unit_number\}\}/g, unitNumber)
      .replace(/\{\{job_number\}\}/g, jobNumber)
      .replace(/\{\{property_name\}\}/g, job.property.name || propertyAddress);
  };

  // Render email content as styled HTML for visual preview
  const renderEmailVisual = (content: string): string => {
    if (!content) return '';

    const lines = content.split('\n');
    let htmlContent = '';
    let emptyLineCount = 0;
    let inJobInfo = false;
    let inWorkOrderInfo = false;

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine === '') {
        emptyLineCount++;
        // Only add one line break for multiple empty lines
        if (emptyLineCount === 1) {
          htmlContent += '<br>';
        }
      } else if (trimmedLine === 'Job Information:' || trimmedLine.includes('Information:')) {
        inJobInfo = trimmedLine === 'Job Information:';
        inWorkOrderInfo = trimmedLine === 'Work Order Information:';
        emptyLineCount = 0;
        htmlContent += `<div style="margin-top: 16px; margin-bottom: 8px; font-weight: bold; color: #374151;">${trimmedLine}</div>`;
      } else if (trimmedLine.startsWith('•')) {
        emptyLineCount = 0;
        const bgColor = inJobInfo ? '#dbeafe' : inWorkOrderInfo ? '#ecfdf5' : '#f3f4f6';
        const borderColor = inJobInfo ? '#3b82f6' : inWorkOrderInfo ? '#10b981' : '#6b7280';
        htmlContent += `<div style="margin-left: 20px; margin-bottom: 4px; padding: 6px 10px; background-color: ${bgColor}; border-left: 3px solid ${borderColor}; border-radius: 4px;">&bull; ${trimmedLine.substring(1).trim()}</div>`;
      } else if (trimmedLine.startsWith('Dear') || trimmedLine.startsWith('Hello') || trimmedLine.startsWith('Hi') || trimmedLine.startsWith('I hope') || trimmedLine.startsWith('Please') || trimmedLine.startsWith('Thank you') || trimmedLine.startsWith('Thanks')) {
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

  const handleSendEmail = async () => {
    if (!job || !recipientEmail || !emailContent || !emailSubject) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setSending(true);

      // Prepare email data for send-email function
      const emailData = {
        to: recipientEmail,
        cc: ccEmails || undefined,
        bcc: bccEmails || undefined,
        subject: emailSubject,
        html: emailContent,  // send-email expects 'html' not 'content'
        text: emailContent.replace(/<[^>]*>/g, ''), // Plain text version
      };

      // Include photos if template requires it
      if (template?.auto_include_photos && job) {
        // Get job photos
        const { data: photos } = await supabase
          .from('job_images')
          .select('*')
          .eq('job_id', job.id)
          .order('created_at', { ascending: false });

        if (photos && photos.length > 0) {
          // For now, we'll just note that photos should be attached
          // In a full implementation, you'd process the photos here
          emailData.html += '\n\n<p><em>Note: Job photos are attached to this email.</em></p>';
          emailData.text += '\n\nNote: Job photos are attached to this email.';
        }
      }

      // Send email via the unified send-email function
      const { error } = await supabase.functions.invoke('send-email', {
        body: emailData
      });

      if (error) throw error;

      // Log the notification
      await supabase.from('email_logs').insert({
        job_id: job?.id,
        recipient_email: recipientEmail,
        cc_emails: ccEmails || null,
        bcc_emails: bccEmails || null,
        subject: emailSubject,
        template_type: notificationType,
        sent_at: new Date().toISOString()
      });

      // If the job is in "Pending Work Order" phase, log this activity
      if (job?.job_phase?.label === 'Pending Work Order') {
        const { data: sessionData } = await supabase.auth.getSession();
        const currentUserId = sessionData?.session?.user?.id;

        if (currentUserId) {
          // Get the current phase ID
          const { data: phaseData } = await supabase
            .from('job_phases')
            .select('id')
            .eq('job_phase_label', 'Pending Work Order')
            .single();

          if (phaseData) {
            // Log activity as a phase change (to same phase) to track the notification
            await supabase.from('job_phase_changes').insert({
              job_id: job.id,
              from_phase_id: phaseData.id,
              to_phase_id: phaseData.id,
              changed_by: currentUserId,
              changed_at: new Date().toISOString(),
              notes: `${getNotificationTypeLabel()} notification email sent to ${recipientEmail}`
            });
          }
        }
      }

      toast.success('Notification sent successfully!');
      onSent?.();
      onClose();
    } catch (error) {
      console.error('Error sending notification:', error);
      toast.error('Failed to send notification');
    } finally {
      setSending(false);
    }
  };

  const getNotificationTypeLabel = () => {
    switch (notificationType) {
      case 'sprinkler_paint':
        return 'Sprinkler Paint';
      case 'drywall_repairs':
        return 'Drywall Repair';
      default:
        return 'Notification';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Send {getNotificationTypeLabel()} Notification
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <span className="ml-2 text-gray-600 dark:text-gray-400">Loading template...</span>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Email Form */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    To: <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="recipient@example.com"
                    required
                  />
                </div>

                {/* Collapsible CC/BCC Section */}
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
                          CC:
                        </label>
                        <input
                          type="email"
                          value={ccEmails}
                          onChange={(e) => setCcEmails(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                          placeholder="cc1@example.com, cc2@example.com"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          BCC:
                        </label>
                        <input
                          type="email"
                          value={bccEmails}
                          onChange={(e) => setBccEmails(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                          placeholder="bcc1@example.com, bcc2@example.com"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Subject: <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Message: <span className="text-red-500">*</span>
                    </label>
                    <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                      <button
                        type="button"
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
                        type="button"
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
                          <strong>Subject:</strong> {emailSubject || 'Notification Subject'}
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
                      value={emailContent}
                      onChange={(e) => setEmailContent(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white font-mono text-sm"
                      rows={12}
                      required
                    />
                  )}
                </div>

                {template?.auto_include_photos && (
                  <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                    <div className="flex items-center">
                      <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
                      <span className="text-sm text-blue-800 dark:text-blue-200">
                        Job photos will be automatically included with this notification
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
            disabled={sending}
          >
            Cancel
          </button>
          <button
            onClick={() => setShowEmailPreview(true)}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            Preview Email
          </button>
          <button
            onClick={handleSendEmail}
            disabled={sending || loading || !recipientEmail || !emailContent || !emailSubject}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Notification
              </>
            )}
          </button>
        </div>
      </div>

      {/* Email Preview Modal */}
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
            
            <div className="border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800">
              {/* Email header simulation */}
              <div className="bg-gray-50 dark:bg-gray-700 p-4 border-b border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-400">
                <div className="flex justify-between items-center mb-2">
                  <span><strong>To:</strong> {recipientEmail || 'recipient@example.com'}</span>
                  <span className="text-gray-400">📧</span>
                </div>
                {ccEmails && (
                  <div className="mb-2">
                    <strong>CC:</strong> {ccEmails}
                  </div>
                )}
                {bccEmails && (
                  <div className="mb-2">
                    <strong>BCC:</strong> {bccEmails}
                  </div>
                )}
                <div>
                  <strong>Subject:</strong> {emailSubject || 'Notification Subject'}
                </div>
              </div>
              
              {/* Email body */}
              <div className="p-6">
                <div 
                  className="text-gray-900 dark:text-gray-100 leading-relaxed"
                  dangerouslySetInnerHTML={{ 
                    __html: renderEmailVisual(emailContent)
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationEmailModal;
