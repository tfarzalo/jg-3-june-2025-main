import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Save, 
  Eye, 
  Code, 
  Copy, 
  Settings,
  Type,
  Mail,
  Phone,
  Calendar,
  Hash,
  Link,
  CheckSquare,
  Circle,
  List,
  FileText,
  AlertCircle,
  X,
  Edit,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { toast } from 'sonner';
import { useUnsavedChangesPrompt } from '../hooks/useUnsavedChangesPrompt';

interface FormField {
  id: string;
  field_type: string;
  field_name: string;
  field_label: string;
  placeholder: string;
  is_required: boolean;
  options: string[];
  validation_rules: any;
  sort_order: number;
}

interface LeadForm {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  success_message: string;
  redirect_url: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

const FIELD_TYPES = [
  { value: 'text', label: 'Text Input', icon: Type, description: 'Single line text input' },
  { value: 'email', label: 'Email', icon: Mail, description: 'Email address input' },
  { value: 'phone', label: 'Phone', icon: Phone, description: 'Phone number input' },
  { value: 'textarea', label: 'Text Area', icon: FileText, description: 'Multi-line text input' },
  { value: 'select', label: 'Dropdown', icon: List, description: 'Single selection dropdown' },
  { value: 'radio', label: 'Radio Buttons', icon: Circle, description: 'Single selection radio buttons' },
  { value: 'checkbox', label: 'Checkboxes', icon: CheckSquare, description: 'Multiple selection checkboxes' },
  { value: 'number', label: 'Number', icon: Hash, description: 'Numeric input' },
  { value: 'date', label: 'Date', icon: Calendar, description: 'Date picker' },
  { value: 'url', label: 'URL', icon: Link, description: 'Website URL input' },
];

export function LeadFormBuilder() {
  const [forms, setForms] = useState<LeadForm[]>([]);
  const [selectedForm, setSelectedForm] = useState<LeadForm | null>(null);
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'builder' | 'preview' | 'embed'>('builder');
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  
  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [successMessage, setSuccessMessage] = useState('Thank you for your submission!');
  const [redirectUrl, setRedirectUrl] = useState('');
  const [isFormActive, setIsFormActive] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);
  const { attemptNavigate } = useUnsavedChangesPrompt(hasChanges, async () => {
    if (selectedForm) {
      await updateForm();
    } else {
      await createForm();
    }
  });

  // Field state
  const [newField, setNewField] = useState<Partial<FormField>>({
    field_type: 'text',
    field_name: '',
    field_label: '',
    placeholder: '',
    is_required: false,
    options: [],
    validation_rules: {},
    sort_order: 0
  });

  useEffect(() => {
    fetchForms();
  }, []);

  useEffect(() => {
    if (selectedForm) {
      fetchFormFields(selectedForm.id);
    }
  }, [selectedForm]);

