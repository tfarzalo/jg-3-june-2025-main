import React, { useState, useEffect } from 'react';
import { Building2, X, Save, Loader2 } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { toast } from 'sonner';

interface CreatePropertyFromContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  contactId: string;
  contactData: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    address: any;
  };
  onSuccess: (propertyId: string) => void;
}

export function CreatePropertyFromContactModal({
  isOpen,
  onClose,
  contactId,
  contactData,
  onSuccess
}: CreatePropertyFromContactModalProps) {
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    property_name: '',
    address: contactData.address?.street || '',
    address_2: '',
    city: contactData.address?.city || '',
    state: contactData.address?.state || '',
    zip: contactData.address?.zip || '',
    phone: contactData.phone || '',
    primary_contact_name: `${contactData.first_name} ${contactData.last_name}`.trim(),
    primary_contact_phone: contactData.phone || '',
    primary_contact_role: 'Primary Contact',
    ap_email: contactData.email || '',
  });

  useEffect(() => {
    if (isOpen) {
      // Pre-fill form data when modal opens
      setFormData({
        property_name: '',
        address: contactData.address?.street || '',
        address_2: '',
        city: contactData.address?.city || '',
        state: contactData.address?.state || '',
        zip: contactData.address?.zip || '',
        phone: contactData.phone || '',
        primary_contact_name: `${contactData.first_name} ${contactData.last_name}`.trim(),
        primary_contact_phone: contactData.phone || '',
        primary_contact_role: 'Primary Contact',
        ap_email: contactData.email || '',
      });
    }
  }, [isOpen, contactData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.property_name.trim()) {
      toast.error('Property name is required');
      return;
    }
    
    if (!formData.address.trim()) {
      toast.error('Property address is required');
      return;
    }

    setLoading(true);

    try {
      // Create property
      const { data: property, error: propertyError } = await supabase
        .from('properties')
        .insert([{
          property_name: formData.property_name,
          address: formData.address,
          address_2: formData.address_2,
          city: formData.city,
          state: formData.state,
          zip: formData.zip,
          phone: formData.phone,
          property_management_group_id: null,
          primary_contact_name: formData.primary_contact_name,
          primary_contact_phone: formData.primary_contact_phone,
          primary_contact_role: formData.primary_contact_role,
          ap_email: formData.ap_email,
        }])
        .select()
        .single();

      if (propertyError) throw propertyError;

      // Link contact to property
      const { error: linkError } = await supabase
        .from('contacts')
        .update({ property_id: property.id })
        .eq('id', contactId);

      if (linkError) {
        console.error('Error linking contact to property:', linkError);
        toast.warning('Property created but contact link failed');
      }

      // Update lead status to "Customer"
      const { data: leadData } = await supabase
        .from('contacts')
        .select('lead_id')
        .eq('id', contactId)
        .single();

      if (leadData?.lead_id) {
        // Get "Customer" status ID
        const { data: statusData } = await supabase
          .from('lead_statuses')
          .select('id')
          .eq('name', 'Customer')
          .single();

        if (statusData) {
          await supabase
            .from('leads')
            .update({ status_id: statusData.id })
            .eq('id', leadData.lead_id);
        }
      }

      toast.success('Property created successfully! Contact status updated to Customer.');
      onSuccess(property.id);
      onClose();
    } catch (err) {
      console.error('Error creating property:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to create property');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <Building2 className="h-6 w-6 text-purple-600 mr-3" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Create Property from Contact
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Info Banner */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Note:</strong> This will create a new property using the contact's information and automatically update the contact status to "Customer".
            </p>
          </div>

          {/* Property Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Property Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.property_name}
              onChange={(e) => setFormData({ ...formData, property_name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Enter property name"
              required
            />
          </div>

          {/* Address */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Street Address <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Street address"
                required
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Address Line 2
              </label>
              <input
                type="text"
                value={formData.address_2}
                onChange={(e) => setFormData({ ...formData, address_2: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Apt, suite, unit, etc."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                City
              </label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="City"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                State
              </label>
              <input
                type="text"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="State"
                maxLength={2}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                ZIP Code
              </label>
              <input
                type="text"
                value={formData.zip}
                onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="ZIP"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Phone
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Property phone"
              />
            </div>
          </div>

          {/* Primary Contact Info */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-4">
              Primary Contact Information
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Contact Name
                </label>
                <input
                  type="text"
                  value={formData.primary_contact_name}
                  onChange={(e) => setFormData({ ...formData, primary_contact_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Contact name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Contact Phone
                </label>
                <input
                  type="tel"
                  value={formData.primary_contact_phone}
                  onChange={(e) => setFormData({ ...formData, primary_contact_phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Contact phone"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Contact Role
                </label>
                <input
                  type="text"
                  value={formData.primary_contact_role}
                  onChange={(e) => setFormData({ ...formData, primary_contact_role: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="e.g., Property Manager"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  AP Email
                </label>
                <input
                  type="email"
                  value={formData.ap_email}
                  onChange={(e) => setFormData({ ...formData, ap_email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Accounts payable email"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Create Property
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
