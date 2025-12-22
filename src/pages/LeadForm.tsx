import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { toast } from 'sonner';

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

interface LeadStatus {
  id: string;
  name: string;
  description: string;
  color: string;
  sort_order: number;
}

export function LeadForm() {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
  const [form, setForm] = useState<LeadForm | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [leadStatuses, setLeadStatuses] = useState<LeadStatus[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEmbedded, setIsEmbedded] = useState(false);

  useEffect(() => {
    // Check if page is loaded in an iframe
    setIsEmbedded(window.self !== window.top);
    
    if (formId) {
      fetchFormData();
      fetchLeadStatuses();
    }
  }, [formId]);

  const fetchLeadStatuses = async () => {
    try {
      const { data, error } = await supabase
        .from('lead_statuses')
        .select('*')
        .order('sort_order');

      if (error) throw error;
      setLeadStatuses(data);
    } catch (error) {
      console.error('Error fetching lead statuses:', error);
    }
  };

  const fetchFormData = async () => {
    try {
      setLoading(true);
      
      // Fetch form details
      const { data: formData, error: formError } = await supabase
        .from('lead_forms')
        .select('*')
        .eq('id', formId)
        .eq('is_active', true)
        .single();

      if (formError) throw formError;
      if (!formData) throw new Error('Form not found or inactive');

      setForm(formData);

      // Fetch form fields
      const { data: fieldsData, error: fieldsError } = await supabase
        .from('lead_form_fields')
        .select('*')
        .eq('form_id', formId)
        .order('sort_order');

      if (fieldsError) throw fieldsError;
      setFields(fieldsData);

    } catch (error) {
      console.error('Error fetching form data:', error);
      setError('Form not found or inactive');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (fieldName: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  const validateForm = () => {
    for (const field of fields) {
      if (field.is_required && (!formData[field.field_name] || formData[field.field_name] === '')) {
        toast.error(`${field.field_label} is required`);
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
      setSubmitting(true);
      
      // Get client IP and user agent
      const ipResponse = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipResponse.json();
      
      // Get the selected status or default to "Lead"
      const selectedStatusId = formData.lead_status || 
        (await supabase
          .from('lead_statuses')
          .select('id')
          .eq('name', 'Lead')
          .single()
        ).data?.id;

      const { error } = await supabase
        .from('leads')
        .insert({
          form_id: formId!,
          status_id: selectedStatusId,
          form_data: formData,
          source_url: document.referrer || window.location.href,
          ip_address: ipData.ip,
          user_agent: navigator.userAgent
        });

      if (error) throw error;

      setSubmitted(true);
      toast.success('Form submitted successfully!');
      
      // If embedded in iframe, send message to parent window
      if (isEmbedded && window.parent) {
        window.parent.postMessage({
          type: 'leadFormSubmitted',
          formId: formId,
          success: true
        }, '*');
      }
      
      // Redirect if URL is provided
      if (form?.redirect_url) {
        setTimeout(() => {
          if (isEmbedded && window.parent) {
            // For embedded forms, send redirect message to parent
            window.parent.postMessage({
              type: 'leadFormRedirect',
              url: form.redirect_url
            }, '*');
          } else {
            window.location.href = form.redirect_url;
          }
        }, 2000);
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error('Failed to submit form. Please try again.');
      
      // If embedded in iframe, send error message to parent window
      if (isEmbedded && window.parent) {
        window.parent.postMessage({
          type: 'leadFormError',
          formId: formId,
          error: error instanceof Error ? error.message : 'Unknown error'
        }, '*');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (field: FormField) => {
    const fieldId = `field-${field.id}`;
    const value = formData[field.field_name] || '';
    
    switch (field.field_type) {
      case 'text':
      case 'email':
      case 'phone':
      case 'url':
        return (
          <input
            type={field.field_type}
            id={fieldId}
            name={field.field_name}
            value={value}
            onChange={(e) => handleInputChange(field.field_name, e.target.value)}
            placeholder={field.placeholder}
            required={field.is_required}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors bg-white dark:bg-[#0F172A] text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
          />
        );
      case 'textarea':
        return (
          <textarea
            id={fieldId}
            name={field.field_name}
            value={value}
            onChange={(e) => handleInputChange(field.field_name, e.target.value)}
            placeholder={field.placeholder}
            required={field.is_required}
            rows={4}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors bg-white dark:bg-[#0F172A] text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
          />
        );
      case 'select':
        return (
          <select
            id={fieldId}
            name={field.field_name}
            value={value}
            onChange={(e) => handleInputChange(field.field_name, e.target.value)}
            required={field.is_required}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors bg-white dark:bg-[#0F172A] text-gray-900 dark:text-white"
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
                  checked={value === option}
                  onChange={(e) => handleInputChange(field.field_name, e.target.value)}
                  required={field.is_required}
                  className="mr-3 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-gray-700 dark:text-gray-300">{option}</span>
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
                  checked={Array.isArray(value) ? value.includes(option) : false}
                  onChange={(e) => {
                    const currentValues = Array.isArray(value) ? value : [];
                    if (e.target.checked) {
                      handleInputChange(field.field_name, [...currentValues, option]);
                    } else {
                      handleInputChange(field.field_name, currentValues.filter(v => v !== option));
                    }
                  }}
                  className="mr-3 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-gray-700 dark:text-gray-300">{option}</span>
              </label>
            ))}
          </div>
        );
      case 'number':
        return (
          <input
            type="number"
            id={fieldId}
            name={field.field_name}
            value={value}
            onChange={(e) => handleInputChange(field.field_name, e.target.value)}
            placeholder={field.placeholder}
            required={field.is_required}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors bg-white dark:bg-[#0F172A] text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
          />
        );
      case 'date':
        return (
          <input
            type="date"
            id={fieldId}
            name={field.field_name}
            value={value}
            onChange={(e) => handleInputChange(field.field_name, e.target.value)}
            onClick={(e) => e.currentTarget.showPicker?.()}
            required={field.is_required}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors bg-white dark:bg-[#0F172A] text-gray-900 dark:text-white"
          />
        );
      default:
        return <div>Unsupported field type</div>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0F172A]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading form...</p>
        </div>
      </div>
    );
  }

  if (error || !form) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0F172A]">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Form Not Found</h1>
          <p className="text-gray-600 dark:text-gray-400">This form is not available or has been deactivated.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0F172A]">
        <div className="text-center max-w-md mx-auto p-8">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Thank You!</h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-6">
            {form.success_message}
          </p>
          {form.redirect_url && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              You will be redirected shortly...
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0F172A] py-12">
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-white dark:bg-[#1E293B] rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {form.name}
            </h1>
            {form.description && (
              <p className="text-gray-600 dark:text-gray-400">
                {form.description}
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {fields.map((field) => (
              <div key={field.id}>
                <label 
                  htmlFor={`field-${field.id}`}
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  {field.field_label}
                  {field.is_required && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </label>
                {renderField(field)}
              </div>
            ))}

            <div className="pt-6">
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Submitting...
                  </>
                ) : (
                  'Submit'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
