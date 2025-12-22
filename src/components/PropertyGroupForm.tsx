import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, User, Phone, Mail, MapPin, Plus, X, Check } from 'lucide-react';
import { supabase } from '@/utils/supabase';

export function PropertyGroupForm() {
  const navigate = useNavigate();
  const { groupId } = useParams<{ groupId: string }>();
  const isEditMode = Boolean(groupId);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(isEditMode);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    company_name: '',
    address: '',
    address_2: '',
    city: '',
    state: '',
    zip: '',
    contact_name: '',
    contact_phone: '',
    contact_email: ''
  });
  
  // Property management state
  const [availableProperties, setAvailableProperties] = useState<any[]>([]);
  const [associatedProperties, setAssociatedProperties] = useState<any[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(false);

  // Load data for edit mode
  useEffect(() => {
    if (isEditMode && groupId) {
      fetchPropertyGroup();
      fetchAvailableProperties();
    }
  }, [isEditMode, groupId]);

  const fetchPropertyGroup = async () => {
    if (!groupId) return;
    
    try {
      setLoadingData(true);
      const { data, error } = await supabase
        .from('property_management_groups')
        .select(`
          *,
          properties:properties(
            id,
            property_name,
            address,
            city,
            state
          )
        `)
        .eq('id', groupId)
        .single();

      if (error) throw error;
      
      setFormData({
        company_name: data.company_name || '',
        address: data.address || '',
        address_2: data.address_2 || '',
        city: data.city || '',
        state: data.state || '',
        zip: data.zip || '',
        contact_name: data.contact_name || '',
        contact_phone: data.contact_phone || '',
        contact_email: data.contact_email || ''
      });

      // Set associated properties
      setAssociatedProperties(data.properties || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load property group');
    } finally {
      setLoadingData(false);
    }
  };

  const fetchAvailableProperties = async () => {
    try {
      setLoadingProperties(true);
      const { data, error } = await supabase
        .from('properties')
        .select('id, property_name, address, city, state, property_management_group_id')
        .eq('is_archived', false)
        .order('property_name');

      if (error) throw error;
      setAvailableProperties(data || []);
    } catch (err) {
      console.error('Error fetching properties:', err);
    } finally {
      setLoadingProperties(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isEditMode && groupId) {
        // Update existing property group
        const { data, error } = await supabase
          .from('property_management_groups')
          .update(formData)
          .eq('id', groupId)
          .select()
          .single();

        if (error) throw error;

        // Handle property associations - only in edit mode
        await handlePropertyAssociations(groupId);

        navigate(`/dashboard/property-groups/${data.id}`);
      } else {
        // Create new property group
        const { data, error } = await supabase
          .from('property_management_groups')
          .insert([formData])
          .select()
          .single();

        if (error) throw error;
        navigate(`/dashboard/property-groups/${data.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${isEditMode ? 'update' : 'create'} property group`);
    } finally {
      setLoading(false);
    }
  };

  const handlePropertyAssociations = async (groupId: string) => {
    try {
      // Get the original associated properties from the database
      const { data: originalProperties, error: fetchError } = await supabase
        .from('properties')
        .select('id, property_management_group_id')
        .eq('property_management_group_id', groupId);

      if (fetchError) throw fetchError;

      const originalPropertyIds = new Set(originalProperties?.map(p => p.id) || []);
      const currentPropertyIds = new Set(associatedProperties.map(p => p.id));

      // Find properties to add (in current but not in original)
      const propertiesToAdd = associatedProperties.filter(p => !originalPropertyIds.has(p.id));
      
      // Find properties to remove (in original but not in current)
      const propertiesToRemove = originalProperties?.filter(p => !currentPropertyIds.has(p.id)) || [];

      // Add new properties to the group
      if (propertiesToAdd.length > 0) {
        const { error: addError } = await supabase
          .from('properties')
          .update({ property_management_group_id: groupId })
          .in('id', propertiesToAdd.map(p => p.id));

        if (addError) throw addError;
      }

      // Remove properties from the group
      if (propertiesToRemove.length > 0) {
        const { error: removeError } = await supabase
          .from('properties')
          .update({ property_management_group_id: null })
          .in('id', propertiesToRemove.map(p => p.id));

        if (removeError) throw removeError;
      }
    } catch (err) {
      console.error('Error updating property associations:', err);
      throw err;
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddProperty = (propertyId: string) => {
    // Only update local state - don't save to database yet
    const property = availableProperties.find(p => p.id === propertyId);
    if (property) {
      setAssociatedProperties(prev => [...prev, { ...property, property_management_group_id: groupId }]);
      setAvailableProperties(prev => prev.filter(p => p.id !== propertyId));
    }
  };

  const handleRemoveProperty = (propertyId: string) => {
    // Only update local state - don't save to database yet
    const property = associatedProperties.find(p => p.id === propertyId);
    if (property) {
      setAvailableProperties(prev => [...prev, { ...property, property_management_group_id: null }]);
      setAssociatedProperties(prev => prev.filter(p => p.id !== propertyId));
    }
  };

  if (loadingData) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-[#0F172A] p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-[#0F172A] p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/dashboard/property-groups')}
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
            <Building2 className="h-8 w-8 text-gray-600 dark:text-gray-400" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {isEditMode ? 'Edit Property Management Group' : 'Add Property Management Group'}
            </h1>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-500/50 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Company Information */}
          <div className="bg-white dark:bg-[#1E293B] rounded-xl p-6 shadow-lg border border-gray-100 dark:border-gray-800">
            <div className="flex items-center mb-6">
              <Building2 className="h-6 w-6 text-blue-600 dark:text-blue-400 mr-3" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Company Information</h2>
            </div>
            
            <div className="space-y-6">
              <div>
                <label htmlFor="company_name" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Company Name *
                </label>
                <input
                  type="text"
                  name="company_name"
                  id="company_name"
                  required
                  value={formData.company_name}
                  onChange={handleChange}
                  className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  placeholder="Enter company name"
                />
              </div>
            </div>
          </div>

          {/* Address Information */}
          <div className="bg-white dark:bg-[#1E293B] rounded-xl p-6 shadow-lg border border-gray-100 dark:border-gray-800">
            <div className="flex items-center mb-6">
              <MapPin className="h-6 w-6 text-blue-600 dark:text-blue-400 mr-3" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Address Information</h2>
            </div>
            
            <div className="space-y-6">
              <div>
                <label htmlFor="address" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Address *
                </label>
                <input
                  type="text"
                  name="address"
                  id="address"
                  required
                  value={formData.address}
                  onChange={handleChange}
                  className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  placeholder="Enter street address"
                />
              </div>

              <div>
                <label htmlFor="address_2" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Address Line 2
                </label>
                <input
                  type="text"
                  name="address_2"
                  id="address_2"
                  value={formData.address_2}
                  onChange={handleChange}
                  className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  placeholder="Apartment, suite, etc. (optional)"
                />
              </div>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                <div>
                  <label htmlFor="city" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    City *
                  </label>
                  <input
                    type="text"
                    name="city"
                    id="city"
                    required
                    value={formData.city}
                    onChange={handleChange}
                    className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    placeholder="Enter city"
                  />
                </div>

                <div>
                  <label htmlFor="state" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    State *
                  </label>
                  <input
                    type="text"
                    name="state"
                    id="state"
                    required
                    value={formData.state}
                    onChange={handleChange}
                    className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    placeholder="Enter state"
                  />
                </div>

                <div>
                  <label htmlFor="zip" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    ZIP Code *
                  </label>
                  <input
                    type="text"
                    name="zip"
                    id="zip"
                    required
                    value={formData.zip}
                    onChange={handleChange}
                    className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    placeholder="Enter ZIP code"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="bg-white dark:bg-[#1E293B] rounded-xl p-6 shadow-lg border border-gray-100 dark:border-gray-800">
            <div className="flex items-center mb-6">
              <User className="h-6 w-6 text-blue-600 dark:text-blue-400 mr-3" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Contact Information</h2>
            </div>
            
            <div className="space-y-6">
              <div>
                <label htmlFor="contact_name" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Contact Name
                </label>
                <input
                  type="text"
                  name="contact_name"
                  id="contact_name"
                  value={formData.contact_name}
                  onChange={handleChange}
                  className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  placeholder="Enter contact name"
                />
              </div>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="contact_phone" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    Contact Phone
                  </label>
                  <input
                    type="tel"
                    name="contact_phone"
                    id="contact_phone"
                    value={formData.contact_phone}
                    onChange={handleChange}
                    className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    placeholder="Enter phone number"
                  />
                </div>

                <div>
                  <label htmlFor="contact_email" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    Contact Email
                  </label>
                  <input
                    type="email"
                    name="contact_email"
                    id="contact_email"
                    value={formData.contact_email}
                    onChange={handleChange}
                    className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    placeholder="Enter email address"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Property Management - Only show in edit mode */}
          {isEditMode && (
            <div className="bg-white dark:bg-[#1E293B] rounded-xl p-6 shadow-lg border border-gray-100 dark:border-gray-800">
              <div className="flex items-center mb-6">
                <Building2 className="h-6 w-6 text-blue-600 dark:text-blue-400 mr-3" />
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Associated Properties</h2>
              </div>
              
              <div className="space-y-6">
                {/* Associated Properties */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Current Properties ({associatedProperties.length})
                  </h3>
                  {associatedProperties.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {associatedProperties.map(property => (
                        <div key={property.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#0F172A] rounded-lg">
                          <div className="flex-1 min-w-0">
                            <p className="text-gray-900 dark:text-white font-medium truncate">
                              {property.property_name}
                            </p>
                            <p className="text-gray-600 dark:text-gray-400 text-sm truncate">
                              {property.address}, {property.city}, {property.state}
                            </p>
                          </div>
                          <button
                            onClick={() => handleRemoveProperty(property.id)}
                            className="ml-3 p-1 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                            title="Remove from group"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <Building2 className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                      <p>No properties associated with this group</p>
                    </div>
                  )}
                </div>

                {/* Available Properties */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Available Properties ({availableProperties.filter(p => !p.property_management_group_id).length})
                  </h3>
                  {loadingProperties ? (
                    <div className="text-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {availableProperties
                        .filter(property => !property.property_management_group_id)
                        .map(property => (
                          <div key={property.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#0F172A] rounded-lg">
                            <div className="flex-1 min-w-0">
                              <p className="text-gray-900 dark:text-white font-medium truncate">
                                {property.property_name}
                              </p>
                              <p className="text-gray-600 dark:text-gray-400 text-sm truncate">
                                {property.address}, {property.city}, {property.state}
                              </p>
                            </div>
                            <button
                              onClick={() => handleAddProperty(property.id)}
                              className="ml-3 p-1 text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
                              title="Add to group"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      {availableProperties.filter(property => !property.property_management_group_id).length === 0 && (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                          <Check className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                          <p>All properties are already assigned to groups</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 mt-8">
            <button
              type="button"
              onClick={() => navigate('/dashboard/property-groups')}
              className="px-6 py-3 text-sm font-medium text-gray-700 dark:text-gray-400 bg-white dark:bg-[#1E293B] border border-gray-300 dark:border-[#2D3B4E] rounded-lg hover:bg-gray-50 dark:hover:bg-[#2D3B4E] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (isEditMode ? 'Updating...' : 'Creating...') : (isEditMode ? 'Update Property Group' : 'Create Property Group')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}