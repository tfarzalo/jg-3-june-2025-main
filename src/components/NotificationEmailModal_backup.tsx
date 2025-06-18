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

  const initializeEmails = () => {
    // Auto-populate recipient email with property AP contact if available
    if (job?.property?.ap_email) {
      setRecipientEmail(job.property.ap_email);
    } else {
      setRecipientEmail(''); // Leave empty for manual input if no AP email
    }
    setCcEmails('');
    setBccEmails('');
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
    if (!recipientEmail || !emailContent || !emailSubject) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setSending(true);
      
      // Prepare email data
      const emailData = {
        to: recipientEmail,
        cc: ccEmails || undefined,
        bcc: bccEmails || undefined,
        subject: emailSubject,
        content: emailContent,
        job_id: job?.id,
        notification_type: notificationType,
        template_id: template?.id
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
          emailData.content += '\n\n<p><em>Note: Job photos are attached to this email.</em></p>';
        }
      }

      // Send email via your email service
      const { error } = await supabase.functions.invoke('send-notification-email', {
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
        content: emailContent,
        notification_type: notificationType,
        template_id: template?.id,
        sent_at: new Date().toISOString()
      });

      toast.success(`${getNotificationTypeLabel()} notification sent successfully`);
      onSent?.();
      onClose();
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error('Failed to send notification email');
    } finally {
      setSending(false);
    }
  };

  const getNotificationTypeLabel = () => {
    switch (notificationType) {
      case 'sprinkler_paint':
        return 'Sprinkler Paint';
      case 'drywall_repairs':
        return 'Drywall Repairs';
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
              {/* Job Information */}
              {job && (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-6">
                  <h3 className="font-medium text-gray-900 dark:text-white mb-2">Job Information</h3>
                  <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                    <div><strong>Property:</strong> {job.property.name}</div>
                    <div><strong>Address:</strong> {job.property.address}, {job.property.city}, {job.property.state}</div>
                    <div><strong>Unit:</strong> {job.unit_number || 'N/A'}</div>
                    <div><strong>Job #:</strong> {job.work_order_num || job.id.slice(0, 8)}</div>
                  </div>
                </div>
              )}

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

                {/* Email Preview */}
                <div className="mt-4">
                  <button
                    onClick={() => setShowEmailPreview(!showEmailPreview)}
                    className="flex items-center text-sm font-medium text-blue-600 hover:underline"
                  >
                    {showEmailPreview ? (
                      <>
                        <ChevronUp className="h-4 w-4 mr-1" />
                        Hide Email Preview
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4 mr-1" />
                        Show Email Preview
                      </>
                    )}
                  </button>

                  {showEmailPreview && (
                    <div className="mt-2 p-4 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800">
                      <div
                        className="text-sm text-gray-900 dark:text-gray-100"
                        dangerouslySetInnerHTML={{ __html: renderEmailVisual(emailContent) }}
                      />
                    </div>
                  )}
                </div>
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
    </div>
  );
};

export default NotificationEmailModal;
