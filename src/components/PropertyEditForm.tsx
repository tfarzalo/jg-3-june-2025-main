import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Building2, ArrowLeft, MapPin, Plus, Minus, ZoomIn, Trash2 } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { useLeafletMap } from '../hooks/useLeafletMap';
import { PaintColorsEditor } from './properties/PaintColorsEditor';
import { PropertyContactsEditor } from './property/PropertyContactsEditor';
import { SystemContactKey, ContactRoles } from '../types/contacts';
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

export function PropertyEditForm() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
  const [propertyGroups, setPropertyGroups] = useState<PropertyManagementGroup[]>([]);
  const [originalPropertyName, setOriginalPropertyName] = useState('');
  
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
    console.log('🔄 handleSystemContactRoleChange called:', { key, role, value });
    setSystemContactRoles(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [role]: value
      }
    }));
    
    // If setting a role to true, clear it from other contacts
    if (value) {
      if (role === 'subcontractor' || role === 'accountsReceivable' || role === 'primaryApproval' || role === 'primaryNotification') {
        // Clear this role from all other system contacts
        setSystemContactRoles(prev => {
          const updated = { ...prev };
          Object.keys(updated).forEach(k => {
            if (k !== key && updated[k]) {
              updated[k] = { ...updated[k], [role]: false };
            }
          });
          return updated;
        });
        
        // Also clear from custom contacts
        setContacts(prev => prev.map(contact => {
          if (role === 'subcontractor') return { ...contact, is_subcontractor_contact: false };
          if (role === 'accountsReceivable') return { ...contact, is_accounts_receivable_contact: false };
          if (role === 'primaryApproval') return { ...contact, is_primary_approval_recipient: false };
          if (role === 'primaryNotification') return { ...contact, is_primary_notification_recipient: false };
          return contact;
        }));
      }
    }
    
    // If unchecking approvalRecipient, also uncheck primaryApproval
    if (role === 'approvalRecipient' && !value) {
      setSystemContactRoles(prev => ({
        ...prev,
        [key]: {
          ...prev[key],
          primaryApproval: false
        }
      }));
    }
    
    // If unchecking notificationRecipient, also uncheck primaryNotification
    if (role === 'notificationRecipient' && !value) {
      setSystemContactRoles(prev => ({
        ...prev,
        [key]: {
          ...prev[key],
          primaryNotification: false
        }
      }));
    }
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
    const newContact: PropertyContact = {
      id: `temp-${Date.now()}`,
      position: '',
      name: '',
      email: '',
      phone: '',
      is_new: true
    };
    setContacts(prev => [...prev, newContact]);
  };

  const handleCustomContactDelete = (id: string) => {
    setContacts(prev => prev.filter(contact => contact.id !== id));
  };

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
      
      setOriginalPropertyName(data.property_name || '');
      
      // Populate system contacts from property data
      setSystemContacts({
        community_manager: {
          name: data.community_manager_name || '',
          email: data.community_manager_email || '',
          secondary_email: data.community_manager_secondary_email || '',
          phone: data.community_manager_phone || '',
          title: data.community_manager_title || 'Community Manager'
        },
        maintenance_supervisor: {
          name: data.maintenance_supervisor_name || '',
          email: data.maintenance_supervisor_email || '',
          secondary_email: data.maintenance_supervisor_secondary_email || '',
          phone: data.maintenance_supervisor_phone || '',
          title: data.maintenance_supervisor_title || 'Maintenance Supervisor'
        },
        primary_contact: {
          name: data.primary_contact_name || '',
          email: data.primary_contact_email || '',
          secondary_email: data.primary_contact_secondary_email || '',
          phone: data.primary_contact_phone || '',
          title: data.primary_contact_role || 'Primary Contact'
        },
        ap: {
          name: data.ap_name || '',
          email: data.ap_email || '',
          secondary_email: data.ap_secondary_email || '',
          phone: data.ap_phone || '',
          title: 'Accounts Payable'
        }
      });
      
      // Load system contact roles from database
      console.log('📥 Loading system contact roles from database:', {
        cm_subcontractor: data.community_manager_is_subcontractor,
        cm_approval: data.community_manager_is_approval_recipient,
        ms_subcontractor: data.maintenance_supervisor_is_subcontractor,
        ap_ar: data.ap_is_ar
      });
      
      setSystemContactRoles({
        community_manager: {
          subcontractor: data.community_manager_is_subcontractor || false,
          accountsReceivable: data.community_manager_is_ar || false,
          approvalRecipient: data.community_manager_is_approval_recipient || false,
          notificationRecipient: data.community_manager_is_notification_recipient || false,
          primaryApproval: data.community_manager_is_primary_approval || false,
          primaryNotification: data.community_manager_is_primary_notification || false
        },
        maintenance_supervisor: {
          subcontractor: data.maintenance_supervisor_is_subcontractor || false,
          accountsReceivable: data.maintenance_supervisor_is_ar || false,
          approvalRecipient: data.maintenance_supervisor_is_approval_recipient || false,
          notificationRecipient: data.maintenance_supervisor_is_notification_recipient || false,
          primaryApproval: data.maintenance_supervisor_is_primary_approval || false,
          primaryNotification: data.maintenance_supervisor_is_primary_notification || false
        },
        primary_contact: {
          subcontractor: data.primary_contact_is_subcontractor || false,
          accountsReceivable: data.primary_contact_is_ar || false,
          approvalRecipient: data.primary_contact_is_approval_recipient || false,
          notificationRecipient: data.primary_contact_is_notification_recipient || false,
          primaryApproval: data.primary_contact_is_primary_approval || false,
          primaryNotification: data.primary_contact_is_primary_notification || false
        },
        ap: {
          subcontractor: data.ap_is_subcontractor || false,
          accountsReceivable: data.ap_is_ar || false,
          approvalRecipient: data.ap_is_approval_recipient || false,
          notificationRecipient: data.ap_is_notification_recipient || false,
          primaryApproval: data.ap_is_primary_approval || false,
          primaryNotification: data.ap_is_primary_notification || false
        }
      });
      
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
        billing_notes: data.billing_notes || '',
        extra_charges_notes: data.extra_charges_notes || '',
        occupied_regular_paint_fees: data.occupied_regular_paint_fees || '',
        quickbooks_number: data.quickbooks_number || '',
        unit_map_file_path: data.unit_map_file_path || '',
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
        property_management_group_id: formData.property_management_group_id || null,
        // System contact info
        community_manager_name: systemContacts.community_manager.name,
        community_manager_email: systemContacts.community_manager.email,
        community_manager_phone: systemContacts.community_manager.phone,
        community_manager_secondary_email: systemContacts.community_manager.secondary_email || null,
        community_manager_title: systemContacts.community_manager.title || 'Community Manager',
        maintenance_supervisor_name: systemContacts.maintenance_supervisor.name,
        maintenance_supervisor_email: systemContacts.maintenance_supervisor.email,
        maintenance_supervisor_phone: systemContacts.maintenance_supervisor.phone,
        maintenance_supervisor_secondary_email: systemContacts.maintenance_supervisor.secondary_email || null,
        maintenance_supervisor_title: systemContacts.maintenance_supervisor.title || 'Maintenance Supervisor',
        ap_name: systemContacts.ap.name,
        ap_email: systemContacts.ap.email,
        ap_phone: systemContacts.ap.phone,
        ap_secondary_email: systemContacts.ap.secondary_email || null,
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

      dateFields.forEach(field => {
        updateData[field] = formData[field as keyof typeof formData] || null;
      });

      // Set primary contact fields based on which contact has the subcontractor role
      const subcontractorContact = Object.entries(systemContactRoles).find(
        ([_, roles]) => roles.subcontractor
      );
      
      if (subcontractorContact) {
        const [key] = subcontractorContact;
        const contact = systemContacts[key as SystemContactKey];
        updateData.primary_contact_name = contact.name;
        updateData.primary_contact_role = contact.title;
        updateData.primary_contact_email = contact.email;
        updateData.primary_contact_phone = contact.phone;
        updateData.primary_contact_secondary_email = contact.secondary_email || null;
      } else {
        // Check custom contacts
        const customSubContact = contacts.find(c => c.is_subcontractor_contact);
        if (customSubContact) {
          updateData.primary_contact_name = customSubContact.name;
          updateData.primary_contact_role = customSubContact.position;
          updateData.primary_contact_email = customSubContact.email;
          updateData.primary_contact_phone = customSubContact.phone;
          updateData.primary_contact_secondary_email = customSubContact.secondary_email || null;
        } else {
          // Fallback to community manager
          updateData.primary_contact_name = systemContacts.community_manager.name;
          updateData.primary_contact_role = systemContacts.community_manager.title;
          updateData.primary_contact_email = systemContacts.community_manager.email;
          updateData.primary_contact_phone = systemContacts.community_manager.phone;
          updateData.primary_contact_secondary_email = systemContacts.community_manager.secondary_email || null;
        }
      }

      console.log('💾 Saving system contact roles:', systemContactRoles);
      console.log('💾 Update data includes role fields:', {
        cm_subcontractor: updateData.community_manager_is_subcontractor,
        cm_approval: updateData.community_manager_is_approval_recipient,
        ms_subcontractor: updateData.maintenance_supervisor_is_subcontractor,
        ap_ar: updateData.ap_is_ar
      });

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
            console.log('💾 Saving contacts with roles:', contacts);
            const contactsToInsert = contacts.map(c => ({
              property_id: propertyId,
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

            const { error: insertError } = await supabase
              .from('property_contacts')
              .insert(contactsToInsert);
            
            if (insertError) {
              console.error('❌ Error inserting contacts:', insertError);
              throw insertError;
            } else {
              console.log('✅ Contacts saved successfully');
            }
          }

        } catch (paintError) {
          console.error('Error saving additional data:', paintError);
          // Continue with navigation even if paint schemes/contacts fail to save
        }
      }

      if (propertyId && originalPropertyName && formData.property_name.trim() !== originalPropertyName.trim()) {
        const shouldUpdateFolder = window.confirm('Update folder display name too?');
        if (shouldUpdateFolder) {
          const { data: folderData } = await supabase
            .from('files')
            .select('id')
            .eq('property_id', propertyId)
            .is('folder_id', null)
            .eq('type', 'folder/directory')
            .order('created_at', { ascending: true })
            .maybeSingle();
          if (folderData?.id) {
            await supabase.rpc('rename_folder', {
              p_folder_id: folderData.id,
              p_new_name: formData.property_name.trim()
            });
          }
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
