import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Building2, ArrowLeft } from 'lucide-react';
import { supabase } from '@/utils/supabase';

interface FormData {
  company_name: string;
  address: string;
  address_2: string;
  city: string;
  state: string;
  zip: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  group_status: string;
}

export function PropertyGroupEditForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    company_name: '',
    address: '',
    address_2: '',
    city: '',
    state: '',
    zip: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    group_status: ''
  });

  useEffect(() => {
    if (!id) {
      navigate('/dashboard/property-groups');
      return;
    }
    fetchPropertyGroup();
  }, [id, navigate]);

  const fetchPropertyGroup = async () => {
    try {
      const { data, error } = await supabase
        .from('property_management_groups')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Property group not found');
      
      setFormData({
        company_name: data.company_name || '',
        address: data.address || '',
        address_2: data.address_2 || '',
        city: data.city || '',
        state: data.state || '',
        zip: data.zip || '',
        contact_name: data.contact_name || '',
        contact_email: data.contact_email || '',
        contact_phone: data.contact_phone || '',
        group_status: data.group_status || ''
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch property group');
      setTimeout(() => navigate('/dashboard/property-groups'), 2000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('property_management_groups')
        .update(formData)
        .eq('id', id);

      if (error) throw error;
      navigate(`/dashboard/property-groups/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update property group');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-[#0F172A] p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate(`/dashboard/property-groups/${id}`)}
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Property Management Group</h1>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-500/50 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Basic Information</h2>
            
            <div className="grid grid-cols-1 gap-6">
              <div>
                <label htmlFor="company_name" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Company Name
                </label>
                <input
                  type="text"
                  id="company_name"
                  name="company_name"
                  required
                  value={formData.company_name}
                  onChange={handleChange}
                  className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter company name"
                />
              </div>

              <div>
                <label htmlFor="group_status" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Status
                </label>
                <input
                  type="text"
                  id="group_status"
                  name="group_status"
                  value={formData.group_status}
                  onChange={handleChange}
                  className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter status"
                />
              </div>
            </div>
          </div>

          {/* Address Information */}
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Address Information</h2>
            
            <div className="grid grid-cols-1 gap-6">
              <div>
                <label htmlFor="address" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Street Address
                </label>
                <input
                  type="text"
                  id="address"
                  name="address"
                  required
                  value={formData.address}
                  onChange={handleChange}
                  className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter street address"
                />
              </div>

              <div>
                <label htmlFor="address_2" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Address Line 2
                </label>
                <input
                  type="text"
                  id="address_2"
                  name="address_2"
                  value={formData.address_2}
                  onChange={handleChange}
                  className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Apartment, suite, unit, etc."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label htmlFor="city" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    City
                  </label>
                  <input
                    type="text"
                    id="city"
                    name="city"
                    required
                    value={formData.city}
                    onChange={handleChange}
                    className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter city"
                  />
                </div>

                <div>
                  <label htmlFor="state" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    State
                  </label>
                  <input
                    type="text"
                    id="state"
                    name="state"
                    required
                    value={formData.state}
                    onChange={handleChange}
                    className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter state"
                  />
                </div>

                <div>
                  <label htmlFor="zip" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    ZIP Code
                  </label>
                  <input
                    type="text"
                    id="zip"
                    name="zip"
                    required
                    value={formData.zip}
                    onChange={handleChange}
                    className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter ZIP code"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Contact Information</h2>
            
            <div className="grid grid-cols-1 gap-6">
              <div>
                <label htmlFor="contact_name" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Contact Name
                </label>
                <input
                  type="text"
                  id="contact_name"
                  name="contact_name"
                  value={formData.contact_name}
                  onChange={handleChange}
                  className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter contact name"
                />
              </div>

              <div>
                <label htmlFor="contact_email" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Contact Email
                </label>
                <input
                  type="email"
                  id="contact_email"
                  name="contact_email"
                  value={formData.contact_email}
                  onChange={handleChange}
                  className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter contact email"
                />
              </div>

              <div>
                <label htmlFor="contact_phone" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Contact Phone
                </label>
                <input
                  type="tel"
                  id="contact_phone"
                  name="contact_phone"
                  value={formData.contact_phone}
                  onChange={handleChange}
                  className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter contact phone"
                />
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => navigate(`/dashboard/property-groups/${id}`)}
              className="px-6 py-2 text-sm font-medium text-gray-700 dark:text-gray-400 bg-white dark:bg-[#1E293B] border border-gray-300 dark:border-[#2D3B4E] rounded-lg hover:bg-gray-50 dark:hover:bg-[#2D3B4E] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}