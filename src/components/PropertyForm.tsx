import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, ArrowLeft, MapPin, ZoomIn, Upload, FileImage } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { useLeafletMap } from '../hooks/useLeafletMap';
import { PaintColorsEditor } from './properties/PaintColorsEditor';
import { PropertyContactsEditor } from './property/PropertyContactsEditor';
import { SystemContactKey, ContactRoles } from '../types/contacts';
import { PaintScheme } from '../lib/types';
import { Lightbox } from './Lightbox';
import { UnitMapUpload } from './ui/UnitMapUpload';
import { toast } from 'sonner';
import { uploadPropertyUnitMap } from '../lib/utils/fileUpload';
import { useUserRole } from '../contexts/UserRoleContext';

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
  secondary_email?: string;
  phone: string;
  is_subcontractor_contact?: boolean;
  is_accounts_receivable_contact?: boolean;
  is_approval_recipient?: boolean;
  is_notification_recipient?: boolean;
  is_primary_approval_recipient?: boolean;
  is_primary_notification_recipient?: boolean;
  is_new?: boolean;
}

export function PropertyForm() {
  const navigate = useNavigate();
  const { isAdmin, isJGManagement } = useUserRole();
  const [loading, setLoading] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [propertyGroups, setPropertyGroups] = useState<PropertyManagementGroup[]>([]);
  const [previewAddress, setPreviewAddress] = useState('');
  const [paintSchemes, setPaintSchemes] = useState<PaintScheme[]>([]);
  const [contacts, setContacts] = useState<PropertyContact[]>([]);
  
  // New contact management state
  const [systemContacts, setSystemContacts] = useState({
    community_manager: { name: '', email: '', secondary_email: '', phone: '', title: 'Community Manager' },
    maintenance_supervisor: { name: '', email: '', secondary_email: '', phone: '', title: 'Maintenance Supervisor' },
    primary_contact: { name: '', email: '', secondary_email: '', phone: '', title: 'Primary Contact' },
    ap: { name: '', email: '', secondary_email: '', phone: '', title: 'Accounts Payable' }
  });
  
  const [systemContactRoles, setSystemContactRoles] = useState<Record<string, Partial<ContactRoles>>>({
    community_manager: { subcontractor: true },
    maintenance_supervisor: {},
    primary_contact: {},
    ap: { accountsReceivable: true }
  });
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [pendingUnitMapFile, setPendingUnitMapFile] = useState<File | null>(null);
  const [createdPropertyId, setCreatedPropertyId] = useState<string | null>(null);
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
    
    // Billing Information
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

  // Handler functions for PropertyContactsEditor
  const handleSystemContactChange = (key: SystemContactKey, field: string, value: string) => {
    setSystemContacts(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value
      }
    }));
  };

  const handleSystemContactRoleChange = (key: SystemContactKey, role: keyof ContactRoles, value: boolean) => {
    setSystemContactRoles(prev => {
      const updated = { ...prev };
      
      // Handle exclusive roles (only one can be true at a time)
      if (role === 'subcontractor' && value) {
        // Clear subcontractor from all other contacts
        Object.keys(updated).forEach(k => {
          if (k !== key && updated[k]) {
            updated[k] = { ...updated[k], subcontractor: false };
          }
        });
      }
      
      if (role === 'accountsReceivable' && value) {
        // Clear AR from all other contacts
        Object.keys(updated).forEach(k => {
          if (k !== key && updated[k]) {
            updated[k] = { ...updated[k], accountsReceivable: false };
          }
        });
      }
      
      if (role === 'primaryApproval' && value) {
        // Clear primary approval from all other contacts
        Object.keys(updated).forEach(k => {
          if (k !== key && updated[k]) {
            updated[k] = { ...updated[k], primaryApproval: false };
          }
        });
        // Also clear from custom contacts
        setContacts(prev => prev.map(c => ({ ...c, is_primary_approval_recipient: false })));
      }
      
      if (role === 'primaryNotification' && value) {
        // Clear primary notification from all other contacts
        Object.keys(updated).forEach(k => {
          if (k !== key && updated[k]) {
            updated[k] = { ...updated[k], primaryNotification: false };
          }
        });
        // Also clear from custom contacts
        setContacts(prev => prev.map(c => ({ ...c, is_primary_notification_recipient: false })));
      }
      
      // Update the current contact's role
      updated[key] = {
        ...updated[key],
        [role]: value
      };
      
      // If unchecking approval recipient, also uncheck primary approval
      if (role === 'approvalRecipient' && !value) {
        updated[key].primaryApproval = false;
      }
      
      // If unchecking notification recipient, also uncheck primary notification
      if (role === 'notificationRecipient' && !value) {
        updated[key].primaryNotification = false;
      }
      
      return updated;
    });
  };

  const handleCustomContactChange = (id: string, field: keyof PropertyContact, value: any) => {
    console.log('🔄 handleCustomContactChange called:', { id, field, value });
    setContacts(prev => prev.map(contact => {
      if (contact.id !== id) {
        // Handle exclusive roles
        if (field === 'is_subcontractor_contact' && value === true) {
          return { ...contact, is_subcontractor_contact: false };
        }
        if (field === 'is_accounts_receivable_contact' && value === true) {
          return { ...contact, is_accounts_receivable_contact: false };
        }
        if (field === 'is_primary_approval_recipient' && value === true) {
          return { ...contact, is_primary_approval_recipient: false };
        }
        if (field === 'is_primary_notification_recipient' && value === true) {
          return { ...contact, is_primary_notification_recipient: false };
        }
        return contact;
      }
      
      const updated = { ...contact, [field]: value };
      
      // If unchecking approval recipient, also uncheck primary
      if (field === 'is_approval_recipient' && !value) {
        updated.is_primary_approval_recipient = false;
      }
      
      // If unchecking notification recipient, also uncheck primary
      if (field === 'is_notification_recipient' && !value) {
        updated.is_primary_notification_recipient = false;
      }
      
      return updated;
    }));
    
    // Also clear from system contacts if needed
    if (field === 'is_subcontractor_contact' && value === true) {
      setSystemContactRoles(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(k => {
          if (updated[k]) updated[k] = { ...updated[k], subcontractor: false };
        });
        return updated;
      });
    }
    
    if (field === 'is_accounts_receivable_contact' && value === true) {
      setSystemContactRoles(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(k => {
          if (updated[k]) updated[k] = { ...updated[k], accountsReceivable: false };
        });
        return updated;
      });
    }
    
    if (field === 'is_primary_approval_recipient' && value === true) {
      setSystemContactRoles(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(k => {
          if (updated[k]) updated[k] = { ...updated[k], primaryApproval: false };
        });
        return updated;
      });
    }
    
    if (field === 'is_primary_notification_recipient' && value === true) {
      setSystemContactRoles(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(k => {
          if (updated[k]) updated[k] = { ...updated[k], primaryNotification: false };
        });
        return updated;
      });
    }
  };

  const handleCustomContactAdd = () => {
    setContacts(prev => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        position: '',
        name: '',
        email: '',
        secondary_email: '',
        phone: '',
        is_new: true
      }
    ]);
  };

  const handleCustomContactDelete = (id: string) => {
    setContacts(prev => prev.filter(contact => contact.id !== id));
  };

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
    if (!(isAdmin || isJGManagement)) {
      setError('You do not have permission to create properties.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      // Prepare form data, converting empty strings to null for UUID fields
      const cleanedFormData: Record<string, any> = {
        ...formData,
        property_management_group_id: formData.property_management_group_id || null,
        // System contact info
        community_manager_name: systemContacts.community_manager.name,
        community_manager_email: systemContacts.community_manager.email,
        community_manager_phone: systemContacts.community_manager.phone,
        community_manager_title: systemContacts.community_manager.title || 'Community Manager',
        maintenance_supervisor_name: systemContacts.maintenance_supervisor.name,
        maintenance_supervisor_email: systemContacts.maintenance_supervisor.email,
        maintenance_supervisor_phone: systemContacts.maintenance_supervisor.phone,
        maintenance_supervisor_title: systemContacts.maintenance_supervisor.title || 'Maintenance Supervisor',
        ap_name: systemContacts.ap.name,
        ap_email: systemContacts.ap.email,
        ap_phone: systemContacts.ap.phone,
        // System contact roles
        community_manager_is_subcontractor: systemContactRoles.community_manager?.subcontractor || false,
        community_manager_is_ar: systemContactRoles.community_manager?.accountsReceivable || false,
        community_manager_is_approval_recipient: systemContactRoles.community_manager?.approvalRecipient || false,
        community_manager_is_notification_recipient: systemContactRoles.community_manager?.notificationRecipient || false,
        community_manager_is_primary_approval: systemContactRoles.community_manager?.primaryApproval || false,
        community_manager_is_primary_notification: systemContactRoles.community_manager?.primaryNotification || false,
        maintenance_supervisor_is_subcontractor: systemContactRoles.maintenance_supervisor?.subcontractor || false,
        maintenance_supervisor_is_ar: systemContactRoles.maintenance_supervisor?.accountsReceivable || false,
        maintenance_supervisor_is_approval_recipient: systemContactRoles.maintenance_supervisor?.approvalRecipient || false,
        maintenance_supervisor_is_notification_recipient: systemContactRoles.maintenance_supervisor?.notificationRecipient || false,
        maintenance_supervisor_is_primary_approval: systemContactRoles.maintenance_supervisor?.primaryApproval || false,
        maintenance_supervisor_is_primary_notification: systemContactRoles.maintenance_supervisor?.primaryNotification || false,
        primary_contact_is_subcontractor: systemContactRoles.primary_contact?.subcontractor || false,
        primary_contact_is_ar: systemContactRoles.primary_contact?.accountsReceivable || false,
        primary_contact_is_approval_recipient: systemContactRoles.primary_contact?.approvalRecipient || false,
        primary_contact_is_notification_recipient: systemContactRoles.primary_contact?.notificationRecipient || false,
        primary_contact_is_primary_approval: systemContactRoles.primary_contact?.primaryApproval || false,
        primary_contact_is_primary_notification: systemContactRoles.primary_contact?.primaryNotification || false,
        ap_is_subcontractor: systemContactRoles.ap?.subcontractor || false,
        ap_is_ar: systemContactRoles.ap?.accountsReceivable || false,
        ap_is_approval_recipient: systemContactRoles.ap?.approvalRecipient || false,
        ap_is_notification_recipient: systemContactRoles.ap?.notificationRecipient || false,
        ap_is_primary_approval: systemContactRoles.ap?.primaryApproval || false,
        ap_is_primary_notification: systemContactRoles.ap?.primaryNotification || false,
      };

      // Set primary contact fields based on which contact has the subcontractor role
      const subcontractorContact = Object.entries(systemContactRoles).find(
        ([_, roles]) => roles.subcontractor
      );
      
      if (subcontractorContact) {
        const [key] = subcontractorContact;
        const contact = systemContacts[key as SystemContactKey];
        cleanedFormData.primary_contact_name = contact.name;
        cleanedFormData.primary_contact_role = contact.title;
        cleanedFormData.primary_contact_email = contact.email;
        cleanedFormData.primary_contact_phone = contact.phone;
      } else {
        // Check custom contacts
        const customSubContact = contacts.find(c => c.is_subcontractor_contact);
        if (customSubContact) {
          cleanedFormData.primary_contact_name = customSubContact.name;
          cleanedFormData.primary_contact_role = customSubContact.position;
          cleanedFormData.primary_contact_email = customSubContact.email;
          cleanedFormData.primary_contact_phone = customSubContact.phone;
        } else {
          // Fallback to community manager
          cleanedFormData.primary_contact_name = systemContacts.community_manager.name;
          cleanedFormData.primary_contact_role = systemContacts.community_manager.title;
          cleanedFormData.primary_contact_email = systemContacts.community_manager.email;
          cleanedFormData.primary_contact_phone = systemContacts.community_manager.phone;
        }
      }

      // Remove unit_map_file_path from form data as it's handled by the file upload system
      delete cleanedFormData.unit_map_file_path;

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

      dateFields.forEach(field => {
        cleanedFormData[field] = formData[field as keyof typeof formData] || null;
      });

      const { data, error } = await supabase
        .from('properties')
        .insert([cleanedFormData])
        .select()
        .single();

      if (error) {
        console.error('❌ Property creation failed');
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        console.error('Error details:', error.details);
        console.error('Error hint:', error.hint);
        throw error;
      }

      console.log('✅ Property created successfully:', data.id);

      // Save additional contacts
      if (contacts.length > 0) {
        console.log('💾 Saving contacts with roles:', contacts);
        const contactsToInsert = contacts.map(c => ({
          property_id: data.id,
          position: c.position,
          name: c.name,
          email: c.email,
          secondary_email: c.secondary_email || null,
          phone: c.phone,
          is_subcontractor_contact: c.is_subcontractor_contact || false,
          is_accounts_receivable_contact: c.is_accounts_receivable_contact || false,
          is_approval_recipient: c.is_approval_recipient || false,
          is_notification_recipient: c.is_notification_recipient || false,
          is_primary_approval_recipient: c.is_primary_approval_recipient || false,
          is_primary_notification_recipient: c.is_primary_notification_recipient || false
        }));
        console.log('💾 Contacts to insert:', contactsToInsert);

        const { error: contactsError } = await supabase
          .from('property_contacts')
          .insert(contactsToInsert);
        
        if (contactsError) {
          console.error('❌ Error saving additional contacts:', contactsError);
        } else {
          console.log('✅ Contacts saved successfully');
        }
      }

      // Store the created property ID for file upload
      setCreatedPropertyId(data.id);

      // Save paint schemes (including empty arrays)
      try {
        console.log('Saving paint schemes for new property:', data.id, paintSchemes);
        const { savePaintSchemes } = await import('../lib/paintColors');
        await savePaintSchemes(data.id, paintSchemes);
        console.log('Paint schemes saved successfully for new property');
      } catch (paintError) {
        console.error('Error saving paint schemes:', paintError);
        // Continue with navigation even if paint schemes fail to save
      }

      // If there's a pending unit map file, upload it now
      if (pendingUnitMapFile) {
        try {
          const uploadResult = await uploadPropertyUnitMap(
            pendingUnitMapFile, 
            data.id, 
            formData.property_name
          );
          
          if (uploadResult.success) {
            toast.success('Property created and unit map uploaded successfully!');
          } else {
            toast.warning('Property created but unit map upload failed: ' + uploadResult.error);
          }
        } catch (uploadError) {
          console.error('Unit map upload error:', uploadError);
          toast.warning('Property created but unit map upload failed');
        }
      } else {
        toast.success('Property created successfully!');
      }

      navigate(`/dashboard/properties/${data.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create property';
      if (/permission|row-level security|policy/i.test(msg)) {
        setError('You do not have permission to create properties.');
      } else {
        setError(msg);
      }
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
                  <option value="">Select property management group...</option>
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
          <PropertyContactsEditor
            systemContacts={systemContacts}
            systemContactRoles={systemContactRoles}
            customContacts={contacts}
            onSystemContactChange={handleSystemContactChange}
            onSystemContactRoleChange={handleSystemContactRoleChange}
            onCustomContactChange={handleCustomContactChange}
            onCustomContactAdd={handleCustomContactAdd}
            onCustomContactDelete={handleCustomContactDelete}
          />

          {/* Property Unit Map */}
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Property Unit Map</h2>
            
            {createdPropertyId ? (
              // Show the upload component after property is created
              <UnitMapUpload
                propertyId={createdPropertyId}
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
              // Show drag-and-drop file selection before property creation
              <div className="space-y-4">
                <div 
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    pendingUnitMapFile 
                      ? 'border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-900/10' 
                      : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 bg-gray-50/50 dark:bg-[#0F172A]/50'
                  }`}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      setPendingUnitMapFile(e.dataTransfer.files[0]);
                      toast.success('Unit map selected. It will be uploaded after the property is created.');
                    }
                  }}
                >
                  {pendingUnitMapFile ? (
                    <>
                      <FileImage className="mx-auto h-12 w-12 text-green-500 dark:text-green-400 mb-4" />
                      <p className="text-sm font-medium text-green-700 dark:text-green-300 mb-2">
                        ✓ File Selected
                      </p>
                      <p className="text-xs text-green-600 dark:text-green-400 mb-3">
                        {pendingUnitMapFile.name}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
                        Will be uploaded when property is created
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setPendingUnitMapFile(null);
                          toast.info('Unit map selection cleared');
                        }}
                        className="text-sm text-red-600 dark:text-red-400 hover:underline"
                      >
                        Remove selection
                      </button>
                    </>
                  ) : (
                    <>
                      <Upload className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
                      <div className="space-y-2 mb-4">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          Drag and drop unit map image here
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          or click to browse
                        </p>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setPendingUnitMapFile(e.target.files[0]);
                            toast.success('Unit map selected. It will be uploaded after the property is created.');
                          }
                        }}
                        className="block w-full text-sm text-gray-500 dark:text-gray-400
                          file:mr-4 file:py-2 file:px-4
                          file:rounded-full file:border-0
                          file:text-sm file:font-semibold
                          file:bg-blue-50 file:text-blue-700
                          hover:file:bg-blue-100
                          dark:file:bg-blue-900/20 dark:file:text-blue-300
                          dark:hover:file:bg-blue-900/30
                          cursor-pointer"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                        PNG, JPG, GIF up to 10MB
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Manage Billing Details */}
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Billing Management</h2>
              <div className="text-gray-600 dark:text-gray-400 text-sm">
                Billing details can be configured after the property is created.
              </div>
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
            
            {/* Paint Colors Editor - Available after creation */}
            {createdPropertyId ? (
              <PaintColorsEditor
                propertyId={createdPropertyId}
                onChange={setPaintSchemes}
              />
            ) : (
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8">
                <div className="text-center max-w-2xl mx-auto">
                  <div className="mb-4">
                    <svg
                      className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Paint Colors Available After Property Creation
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Paint color information (brands, types, colors, finishes) can be added after the property has been created. 
                    Once you save this property, you'll be able to return and add detailed paint specifications.
                  </p>
                  <div className="flex items-start space-x-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-left">
                    <svg
                      className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <div className="text-sm text-blue-800 dark:text-blue-300">
                      <p className="font-medium mb-1">Why after creation?</p>
                      <p>
                        Paint colors require a property ID to be properly stored and organized. 
                        Save the property first, then navigate to the property details page to add paint information.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
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
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200">QuickBooks Information</h3>
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
              disabled={loading || !(isAdmin || isJGManagement)}
              className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Property'}
            </button>
            {!(isAdmin || isJGManagement) && (
              <div className="text-sm text-red-600 dark:text-red-400 flex items-center">
                You do not have permission to create properties.
              </div>
            )}
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
