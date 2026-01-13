import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Building2, ArrowLeft, MapPin, Plus, ZoomIn, Trash2 } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { useLeafletMap } from '../hooks/useLeafletMap';
import { PaintColorsEditor } from './properties/PaintColorsEditor';
import { PaintScheme } from '../lib/types';
import { Lightbox } from './Lightbox';
import { UnitMapUpload } from './ui/UnitMapUpload';
import { toast } from 'sonner';

interface PropertyManagementGroup {
  id: string;
  company_name: string;
}

interface PropertyContact {
  id: string;
  property_id?: string;
  position: string;
  name: string;
  email: string;
  phone: string;
  is_new?: boolean;
}

export function PropertyEditForm() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewAddress, setPreviewAddress] = useState('');
  const [paintSchemes, setPaintSchemes] = useState<PaintScheme[]>([]);
  const [contacts, setContacts] = useState<PropertyContact[]>([]);
  const [subcontractorContactSource, setSubcontractorContactSource] = useState<string>('community_manager');
  const [notificationContactSource, setNotificationContactSource] = useState<string>('community_manager');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [propertyGroups, setPropertyGroups] = useState<PropertyManagementGroup[]>([]);
  
  const [formData, setFormData] = useState({
    property_name: '',
    property_management_group_id: '',
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
    
    // Contact Information
    community_manager_name: '',
    community_manager_email: '',
    community_manager_phone: '',
    maintenance_supervisor_name: '',
    maintenance_supervisor_email: '',
    maintenance_supervisor_phone: '',
    maintenance_supervisor_title: '',
    point_of_contact: '',
    primary_contact_name: '',
    primary_contact_phone: '',
    primary_contact_role: '',
    subcontractor_a: '',
    subcontractor_b: '',
    community_manager_title: '',
    
    // Billing Information
    ap_name: '',
    ap_email: '',
    ap_phone: '',
    billing_notes: '',
    extra_charges_notes: '',
    occupied_regular_paint_fees: '',
    quickbooks_number: '',
    unit_map_file_path: '',

    // Paint Colors - will be handled by PaintColorsEditor
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
    compliance_w9_created: '',
    compliance_required_date: '',
    compliance_approved_date: '',
    compliance_bid_approved_date: '',
    compliance_po_needed_date: '',
    compliance_w9_created_date: '',
    compliance_coi_address_date: '',
    compliance_create_sub_prop_portal_date: '',
    compliance_notify_team_date: '',
    compliance_upload_documents_date: '',
    compliance_invoice_delivery_date: ''
  });

  const { mapRef, error: mapError } = useLeafletMap({
    address: previewAddress
  });

  useEffect(() => {
    if (!propertyId) {
      navigate('/dashboard/properties');
      return;
    }
    fetchPropertyGroups();
    Promise.all([
      fetchProperty(),
      fetchPaintSchemes(),
      fetchContacts()
    ]);
  }, [propertyId, navigate]);

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
    }
  };

  const fetchProperty = async () => {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('id', propertyId)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Property not found');
      
      setFormData({
        property_name: data.property_name || '',
        property_management_group_id: data.property_management_group_id || '',
        address: data.address || '',
        address_2: data.address_2 || '',
        city: data.city || '',
        state: data.state || '',
        zip: data.zip || '',
        phone: data.phone || '',
        region: data.region || '',
        property_grade: data.property_grade || '',
        supplies_paint: data.supplies_paint || '',
        unit_layout: data.unit_layout || '',
        community_manager_name: data.community_manager_name || '',
        community_manager_email: data.community_manager_email || '',
        community_manager_phone: data.community_manager_phone || '',
        maintenance_supervisor_name: data.maintenance_supervisor_name || '',
        maintenance_supervisor_email: data.maintenance_supervisor_email || '',
        maintenance_supervisor_phone: data.maintenance_supervisor_phone || '',
        maintenance_supervisor_title: data.maintenance_supervisor_title || '',
        point_of_contact: data.point_of_contact || '',
        primary_contact_name: data.primary_contact_name || '',
        primary_contact_phone: data.primary_contact_phone || '',
        primary_contact_role: data.primary_contact_role || '',
        subcontractor_a: data.subcontractor_a || '',
        subcontractor_b: data.subcontractor_b || '',
        community_manager_title: data.community_manager_title || '',
        ap_name: data.ap_name || '',
        ap_email: data.ap_email || '',
        ap_phone: data.ap_phone || '',
        billing_notes: data.billing_notes || '',
        extra_charges_notes: data.extra_charges_notes || '',
        occupied_regular_paint_fees: data.occupied_regular_paint_fees || '',
        quickbooks_number: data.quickbooks_number || '',
        unit_map_file_path: data.unit_map_file_path || '',
        // The following fields are now managed by PaintColorsEditor
        // color_walls: data.color_walls || '',
        // color_trim: data.color_trim || '',
        // color_regular_unit: data.color_regular_unit || '',
        // color_kitchen_bathroom: data.color_kitchen_bathroom || '',
        // color_ceilings: data.color_ceilings || '',
        paint_location: data.paint_location || '',
        compliance_bid_approved: data.compliance_bid_approved || '',
        compliance_coi_address: data.compliance_coi_address || '',
        compliance_create_sub_prop_portal: data.compliance_create_sub_prop_portal || '',
        compliance_notify_team: data.compliance_notify_team || '',
        compliance_upload_documents: data.compliance_upload_documents || '',
        compliance_invoice_delivery: data.compliance_invoice_delivery || '',
        compliance_approved: data.compliance_approved || '',
        compliance_required: data.compliance_required || '',
        compliance_po_needed: data.compliance_po_needed || '',
        compliance_w9_created: data.compliance_w9_created || '',
        compliance_required_date: data.compliance_required_date || '',
        compliance_approved_date: data.compliance_approved_date || '',
        compliance_bid_approved_date: data.compliance_bid_approved_date || '',
        compliance_po_needed_date: data.compliance_po_needed_date || '',
        compliance_w9_created_date: data.compliance_w9_created_date || '',
        compliance_coi_address_date: data.compliance_coi_address_date || '',
        compliance_create_sub_prop_portal_date: data.compliance_create_sub_prop_portal_date || '',
        compliance_notify_team_date: data.compliance_notify_team_date || '',
        compliance_upload_documents_date: data.compliance_upload_documents_date || '',
        compliance_invoice_delivery_date: data.compliance_invoice_delivery_date || ''
      });

      // Determine subcontractor contact source
      if (data.primary_contact_name && data.primary_contact_name === data.maintenance_supervisor_name) {
        setSubcontractorContactSource('maintenance_supervisor');
      } else if (data.primary_contact_name && data.primary_contact_name === data.community_manager_name) {
        setSubcontractorContactSource('community_manager');
      } else if (data.primary_contact_name) {
        // We'll check against additional contacts later or leave it as is if it matches a name
        // Ideally we'd store the source ID but for now we rely on name matching
        // Let's defer exact matching to when contacts are loaded or just default to 'community_manager' if ambiguous
        // A better approach is checking if it matches the *current* values
      }

      // Determine notification contact source by email, default to AP if available
      const currentEmail = data.primary_contact_email || data.ap_email || null;
      if (currentEmail) {
        if (currentEmail === data.community_manager_email) {
          setNotificationContactSource('community_manager');
        } else if (currentEmail === data.maintenance_supervisor_email) {
          setNotificationContactSource('maintenance_supervisor');
        } else if (currentEmail === data.ap_email) {
          setNotificationContactSource('ap');
        }
      } else if (data.ap_email) {
        setNotificationContactSource('ap');
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch property');
      setTimeout(() => navigate('/dashboard/properties'), 2000);
    }
  };

  const fetchPaintSchemes = async () => {
    if (!propertyId) return;
    
    try {
      const { getPaintSchemesByProperty } = await import('../lib/paintColors');
      const schemes = await getPaintSchemesByProperty(propertyId);
      setPaintSchemes(schemes || []);
    } catch (err) {
      console.error('Failed to fetch paint schemes:', err);
      setPaintSchemes([]); // Set empty array as fallback
    }
  };

  const fetchContacts = async () => {
    if (!propertyId) return;
    
    try {
      const { data, error } = await supabase
        .from('property_contacts')
        .select('*')
        .eq('property_id', propertyId);

      if (error) throw error;
      setContacts(data || []);
    } catch (err) {
      console.error('Failed to fetch property contacts:', err);
      // Don't show error to user, just log it
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!propertyId) throw new Error('Property ID is missing');
      const dateFields = [
        'compliance_required_date',
        'compliance_approved_date',
        'compliance_bid_approved_date',
        'compliance_po_needed_date',
        'compliance_w9_created_date',
        'compliance_coi_address_date',
        'compliance_create_sub_prop_portal_date',
        'compliance_notify_team_date',
        'compliance_upload_documents_date',
        'compliance_invoice_delivery_date',
      ] as const;

      // Remove unit_map_file_path from form data as it's handled by the file upload system
      const { unit_map_file_path, ...rest } = formData as any;
      const updateData: Record<string, any> = {
        ...rest,
        property_management_group_id: formData.property_management_group_id || null
      };

      dateFields.forEach(field => {
        updateData[field] = formData[field as keyof typeof formData] || null;
      });
      
      updateData.community_manager_title = (formData.community_manager_title || '').trim() || 'Community Manager';
      updateData.maintenance_supervisor_title = (formData.maintenance_supervisor_title || '').trim() || 'Maintenance Supervisor';
      
      // Set primary contact fields based on selected source
      if (subcontractorContactSource === 'community_manager') {
        updateData.primary_contact_name = formData.community_manager_name;
        updateData.primary_contact_role = updateData.community_manager_title;
        updateData.primary_contact_phone = formData.community_manager_phone;
      } else if (subcontractorContactSource === 'maintenance_supervisor') {
        updateData.primary_contact_name = formData.maintenance_supervisor_name;
        updateData.primary_contact_role = updateData.maintenance_supervisor_title;
        updateData.primary_contact_phone = formData.maintenance_supervisor_phone;
      } else {
        // Additional contact
        const contact = contacts.find(c => c.id === subcontractorContactSource);
        if (contact) {
          updateData.primary_contact_name = contact.name;
          updateData.primary_contact_role = contact.position;
          updateData.primary_contact_phone = contact.phone;
        } else {
           // Fallback
           updateData.primary_contact_name = formData.community_manager_name;
           updateData.primary_contact_role = updateData.community_manager_title;
           updateData.primary_contact_phone = formData.community_manager_phone;
        }
      }

      if (notificationContactSource === 'community_manager') {
        updateData.primary_contact_email = formData.community_manager_email;
      } else if (notificationContactSource === 'maintenance_supervisor') {
        updateData.primary_contact_email = formData.maintenance_supervisor_email;
      } else if (notificationContactSource === 'ap') {
        updateData.primary_contact_email = formData.ap_email;
      } else {
        const notifyContact = contacts.find(c => c.id === notificationContactSource);
        if (notifyContact) {
          updateData.primary_contact_email = notifyContact.email;
        } else if (formData.ap_email) {
          updateData.primary_contact_email = formData.ap_email;
        }
      }

      const { error } = await supabase
        .from('properties')
        .update(updateData)
        .eq('id', propertyId);

      if (error) throw error;

      // Save paint schemes (including empty arrays to clear existing schemes)
      if (propertyId) {
        try {
          console.log('Saving paint schemes for property:', propertyId, paintSchemes);
          const { savePaintSchemes } = await import('../lib/paintColors');
          await savePaintSchemes(propertyId, paintSchemes);
          console.log('Paint schemes saved successfully');

          // Save property contacts
          // 1. Delete existing contacts
          const { error: deleteError } = await supabase
            .from('property_contacts')
            .delete()
            .eq('property_id', propertyId);
          
          if (deleteError) throw deleteError;

          // 2. Insert current contacts
          if (contacts.length > 0) {
            const contactsToInsert = contacts.map(c => ({
              property_id: propertyId,
              position: c.position,
              name: c.name,
              email: c.email,
              phone: c.phone
            }));

            const { error: insertError } = await supabase
              .from('property_contacts')
              .insert(contactsToInsert);
            
            if (insertError) throw insertError;
          }

        } catch (paintError) {
          console.error('Error saving additional data:', paintError);
          // Continue with navigation even if paint schemes/contacts fail to save
        }
      }

      navigate(`/dashboard/properties/${propertyId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update property');
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

  const handleAddContact = () => {
    setContacts(prev => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        position: '',
        name: '',
        email: '',
        phone: '',
        is_new: true
      }
    ]);
  };

  const handleContactChange = (id: string, field: keyof PropertyContact, value: string) => {
    setContacts(prev => prev.map(contact => 
      contact.id === id ? { ...contact, [field]: value } : contact
    ));
  };

  const handleDeleteContact = (id: string) => {
    setContacts(prev => prev.filter(contact => contact.id !== id));
    if (subcontractorContactSource === id) {
      setSubcontractorContactSource('community_manager');
    }
  };

  const handleSubcontractorContactChange = (source: string) => {
    setSubcontractorContactSource(source);
    toast.success('Subcontractor contact updated');
  };
  const handleNotificationContactChange = (source: string) => {
    setNotificationContactSource(source);
    toast.success('Email notifications contact updated');
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-[#0F172A] p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate(`/dashboard/properties/${propertyId}`)}
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Property</h1>
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
            
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="md:col-span-2">
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

              <div className="md:col-span-2">
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
                  <option value="">Select property management group...</option>
                  {propertyGroups.map(group => (
                    <option key={group.id} value={group.id}>
                      {group.company_name}
                    </option>
                  ))}
                </select>
              </div>

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
              {/* Property Contact 1 (Community Manager) */}
              <div className="space-y-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50/50 dark:bg-gray-800/50">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">Property Contact 1</h3>
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="subcontractor_contact_source"
                      checked={subcontractorContactSource === 'community_manager'}
                      onChange={() => handleSubcontractorContactChange('community_manager')}
                      className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      title="Set as Subcontractor Contact"
                    />
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Subcontractor Contact</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="notification_contact_source"
                      checked={notificationContactSource === 'community_manager'}
                      onChange={() => handleNotificationContactChange('community_manager')}
                      className="h-4 w-4 text-green-600 border-gray-300 focus:ring-green-500"
                      title="Set as Email Notifications Contact"
                    />
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Email Notifications</label>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Position / Job</label>
                  <input
                    type="text"
                    name="community_manager_title"
                    value={formData.community_manager_title}
                    onChange={handleChange}
                    className="w-full h-10 px-3 bg-white dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Community Manager"
                  />
                </div>
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
                    className="w-full h-11 px-4 bg-white dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="w-full h-11 px-4 bg-white dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="w-full h-11 px-4 bg-white dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Property Contact 2 (Maintenance Supervisor) */}
              <div className="space-y-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50/50 dark:bg-gray-800/50">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">Property Contact 2</h3>
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="subcontractor_contact_source"
                      checked={subcontractorContactSource === 'maintenance_supervisor'}
                      onChange={() => handleSubcontractorContactChange('maintenance_supervisor')}
                      className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      title="Set as Subcontractor Contact"
                    />
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Subcontractor Contact</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="notification_contact_source"
                      checked={notificationContactSource === 'maintenance_supervisor'}
                      onChange={() => handleNotificationContactChange('maintenance_supervisor')}
                      className="h-4 w-4 text-green-600 border-gray-300 focus:ring-green-500"
                      title="Set as Email Notifications Contact"
                    />
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Email Notifications</label>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Position / Job</label>
                  <input
                    type="text"
                    name="maintenance_supervisor_title"
                    value={formData.maintenance_supervisor_title}
                    onChange={handleChange}
                    className="w-full h-10 px-3 bg-white dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Maintenance Supervisor"
                  />
                </div>
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
                    className="w-full h-11 px-4 bg-white dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="w-full h-11 px-4 bg-white dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="w-full h-11 px-4 bg-white dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Additional Contacts */}
              {contacts.map((contact, index) => (
                <div key={contact.id} className="space-y-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50/50 dark:bg-gray-800/50 relative">
                   <button
                     type="button"
                     onClick={() => handleDeleteContact(contact.id)}
                     className="absolute top-4 right-4 p-1 text-red-600 hover:text-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                     title="Remove contact"
                   >
                     <Trash2 className="h-4 w-4" />
                   </button>

                  <div className="flex items-center justify-between pr-8">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">Property Contact {index + 3}</h3>
                    <div className="flex items-center space-x-2">
                       <input
                         type="radio"
                         name="subcontractor_contact_source"
                         checked={subcontractorContactSource === contact.id}
                         onChange={() => handleSubcontractorContactChange(contact.id)}
                         className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                         title="Set as Subcontractor Contact"
                       />
                       <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Subcontractor Contact</label>
                    </div>
                    <div className="flex items-center space-x-2">
                       <input
                         type="radio"
                         name="notification_contact_source"
                         checked={notificationContactSource === contact.id}
                         onChange={() => handleNotificationContactChange(contact.id)}
                         className="h-4 w-4 text-green-600 border-gray-300 focus:ring-green-500"
                         title="Set as Email Notifications Contact"
                       />
                       <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Email Notifications</label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Position / Job</label>
                    <input
                      type="text"
                      value={contact.position || ''}
                      onChange={(e) => handleContactChange(contact.id, 'position', e.target.value)}
                      className="w-full h-10 px-3 bg-white dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Position"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Name</label>
                    <input
                      type="text"
                      value={contact.name || ''}
                      onChange={(e) => handleContactChange(contact.id, 'name', e.target.value)}
                      className="w-full h-11 px-4 bg-white dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Email</label>
                    <input
                      type="email"
                      value={contact.email || ''}
                      onChange={(e) => handleContactChange(contact.id, 'email', e.target.value)}
                      className="w-full h-11 px-4 bg-white dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Email"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Phone</label>
                    <input
                      type="tel"
                      value={contact.phone || ''}
                      onChange={(e) => handleContactChange(contact.id, 'phone', e.target.value)}
                      className="w-full h-11 px-4 bg-white dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Phone"
                    />
                  </div>
                </div>
              ))}
              
              {/* Add Contact Button Card */}
              <div className="flex items-center justify-center p-6 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50/30 dark:bg-gray-800/30 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer" onClick={handleAddContact}>
                 <div className="text-center">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Plus className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white">Add Contact</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Property Contact {contacts.length + 3}</p>
                 </div>
              </div>
            </div>
          </div>

          {/* Property Unit Map */}
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Property Unit Map</h2>
            
            {propertyId ? (
              // Show the upload component for existing properties
              <UnitMapUpload
                propertyId={propertyId}
                propertyName={formData.property_name}
                currentFilePath={formData.unit_map_file_path}
                onUploadSuccess={(filePath) => {
                  setFormData(prev => ({ ...prev, unit_map_file_path: filePath }));
                  toast.success('Unit map uploaded successfully');
                }}
                onUploadError={(error) => {
                  toast.error(`Upload failed: ${error}`);
                }}
                onDeleteSuccess={() => {
                  setFormData(prev => ({ ...prev, unit_map_file_path: '' }));
                  toast.success('Unit map deleted successfully');
                }}
                onDeleteError={(error) => {
                  toast.error(`Delete failed: ${error}`);
                }}
                disabled={loading}
              />
            ) : (
              // Show loading state while property data is being fetched
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Loading property data...</p>
              </div>
            )}
          </div>

          {/* Manage Billing Details */}
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Billing Management</h2>
              <button
                type="button"
                onClick={() => navigate(`/dashboard/properties/${propertyId}/billing`)}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center"
              >
                <Plus className="h-4 w-4 mr-2" />
                Manage Billing Details
              </button>
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Property billing details are managed on a dedicated page. Click the Manage button to view and edit.
            </p>
          </div>

                    {/* Paint Colors */}
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Paint Colors</h2>
            
            {/* Paint Location Field */}
            <div className="mb-6">
              <label htmlFor="paint_location" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Paint Storage Location
              </label>
              <input
                type="text"
                id="paint_location"
                name="paint_location"
                value={formData.paint_location}
                onChange={handleChange}
                className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Maintenance office, Storage room, Garage, etc."
              />
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Specify where paint is physically stored on the premises (e.g., Maintenance office, Storage room, Garage, etc.)
              </p>
            </div>
            
            <PaintColorsEditor
              propertyId={propertyId}
              initial={paintSchemes}
              onChange={setPaintSchemes}
            />
          </div>

          {/* Compliance Information */}
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Compliance Information</h2>
            
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[
                { key: 'compliance_required', label: 'Compliance Required', options: ['Yes', 'No'] },
                { key: 'compliance_approved', label: 'Compliance Approved', options: ['Yes', 'No', 'Pending'] },
                { key: 'compliance_bid_approved', label: 'Bid Approved', options: ['Yes', 'No', 'Pending'] },
                { key: 'compliance_po_needed', label: 'PO Needed', options: ['Yes', 'No'] },
                { key: 'compliance_w9_created', label: 'W9 Created', options: ['Yes', 'No'] },
                { key: 'compliance_coi_address', label: 'COI Address', type: 'text' },
                { key: 'compliance_create_sub_prop_portal', label: 'Create Sub Prop Portal', options: ['Yes', 'No', 'Completed'] },
                { key: 'compliance_notify_team', label: 'Notify Team', options: ['Yes', 'No', 'Completed'] },
                { key: 'compliance_upload_documents', label: 'Upload Documents', options: ['Yes', 'No', 'Completed'] },
                { key: 'compliance_invoice_delivery', label: 'Invoice Delivery', type: 'text' },
              ].map((item) => {
                const dateKey = `${item.key}_date` as keyof typeof formData;
                const valueKey = item.key as keyof typeof formData;
                return (
                  <div key={item.key} className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#0F172A] space-y-3">
                    <label htmlFor={item.key} className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                      {item.label}
                    </label>
                    {item.type === 'text' ? (
                      <input
                        type="text"
                        id={item.key}
                        name={item.key}
                        value={formData[valueKey]}
                        onChange={handleChange}
                        className="w-full h-11 px-3 bg-white dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={item.label}
                      />
                    ) : (
                      <select
                        id={item.key}
                        name={item.key}
                        value={formData[valueKey]}
                        onChange={handleChange}
                        className="w-full h-11 px-4 bg-white dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select...</option>
                        {item.options?.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    )}
                    <div>
                      <label htmlFor={dateKey as string} className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                        Date
                      </label>
                      <input
                        type="date"
                        id={dateKey as string}
                        name={dateKey as string}
                        value={formData[dateKey] as string}
                        onChange={handleChange}
                        className="w-full h-11 px-3 bg-white dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Billing Information */}
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Billing Information</h2>
            
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200">AP Contact</h3>
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="notification_contact_source"
                    checked={notificationContactSource === 'ap'}
                    onChange={() => handleNotificationContactChange('ap')}
                    className="h-4 w-4 text-green-600 border-gray-300 focus:ring-green-500"
                    title="Set as Email Notifications Contact"
                  />
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Email Notifications</label>
                </div>
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
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => navigate(`/dashboard/properties/${propertyId}`)}
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
      
      {/* Lightbox for Unit Map Preview */}
      <Lightbox
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        imageUrl={formData.unit_map_file_path}
        imageAlt="Unit Map Preview"
      />
    </div>
  );
}
