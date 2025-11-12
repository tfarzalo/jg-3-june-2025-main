import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  X, 
  Send, 
  Image, 
  Eye, 
  EyeOff, 
  Check, 
  ChevronDown, 
  ChevronUp,
  Settings,
  FileText,
  Download,
  Plus,
  Trash2
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { toast } from 'sonner';

interface Job {
  id: string;
  work_order_num?: number;
  unit_number?: string;
  property?: {
    name: string;
    address: string;
    address_2?: string;
    city: string;
    state: string;
    zip: string;
    ap_email?: string;
  };
  job_type?: {
    label: string;
  };
  job_phase?: {
    label: string;
  };
  scheduled_date?: string;
  work_order?: {
    id: string;
    submission_date?: string;
    has_extra_charges?: boolean;
    extra_charges_description?: string;
    extra_hours?: number;
    has_sprinklers?: boolean;
    sprinklers_painted?: boolean;
  };
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  template_type: string;
  trigger_phase: string;
  auto_include_photos: boolean;
  photo_types: string[];
}

interface JobImage {
  id: string;
  file_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  image_type: string;
  created_at: string;
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
}

export function EnhancedPropertyNotificationModal({
  isOpen,
  onClose,
  job,
  notificationType,
  onSent
}: EnhancedPropertyNotificationModalProps) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [jobImages, setJobImages] = useState<JobImage[]>([]);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [emailConfig, setEmailConfig] = useState<EmailConfiguration | null>(null);
  
  const [recipientEmail, setRecipientEmail] = useState('');
  const [ccEmails, setCcEmails] = useState('');
  const [bccEmails, setBccEmails] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailContent, setEmailContent] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCCBCC, setShowCCBCC] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showImageSelector, setShowImageSelector] = useState(false);
  const [includeJobDetails, setIncludeJobDetails] = useState(true);
  const [includeWorkOrderDetails, setIncludeWorkOrderDetails] = useState(true);
  const [includeBillingDetails, setIncludeBillingDetails] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [apContactName, setApContactName] = useState('');

  useEffect(() => {
    if (isOpen && job) {
      fetchData();
      initializeEmails();
    }
  }, [isOpen, job, notificationType]);

  // Also initialize emails when the modal opens
  useEffect(() => {
    if (isOpen) {
      initializeEmails();
    }
  }, [isOpen]);

  const fetchData = async () => {
    if (!job) return;
    
    try {
      setLoading(true);
      
      // Fetch all available property notification templates
      const { data: templatesData, error: templatesError } = await supabase
        .from('email_templates')
        .select('*')
        .eq('template_category', 'property_notification')
        .eq('is_active', true)
        .order('name');

      if (templatesError) throw templatesError;
      setTemplates(templatesData || []);

      // Fetch job images
      const { data: imagesData, error: imagesError } = await supabase
        .from('job_images')
        .select('*')
        .eq('job_id', job.id)
        .order('created_at', { ascending: false });

      if (imagesError) throw imagesError;
      setJobImages(imagesData || []);

      // Fetch email configuration
      const { data: configData, error: configError } = await supabase
        .rpc('get_active_email_configuration');

      if (configError) throw configError;
      setEmailConfig(configData);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load email data');
    } finally {
      setLoading(false);
    }
  };

  const initializeEmails = () => {
    // Auto-populate recipient email with property AP contact if available
    console.log('=== INITIALIZING EMAILS ===');
    console.log('Job object:', job);
    console.log('Job property:', job?.property);
    console.log('Property ap_email:', job?.property?.ap_email);
    console.log('Property ap_name:', job?.property?.ap_name);
    console.log('Property keys:', job?.property ? Object.keys(job.property) : 'No property');
    console.log('Property values:', job?.property ? job.property : 'No property');
    console.log('Full job object structure:', JSON.stringify(job, null, 2));
    
    // Use ap_email column from property data
    const apEmail = job?.property?.ap_email;
    
    if (apEmail) {
      console.log('✅ Setting recipient email to:', apEmail);
      setRecipientEmail(apEmail);
    } else {
      console.log('❌ No AP email found, setting empty string');
      setRecipientEmail('');
    }
    
    // Use ap_name column from property data
    const apContactName = job?.property?.ap_name;
    
    if (apContactName) {
      console.log('✅ Setting AP contact name to:', apContactName);
      setApContactName(apContactName);
    } else {
      console.log('❌ No AP contact name found, setting empty string');
      setApContactName('');
    }
    
    setCcEmails('');
    setBccEmails('');
    setCurrentStep(1);
    console.log('=== EMAIL INITIALIZATION COMPLETE ===');
  };

  const processTemplate = (template: string, job: Job): string => {
    if (!template || !job) return template;

    const propertyAddress = `${job.property?.address || ''}${job.property?.address_2 ? `, ${job.property.address_2}` : ''}, ${job.property?.city || ''}, ${job.property?.state || ''} ${job.property?.zip || ''}`;
    const unitNumber = job.unit_number || 'N/A';
    const jobNumber = job.work_order_num ? `WO-${String(job.work_order_num).padStart(6, '0')}` : job.id.slice(0, 8);
    const workOrderNumber = job.work_order_num ? `WO-${String(job.work_order_num).padStart(6, '0')}` : 'N/A';
    const scheduledDate = job.scheduled_date ? new Date(job.scheduled_date).toLocaleDateString() : 'N/A';
    const completionDate = new Date().toLocaleDateString();
    const extraChargesDescription = job.work_order?.extra_charges_description || 'Additional work required';
    const extraHours = job.work_order?.extra_hours || 0;
    const estimatedCost = extraHours * 50; // $50/hour estimate

    const apContactName = job.property?.ap_name || 'Property Manager';
    
    return template
      .replace(/\{\{property_address\}\}/g, propertyAddress)
      .replace(/\{\{unit_number\}\}/g, unitNumber)
      .replace(/\{\{job_number\}\}/g, jobNumber)
      .replace(/\{\{work_order_number\}\}/g, workOrderNumber)
      .replace(/\{\{property_name\}\}/g, job.property?.name || propertyAddress)
      .replace(/\{\{ap_contact_name\}\}/g, apContactName)
      .replace(/\{\{job_type\}\}/g, job.job_type?.label || 'N/A')
      .replace(/\{\{scheduled_date\}\}/g, scheduledDate)
      .replace(/\{\{completion_date\}\}/g, completionDate)
      .replace(/\{\{extra_charges_description\}\}/g, extraChargesDescription)
      .replace(/\{\{extra_hours\}\}/g, extraHours.toString())
      .replace(/\{\{estimated_cost\}\}/g, estimatedCost.toFixed(2))
      .replace(/\{\{approval_button\}\}/g, generateApprovalButton());
  };

  const generateApprovalButton = () => {
    if (notificationType !== 'extra_charges') return '';
    
    return `
<div style="text-align: center; margin: 30px 0; padding: 20px; background-color: #f8f9fa; border-radius: 8px;">
  <h3 style="margin: 0 0 15px 0; color: #1f2937;">One-Click Approval</h3>
  <a href="{{approval_url}}" 
     style="display: inline-block; background-color: #22c55e; color: white; padding: 15px 30px; 
            text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;
            margin: 10px 0;">
    ✅ APPROVE EXTRA CHARGES
  </a>
  <p style="margin: 15px 0 5px 0; font-size: 14px; color: #6b7280;">
    Click the button above to approve these charges instantly and move the job to Work Order phase.
  </p>
  <p style="margin: 0; font-size: 12px; color: #9ca3af;">
    Secure link • Expires in 7 days • You'll receive confirmation after approval
  </p>
</div>`;
  };

  const handleTemplateSelect = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    if (job) {
      const processedSubject = processTemplate(template.subject, job);
      const processedBody = processTemplate(template.body, job);
      setEmailSubject(processedSubject);
      setEmailContent(processedBody);
    }
    setCurrentStep(2);
  };

  const handleImageToggle = (imageId: string) => {
    setSelectedImages(prev => 
      prev.includes(imageId) 
        ? prev.filter(id => id !== imageId)
        : [...prev, imageId]
    );
  };

  const generateJobDetailsSection = () => {
    if (!job || !includeJobDetails) return '';

    return `
**Job Information:**
• Work Order #: ${job.work_order_num ? `WO-${String(job.work_order_num).padStart(6, '0')}` : 'N/A'}
• Property: ${job.property?.name || 'N/A'}
• Address: ${job.property?.address || 'N/A'}${job.property?.address_2 ? `, ${job.property.address_2}` : ''}
• Unit: ${job.unit_number || 'N/A'}
• Job Type: ${job.job_type?.label || 'N/A'}
• Phase: ${job.job_phase?.label || 'N/A'}
• Scheduled Date: ${job.scheduled_date ? new Date(job.scheduled_date).toLocaleDateString() : 'N/A'}

`;
  };

  const generateWorkOrderDetailsSection = () => {
    if (!job?.work_order || !includeWorkOrderDetails) return '';

    return `
**Work Order Information:**
• Submission Date: ${job.work_order.submission_date ? new Date(job.work_order.submission_date).toLocaleDateString() : 'N/A'}
• Unit Occupied: ${job.work_order.is_occupied ? 'Yes' : 'No'}
• Full Paint: ${job.work_order.is_full_paint ? 'Yes' : 'No'}
• Extra Charges: ${job.work_order.has_extra_charges ? 'Yes' : 'No'}
• Extra Hours: ${job.work_order.extra_hours || '0'}
• Description: ${job.work_order.extra_charges_description || 'N/A'}

`;
  };

  const generateBillingDetailsSection = () => {
    if (!includeBillingDetails) return '';

    return `
**Billing Information:**
• Estimated Cost: $${(job?.work_order?.extra_hours || 0) * 50}
• Additional Hours: ${job?.work_order?.extra_hours || 0}
• Rate: $50/hour

`;
  };

  const handleSendEmail = async () => {
    if (!job || !recipientEmail || !emailContent || !emailSubject) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setSending(true);

      // Build final email content with selected sections
      let finalContent = emailContent;
      
      if (includeJobDetails) {
        finalContent += generateJobDetailsSection();
      }
      
      if (includeWorkOrderDetails) {
        finalContent += generateWorkOrderDetailsSection();
      }
      
      if (includeBillingDetails) {
        finalContent += generateBillingDetailsSection();
      }

      // Prepare email data
      const emailData = {
        to: recipientEmail,
        cc: ccEmails || undefined,
        bcc: bccEmails || emailConfig?.default_bcc_emails?.join(',') || undefined,
        subject: emailSubject,
        content: finalContent,
        job_id: job.id,
        template_type: notificationType,
        from_email: emailConfig?.from_email || 'no-reply@jgpaintingprosinc.com',
        from_name: emailConfig?.from_name || 'JG Painting Pros Inc.',
        has_attachments: selectedImages.length > 0,
        attachment_count: selectedImages.length
      };

      // Send email via Supabase function
      const { error: emailError } = await supabase.functions.invoke('send-email', {
        body: {
          to: emailData.to,
          cc: emailData.cc,
          bcc: emailData.bcc,
          subject: emailData.subject,
          html: emailData.content,
          from: `${emailData.from_name} <${emailData.from_email}>`
        }
      });

      if (emailError) throw emailError;

      // Log the notification
      const { data: logData, error: logError } = await supabase
        .from('email_logs')
        .insert({
          job_id: job.id,
          recipient_email: recipientEmail,
          cc_emails: ccEmails || null,
          bcc_emails: bccEmails || emailConfig?.default_bcc_emails?.join(',') || null,
          subject: emailSubject,
          content: finalContent,
          notification_type: notificationType,
          template_id: selectedTemplate?.id || null,
          from_email: emailData.from_email,
          from_name: emailData.from_name,
          has_attachments: selectedImages.length > 0,
          attachment_count: selectedImages.length
        })
        .select()
        .single();

      if (logError) throw logError;

      // Log attachments if any
      if (selectedImages.length > 0 && logData) {
        const attachmentData = selectedImages.map(imageId => {
          const image = jobImages.find(img => img.id === imageId);
          return {
            email_log_id: logData.id,
            job_image_id: imageId,
            attachment_type: 'image',
            file_path: image?.file_path || '',
            file_name: image?.file_name || '',
            file_size: image?.file_size || 0,
            mime_type: image?.mime_type || ''
          };
        });

        await supabase
          .from('email_attachments')
          .insert(attachmentData);
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
      case 'extra_charges':
        return 'Extra Charges Approval Request';
      case 'sprinkler_paint':
        return 'Sprinkler Paint Notification';
      case 'drywall_repairs':
        return 'Drywall Repairs Notification';
      default:
        return 'Property Notification';
    }
  };

  const getScenarioDescription = (template: EmailTemplate) => {
    switch (template.trigger_phase) {
      case 'extra_charges':
        return 'Use this template when requesting approval for additional charges only.';
      case 'sprinkler_paint':
        return 'Use this template when notifying about sprinkler paint work completion.';
      case 'drywall_repairs':
        return 'Use this template when notifying about drywall repair work completion.';
      case 'extra_charges_sprinkler':
        return 'Use this template when requesting approval for extra charges AND sprinkler paint work.';
      case 'extra_charges_drywall':
        return 'Use this template when requesting approval for extra charges AND drywall repairs.';
      case 'sprinkler_drywall':
        return 'Use this template when notifying about both sprinkler paint AND drywall repair work completion.';
      case 'all_combined':
        return 'Use this template when requesting approval for a complete work package (extra charges + sprinkler + drywall).';
      case 'general':
        return 'Use this template for general property work updates and communications.';
      default:
        return 'Property notification template.';
    }
  };

  const isApprovalTemplate = (template: EmailTemplate) => {
    return template.template_type === 'approval' || template.trigger_phase.includes('extra_charges');
  };

  const handleNextStep = () => {
    if (currentStep === 1 && selectedTemplate) {
      setCurrentStep(2);
    } else if (currentStep === 2 && recipientEmail) {
      setCurrentStep(3);
    }
  };

  const handlePreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const canProceedToNextStep = () => {
    if (currentStep === 1) return selectedTemplate !== null;
    if (currentStep === 2) return recipientEmail.trim() !== '';
    return false;
  };

  if (!job) {
    return null;
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
            Loading email data...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#1E293B] rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <Mail className="h-6 w-6 text-blue-600 mr-3" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {getNotificationTypeLabel()}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Step Progress Indicator */}
          <div className="mb-8">
            <div className="flex items-center justify-center space-x-4">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    currentStep >= step
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }`}>
                    {step}
                  </div>
                  <div className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    {step === 1 ? 'Select Template' : step === 2 ? 'Recipient & Images' : 'Review & Send'}
                  </div>
                  {step < 3 && (
                    <div className={`w-8 h-0.5 mx-4 ${
                      currentStep > step ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            {/* Step 1: Template Selection */}
            {currentStep === 1 && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/30 rounded-lg p-4 mb-6">
                <div className="flex items-center mb-4">
                  <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Step 1: Select Email Template
                  </h3>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                  Choose the appropriate template based on your notification scenario. The template will determine the content and whether an approval button is included.
                </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-all duration-200 ${
                      selectedTemplate?.id === template.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 shadow-md'
                        : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 hover:shadow-sm'
                    }`}
                    onClick={() => handleTemplateSelect(template)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h4 className="font-medium text-gray-900 dark:text-white text-base">
                        {template.name}
                      </h4>
                      <div className="flex items-center gap-2 ml-2">
                        {template.auto_include_photos && (
                          <Image className="h-4 w-4 text-blue-500" title="Auto-includes photos" />
                        )}
                        {isApprovalTemplate(template) && (
                          <span className="px-2 py-1 text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-full font-medium">
                            APPROVAL
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="mb-3">
                      <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                        template.trigger_phase === 'extra_charges' 
                          ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          : template.trigger_phase === 'sprinkler_paint'
                          ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                          : template.trigger_phase === 'drywall_repairs'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
                          : template.trigger_phase.includes('extra_charges')
                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                      }`}>
                        {template.trigger_phase.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </div>
                    
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 font-medium">
                      Subject: {template.subject}
                    </p>
                    
                    <p className="text-xs text-gray-500 dark:text-gray-500 leading-relaxed">
                      {getScenarioDescription(template)}
                    </p>
                  </div>
                ))}
              </div>
              
              {selectedTemplate && (
                <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700/30 rounded-lg">
                  <div className="flex items-center">
                    <Check className="h-4 w-4 text-green-600 dark:text-green-400 mr-2" />
                    <span className="text-sm font-medium text-green-800 dark:text-green-200">
                      Template Selected: {selectedTemplate.name}
                    </span>
                  </div>
                  <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                    {isApprovalTemplate(selectedTemplate) 
                      ? 'This template includes an approval button for the recipient to approve charges.'
                      : 'This template is for notification purposes only - no approval required.'
                    }
                  </p>
                </div>
              )}
              </div>
            )}

            {/* Step 2: Recipient & Images */}
            {currentStep === 2 && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700/30 rounded-lg p-4 mb-6">
                <div className="flex items-center mb-4">
                  <Settings className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Step 2: Recipient & Images
                  </h3>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                  Verify recipient information and select images to include with the email.
                </p>

                {/* Selected Template Summary */}
                {selectedTemplate && (
                  <div className="mb-6 p-3 bg-white dark:bg-gray-800 rounded-lg border">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          Selected Template: {selectedTemplate.name}
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {selectedTemplate.subject}
                        </p>
                      </div>
                      <button
                        onClick={() => setCurrentStep(1)}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                      >
                        Change Template
                      </button>
                    </div>
                  </div>
                )}

                {/* Recipient Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      To: <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      placeholder="Enter recipient email"
                      required
                    />
                    {apContactName && (
                      <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center">
                        <Check className="h-3 w-3 mr-1" />
                        Auto-populated from AP Contact (ap_name): {apContactName}
                      </p>
                    )}
                    {!apContactName && recipientEmail && (
                      <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                        ⚠️ No AP contact name (ap_name) found - email will use generic greeting
                      </p>
                    )}
                    {!recipientEmail && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        No AP contact email (ap_email) found - please enter recipient email manually
                      </p>
                    )}
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
                            onChange={(e) => setCcEmails(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                            placeholder="cc1@example.com, cc2@example.com"
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
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                            placeholder="bcc1@example.com, bcc2@example.com"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Image Selection */}
                {jobImages.length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Attach Images ({selectedImages.length} selected)
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowImageSelector(!showImageSelector)}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                      >
                        {showImageSelector ? 'Hide Images' : 'Select Images'}
                      </button>
                    </div>
                    
                    {showImageSelector && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-h-48 overflow-y-auto">
                        {jobImages.map((image) => (
                          <div
                            key={image.id}
                            className={`relative border rounded-lg overflow-hidden cursor-pointer transition-colors ${
                              selectedImages.includes(image.id)
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                            }`}
                            onClick={() => handleImageToggle(image.id)}
                          >
                            <div className="aspect-square bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                              <Image className="h-8 w-8 text-gray-400" />
                            </div>
                            <div className="p-2">
                              <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                                {image.file_name}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-500">
                                {image.image_type}
                              </p>
                            </div>
                            {selectedImages.includes(image.id) && (
                              <div className="absolute top-1 right-1 bg-blue-500 text-white rounded-full p-1">
                                <Check className="h-3 w-3" />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Content Options */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Include in Email:
                  </h3>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={includeJobDetails}
                        onChange={(e) => setIncludeJobDetails(e.target.checked)}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Job Details</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={includeWorkOrderDetails}
                        onChange={(e) => setIncludeWorkOrderDetails(e.target.checked)}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Work Order Details</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={includeBillingDetails}
                        onChange={(e) => setIncludeBillingDetails(e.target.checked)}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Billing Details</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Review & Send */}
            {currentStep === 3 && (
              <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700/30 rounded-lg p-4 mb-6">
                <div className="flex items-center mb-4">
                  <Eye className="h-5 w-5 text-purple-600 dark:text-purple-400 mr-2" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Step 3: Review & Send
                  </h3>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                  Review the final email content and send when ready.
                </p>

                {/* Email Subject */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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

                {/* Email Content */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Email Content
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPreview(!showPreview)}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center"
                    >
                      {showPreview ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                      {showPreview ? 'Hide Preview' : 'Show Preview'}
                    </button>
                  </div>
                  
                  {showPreview ? (
                    <div className="border border-gray-300 dark:border-gray-600 rounded-md p-4 bg-gray-50 dark:bg-gray-800 max-h-64 overflow-y-auto">
                      <div className="prose prose-sm max-w-none dark:prose-invert">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                          Subject: {emailSubject}
                        </h4>
                        <div className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                          {emailContent}
                          {includeJobDetails && generateJobDetailsSection()}
                          {includeWorkOrderDetails && generateWorkOrderDetailsSection()}
                          {includeBillingDetails && generateBillingDetailsSection()}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <textarea
                      value={emailContent}
                      onChange={(e) => setEmailContent(e.target.value)}
                      rows={8}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      placeholder="Email content will be populated from selected template..."
                    />
                  )}
                </div>
              </div>
            )}


            {/* Actions */}
            <div className="flex justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
              <div>
                {currentStep > 1 && (
                  <button
                    type="button"
                    onClick={handlePreviousStep}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center"
                  >
                    <ChevronUp className="h-4 w-4 mr-2 rotate-90" />
                    Previous
                  </button>
                )}
              </div>
              
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                
                {currentStep < 3 ? (
                  <button
                    onClick={handleNextStep}
                    disabled={!canProceedToNextStep()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
                  >
                    Next
                    <ChevronDown className="h-4 w-4 ml-2 rotate-90" />
                  </button>
                ) : (
                  <button
                    onClick={handleSendEmail}
                    disabled={sending || !selectedTemplate || !recipientEmail || !emailContent || !emailSubject}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center"
                  >
                    {sending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Send Notification
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