  const fetchForms = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('lead_forms')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setForms(data);
    } catch (error) {
      console.error('Error fetching forms:', error);
      toast.error('Failed to fetch forms');
    } finally {
      setLoading(false);
    }
  };

  const fetchFormFields = async (formId: string) => {
    try {
      const { data, error } = await supabase
        .from('lead_form_fields')
        .select('*')
        .eq('form_id', formId)
        .order('sort_order');

      if (error) throw error;
      setFormFields(data);
    } catch (error) {
      console.error('Error fetching form fields:', error);
      toast.error('Failed to fetch form fields');
    }
  };

  const createForm = async () => {
    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('lead_forms')
        .insert({
          name: formName,
          description: formDescription,
          success_message: successMessage,
          redirect_url: redirectUrl,
          is_active: isFormActive,
          created_by: user.id
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Form created successfully');
      setSelectedForm(data);
      setFormName('');
      setFormDescription('');
      setSuccessMessage('Thank you for your submission!');
      setRedirectUrl('');
      setIsFormActive(true);
      fetchForms();
    } catch (error) {
      console.error('Error creating form:', error);
      toast.error('Failed to create form');
    } finally {
      setSaving(false);
    }
  };

  const updateForm = async () => {
    if (!selectedForm) return;

    try {
      setSaving(true);
      const { error } = await supabase
        .from('lead_forms')
        .update({
          name: formName,
          description: formDescription,
          success_message: successMessage,
          redirect_url: redirectUrl,
          is_active: isFormActive,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedForm.id);

      if (error) throw error;

      toast.success('Form updated successfully');
      fetchForms();
    } catch (error) {
      console.error('Error updating form:', error);
      toast.error('Failed to update form');
    } finally {
      setSaving(false);
    }
  };

  const addField = async () => {
    if (!selectedForm || !newField.field_name || !newField.field_label) {
      toast.error('Please fill in field name and label');
      return;
    }

    try {
      setSaving(true);
      const { data, error } = await supabase
        .from('lead_form_fields')
        .insert({
          form_id: selectedForm.id,
          field_type: newField.field_type!,
          field_name: newField.field_name,
          field_label: newField.field_label,
          placeholder: newField.placeholder || '',
          is_required: newField.is_required || false,
          options: newField.options || [],
          validation_rules: newField.validation_rules || {},
          sort_order: formFields.length
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Field added successfully');
      setNewField({
        field_type: 'text',
        field_name: '',
        field_label: '',
        placeholder: '',
        is_required: false,
        options: [],
        validation_rules: {},
        sort_order: 0
      });
      fetchFormFields(selectedForm.id);
    } catch (error) {
      console.error('Error adding field:', error);
      toast.error('Failed to add field');
    } finally {
      setSaving(false);
    }
  };

  const deleteField = async (fieldId: string) => {
    try {
      const { error } = await supabase
        .from('lead_form_fields')
        .delete()
        .eq('id', fieldId);

      if (error) throw error;

      toast.success('Field deleted successfully');
      if (selectedForm) {
        fetchFormFields(selectedForm.id);
      }
    } catch (error) {
      console.error('Error deleting field:', error);
      toast.error('Failed to delete field');
    }
  };

  const deleteForm = async (formId: string) => {
    const confirmed = window.confirm(
      'Are you sure you want to delete this form? This will also delete all associated fields and submissions. This action cannot be undone.'
    );

    if (!confirmed) return;

    try {
      setSaving(true);
      const { error } = await supabase
        .from('lead_forms')
        .delete()
        .eq('id', formId);

      if (error) throw error;

      toast.success('Form deleted successfully');
      setSelectedForm(null);
      fetchForms();
    } catch (error) {
      console.error('Error deleting form:', error);
      toast.error('Failed to delete form');
    } finally {
      setSaving(false);
    }
  };

  const startEditingField = (field: FormField) => {
    setEditingFieldId(field.id);
    setNewField({
      field_type: field.field_type,
      field_name: field.field_name,
      field_label: field.field_label,
      placeholder: field.placeholder,
      is_required: field.is_required,
      options: field.options,
      validation_rules: field.validation_rules,
      sort_order: field.sort_order
    });
  };

  const cancelEditingField = () => {
    setEditingFieldId(null);
    setNewField({
      field_type: 'text',
      field_name: '',
      field_label: '',
      placeholder: '',
      is_required: false,
      options: [],
      validation_rules: {},
      sort_order: 0
    });
  };

  const updateField = async () => {
    if (!editingFieldId || !newField.field_name || !newField.field_label) {
      toast.error('Please fill in field name and label');
      return;
    }

    try {
      setSaving(true);
      const { error } = await supabase
        .from('lead_form_fields')
        .update({
          field_type: newField.field_type!,
          field_name: newField.field_name,
          field_label: newField.field_label,
          placeholder: newField.placeholder || '',
          is_required: newField.is_required || false,
          options: newField.options || [],
          validation_rules: newField.validation_rules || {}
        })
        .eq('id', editingFieldId);

      if (error) throw error;

      toast.success('Field updated successfully');
      cancelEditingField();
      if (selectedForm) {
        fetchFormFields(selectedForm.id);
      }
    } catch (error) {
      console.error('Error updating field:', error);
      toast.error('Failed to update field');
    } finally {
      setSaving(false);
    }
  };

  const moveFieldUp = async (fieldId: string, currentOrder: number) => {
    if (currentOrder === 0) return;

    try {
      const prevField = formFields.find(f => f.sort_order === currentOrder - 1);
      if (!prevField) return;

      // Swap sort orders
      await supabase
        .from('lead_form_fields')
        .update({ sort_order: currentOrder })
        .eq('id', prevField.id);

      await supabase
        .from('lead_form_fields')
        .update({ sort_order: currentOrder - 1 })
        .eq('id', fieldId);

      if (selectedForm) {
        fetchFormFields(selectedForm.id);
      }
    } catch (error) {
      console.error('Error moving field:', error);
      toast.error('Failed to reorder field');
    }
  };

  const moveFieldDown = async (fieldId: string, currentOrder: number) => {
    if (currentOrder === formFields.length - 1) return;

    try {
      const nextField = formFields.find(f => f.sort_order === currentOrder + 1);
      if (!nextField) return;

      // Swap sort orders
      await supabase
        .from('lead_form_fields')
        .update({ sort_order: currentOrder })
        .eq('id', nextField.id);

      await supabase
        .from('lead_form_fields')
        .update({ sort_order: currentOrder + 1 })
        .eq('id', fieldId);

      if (selectedForm) {
        fetchFormFields(selectedForm.id);
      }
    } catch (error) {
      console.error('Error moving field:', error);
      toast.error('Failed to reorder field');
    }
  };

  const generateEmbedCode = () => {
    if (!selectedForm) return '';

    const formId = selectedForm.id;
    const baseUrl = window.location.origin;
    
    return `<!-- Lead Form Embed Code -->
<!-- Option 1: Iframe Embed (Recommended) -->
<iframe 
  id="jg-lead-form-${formId}"
  src="${baseUrl}/lead-form/${formId}" 
  width="100%" 
  height="700" 
  frameborder="0"
  style="border: 1px solid #e5e7eb; border-radius: 8px; max-width: 600px;">
</iframe>

<script>
// Listen for form submission events from the iframe
window.addEventListener('message', function(event) {
  // Verify the origin if needed: if (event.origin !== '${baseUrl}') return;
  
  if (event.data.type === 'leadFormSubmitted') {
    console.log('Lead form submitted successfully!', event.data);
    // Add your custom code here (e.g., track conversion, show thank you message)
  } else if (event.data.type === 'leadFormError') {
    console.error('Lead form error:', event.data.error);
  } else if (event.data.type === 'leadFormRedirect') {
    window.location.href = event.data.url;
  }
}, false);
</script>

<!-- Option 2: Direct Link -->
<a href="${baseUrl}/lead-form/${formId}" target="_blank" style="display: inline-block; padding: 12px 24px; background-color: #8B5CF6; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Fill Out Form</a>`;
  };

  const copyEmbedCode = () => {
    const embedCode = generateEmbedCode();
    navigator.clipboard.writeText(embedCode);
    toast.success('Embed code copied to clipboard');
  };

  const renderFieldPreview = (field: FormField) => {
    const fieldId = `field-${field.id}`;
    
    switch (field.field_type) {
      case 'text':
      case 'email':
      case 'phone':
      case 'url':
        return (
          <input
            type={field.field_type}
            id={fieldId}
            placeholder={field.placeholder}
            required={field.is_required}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        );
      case 'textarea':
        return (
          <textarea
            id={fieldId}
            placeholder={field.placeholder}
            required={field.is_required}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        );
      case 'select':
        return (
          <select
            id={fieldId}
            required={field.is_required}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="">Select an option</option>
            {field.options.map((option, index) => (
              <option key={index} value={option}>{option}</option>
            ))}
          </select>
        );
      case 'radio':
        return (
          <div className="space-y-2">
            {field.options.map((option, index) => (
              <label key={index} className="flex items-center">
                <input
                  type="radio"
                  name={field.field_name}
                  value={option}
                  required={field.is_required}
                  className="mr-2"
                />
                {option}
              </label>
            ))}
          </div>
        );
      case 'checkbox':
        return (
          <div className="space-y-2">
            {field.options.map((option, index) => (
              <label key={index} className="flex items-center">
                <input
                  type="checkbox"
                  name={field.field_name}
                  value={option}
                  className="mr-2"
                />
                {option}
              </label>
            ))}
          </div>
        );
      case 'number':
        return (
          <input
            type="number"
            id={fieldId}
            placeholder={field.placeholder}
            required={field.is_required}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        );
      case 'date':
        return (
          <input
            type="date"
            id={fieldId}
            required={field.is_required}
            onClick={(e) => e.currentTarget.showPicker?.()}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        );
      default:
        return <div>Unsupported field type</div>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Lead Form Builder
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Create and manage lead capture forms
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => attemptNavigate(() => window.history.back())}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 rounded-lg"
          >
            Back
          </button>
        <button
          onClick={() => {
            setSelectedForm(null);
            setFormName('');
            setFormDescription('');
            setSuccessMessage('Thank you for your submission!');
            setRedirectUrl('');
            setIsFormActive(true);
            setFormFields([]);
          }}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Form
        </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Forms List */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Forms
              </h3>
            </div>
            <div className="p-4 space-y-2">
              {forms.map((form) => (
                <div
                  key={form.id}
                  className={`p-3 rounded-lg transition-colors ${
                    selectedForm?.id === form.id
                      ? 'bg-purple-100 dark:bg-purple-900 border border-purple-300 dark:border-purple-700'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div 
                      onClick={() => setSelectedForm(form)}
                      className="flex-1 cursor-pointer"
                    >
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        {form.name}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {form.description || 'No description'}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${
                        form.is_active ? 'bg-green-500' : 'bg-gray-400'
                      }`} />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteForm(form.id);
                        }}
                        className="p-1 text-red-600 hover:text-red-800 hover:bg-red-100 dark:hover:bg-red-900 rounded"
                        title="Delete form"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Form Builder */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-gray-700">
              <nav className="flex space-x-8 px-6">
                {[
                  { id: 'builder', label: 'Builder', icon: Settings },
                  { id: 'preview', label: 'Preview', icon: Eye },
                  { id: 'embed', label: 'Embed', icon: Code }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === tab.id
                        ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                  >
                    <tab.icon className="h-4 w-4 mr-2" />
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            <div className="p-6">
              {activeTab === 'builder' && (
                <div className="space-y-6">
                  {/* Form Settings */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Form Settings
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Form Name *
                        </label>
                        <input
                          type="text"
                          value={formName}
                          onChange={(e) => { setFormName(e.target.value); setHasChanges(true); }}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder="Enter form name"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Description
                        </label>
                        <input
                          type="text"
                          value={formDescription}
                          onChange={(e) => { setFormDescription(e.target.value); setHasChanges(true); }}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder="Enter form description"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Success Message
                        </label>
                        <input
                          type="text"
                          value={successMessage}
                          onChange={(e) => { setSuccessMessage(e.target.value); setHasChanges(true); }}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder="Thank you for your submission!"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Redirect URL
                        </label>
                        <input
                          type="url"
                          value={redirectUrl}
                          onChange={(e) => { setRedirectUrl(e.target.value); setHasChanges(true); }}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder="https://example.com/thank-you"
                        />
                      </div>
                    </div>
                    <div className="mt-4">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={isFormActive}
                          onChange={(e) => { setIsFormActive(e.target.checked); setHasChanges(true); }}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          Form is active
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Form Actions */}
                  <div className="flex space-x-4">
                    {selectedForm ? (
                      <button
                        onClick={updateForm}
                        disabled={saving || !formName}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg flex items-center"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {saving ? 'Saving...' : 'Update Form'}
                      </button>
                    ) : (
                      <button
                        onClick={createForm}
                        disabled={saving || !formName}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg flex items-center"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {saving ? 'Creating...' : 'Create Form'}
                      </button>
                    )}
                  </div>

                  {/* Add/Edit Field */}
                  {selectedForm && (
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {editingFieldId ? 'Edit Field' : 'Add Field'}
                        </h3>
                        {editingFieldId && (
                          <button
                            onClick={cancelEditingField}
                            className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white flex items-center"
                          >
                            <X className="h-4 w-4 mr-1" />
                            Cancel
                          </button>
                        )}
                      </div>
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Field Type
                            </label>
                            <select
                              value={newField.field_type}
                              onChange={(e) => setNewField({ ...newField, field_type: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            >
                              {FIELD_TYPES.map((type) => (
                                <option key={type.value} value={type.value}>
                                  {type.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Field Name *
                            </label>
                            <input
                              type="text"
                              value={newField.field_name}
                              onChange={(e) => setNewField({ ...newField, field_name: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              placeholder="e.g., first_name"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Field Label *
                            </label>
                            <input
                              type="text"
                              value={newField.field_label}
                              onChange={(e) => setNewField({ ...newField, field_label: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              placeholder="e.g., First Name"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Placeholder
                            </label>
                            <input
                              type="text"
                              value={newField.placeholder}
                              onChange={(e) => setNewField({ ...newField, placeholder: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              placeholder="Enter placeholder text"
                            />
                          </div>
                        </div>

                        {/* Options for select, radio, checkbox */}
                        {['select', 'radio', 'checkbox'].includes(newField.field_type!) && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Options (one per line)
                            </label>
                            <textarea
                              value={newField.options?.join('\n') || ''}
                              onChange={(e) => setNewField({ 
                                ...newField, 
                                options: e.target.value.split('\n').filter(opt => opt.trim()) 
                              })}
                              rows={4}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              placeholder="Option 1&#10;Option 2&#10;Option 3"
                            />
                          </div>
                        )}

                        <div className="flex items-center space-x-4">
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={newField.is_required}
                              onChange={(e) => setNewField({ ...newField, is_required: e.target.checked })}
                              className="mr-2"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              Required field
                            </span>
                          </label>
                        </div>

                        <div className="flex space-x-2">
                          <button
                            onClick={editingFieldId ? updateField : addField}
                            disabled={saving || !newField.field_name || !newField.field_label}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg flex items-center"
                          >
                            {editingFieldId ? (
                              <>
                                <Save className="h-4 w-4 mr-2" />
                                Update Field
                              </>
                            ) : (
                              <>
                                <Plus className="h-4 w-4 mr-2" />
                                Add Field
                              </>
                            )}
                          </button>
                          {editingFieldId && (
                            <button
                              onClick={cancelEditingField}
                              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg flex items-center"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Form Fields List */}
                  {selectedForm && formFields.length > 0 && (
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Form Fields
                      </h3>
                      <div className="space-y-3">
                        {formFields.map((field, index) => (
                          <div
                            key={field.id}
                            className={`flex items-center justify-between p-3 rounded-lg ${
                              editingFieldId === field.id
                                ? 'bg-purple-100 dark:bg-purple-900 border border-purple-300 dark:border-purple-700'
                                : 'bg-gray-50 dark:bg-gray-700'
                            }`}
                          >
                            <div className="flex items-center space-x-3 flex-1">
                              <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
                                {React.createElement(FIELD_TYPES.find(t => t.value === field.field_type)?.icon || Type, { className: "h-4 w-4 text-purple-600 dark:text-purple-400" })}
                              </div>
                              <div className="flex-1">
                                <div className="font-medium text-gray-900 dark:text-white">
                                  {field.field_label}
                                </div>
                                <div className="text-sm text-gray-600 dark:text-gray-400">
                                  {field.field_name} • {field.field_type}
                                  {field.is_required && ' • Required'}
                                  {field.options && field.options.length > 0 && ` • ${field.options.length} options`}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-1">
                              {/* Reorder buttons */}
                              <button
                                onClick={() => moveFieldUp(field.id, index)}
                                disabled={index === 0}
                                className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-200 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-600 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Move up"
                              >
                                <ChevronUp className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => moveFieldDown(field.id, index)}
                                disabled={index === formFields.length - 1}
                                className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-200 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-600 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Move down"
                              >
                                <ChevronDown className="h-4 w-4" />
                              </button>
                              {/* Edit button */}
                              <button
                                onClick={() => startEditingField(field)}
                                className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900 rounded"
                                title="Edit field"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              {/* Delete button */}
                              <button
                                onClick={() => deleteField(field.id)}
                                className="p-1 text-red-600 hover:text-red-800 hover:bg-red-100 dark:hover:bg-red-900 rounded"
                                title="Delete field"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'preview' && selectedForm && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Form Preview
                  </h3>
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 bg-gray-50 dark:bg-gray-900">
                    <h4 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                      {selectedForm.name}
                    </h4>
                    {selectedForm.description && (
                      <p className="text-gray-600 dark:text-gray-400 mb-6">
                        {selectedForm.description}
                      </p>
                    )}
                    <form className="space-y-4">
                      {formFields.map((field) => (
                        <div key={field.id}>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {field.field_label}
                            {field.is_required && <span className="text-red-500 ml-1">*</span>}
                          </label>
                          {renderFieldPreview(field)}
                        </div>
                      ))}
                      <button
                        type="submit"
                        className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
                      >
                        Submit
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {activeTab === 'embed' && selectedForm && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Embed Code
                  </h3>
                  <div className="space-y-4">
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Embed Code
                        </span>
                        <button
                          onClick={copyEmbedCode}
                          className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded flex items-center"
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Copy
                        </button>
                      </div>
                      <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-x-auto">
                        <code>{generateEmbedCode()}</code>
                      </pre>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      <p className="mb-2">
                        <strong>Instructions:</strong>
                      </p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>Copy the embed code above</li>
                        <li>Paste it into your website's HTML where you want the form to appear</li>
                        <li>The form will automatically load and handle submissions</li>
                        <li>Submissions will be stored in your contacts database</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
