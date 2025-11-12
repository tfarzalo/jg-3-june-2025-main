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
  body: string;
  template_type: string;
  trigger_phase: string;
  template_category: string;
  auto_include_photos: boolean;
  photo_types: string[];
  tags?: string[];
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

export function EmailTemplateManager() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [config, setConfig] = useState<EmailConfiguration | null>(null);
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
    body: '',
    template_type: 'approval',
    trigger_phase: 'extra_charges',
    template_category: 'property_notification',
    auto_include_photos: false,
    photo_types: [] as string[],
    is_active: true
  });

  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Refs for text inputs to handle cursor position
  const subjectInputRef = useRef<HTMLInputElement>(null);
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);

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

  const photoTypes = [
    { value: 'before', label: 'Before Photos' },
    { value: 'after', label: 'After Photos' },
    { value: 'sprinkler', label: 'Sprinkler Photos' },
    { value: 'repair', label: 'Repair Photos' },
    { value: 'other', label: 'Other Photos' }
  ];

  const availableTags = [
    { value: 'extra_charges', label: 'Extra Charges', color: 'red' },
    { value: 'sprinkler_paint', label: 'Sprinkler Paint', color: 'orange' },
    { value: 'drywall_repairs', label: 'Drywall Repairs', color: 'amber' },
    { value: 'approval', label: 'Approval Required', color: 'green' },
    { value: 'notification', label: 'Notification Only', color: 'blue' },
    { value: 'urgent', label: 'Urgent', color: 'purple' },
    { value: 'follow_up', label: 'Follow Up', color: 'indigo' }
  ];

  const templateVariables = [
    { variable: '{{job_number}}', description: 'Job number (e.g., WO-000123)' },
    { variable: '{{work_order_number}}', description: 'Work order number' },
    { variable: '{{property_name}}', description: 'Property name' },
    { variable: '{{property_address}}', description: 'Full property address' },
    { variable: '{{unit_number}}', description: 'Unit number' },
    { variable: '{{ap_contact_name}}', description: 'AP Contact name (from ap_name column) for personalization' },
    { variable: '{{job_type}}', description: 'Job type' },
    { variable: '{{scheduled_date}}', description: 'Scheduled date' },
    { variable: '{{completion_date}}', description: 'Completion date' },
    { variable: '{{extra_charges_description}}', description: 'Extra charges description' },
    { variable: '{{extra_hours}}', description: 'Extra hours' },
    { variable: '{{estimated_cost}}', description: 'Estimated cost' },
    { variable: '{{approval_button}}', description: 'Approval button HTML (for approval emails)' }
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
        ...templateForm,
        photo_types: templateForm.photo_types,
        tags: selectedTags
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
      template_type: 'approval',
      trigger_phase: 'extra_charges',
      template_category: 'property_notification',
      auto_include_photos: false,
      photo_types: [],
      is_active: true
    });
    setSelectedTags([]);
  };

  const handleEditTemplate = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name,
      subject: template.subject,
      body: template.body,
      template_type: template.template_type,
      trigger_phase: template.trigger_phase,
      template_category: template.template_category,
      auto_include_photos: template.auto_include_photos,
      photo_types: template.photo_types,
      is_active: template.is_active
    });
    setSelectedTags(template.tags || []);
    setShowTemplateForm(true);
  };

  const handleAddBccEmail = () => {
    if (configForm.bcc_input.trim()) {
      setConfigForm(prev => ({
        ...prev,
        default_bcc_emails: [...prev.default_bcc_emails, prev.bcc_input.trim()],
        bcc_input: ''
      }));
    }
  };

  const handleRemoveBccEmail = (index: number) => {
    setConfigForm(prev => ({
      ...prev,
      default_bcc_emails: prev.default_bcc_emails.filter((_, i) => i !== index)
    }));
  };

  const handlePhotoTypeChange = (photoType: string, checked: boolean) => {
    setTemplateForm(prev => ({
      ...prev,
      photo_types: checked 
        ? [...prev.photo_types, photoType]
        : prev.photo_types.filter(type => type !== photoType)
    }));
  };

  const handleTagToggle = (tagValue: string) => {
    setSelectedTags(prev => 
      prev.includes(tagValue) 
        ? prev.filter(tag => tag !== tagValue)
        : [...prev, tagValue]
    );
  };

  const getTagColor = (color: string) => {
    const colors = {
      red: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      orange: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
      green: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      indigo: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200'
    };
    return colors[color as keyof typeof colors] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  };

  const insertVariable = (variable: string, field: 'subject' | 'body' = 'body') => {
    const ref = field === 'subject' ? subjectInputRef : bodyTextareaRef;
    const element = ref.current;
    
    if (element) {
      const start = element.selectionStart || 0;
      const end = element.selectionEnd || 0;
      const currentValue = field === 'subject' ? templateForm.subject : templateForm.body;
      
      // Insert the variable at cursor position
      const newValue = currentValue.substring(0, start) + variable + currentValue.substring(end);
      
      setTemplateForm(prev => ({
        ...prev,
        [field]: newValue
      }));
      
      // Set cursor position after the inserted variable
      setTimeout(() => {
        const newCursorPos = start + variable.length;
        element.setSelectionRange(newCursorPos, newCursorPos);
        element.focus();
      }, 0);
    } else {
      // Fallback: append to end if refs not available
      setTemplateForm(prev => ({
        ...prev,
        [field]: prev[field] + variable
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

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Default BCC Emails
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="email"
                value={configForm.bcc_input}
                onChange={(e) => setConfigForm(prev => ({ ...prev, bcc_input: e.target.value }))}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="Enter BCC email address"
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
            {configForm.default_bcc_emails.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {configForm.default_bcc_emails.map((email, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-full text-sm"
                  >
                    {email}
                    <button
                      type="button"
                      onClick={() => handleRemoveBccEmail(index)}
                      className="ml-2 text-gray-500 hover:text-red-500"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </span>
                ))}
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
                    {template.auto_include_photos && (
                      <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 rounded-full flex items-center">
                        <Image className="h-3 w-3 mr-1" />
                        Photos
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {template.tags && template.tags.length > 0 ? (
                      template.tags.map((tag, index) => {
                        const tagInfo = availableTags.find(t => t.value === tag);
                        return (
                          <span
                            key={index}
                            className={`px-2 py-1 text-xs rounded-full ${getTagColor(tagInfo?.color || 'gray')}`}
                          >
                            {tagInfo?.label || tag}
                          </span>
                        );
                      })
                    ) : (
                      <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 rounded-full">
                        No tags
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
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

                  <div className="flex items-center">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={templateForm.auto_include_photos}
                        onChange={(e) => setTemplateForm(prev => ({ ...prev, auto_include_photos: e.target.checked }))}
                        className="mr-2"
                      />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Auto-include photos
                      </span>
                    </label>
                  </div>
                </div>

                {/* Template Tags */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Template Tags
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    Select multiple tags to categorize this template. These help users identify the template's purpose.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {availableTags.map(tag => (
                      <button
                        key={tag.value}
                        type="button"
                        onClick={() => handleTagToggle(tag.value)}
                        className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                          selectedTags.includes(tag.value)
                            ? `${getTagColor(tag.color)} border-current`
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        {tag.label}
                      </button>
                    ))}
                  </div>
                  {selectedTags.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Selected: {selectedTags.map(tag => availableTags.find(t => t.value === tag)?.label).join(', ')}
                      </p>
                    </div>
                  )}
                </div>

                {/* Photo Types */}
                {templateForm.auto_include_photos && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Photo Types to Include
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {photoTypes.map(photoType => (
                        <label key={photoType.value} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={templateForm.photo_types.includes(photoType.value)}
                            onChange={(e) => handlePhotoTypeChange(photoType.value, e.target.checked)}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {photoType.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

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
                      {templateVariables.slice(0, 6).map(variable => (
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

                {/* Content */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Email Content
                    </label>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Click variables below to insert them
                    </div>
                  </div>
                  
                  {/* Template Variables */}
                  <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Click to insert in email body:
                    </div>
                    <div className="flex flex-wrap gap-2">
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
                  </div>

                  <textarea
                    ref={bodyTextareaRef}
                    value={templateForm.body}
                    onChange={(e) => setTemplateForm(prev => ({ ...prev, body: e.target.value }))}
                    rows={12}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white font-mono text-sm"
                    placeholder="Enter your email template content here..."
                  />
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3">
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
      {showPreview && previewTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1E293B] rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
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
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                    {previewTemplate.subject}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Content:
                  </label>
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-md whitespace-pre-wrap">
                    {previewTemplate.body}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
