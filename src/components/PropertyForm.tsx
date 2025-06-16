import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, ArrowLeft, MapPin } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { useLeafletMap } from '../hooks/useLeafletMap';

interface PropertyManagementGroup {
  id: string;
  company_name: string;
}

export function PropertyForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [propertyGroups, setPropertyGroups] = useState<PropertyManagementGroup[]>([]);
  const [previewAddress, setPreviewAddress] = useState('');
  
  const [formData, setFormData] = useState({
    property_name: '',
    address: '',
    address_2: '',
    city: '',
    state: '',
    zip: '',
    phone: '',
    region: '',
    property_grade: '',
    supplies_paint: '',
    unit_layout: '',
    property_management_group_id: '',
    
    // Contact Information
    community_manager_name: '',
    community_manager_email: '',
    community_manager_phone: '',
    maintenance_supervisor_name: '',
    maintenance_supervisor_email: '',
    maintenance_supervisor_phone: '',
    point_of_contact: '',
    primary_contact_name: '',
    primary_contact_phone: '',
    primary_contact_role: '',
    subcontractor_a: '',
    subcontractor_b: '',
    
    // Billing Information
    ap_name: '',
    ap_email: '',
    ap_phone: '',
    billing_notes: '',
    extra_charges_notes: '',
    occupied_regular_paint_fees: '',
    quickbooks_number: '',

    // Paint Colors
    color_walls: '',
    color_trim: '',
    color_regular_unit: '',
    color_kitchen_bathroom: '',
    color_ceilings: '',
    paint_location: '',

    // Compliance Information
    compliance_bid_approved: '',
    compliance_coi_address: '',
    compliance_create_sub_prop_portal: '',
    compliance_notify_team: '',
    compliance_upload_documents: '',
    compliance_invoice_delivery: '',
    compliance_approved: '',
    compliance_required: '',
    compliance_po_needed: '',
    compliance_w9_created: ''
  });

  const { mapRef, error: mapError } = useLeafletMap({
    address: previewAddress
  });

  useEffect(() => {
    fetchPropertyGroups();
  }, []);

  useEffect(() => {
    // Update preview address when address fields change
    const addressParts = [
      formData.address,
      formData.city,
      formData.state,
      formData.zip
    ].filter(Boolean);
    
    if (addressParts.length > 0) {
      setPreviewAddress(addressParts.join(', '));
    }
  }, [formData.address, formData.city, formData.state, formData.zip]);

  const fetchPropertyGroups = async () => {
    try {
      const { data, error } = await supabase
        .from('property_management_groups')
        .select('*')
        .order('company_name');

      if (error) throw error;
      setPropertyGroups(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch property groups');
    } finally {
      setLoadingGroups(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('properties')
        .insert([formData])
        .select()
        .single();

      if (error) throw error;
      navigate(`/dashboard/properties/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create property');
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
              onClick={() => navigate('/dashboard/properties')}
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Add Property</h1>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-500/50 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Property Information */}
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Property Information</h2>
            
            <div className="space-y-6">
              <div>
                <label htmlFor="property_name" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Property Name
                </label>
                <input
                  type="text"
                  id="property_name"
                  name="property_name"
                  required
                  value={formData.property_name}
                  onChange={handleChange}
                  className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter property name"
                />
              </div>

              <div>
                <label htmlFor="property_management_group_id" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Property Management Group
                </label>
                <select
                  id="property_management_group_id"
                  name="property_management_group_id"
                  required
                  value={formData.property_management_group_id}
                  onChange={handleChange}
                  className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select property type...</option>
                  {propertyGroups.map(group => (
                    <option key={group.id} value={group.id}>
                      {group.company_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="region" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    Region
                  </label>
                  <input
                    type="text"
                    id="region"
                    name="region"
                    value={formData.region}
                    onChange={handleChange}
                    className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter region number"
                  />
                </div>

                <div>
                  <label htmlFor="property_grade" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    Property Grade
                  </label>
                  <select
                    id="property_grade"
                    name="property_grade"
                    value={formData.property_grade}
                    onChange={handleChange}
                    className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select grade...</option>
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                    <option value="F">F</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Location Details */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Location Details</h2>
              
              <div className="space-y-6">
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

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    Phone
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter phone number"
                  />
                </div>
              </div>
            </div>

            {/* Map Preview */}
            <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
              <div className="flex items-center mb-4">
                <MapPin className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Location Preview</h2>
              </div>
              
              {previewAddress ? (
                mapError ? (
                  <div className="text-red-600 dark:text-red-400 p-4 border border-red-300 dark:border-red-800 rounded-lg">
                    {mapError}
                  </div>
                ) : (
                  <div 
                    ref={mapRef} 
                    className="w-full h-[300px] rounded-lg overflow-hidden"
                  />
                )
              ) : (
                <div className="flex items-center justify-center h-[300px] bg-gray-100 dark:bg-[#0F172A] rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
                  <p className="text-gray-500 dark:text-gray-400">
                    Enter an address to see the map preview
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Contact Information */}
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Contact Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Community Manager */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200">Community Manager</h3>
                <div>
                  <label htmlFor="community_manager_name" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    id="community_manager_name"
                    name="community_manager_name"
                    value={formData.community_manager_name}
                    onChange={handleChange}
                    className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="community_manager_email" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    id="community_manager_email"
                    name="community_manager_email"
                    value={formData.community_manager_email}
                    onChange={handleChange}
                    className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="community_manager_phone" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    Phone
                  </label>
                  <input
                    type="tel"
                    id="community_manager_phone"
                    name="community_manager_phone"
                    value={formData.community_manager_phone}
                    onChange={handleChange}
                    className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Maintenance Supervisor */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200">Maintenance Supervisor</h3>
                <div>
                  <label htmlFor="maintenance_supervisor_name" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    id="maintenance_supervisor_name"
                    name="maintenance_supervisor_name"
                    value={formData.maintenance_supervisor_name}
                    onChange={handleChange}
                    className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="maintenance_supervisor_email" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    id="maintenance_supervisor_email"
                    name="maintenance_supervisor_email"
                    value={formData.maintenance_supervisor_email}
                    onChange={handleChange}
                    className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="maintenance_supervisor_phone" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    Phone
                  </label>
                  <input
                    type="tel"
                    id="maintenance_supervisor_phone"
                    name="maintenance_supervisor_phone"
                    value={formData.maintenance_supervisor_phone}
                    onChange={handleChange}
                    className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Paint Colors */}
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Paint Colors</h2>
            
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div>
                <label htmlFor="color_walls" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Walls
                </label>
                <input
                  type="text"
                  id="color_walls"
                  name="color_walls"
                  value={formData.color_walls}
                  onChange={handleChange}
                  className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="color_trim" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Trim
                </label>
                <input
                  type="text"
                  id="color_trim"
                  name="color_trim"
                  value={formData.color_trim}
                  onChange={handleChange}
                  className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="color_regular_unit" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Regular Unit
                </label>
                <input
                  type="text"
                  id="color_regular_unit"
                  name="color_regular_unit"
                  value={formData.color_regular_unit}
                  onChange={handleChange}
                  className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="color_kitchen_bathroom" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Kitchen/Bathroom
                </label>
                <input
                  type="text"
                  id="color_kitchen_bathroom"
                  name="color_kitchen_bathroom"
                  value={formData.color_kitchen_bathroom}
                  onChange={handleChange}
                  className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="color_ceilings" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Ceilings
                </label>
                <input
                  type="text"
                  id="color_ceilings"
                  name="color_ceilings"
                  value={formData.color_ceilings}
                  onChange={handleChange}
                  className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="paint_location" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Paint Location
                </label>
                <input
                  type="text"
                  id="paint_location"
                  name="paint_location"
                  value={formData.paint_location}
                  onChange={handleChange}
                  className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Compliance Information */}
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Compliance Information</h2>
            
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div>
                <label htmlFor="compliance_required" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Compliance Required
                </label>
                <select
                  id="compliance_required"
                  name="compliance_required"
                  value={formData.compliance_required}
                  onChange={handleChange}
                  className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select...</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>

              <div>
                <label htmlFor="compliance_approved" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Compliance Approved
                </label>
                <select
                  id="compliance_approved"
                  name="compliance_approved"
                  value={formData.compliance_approved}
                  onChange={handleChange}
                  className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select...</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                  <option value="Pending">Pending</option>
                </select>
              </div>

              <div>
                <label htmlFor="compliance_bid_approved" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Bid Approved
                </label>
                <select
                  id="compliance_bid_approved"
                  name="compliance_bid_approved"
                  value={formData.compliance_bid_approved}
                  onChange={handleChange}
                  className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select...</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                  <option value="Pending">Pending</option>
                </select>
              </div>

              <div>
                <label htmlFor="compliance_po_needed" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  PO Needed
                </label>
                <select
                  id="compliance_po_needed"
                  name="compliance_po_needed"
                  value={formData.compliance_po_needed}
                  onChange={handleChange}
                  className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select...</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>

              <div>
                <label htmlFor="compliance_w9_created" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  W9 Created
                </label>
                <select
                  id="compliance_w9_created"
                  name="compliance_w9_created"
                  value={formData.compliance_w9_created}
                  onChange={handleChange}
                  className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select...</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>

              <div>
                <label htmlFor="compliance_coi_address" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  COI Address
                </label>
                <input
                  type="text"
                  id="compliance_coi_address"
                  name="compliance_coi_address"
                  value={formData.compliance_coi_address}
                  onChange={handleChange}
                  className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="compliance_create_sub_prop_portal" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Create Sub Prop Portal
                </label>
                <select
                  id="compliance_create_sub_prop_portal"
                  name="compliance_create_sub_prop_portal"
                  value={formData.compliance_create_sub_prop_portal}
                  onChange={handleChange}
                  className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select...</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>

              <div>
                <label htmlFor="compliance_notify_team" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Notify Team
                </label>
                <select
                  id="compliance_notify_team"
                  name="compliance_notify_team"
                  value={formData.compliance_notify_team}
                  onChange={handleChange}
                  className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select...</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>

              <div>
                <label htmlFor="compliance_upload_documents" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Upload Documents
                </label>
                <select
                  id="compliance_upload_documents"
                  name="compliance_upload_documents"
                  value={formData.compliance_upload_documents}
                  onChange={handleChange}
                  className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select...</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>

              <div>
                <label htmlFor="compliance_invoice_delivery" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Invoice Delivery
                </label>
                <input
                  type="text"
                  id="compliance_invoice_delivery"
                  name="compliance_invoice_delivery"
                  value={formData.compliance_invoice_delivery}
                  onChange={handleChange}
                  className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Email, Portal, etc."
                />
              </div>
            </div>
          </div>

          {/* Billing Information */}
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Billing Information</h2>
            
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200">AP Contact</h3>
                <div>
                  <label htmlFor="ap_name" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    id="ap_name"
                    name="ap_name"
                    value={formData.ap_name}
                    onChange={handleChange}
                    className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="ap_email" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    id="ap_email"
                    name="ap_email"
                    value={formData.ap_email}
                    onChange={handleChange}
                    className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="ap_phone" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    Phone
                  </label>
                  <input
                    type="tel"
                    id="ap_phone"
                    name="ap_phone"
                    value={formData.ap_phone}
                    onChange={handleChange}
                    className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="quickbooks_number" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    QuickBooks Number
                  </label>
                  <input
                    type="text"
                    id="quickbooks_number"
                    name="quickbooks_number"
                    value={formData.quickbooks_number}
                    onChange={handleChange}
                    className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter QuickBooks number"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="billing_notes" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    Billing Notes
                  </label>
                  <textarea
                    id="billing_notes"
                    name="billing_notes"
                    rows={3}
                    value={formData.billing_notes}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="extra_charges_notes" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    Extra Charges Notes
                  </label>
                  <textarea
                    id="extra_charges_notes"
                    name="extra_charges_notes"
                    rows={3}
                    value={formData.extra_charges_notes}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => navigate('/dashboard/properties')}
              className="px-6 py-2 text-sm font-medium text-gray-700 dark:text-gray-400 bg-white dark:bg-[#1E293B] border border-gray-300 dark:border-[#2D3B4E] rounded-lg hover:bg-gray-50 dark:hover:bg-[#2D3B4E] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Property'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}