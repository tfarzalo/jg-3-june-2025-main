import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  Mail, 
  Image, 
  Settings,
  Eye,
  EyeOff
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { toast } from 'sonner';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string; // Will be used for the introduction paragraph
  signature: string;
  template_type: string;
  trigger_phase: string;
  template_category: string;
  included_sections: string[]; // New field for checkboxes
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface EmailConfiguration {
  id: string;
  from_email: string;
  from_name: string;
  default_bcc_emails: string[];
  is_active: boolean;
}

interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
}

export function EmailTemplateManager() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [config, setConfig] = useState<EmailConfiguration | null>(null);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);

  // Template form state
  const [templateForm, setTemplateForm] = useState({
    name: '',
    subject: '',
    body: '', // This will now be the 'introduction'
    signature: '',
    template_type: 'approval',
    trigger_phase: 'extra_charges',
    template_category: 'property_notification',
    included_sections: [] as string[],
    is_active: true
  });

  // Refs for text inputs to handle cursor position
  const subjectInputRef = useRef<HTMLInputElement>(null);

  // Configuration form state
  const [configForm, setConfigForm] = useState({
    from_email: '',
    from_name: '',
    default_bcc_emails: [] as string[],
    bcc_input: ''
  });

  const templateTypes = [
    { value: 'approval', label: 'Approval Request' },
    { value: 'notification', label: 'Property Notification' }
  ];

  const triggerPhases = [
    { value: 'extra_charges', label: 'Extra Charges Only' },
    { value: 'sprinkler_paint', label: 'Sprinkler Paint Only' },
    { value: 'drywall_repairs', label: 'Drywall Repairs Only' },
    { value: 'extra_charges_sprinkler', label: 'Extra Charges + Sprinkler Paint' },
    { value: 'extra_charges_drywall', label: 'Extra Charges + Drywall Repairs' },
    { value: 'sprinkler_drywall', label: 'Sprinkler Paint + Drywall Repairs' },
    { value: 'all_combined', label: 'All Combined (Extra Charges + Sprinkler + Drywall)' },
    { value: 'general', label: 'General Property Notification' }
  ];

  const contentSections = [
    { value: 'job_details_table', label: 'Job Details Table' },
    { value: 'extra_charges_table', label: 'Extra Charges Table' },
    { value: 'before_images', label: 'Before Photos' },
    { value: 'sprinkler_images', label: 'Sprinkler Photos' },
    { value: 'other_images', label: 'Other Photos' }
  ];

  const templateVariables = [
    { variable: '{{job_number}}', description: 'Job number (e.g., WO-000123)' },
    { variable: '{{property_name}}', description: 'Property name' },
    { variable: '{{property_address}}', description: 'Full property address' },
    { variable: '{{unit_number}}', description: 'Unit number' },
    { variable: '{{ap_contact_name}}', description: 'AP Contact name for personalization' },
    { variable: '{{approval_link}}', description: 'Approval link URL (extra charges only)' },
    { variable: '{{approval_button}}', description: 'Approval button (extra charges only)' },
    { variable: '{{extra_charges_description}}', description: 'Extra charges description' },
    { variable: '{{extra_hours}}', description: 'Extra charges hours (legacy)' },
    { variable: '{{estimated_cost}}', description: 'Estimated extra charges amount (plain number)' },
    { variable: '{{extra_charges.bill_amount}}', description: 'Extra charges amount (formatted)' },
    { variable: '{{extra_charges.bill_amount_plain}}', description: 'Extra charges amount (plain number)' },
    { variable: '{{extra_charges.sub_pay_amount}}', description: 'Extra charges sub pay amount (formatted)' },
    { variable: '{{extra_charges.profit_amount}}', description: 'Extra charges profit amount (formatted)' },
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch templates
      const { data: templatesData, error: templatesError } = await supabase
        .from('email_templates')
        .select('*')
        .eq('template_category', 'property_notification')
        .order('template_type', { ascending: true })
        .order('name', { ascending: true });

      if (templatesError) throw templatesError;
      setTemplates(templatesData || []);

      // Fetch admin and management users (same query as DailyAgendaEmailSettings)
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('id, email, full_name, role')
        .in('role', ['admin', 'manager'])
        .order('full_name', { ascending: true });

      if (usersError) {
        console.error('Error fetching admin users:', usersError);
      }
      
      setAdminUsers(usersData || []);

      // Fetch email configuration
      const { data: configData, error: configError } = await supabase
        .from('email_configurations')
        .select('*')
        .eq('is_active', true)
        .single();

      if (configError && configError.code !== 'PGRST116') throw configError;
      
      if (configData) {
        setConfig(configData);
        setConfigForm({
          from_email: configData.from_email,
          from_name: configData.from_name,
          default_bcc_emails: configData.default_bcc_emails || [],
          bcc_input: ''
        });
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load email settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async () => {
    try {
      setSaving(true);
      
      const templateData = {
        name: templateForm.name,
        subject: templateForm.subject,
        body: templateForm.body,
        signature: templateForm.signature,
        template_type: templateForm.template_type,
        trigger_phase: templateForm.trigger_phase,
        template_category: templateForm.template_category,
        included_sections: templateForm.included_sections,
        is_active: templateForm.is_active,
      };

      if (editingTemplate) {
        const { error } = await supabase
          .from('email_templates')
          .update(templateData)
          .eq('id', editingTemplate.id);

        if (error) throw error;
        toast.success('Template updated successfully');
      } else {
        const { error } = await supabase
          .from('email_templates')
          .insert([templateData]);

        if (error) throw error;
        toast.success('Template created successfully');
      }

      setShowTemplateForm(false);
      setEditingTemplate(null);
      resetTemplateForm();
      fetchData();
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      const { error } = await supabase
        .from('email_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;
      toast.success('Template deleted successfully');
      fetchData();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Failed to delete template');
    }
  };

  const handleSaveConfiguration = async () => {
    try {
      setSaving(true);
      
      const configData = {
        from_email: configForm.from_email,
        from_name: configForm.from_name,
        default_bcc_emails: configForm.default_bcc_emails
      };

      if (config) {
        const { error } = await supabase
          .from('email_configurations')
          .update(configData)
          .eq('id', config.id);

        if (error) throw error;
        toast.success('Email configuration updated successfully');
      } else {
        const { error } = await supabase
          .from('email_configurations')
          .insert([configData]);

        if (error) throw error;
        toast.success('Email configuration created successfully');
      }

      fetchData();
    } catch (error) {
      console.error('Error saving configuration:', error);
      toast.error('Failed to save email configuration');
    } finally {
      setSaving(false);
    }
  };

  const resetTemplateForm = () => {
    setTemplateForm({
      name: '',
      subject: '',
      body: '',
      signature: '',
      template_type: 'approval',
      trigger_phase: 'extra_charges',
      template_category: 'property_notification',
      included_sections: [],
      is_active: true
    });
  };

  const handleEditTemplate = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name,
      subject: template.subject,
      body: template.body,
      signature: template.signature || '',
      template_type: template.template_type,
      trigger_phase: template.trigger_phase,
      template_category: template.template_category,
      included_sections: template.included_sections || [],
      is_active: template.is_active
    });
    setShowTemplateForm(true);
  };

  const handleAddBccEmail = () => {
    if (configForm.bcc_input.trim()) {
      // Check if email already exists
      if (!configForm.default_bcc_emails.includes(configForm.bcc_input.trim())) {
        setConfigForm(prev => ({
          ...prev,
          default_bcc_emails: [...prev.default_bcc_emails, prev.bcc_input.trim()],
          bcc_input: ''
        }));
      } else {
        toast.error('This email is already in the list');
      }
    }
  };

  const handleRemoveBccEmail = (index: number) => {
    setConfigForm(prev => ({
      ...prev,
      default_bcc_emails: prev.default_bcc_emails.filter((_, i) => i !== index)
    }));
  };

  const handleToggleAdminEmail = (email: string) => {
    setConfigForm(prev => {
      const isCurrentlySelected = prev.default_bcc_emails.includes(email);
      
      if (isCurrentlySelected) {
        // Remove the email
        return {
          ...prev,
          default_bcc_emails: prev.default_bcc_emails.filter(e => e !== email)
        };
      } else {
        // Add the email
        return {
          ...prev,
          default_bcc_emails: [...prev.default_bcc_emails, email]
        };
      }
    });
  };

  const isAdminEmailSelected = (email: string) => {
    return configForm.default_bcc_emails.includes(email);
  };

  const handleContentSectionChange = (sectionValue: string, checked: boolean) => {
    setTemplateForm(prev => {
      const newIncludedSections = checked
        ? [...prev.included_sections, sectionValue]
        : prev.included_sections.filter(sec => sec !== sectionValue);
      
      return {
        ...prev,
        included_sections: newIncludedSections
      };
    });
  };

  const insertVariable = (variable: string, field: 'subject' | 'body' = 'body') => {
    if (field === 'subject') {
      const element = subjectInputRef.current;
      if (element) {
        const start = element.selectionStart || 0;
        const end = element.selectionEnd || 0;
        const currentValue = templateForm.subject;
        
        // Insert the variable at cursor position
        const newValue = currentValue.substring(0, start) + variable + currentValue.substring(end);
        
        setTemplateForm(prev => ({
          ...prev,
          subject: newValue
        }));
        
        // Set cursor position after the inserted variable
        setTimeout(() => {
          const newCursorPos = start + variable.length;
          element.setSelectionRange(newCursorPos, newCursorPos);
          element.focus();
        }, 0);
      } else {
        // Fallback: append to end
        setTemplateForm(prev => ({
          ...prev,
          subject: prev.subject + variable
        }));
      }
    } else {
      // For body field, append to the textarea
      setTemplateForm(prev => ({
        ...prev,
        body: prev.body + variable
      }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Email Configuration */}
      <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
        <div className="flex items-center mb-6">
          <Settings className="h-6 w-6 text-blue-600 mr-3" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Email Configuration
          </h2>
        </div>

        {/* Sender Information Section */}
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Email Sender Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                From Email Address
              </label>
              <input
                type="email"
                value={configForm.from_email}
                onChange={(e) => setConfigForm(prev => ({ ...prev, from_email: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="no-reply@jgpaintingprosinc.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                From Name
              </label>
              <input
                type="text"
                value={configForm.from_name}
                onChange={(e) => setConfigForm(prev => ({ ...prev, from_name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="JG Painting Pros Inc."
              />
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="my-8 border-t border-gray-200 dark:border-gray-700"></div>

        {/* Notification Recipients Section */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Approval/Decline Notification Recipients</h3>
          
          {/* Info Banner */}
          <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              </div>
              <div className="ml-3">
                <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  Extra Charges Approval/Decline Notifications
                </h4>
                <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                  Configure the <strong>Internal Notification Emails</strong> below to receive automatic notifications when property owners approve or decline Extra Charges. 
                  This keeps your team informed in real-time without having to check the system manually.
                </p>
              </div>
            </div>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Any Admin or JG Management role user that is listed below and has the toggle set to <strong>Yes</strong> will receive the accept/decline notifications from jobs where an approval is required.
          </p>

          {/* Admin/Management Users List - matching Daily Agenda style */}
          {adminUsers.length > 0 ? (
            <div className="mb-4 border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#0F172A]">
                    <th className="text-left p-4 font-semibold text-gray-900 dark:text-white">User Name</th>
                    <th className="text-left p-4 font-semibold text-gray-900 dark:text-white">Email</th>
                    <th className="text-left p-4 font-semibold text-gray-900 dark:text-white">Role</th>
                    <th className="text-left p-4 font-semibold text-gray-900 dark:text-white">Receive Notifications</th>
                  </tr>
                </thead>
                <tbody>
                  {adminUsers.map((user) => (
                    <tr key={user.id} className="border-b border-gray-200 dark:border-gray-700 last:border-b-0">
                      <td className="p-4 text-gray-900 dark:text-white">{user.full_name || 'No Name'}</td>
                      <td className="p-4 text-gray-600 dark:text-gray-400">{user.email}</td>
                      <td className="p-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                          {user.role === 'admin' ? 'Admin' : user.role === 'management' ? 'Management' : user.role}
                        </span>
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => handleToggleAdminEmail(user.email)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                            isAdminEmailSelected(user.email) ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                          }`}
                          aria-label={`Toggle notifications for ${user.full_name || user.email}`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              isAdminEmailSelected(user.email) ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mb-4 text-center py-8 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800/50">
              <p>No admin or management users found</p>
              <p className="text-xs mt-1">Users with "admin" or "management" roles will appear here</p>
            </div>
          )}

          {/* Manual Email Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Add Other Email Addresses
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="email"
                value={configForm.bcc_input}
                onChange={(e) => setConfigForm(prev => ({ ...prev, bcc_input: e.target.value }))}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="Add other emails (e.g., office@company.com)"
                onKeyPress={(e) => e.key === 'Enter' && handleAddBccEmail()}
              />
              <button
                type="button"
                onClick={handleAddBccEmail}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Add
              </button>
            </div>
            {configForm.default_bcc_emails.length > 0 ? (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {configForm.default_bcc_emails.map((email, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full text-sm"
                    >
                      ✓ {email}
                      <button
                        type="button"
                        onClick={() => handleRemoveBccEmail(index)}
                        className="ml-2 text-green-600 hover:text-red-500 dark:text-green-300"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </span>
                  ))}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  ✅ {configForm.default_bcc_emails.length} email{configForm.default_bcc_emails.length !== 1 ? 's' : ''} will receive approval/decline notifications
                </p>
              </div>
            ) : (
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  ⚠️ No internal notification emails configured. Add at least one email address to receive approval/decline notifications.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSaveConfiguration}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Configuration
              </>
            )}
          </button>
        </div>
      </div>

      {/* Email Templates */}
      <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Mail className="h-6 w-6 text-blue-600 mr-3" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Property Notification Email Templates
            </h2>
          </div>
          <button
            onClick={() => {
              resetTemplateForm();
              setEditingTemplate(null);
              setShowTemplateForm(true);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Template
          </button>
        </div>

        {/* Templates List */}
        <div className="space-y-4">
          {templates.map((template) => (
            <div
              key={template.id}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-2">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                      {template.name}
                    </h3>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      template.template_type === 'approval' 
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                        : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    }`}>
                      {template.template_type === 'approval' ? 'Approval' : 'Notification'}
                    </span>
                    <span className={`px-2 py-1 text-xs rounded-full ${
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
                      {triggerPhases.find(tp => tp.value === template.trigger_phase)?.label || template.trigger_phase.replace('_', ' ').toUpperCase()}
                    </span>
                    {template.included_sections && template.included_sections.length > 0 && (
                      <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 rounded-full flex items-center">
                        <Settings className="h-3 w-3 mr-1" />
                        {template.included_sections.length} sections
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 mb-2">
                    Subject: {template.subject}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-500 line-clamp-2">
                    {template.body.substring(0, 150)}...
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => {
                      setPreviewTemplate(template);
                      setShowPreview(true);
                    }}
                    className="p-2 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400"
                    title="Preview"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleEditTemplate(template)}
                    className="p-2 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400"
                    title="Edit"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteTemplate(template.id)}
                    className="p-2 text-gray-500 hover:text-red-600 dark:hover:text-red-400"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Template Form Modal */}
      {showTemplateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1E293B] rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {editingTemplate ? 'Edit Template' : 'New Template'}
                </h3>
                <button
                  onClick={() => {
                    setShowTemplateForm(false);
                    setEditingTemplate(null);
                    resetTemplateForm();
                  }}
                  className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Basic Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Template Name
                    </label>
                    <input
                      type="text"
                      value={templateForm.name}
                      onChange={(e) => setTemplateForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      placeholder="e.g., Extra Charges - Professional"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Template Type
                    </label>
                    <select
                      value={templateForm.template_type}
                      onChange={(e) => setTemplateForm(prev => ({ ...prev, template_type: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    >
                      {templateTypes.map(type => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Template Category
                    </label>
                    <select
                      value={templateForm.trigger_phase}
                      onChange={(e) => setTemplateForm(prev => ({ ...prev, trigger_phase: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    >
                      {triggerPhases.map(phase => (
                        <option key={phase.value} value={phase.value}>
                          {phase.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      This helps categorize the template. All templates will be available for selection when sending notifications.
                    </p>
                  </div>

                  <div className="flex items-center pt-6">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={templateForm.is_active}
                        onChange={(e) => setTemplateForm(prev => ({ ...prev, is_active: e.target.checked }))}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                        Is Active
                      </span>
                    </label>
                  </div>
                </div>

                {/* Content Sections to Include */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Content to Include on Page
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    Select which sections to show on the public approval or notification page.
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    {contentSections.map(section => (
                      <label key={section.value} className="flex items-center p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                        <input
                          type="checkbox"
                          checked={templateForm.included_sections.includes(section.value)}
                          onChange={(e) => handleContentSectionChange(section.value, e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="ml-3 text-sm text-gray-700 dark:text-gray-300">
                          {section.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email Subject
                  </label>
                  <input
                    ref={subjectInputRef}
                    type="text"
                    value={templateForm.subject}
                    onChange={(e) => setTemplateForm(prev => ({ ...prev, subject: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="e.g., Extra Charges Approval Request - Job #{{job_number}}"
                  />
                  
                  {/* Subject Variables */}
                  <div className="mt-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Click to insert in subject:</p>
                    <div className="flex flex-wrap gap-1">
                      {templateVariables.map(variable => (
                        <button
                          key={variable.variable}
                          type="button"
                          onClick={() => insertVariable(variable.variable, 'subject')}
                          className="px-2 py-1 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded hover:bg-blue-200 dark:hover:bg-blue-800"
                          title={variable.description}
                        >
                          {variable.variable}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Introduction Content */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Introduction Paragraph
                    </label>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    This is the first paragraph of the email. The link to review and approve will be automatically added after this.
                  </p>
                  
                  <div className="flex flex-wrap gap-1 mb-2">
                    {templateVariables.map(variable => (
                      <button
                        key={variable.variable}
                        type="button"
                        onClick={() => insertVariable(variable.variable, 'body')}
                        className="px-2 py-1 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded hover:bg-blue-200 dark:hover:bg-blue-800"
                        title={variable.description}
                      >
                        {variable.variable}
                      </button>
                    ))}
                  </div>

                  <textarea
                    value={templateForm.body}
                    onChange={(e) => setTemplateForm(prev => ({ ...prev, body: e.target.value }))}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="Enter the introductory paragraph for the email. The selected content sections will be added below this."
                  ></textarea>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Signature
                  </label>
                  <textarea
                    value={templateForm.signature}
                    onChange={(e) => setTemplateForm(prev => ({ ...prev, signature: e.target.value }))}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder={'Best regards,\nJG Painting Pros Inc.'}
                  ></textarea>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => {
                      setShowTemplateForm(false);
                      setEditingTemplate(null);
                      resetTemplateForm();
                    }}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveTemplate}
                    disabled={saving || !templateForm.name || !templateForm.subject || !templateForm.body}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
                  >
                    {saving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        {editingTemplate ? 'Update Template' : 'Create Template'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && previewTemplate && (() => {
        // Process template variables with sample data
        const processTemplateForPreview = (template: EmailTemplate): { subject: string; body: string } => {
          // Sample data
          const sampleData = {
            property_address: '123 Main St, Apt 2B, Anytown, CA 12345',
            unit_number: '205',
            job_number: 'WO-000123',
            work_order_number: 'WO-000123',
            property_name: 'Sunset Apartments',
            ap_contact_name: 'John Smith',
            job_type: 'Unit Turn',
            scheduled_date: new Date().toLocaleDateString(),
            completion_date: new Date().toLocaleDateString(),
            extra_charges_description: 'Additional drywall repair work required',
            extra_hours: '3.5',
            estimated_cost: '175.00'
          };

          const generateReviewLink = () => {
            const linkText = template.template_type === 'approval'
              ? 'Click here to review and approve'
              : 'Click here to review the details';
            
            return `<p style="margin: 20px 0; font-size: 16px; text-align: left;">
              <a href="#preview" style="font-weight: bold; text-decoration: underline; color: #2563eb;">${linkText}</a>
            </p>`;
          };

          const generateSampleImages = (title: string, emoji: string, count: number = 2) => {
            if (count === 0) return '';
            
            const imageHtmlParts = Array.from({ length: count }, (_, i) => {
              const imageUrl = `https://via.placeholder.com/200x200/3b82f6/ffffff?text=${title.replace(' ', '+')}+${i + 1}`;
              return `
        <a href="${imageUrl}" target="_blank" style="display: inline-block; text-decoration: none; margin: 8px;">
          <img src="${imageUrl}" alt="${title}" style="width: 200px; height: 200px; object-fit: cover; border-radius: 8px; border: 2px solid #e5e7eb; box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: all 0.3s;" />
          <p style="margin: 6px 0 0 0; font-size: 12px; color: #6b7280; text-align: center; font-weight: 500;">${title} ${i + 1} - Click to view full size</p>
        </a>`;
            }).join('');
            
            return `
<div style="margin: 25px 0; padding: 20px; background-color: #f9fafb; border-radius: 12px; border: 1px solid #e5e7eb;">
  <h3 style="color: #374151; margin: 0 0 16px 0; font-size: 18px; font-weight: bold;">${emoji} ${title} (${count})</h3>
  <div style="text-align: center; line-height: 0;">
    ${imageHtmlParts}
  </div>
  <p style="margin: 12px 0 0 0; font-size: 12px; color: #9ca3af; text-align: center; font-style: italic;">Click any image to view in full resolution</p>
</div>`;
          };

          const generateSampleExtraChargesTable = () => {
            return `
<div style="margin: 25px 0; padding: 20px; background-color: #fef3c7; border-radius: 12px; border: 2px solid #fbbf24;">
  <h3 style="color: #92400e; margin: 0 0 16px 0; font-size: 18px; font-weight: bold;">💰 Extra Charges Breakdown</h3>
  <table style="width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <thead>
      <tr style="background-color: #fbbf24;">
        <th style="padding: 12px; text-align: left; color: #78350f; font-weight: bold; border-bottom: 2px solid #f59e0b;">Description</th>
        <th style="padding: 12px; text-align: right; color: #78350f; font-weight: bold; border-bottom: 2px solid #f59e0b;">Hours</th>
        <th style="padding: 12px; text-align: right; color: #78350f; font-weight: bold; border-bottom: 2px solid #f59e0b;">Cost</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #374151;">Additional drywall repair work</td>
        <td style="padding: 12px; text-align: right; border-bottom: 1px solid #e5e7eb; color: #374151;">3.5</td>
        <td style="padding: 12px; text-align: right; border-bottom: 1px solid #e5e7eb; color: #374151; font-weight: 600;">$175.00</td>
      </tr>
      <tr style="background-color: #fffbeb;">
        <td style="padding: 12px; font-weight: bold; color: #78350f;">Total</td>
        <td style="padding: 12px; text-align: right; font-weight: bold; color: #78350f;">3.5</td>
        <td style="padding: 12px; text-align: right; font-weight: bold, color: #78350f; font-size: 16px;">$175.00</td>
      </tr>
    </tbody>
  </table>
</div>`;
          };

          const generateSampleJobDetailsTable = () => {
            return `
<div style="margin: 25px 0; padding: 20px; background-color: #dbeafe; border-radius: 12px; border: 2px solid #3b82f6;">
  <h3 style="color: #1e3a8a; margin: 0 0 16px 0; font-size: 18px; font-weight: bold;">📋 Job Details</h3>
  <table style="width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <tbody>
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-weight: 600; width: 40%;">Property</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #374151;">Sunset Apartments</td>
      </tr>
      <tr style="background-color: #f9fafb;">
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-weight: 600;">Address</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #374151;">123 Main St, Anytown, CA 12345</td>
      </tr>
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-weight: 600;">Unit</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #374151;">205</td>
      </tr>
      <tr style="background-color: #f9fafb;">
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-weight: 600;">Job Type</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #374151;">Unit Turn</td>
      </tr>
      <tr>
        <td style="padding: 12px; color: #6b7280; font-weight: 600;">Work Order</td>
        <td style="padding: 12px; color: #374151; font-weight: bold;">WO-000123</td>
      </tr>
    </tbody>
  </table>
</div>`;
          };

          // Process subject
          let processedSubject = template.subject;
          Object.entries(sampleData).forEach(([key, value]) => {
            const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
            processedSubject = processedSubject.replace(regex, value);
          });

          // Process body
          let processedBody = template.body;
          
          // Replace simple variables
          Object.entries(sampleData).forEach(([key, value]) => {
            const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
            processedBody = processedBody.replace(regex, value);
          });

          // Add the review link
          processedBody += generateReviewLink();

          // Generate a summary of what will be on the page
          let pageContentSummary = '<div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">';
          pageContentSummary += '<h4 style="font-size: 16px; font-weight: bold; color: #374151; margin-bottom: 10px;">The following sections will be included on the page:</h4>';
          pageContentSummary += '<ul style="list-style-type: disc; padding-left: 20px; color: #4b5563;">';
          
          if (template.included_sections && template.included_sections.length > 0) {
            template.included_sections.forEach(sectionKey => {
              const section = contentSections.find(s => s.value === sectionKey);
              if (section) {
                pageContentSummary += `<li style="margin-bottom: 5px;">${section.label}</li>`;
              }
            });
          } else {
            pageContentSummary += '<li>No additional sections selected.</li>';
          }

          pageContentSummary += '</ul></div>';

          processedBody += pageContentSummary;

          return { subject: processedSubject, body: processedBody };
        };

        const { subject, body } = processTemplateForPreview(previewTemplate);

        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-[#1E293B] rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Template Preview: {previewTemplate.name}
                  </h3>
                  <button
                    onClick={() => setShowPreview(false)}
                    className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Subject:
                    </label>
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md text-gray-900 dark:text-gray-100">
                      {subject}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Content Preview:
                    </label>
                    <div 
                      className="p-4 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 overflow-auto"
                      style={{ 
                        minHeight: '400px',
                        maxHeight: '600px',
                        lineHeight: '1.6'
                      }}
                      dangerouslySetInnerHTML={{ __html: body }}
                    />
                  </div>

                  <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      <strong>Note:</strong> This is a preview with sample data. Actual emails will use real job data, images, and links.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
