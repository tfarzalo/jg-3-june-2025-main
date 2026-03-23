import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Building2, 
  Pencil, 
  MapPin, 
  Phone, 
  Mail, 
  User, 
  Plus, 
  Calendar,
  Clipboard,
  ClipboardCheck,
  FileText,
  X,
  Check,
  Edit,
  Save,
  Trash2,
  ArrowLeft,
  ZoomIn,
  FolderOpen,
  Users,
  HardHat,
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { PropertyMap } from './PropertyMap';
import { formatAddress } from '../lib/utils/formatUtils';
import { formatDate, formatDisplayDate } from '../lib/dateUtils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { PaintColorsViewer } from './properties/PaintColorsViewer';
import { PaintScheme } from '../lib/types';
import { Lightbox } from './Lightbox';
import { usePropertyPhaseCounts } from '../hooks/usePropertyPhaseCounts';
import { StatCard } from './ui/StatCard';
import { getPreviewUrl } from '../utils/storagePreviews';
import { getPropertyUnitMaps } from '../lib/utils/fileUpload';
import { useUserRole } from '../contexts/UserRoleContext';
import { getBackNavigationPath } from '../lib/utils';
import { PropertyFilesPreview } from './properties/PropertyFilesPreview';
import { PropertyContactsViewer } from './property/PropertyContactsViewer';

interface Property {
  id: string;
  property_name: string;
  address: string;
  address_2: string | null;
  city: string;
  state: string;
  zip: string;
  phone: string;
  region: string;
  property_grade: string;
  supplies_paint: string;
  unit_layout: string;
  notes_and_callbacks: string;
  property_management_group_id: string;
  property_management_group: {
    company_name: string;
  };
  community_manager_name: string;
  community_manager_email: string;
  community_manager_phone: string;
  community_manager_title: string | null;
  community_manager_secondary_email?: string | null;
  maintenance_supervisor_name: string;
  maintenance_supervisor_email: string;
  maintenance_supervisor_phone: string;
  maintenance_supervisor_title: string | null;
  maintenance_supervisor_secondary_email?: string | null;
  point_of_contact: string;
  primary_contact_name: string;
  primary_contact_phone: string;
  primary_contact_role: string;
  primary_contact_email?: string | null;
  primary_contact_secondary_email?: string | null;
  subcontractor_a: string;
  subcontractor_b: string;
  ap_name: string;
  ap_email: string;
  ap_phone: string;
  ap_secondary_email?: string | null;
  billing_notes: string;
  extra_charges_notes: string;
  occupied_regular_paint_fees: string;
  quickbooks_number: string;
  color_walls: string;
  color_trim: string;
  color_regular_unit: string;
  color_kitchen_bathroom: string;
  color_ceilings: string;
  // Compliance fields
  compliance_bid_approved: string;
  compliance_coi_address: string;
  compliance_create_sub_prop_portal: string;
  compliance_notify_team: string;
  compliance_upload_documents: string;
  compliance_invoice_delivery: string;
  compliance_approved: string;
  compliance_required: string;
  compliance_po_needed: string;
  compliance_w9_created: string;
  compliance_required_date: string | null;
  compliance_approved_date: string | null;
  compliance_bid_approved_date: string | null;
  compliance_po_needed_date: string | null;
  compliance_w9_created_date: string | null;
  compliance_coi_address_date: string | null;
  compliance_create_sub_prop_portal_date: string | null;
  compliance_notify_team_date: string | null;
  compliance_upload_documents_date: string | null;
  compliance_invoice_delivery_date: string | null;
  paint_location: string;
  unit_map_file_id: string | null;
  unit_map_file_path: string | null;
  // System contact roles
  community_manager_is_subcontractor?: boolean;
  community_manager_is_ar?: boolean;
  community_manager_is_approval_recipient?: boolean;
  community_manager_is_primary_approval?: boolean;
  community_manager_is_notification_recipient?: boolean;
  community_manager_is_primary_notification?: boolean;
  maintenance_supervisor_is_subcontractor?: boolean;
  maintenance_supervisor_is_ar?: boolean;
  maintenance_supervisor_is_approval_recipient?: boolean;
  maintenance_supervisor_is_primary_approval?: boolean;
  maintenance_supervisor_is_notification_recipient?: boolean;
  maintenance_supervisor_is_primary_notification?: boolean;
  ap_is_subcontractor?: boolean;
  ap_is_ar?: boolean;
  ap_is_approval_recipient?: boolean;
  ap_is_primary_approval?: boolean;
  ap_is_notification_recipient?: boolean;
  ap_is_primary_notification?: boolean;
  primary_contact_is_subcontractor?: boolean;
  primary_contact_is_ar?: boolean;
  primary_contact_is_approval_recipient?: boolean;
  primary_contact_is_primary_approval?: boolean;
  primary_contact_is_notification_recipient?: boolean;
  primary_contact_is_primary_notification?: boolean;
}

interface BillingCategory {
  id: string;
  name: string;
  sort_order: number;
  is_extra_charge?: boolean | null;
}

interface BillingDetail {
  id: string;
  category_id: string;
  unit_size_id: string;
  bill_amount: number;
  sub_pay_amount: number;
  profit_amount: number | null;
  is_hourly: boolean;
}

interface PropertyCallback {
  id: string;
  property_id: string;
  callback_date: string;
  painter: string;
  unit_number: string;
  reason: string;
  posted_by: string;
  created_at: string;
  poster: {
    full_name: string;
  };
}

interface PropertyUpdate {
  id: string;
  property_id: string;
  update_date: string;
  update_type: string;
  note: string;
  posted_by: string;
  created_at: string;
  poster: {
    full_name: string;
  };
}

interface PropertyGeneralNote {
  id: string;
  property_id: string;
  topic: string;
  note_content: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  creator?: {
    full_name: string;
  } | null;
}

interface PropertyContact {
  id: string;
  property_id: string;
  position: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  secondary_email?: string | null;
  is_subcontractor_contact?: boolean;
  is_accounts_receivable_contact?: boolean;
  is_approval_recipient?: boolean;
  is_notification_recipient?: boolean;
  is_primary_approval_recipient?: boolean;
  is_primary_notification_recipient?: boolean;
}

export function PropertyDetails() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const navigate = useNavigate();
  const { isSubcontractor, isAdmin } = useUserRole();
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<BillingCategory[]>([]);
  const [categoryDetails, setCategoryDetails] = useState<{[key: string]: BillingDetail[]}>({});
  const [unitSizes, setUnitSizes] = useState<{[key: string]: string}>({});
  const [callbacks, setCallbacks] = useState<PropertyCallback[]>([]);
  const [updates, setUpdates] = useState<PropertyUpdate[]>([]);
  const [generalNotes, setGeneralNotes] = useState<PropertyGeneralNote[]>([]);
  const [paintSchemes, setPaintSchemes] = useState<PaintScheme[]>([]);
  const [contacts, setContacts] = useState<PropertyContact[]>([]);
  const [editingSecondaryEmailContactId, setEditingSecondaryEmailContactId] = useState<string | null>(null);
  const [secondaryEmailDraft, setSecondaryEmailDraft] = useState('');
  const [secondaryEmailSavingContactId, setSecondaryEmailSavingContactId] = useState<string | null>(null);
  const [editingPropertySecondaryEmailField, setEditingPropertySecondaryEmailField] = useState<string | null>(null);
  const [propertySecondaryEmailDraft, setPropertySecondaryEmailDraft] = useState('');
  const [propertySecondaryEmailSavingField, setPropertySecondaryEmailSavingField] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [unitMapUrl, setUnitMapUrl] = useState<string | null>(null);
  const [unitMapImages, setUnitMapImages] = useState<Array<{ url: string; alt: string; label: string }>>([]);
  const [notificationContactSource, setNotificationContactSource] = useState<string>('community_manager');

  // Preferred subcontractors
  interface SubcontractorUser { id: string; full_name: string; email: string | null; }
  const [subcontractorUsers, setSubcontractorUsers] = useState<SubcontractorUser[]>([]);
  const [preferredSubA, setPreferredSubA] = useState<string | null>(null);
  const [preferredSubB, setPreferredSubB] = useState<string | null>(null);
  const [preferredSubC, setPreferredSubC] = useState<string | null>(null);
  const [exclusionNote, setExclusionNote] = useState<string>('');
  const [exclusionNoteDraft, setExclusionNoteDraft] = useState<string>('');
  const [editingExclusionNote, setEditingExclusionNote] = useState(false);
  const [savingExclusionNote, setSavingExclusionNote] = useState(false);

  // Load all unit map images from property_unit_maps table
  useEffect(() => {
    const loadUnitMaps = async () => {
      if (!property?.id) return;

      // Try loading from the new multi-image table first
      const records = await getPropertyUnitMaps(property.id);

      if (records.length > 0) {
        const resolved = await Promise.all(
          records.map(async (r, idx) => {
            try {
              const result = await getPreviewUrl(supabase, 'files', r.file_path);
              return {
                url: result.url,
                alt: r.display_name || `Property Unit Map ${idx + 1}`,
                label: r.display_name || `Image ${idx + 1} of ${records.length}`,
                is_primary: r.is_primary,
              };
            } catch {
              try {
                const { data } = supabase.storage.from('files').getPublicUrl(r.file_path);
                return {
                  url: data.publicUrl,
                  alt: r.display_name || `Property Unit Map ${idx + 1}`,
                  label: r.display_name || `Image ${idx + 1} of ${records.length}`,
                  is_primary: r.is_primary,
                };
              } catch {
                return null;
              }
            }
          })
        );

        const valid = resolved.filter(Boolean) as Array<{ url: string; alt: string; label: string; is_primary: boolean }>;
        // Put primary image first
        valid.sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));
        setUnitMapImages(valid);
        if (valid.length > 0) setUnitMapUrl(valid[0].url);
        return;
      }

      // Fallback: legacy single-image path
      if (property?.unit_map_file_path) {
        try {
          const { data: fileData } = await supabase
            .from('files')
            .select('path, storage_path')
            .eq('id', property.unit_map_file_id)
            .single();

          const filePath = fileData?.storage_path || fileData?.path || property.unit_map_file_path;
          const previewResult = await getPreviewUrl(supabase, 'files', filePath);
          setUnitMapUrl(previewResult.url);
          setUnitMapImages([{ url: previewResult.url, alt: 'Property Unit Map', label: 'Property Unit Map' }]);
        } catch {
          try {
            const { data: urlData } = supabase.storage
              .from('files')
              .getPublicUrl(property.unit_map_file_path);
            setUnitMapUrl(urlData.publicUrl);
            setUnitMapImages([{ url: urlData.publicUrl, alt: 'Property Unit Map', label: 'Property Unit Map' }]);
          } catch {
            setUnitMapUrl(null);
            setUnitMapImages([]);
          }
        }
      } else {
        setUnitMapUrl(null);
        setUnitMapImages([]);
      }
    };

    loadUnitMaps();
  }, [property?.id, property?.unit_map_file_path, property?.unit_map_file_id]);

  const [propertyJobs, setPropertyJobs] = useState<any[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  
  // Use the new hook for phase counts
  const { jobRequests: phaseJobRequests, workOrders, pendingWorkOrders, completed, cancelled, invoicing, totalJobs, loading: phaseLoading } = usePropertyPhaseCounts(propertyId);
  
  // State for new callback form
  const [showCallbackForm, setShowCallbackForm] = useState(false);
  const [newCallback, setNewCallback] = useState({
    callback_date: format(new Date(), 'yyyy-MM-dd'),
    painter: '',
    unit_number: '',
    reason: ''
  });
  
  // State for new update form
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [newUpdate, setNewUpdate] = useState({
    update_date: format(new Date(), 'yyyy-MM-dd'),
    update_type: '',
    note: ''
  });
  const [showGeneralNoteForm, setShowGeneralNoteForm] = useState(false);
  const [newGeneralNote, setNewGeneralNote] = useState({
    topic: '',
    note_content: ''
  });
  const [editingGeneralNoteId, setEditingGeneralNoteId] = useState<string | null>(null);
  const [editingGeneralNote, setEditingGeneralNote] = useState({
    topic: '',
    note_content: ''
  });
  
  // State for delete confirmation
  const [showDeleteCallbackConfirm, setShowDeleteCallbackConfirm] = useState<string | null>(null);
  const [showDeleteUpdateConfirm, setShowDeleteUpdateConfirm] = useState<string | null>(null);

  const fetchPropertyGeneralNotes = async () => {
    if (!propertyId) return;

    try {
      const { data, error } = await supabase
        .from('property_general_notes')
        .select(`
          id,
          property_id,
          topic,
          note_content,
          created_by,
          created_at,
          updated_at,
          creator:profiles!property_general_notes_created_by_fkey(full_name)
        `)
        .eq('property_id', propertyId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching property general notes:', error);
        setGeneralNotes([]);
        return;
      }

      setGeneralNotes(data || []);
    } catch (error) {
      console.error('Error fetching property general notes:', error);
      setGeneralNotes([]);
    }
  };

  const formattedAddress = property ? [
    property.address,
    property.city,
    property.state,
    property.zip
  ].filter(Boolean).join(', ') : '';

  const formatComplianceDate = (value: string | null) => {
    if (!value) return 'No date set';
    const parsed = new Date(value);
    if (isNaN(parsed.getTime())) return 'Invalid date';
    return format(parsed, 'MM/dd/yyyy');
  };

  const updateNotificationEmail = async (email: string | null) => {
    if (!propertyId) return;
    try {
      await supabase
        .from('properties')
        .update({ primary_contact_email: email })
        .eq('id', propertyId);
      toast.success('Email notifications contact updated');
      setProperty(prev => prev ? { ...prev, primary_contact_email: email || '' } as any : prev);
    } catch (e) {
      toast.error('Failed to update notifications contact');
    }
  };
  const handleNotificationContactChange = (source: string) => {
    setNotificationContactSource(source);
    if (!property) return;
    if (source === 'community_manager') {
      updateNotificationEmail(property.community_manager_email || null);
    } else if (source === 'maintenance_supervisor') {
      updateNotificationEmail(property.maintenance_supervisor_email || null);
    } else if (source === 'ap') {
      updateNotificationEmail(property.ap_email || null);
    } else {
      const contact = contacts.find(c => c.id === source);
      updateNotificationEmail(contact?.email || null);
    }
  };

  const cancelSecondaryEmailEdit = () => {
    setEditingSecondaryEmailContactId(null);
    setSecondaryEmailDraft('');
  };

  const cancelPropertySecondaryEmailEdit = () => {
    setEditingPropertySecondaryEmailField(null);
    setPropertySecondaryEmailDraft('');
  };

  const handleSaveSecondaryEmail = async (contactId: string) => {
    setSecondaryEmailSavingContactId(contactId);
    const trimmedEmail = secondaryEmailDraft.trim();

    try {
      const { error } = await supabase
        .from('property_contacts')
        .update({ secondary_email: trimmedEmail || null })
        .eq('id', contactId);

      if (error) throw error;

      setContacts(prev =>
        prev.map(contact =>
          contact.id === contactId
            ? { ...contact, secondary_email: trimmedEmail || null }
            : contact
        )
      );
      toast.success('Secondary email saved');
      cancelSecondaryEmailEdit();
    } catch (err) {
      console.error('Error saving secondary email:', err);
      toast.error('Unable to save secondary email');
    } finally {
      setSecondaryEmailSavingContactId(null);
    }
  };

  const handleSavePropertySecondaryEmail = async (field: string) => {
    if (!propertyId) return;
    setPropertySecondaryEmailSavingField(field);
    const trimmedEmail = propertySecondaryEmailDraft.trim();

    try {
      const { error } = await supabase
        .from('properties')
        .update({ [field]: trimmedEmail || null })
        .eq('id', propertyId);

      if (error) throw error;

      setProperty(prev => (prev ? { ...prev, [field]: trimmedEmail || null } as Property : prev));
      toast.success('Secondary email saved');
      cancelPropertySecondaryEmailEdit();
    } catch (err) {
      console.error('Error saving secondary email:', err);
      toast.error('Unable to save secondary email');
    } finally {
      setPropertySecondaryEmailSavingField(null);
    }
  };

  const savePreferredSubcontractor = async (slot: 'a' | 'b' | 'c', userId: string | null) => {
    if (!propertyId) return;
    const col = `preferred_subcontractor_${slot}_id`;
    try {
      const { error } = await supabase.from('properties').update({ [col]: userId || null }).eq('id', propertyId);
      if (error) throw error;
      if (slot === 'a') setPreferredSubA(userId);
      if (slot === 'b') setPreferredSubB(userId);
      if (slot === 'c') setPreferredSubC(userId);
      toast.success('Preferred subcontractor updated');
    } catch {
      toast.error('Failed to update preferred subcontractor');
    }
  };

  const saveExclusionNote = async () => {
    if (!propertyId) return;
    setSavingExclusionNote(true);
    try {
      const { error } = await supabase
        .from('properties')
        .update({ subcontractor_exclusion_note: exclusionNoteDraft.trim() || null })
        .eq('id', propertyId);
      if (error) throw error;
      setExclusionNote(exclusionNoteDraft.trim());
      setEditingExclusionNote(false);
      toast.success('Exclusion note saved');
    } catch {
      toast.error('Failed to save exclusion note');
    } finally {
      setSavingExclusionNote(false);
    }
  };

  const complianceItems: { label: string; value: string; date?: string | null }[] = property ? [
    { label: 'Compliance Required', value: property.compliance_required, date: property.compliance_required_date },
    { label: 'Compliance Approved', value: property.compliance_approved, date: property.compliance_approved_date },
    { label: 'Bid Approved', value: property.compliance_bid_approved, date: property.compliance_bid_approved_date },
    { label: 'PO Needed', value: property.compliance_po_needed, date: property.compliance_po_needed_date },
    { label: 'W9 Created', value: property.compliance_w9_created, date: property.compliance_w9_created_date },
    { label: 'COI Address', value: property.compliance_coi_address, date: property.compliance_coi_address_date },
    { label: 'Create Sub Prop Portal', value: property.compliance_create_sub_prop_portal, date: property.compliance_create_sub_prop_portal_date },
    { label: 'Notify Team', value: property.compliance_notify_team, date: property.compliance_notify_team_date },
    { label: 'Upload Documents', value: property.compliance_upload_documents, date: property.compliance_upload_documents_date },
    { label: 'Invoice Delivery', value: property.compliance_invoice_delivery, date: property.compliance_invoice_delivery_date },
  ] : [];

  const getComplianceBadgeClass = (label: string, value: string) => {
    const v = (value || '').toLowerCase();
    if (!value || v === 'n/a') return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    
    // Consistent color scheme: Yes = Green, No = Red
    if (v === 'yes' || v === 'completed') return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200';
    if (v === 'no') return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200';
    if (v === 'pending') return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200';
    
    return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
  };



  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        if (!propertyId) {
          setError('Property ID is required');
          setLoading(false);
          navigate(getBackNavigationPath('/dashboard/properties', isSubcontractor));
          return;
        }

        // Fetch property data
        const { data: propertyData, error: propertyError } = await supabase
          .from('properties')
          .select(`
            *,
            property_management_group:property_management_groups!fk_property_management_group(
              company_name
            )
          `)
          .eq('id', propertyId)
          .single();

        if (propertyError) {
          throw propertyError;
        }
        if (!propertyData) {
          setError('Property not found');
          setLoading(false);
          navigate(getBackNavigationPath('/dashboard/properties', isSubcontractor));
          return;
        }
        

        setProperty(propertyData);

        // Load preferred subcontractors from new columns
        setPreferredSubA(propertyData.preferred_subcontractor_a_id || null);
        setPreferredSubB(propertyData.preferred_subcontractor_b_id || null);
        setPreferredSubC(propertyData.preferred_subcontractor_c_id || null);
        const note = propertyData.subcontractor_exclusion_note || '';
        setExclusionNote(note);
        setExclusionNoteDraft(note);

        // Fetch all subcontractor users for the selector
        const { data: subUsers } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .eq('role', 'subcontractor')
          .order('full_name');
        setSubcontractorUsers(subUsers || []);

        // Fetch billing data
        const { data: categoryData, error: categoryError } = await supabase
          .from('billing_categories')
          .select('id,name,sort_order,is_extra_charge')
          .eq('property_id', propertyId)
          .order('sort_order');

        if (categoryError) throw categoryError;
        setCategories(categoryData || []);

        if (categoryData?.length) {
          const { data: detailsData, error: detailsError } = await supabase
            .from('billing_details')
            .select('*')
            .eq('property_id', propertyId)
            .order('sort_order');

          if (detailsError) throw detailsError;

          const detailsByCategory: {[key: string]: BillingDetail[]} = {};
          detailsData?.forEach(detail => {
            if (!detailsByCategory[detail.category_id]) {
              detailsByCategory[detail.category_id] = [];
            }
            detailsByCategory[detail.category_id].push(detail);
          });
          // Sort each category's details by sort_order, fallback to unit size label
          const sortedByCategory: {[key: string]: BillingDetail[]} = {};
          Object.keys(detailsByCategory).forEach(catId => {
            const arr = detailsByCategory[catId] ?? [];
            sortedByCategory[catId] = [...arr].sort((a, b) => {
              const ao = (a as any).sort_order ?? Number.MAX_SAFE_INTEGER;
              const bo = (b as any).sort_order ?? Number.MAX_SAFE_INTEGER;
              if (ao !== bo) return ao - bo;
              const al = unitSizes[a.unit_size_id] ?? '';
              const bl = unitSizes[b.unit_size_id] ?? '';
              return al.localeCompare(bl);
            });
          });
          setCategoryDetails(sortedByCategory);

          const { data: unitSizeData, error: unitSizeError } = await supabase
            .from('unit_sizes')
            .select('*');

          if (unitSizeError) throw unitSizeError;

          const unitSizeLookup: {[key: string]: string} = {};
          unitSizeData?.forEach(size => {
            unitSizeLookup[size.id] = size.unit_size_label;
          });
          setUnitSizes(unitSizeLookup);
        }

        // Fetch callbacks
        const { data: callbackData, error: callbackError } = await supabase
          .from('property_callbacks')
          .select(`
            *,
            poster:profiles(full_name)
          `)
          .eq('property_id', propertyId)
          .order('callback_date', { ascending: false });

        if (callbackError) throw callbackError;
        setCallbacks(callbackData || []);

        // Fetch updates
        const { data: updateData, error: updateError } = await supabase
          .from('property_updates')
          .select(`
            *,
            poster:profiles(full_name)
          `)
          .eq('property_id', propertyId)
          .order('update_date', { ascending: false });

        if (updateError) throw updateError;
        setUpdates(updateData || []);

        await fetchPropertyGeneralNotes();

        // Fetch additional contacts
        const { data: contactsData, error: contactsError } = await supabase
          .from('property_contacts')
          .select('*')
          .eq('property_id', propertyId);

        if (contactsError) throw contactsError;
        setContacts(contactsData || []);
        const currentEmail = propertyData.primary_contact_email || propertyData.ap_email || null;
        if (currentEmail) {
          if (currentEmail === propertyData.community_manager_email) {
            setNotificationContactSource('community_manager');
          } else if (currentEmail === propertyData.maintenance_supervisor_email) {
            setNotificationContactSource('maintenance_supervisor');
          } else if (currentEmail === propertyData.ap_email) {
            setNotificationContactSource('ap');
          } else {
            const match = (contactsData || []).find(c => c.email === currentEmail);
            if (match) {
              setNotificationContactSource(match.id);
            } else if (propertyData.ap_email) {
              setNotificationContactSource('ap');
            }
          }
        } else if (propertyData.ap_email) {
          setNotificationContactSource('ap');
        }

        // Fetch paint schemes
        try {
          const { getPaintSchemesByProperty } = await import('../lib/paintColors');
          const schemes = await getPaintSchemesByProperty(propertyId);
          setPaintSchemes(schemes);
        } catch (paintError) {
          console.error('Failed to fetch paint schemes:', paintError);
          // Don't show error to user, just log it
        }



        // Fetch property jobs for Property Job History section
        try {
          setJobsLoading(true);
          // Get all jobs for the property with basic information
          const { data: propertyJobsData, error: propertyJobsError } = await supabase
            .from('jobs')
            .select(`
              id,
              work_order_num,
              unit_number,
              scheduled_date,
              description,
              current_phase_id,
              property:properties (
                id,
                property_name,
                address,
                city,
                state
              ),
              unit_size:unit_sizes (
                unit_size_label
              ),
              job_type:job_types (
                job_type_label
              )
            `)
            .eq('property_id', propertyId)
            .order('created_at', { ascending: false });

          if (!propertyJobsError && propertyJobsData) {
            // Filter jobs to only show those in the specific phases we want
            const allowedPhases = ['Job Request', 'Pending Work Order', 'Work Order', 'Completed', 'Invoicing', 'Cancelled'];
            
            // First, get the phase IDs for the allowed phases
            const { data: phaseData, error: phaseError } = await supabase
              .from('job_phases')
              .select('id, job_phase_label, color_light_mode, color_dark_mode')
              .in('job_phase_label', allowedPhases);
            
            if (phaseError) {
              console.error('Error fetching phase data:', phaseError);
              setPropertyJobs([]);
              return;
            }
            
            const allowedPhaseIds = phaseData.map(phase => phase.id);
            const filteredJobs = propertyJobsData.filter(job => 
              job.current_phase_id && allowedPhaseIds.includes(job.current_phase_id)
            );
            
            // Add phase information to each job
            const jobsWithPhaseInfo = filteredJobs.map(job => {
              const phase = phaseData.find(p => p.id === job.current_phase_id);
              return {
                ...job,
                job_phase: phase || null
              };
            });
            
            setPropertyJobs(jobsWithPhaseInfo);
          } else if (propertyJobsError) {
            console.error('Error fetching property jobs:', propertyJobsError);
          }
        } catch (propertyJobsError) {
          console.error('Failed to fetch property jobs:', propertyJobsError);
          // Don't show error to user, just log it
        } finally {
          setJobsLoading(false);
        }

        } catch (err) {
        console.error('Error fetching property details:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch property details');
        navigate(getBackNavigationPath('/dashboard/properties', isSubcontractor));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [propertyId, navigate]);

  const handleAddCallback = async () => {
    if (!propertyId) return;

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('property_callbacks')
        .insert({
          property_id: propertyId,
          callback_date: newCallback.callback_date,
          painter: newCallback.painter,
          unit_number: newCallback.unit_number,
          reason: newCallback.reason,
          posted_by: userData.user.id
        });

      if (error) throw error;

      // Reset form and refresh data
      setNewCallback({
        callback_date: format(new Date(), 'yyyy-MM-dd'),
        painter: '',
        unit_number: '',
        reason: ''
      });
      setShowCallbackForm(false);

      // Fetch updated callbacks
      const { data: callbackData, error: callbackError } = await supabase
        .from('property_callbacks')
        .select(`
          *,
          poster:profiles(full_name)
        `)
        .eq('property_id', propertyId)
        .order('callback_date', { ascending: false });

      if (callbackError) throw callbackError;
      setCallbacks(callbackData || []);
      
      toast.success('Callback added successfully');
    } catch (err) {
      console.error('Error adding callback:', err);
      toast.error('Failed to add callback');
    }
  };

  const handleAddUpdate = async () => {
    if (!propertyId) return;

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('property_updates')
        .insert({
          property_id: propertyId,
          update_date: newUpdate.update_date,
          update_type: newUpdate.update_type,
          note: newUpdate.note,
          posted_by: userData.user.id
        });

      if (error) throw error;

      // Reset form and refresh data
      setNewUpdate({
        update_date: format(new Date(), 'yyyy-MM-dd'),
        update_type: '',
        note: ''
      });
      setShowUpdateForm(false);

      // Fetch updated updates
      const { data: updateData, error: updateError } = await supabase
        .from('property_updates')
        .select(`
          *,
          poster:profiles(full_name)
        `)
        .eq('property_id', propertyId)
        .order('update_date', { ascending: false });

      if (updateError) throw updateError;
      setUpdates(updateData || []);
      
      toast.success('Update added successfully');
    } catch (err) {
      console.error('Error adding update:', err);
      toast.error('Failed to add update');
    }
  };

  const handleDeleteCallback = async (callbackId: string) => {
    try {
      const { error } = await supabase
        .from('property_callbacks')
        .delete()
        .eq('id', callbackId);

      if (error) throw error;
      
      setShowDeleteCallbackConfirm(null);

      // Fetch updated callbacks
      const { data: callbackData, error: callbackError } = await supabase
        .from('property_callbacks')
        .select(`
          *,
          poster:profiles(full_name)
        `)
        .eq('property_id', propertyId)
        .order('callback_date', { ascending: false });

      if (callbackError) throw callbackError;
      setCallbacks(callbackData || []);
      
      toast.success('Callback deleted successfully');
    } catch (err) {
      console.error('Error deleting callback:', err);
      toast.error('Failed to delete callback');
    }
  };

  const handleDeleteUpdate = async (updateId: string) => {
    try {
      const { error } = await supabase
        .from('property_updates')
        .delete()
        .eq('id', updateId);

      if (error) throw error;
      
      setShowDeleteUpdateConfirm(null);

      // Fetch updated updates
      const { data: updateData, error: updateError } = await supabase
        .from('property_updates')
        .select(`
          *,
          poster:profiles(full_name)
        `)
        .eq('property_id', propertyId)
        .order('update_date', { ascending: false });

      if (updateError) throw updateError;
      setUpdates(updateData || []);
      
      toast.success('Update deleted successfully');
    } catch (err) {
      console.error('Error deleting update:', err);
      toast.error('Failed to delete update');
    }
  };

  const handleAddGeneralNote = async () => {
    if (!propertyId) return;

    if (!newGeneralNote.topic.trim() || !newGeneralNote.note_content.trim()) {
      toast.error('Topic and note content are required');
      return;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('property_general_notes')
        .insert({
          property_id: propertyId,
          topic: newGeneralNote.topic.trim(),
          note_content: newGeneralNote.note_content.trim(),
          created_by: userData.user.id
        });

      if (error) throw error;

      setNewGeneralNote({
        topic: '',
        note_content: ''
      });
      setShowGeneralNoteForm(false);
      await fetchPropertyGeneralNotes();
      toast.success('General property note added successfully');
    } catch (err) {
      console.error('Error adding property general note:', err);
      toast.error('Failed to add general property note');
    }
  };

  const handleDeleteGeneralNote = async (noteId: string) => {
    try {
      const { error } = await supabase
        .from('property_general_notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;

      await fetchPropertyGeneralNotes();
      toast.success('General property note deleted successfully');
    } catch (err) {
      console.error('Error deleting property general note:', err);
      toast.error('Failed to delete general property note');
    }
  };

  const handleStartEditGeneralNote = (note: PropertyGeneralNote) => {
    setEditingGeneralNoteId(note.id);
    setEditingGeneralNote({
      topic: note.topic,
      note_content: note.note_content
    });
  };

  const handleCancelEditGeneralNote = () => {
    setEditingGeneralNoteId(null);
    setEditingGeneralNote({
      topic: '',
      note_content: ''
    });
  };

  const handleSaveGeneralNote = async (noteId: string) => {
    if (!editingGeneralNote.topic.trim() || !editingGeneralNote.note_content.trim()) {
      toast.error('Topic and note content are required');
      return;
    }

    try {
      const { error } = await supabase
        .from('property_general_notes')
        .update({
          topic: editingGeneralNote.topic.trim(),
          note_content: editingGeneralNote.note_content.trim()
        })
        .eq('id', noteId);

      if (error) throw error;

      await fetchPropertyGeneralNotes();
      handleCancelEditGeneralNote();
      toast.success('General property note updated successfully');
    } catch (err) {
      console.error('Error updating property general note:', err);
      toast.error('Failed to update general property note');
    }
  };

  // Simple smooth scroll function for anchor navigation
  const smoothScrollTo = (elementId: string) => {
    const element = document.getElementById(elementId);
    if (element) {
      element.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
      });
    }
  };



  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="p-6 bg-gray-100 dark:bg-[#0F172A] min-h-screen">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => navigate(getBackNavigationPath('/dashboard/properties', isSubcontractor))}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <ArrowLeft className="h-6 w-6" />
              </button>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Property Details</h1>
            </div>
          </div>
          <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-500/50 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg">
            {error || 'Property not found'}
          </div>
          <div className="mt-4">
            <button
              onClick={() => navigate(getBackNavigationPath('/dashboard/properties', isSubcontractor))}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Back to Properties
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-100 dark:bg-[#0F172A] min-h-screen smooth-scroll">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-3">
          <Building2 className="h-8 w-8 text-gray-600 dark:text-gray-400" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {property.property_name}
          </h2>
        </div>
        <div className="flex space-x-3">
          {!isSubcontractor && (
            <>
              <button
                type="button"
                onClick={() => navigate(`/dashboard/properties/${property.id}/edit`)}
                className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Pencil className="h-4 w-4 mr-2" />
                Edit Property
              </button>
              <button
                type="button"
                onClick={() => navigate(`/dashboard/properties/${property.id}/billing`)}
                className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Clipboard className="h-4 w-4 mr-2" />
                Manage Billing Details
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => navigate(getBackNavigationPath('/dashboard/properties', isSubcontractor))}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-400 bg-white dark:bg-[#1E293B] border border-gray-300 dark:border-[#2D3B4E] rounded-lg hover:bg-gray-50 dark:hover:bg-[#2D3B4E] transition-colors"
          >
            Back to List
          </button>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="grid grid-cols-9 gap-4 mb-8">
        <button 
          onClick={() => smoothScrollTo('basic-info')}
          className="flex flex-col items-center space-y-1 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          <Building2 className="h-4 w-4" />
          <span className="text-xs">Basic Info</span>
        </button>
        <button 
          onClick={() => smoothScrollTo('contacts')}
          className="flex flex-col items-center space-y-1 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          <User className="h-4 w-4" />
          <span className="text-xs">Contacts</span>
        </button>
        <button 
          onClick={() => smoothScrollTo('compliance')}
          className="flex flex-col items-center space-y-1 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          <ClipboardCheck className="h-4 w-4" />
          <span className="text-xs">Compliance</span>
        </button>
        <button 
          onClick={() => smoothScrollTo('paint-colors')}
          className="flex flex-col items-center space-y-1 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          <FileText className="h-4 w-4" />
          <span className="text-xs">Paint Colors</span>
        </button>
        <button 
          onClick={() => smoothScrollTo('billing-details')}
          className="flex flex-col items-center space-y-1 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          <Clipboard className="h-4 w-4" />
          <span className="text-xs">Billing</span>
        </button>
        <button 
          onClick={() => smoothScrollTo('callbacks')}
          className="flex flex-col items-center space-y-1 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          <Clipboard className="h-4 w-4" />
          <span className="text-xs">Callbacks</span>
        </button>
        <button 
          onClick={() => smoothScrollTo('notes-updates')}
          className="flex flex-col items-center space-y-1 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          <FileText className="h-4 w-4" />
          <span className="text-xs">Notes</span>
        </button>
        <button 
          onClick={() => smoothScrollTo('property-files')}
          className="flex flex-col items-center space-y-1 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
        >
          <FolderOpen className="h-4 w-4" />
          <span className="text-xs">Files</span>
        </button>
        <button 
          onClick={() => smoothScrollTo('job-history')}
          className="flex flex-col items-center space-y-1 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          <Clipboard className="h-4 w-4" />
          <span className="text-xs">History</span>
        </button>
      </div>


      <div className="space-y-8">
        {/* Top Row: Header Information */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Property Location Map - 2/4 width */}
          <div className="xl:col-span-2 bg-white dark:bg-[#1E293B] rounded-xl shadow-lg overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800 px-6 py-4">
              <h2 className="text-xl font-semibold text-white flex items-center">
                <MapPin className="h-5 w-5 mr-2" />
                Property Location
              </h2>
            </div>
            
            {/* Content */}
            <div className="p-6">
              {property && property.address ? (
                <PropertyMap 
                  address={formattedAddress}
                  className="w-full h-72 xl:h-80 rounded-lg overflow-hidden"
                />
              ) : (
                <div className="flex items-center justify-center h-72 xl:h-80 bg-gray-50 dark:bg-[#0F172A] rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                  <div className="text-center">
                    <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500 dark:text-gray-400 font-medium">No address available</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Basic Information - 1/4 width */}
          <div id="basic-info" className="xl:col-span-1 bg-white dark:bg-[#1E293B] rounded-xl shadow-lg overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-purple-700 dark:from-purple-700 dark:to-purple-800 px-6 py-4">
              <h3 className="text-lg font-semibold text-white flex items-center">
                <Building2 className="h-5 w-5 mr-2" />
                Basic Info
              </h3>
            </div>
            
            {/* Content */}
            <div className="p-6 space-y-4">
              <div className="flex items-start">
                <MapPin className="h-4 w-4 text-gray-500 dark:text-gray-400 mt-1 mr-3 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-gray-600 dark:text-gray-400 text-xs font-medium uppercase tracking-wide">Address</p>
                  <p className="text-gray-900 dark:text-white text-sm leading-relaxed">
                    {property.address}
                    {property.address_2 && <span><br />{property.address_2}</span>}
                    <br />
                    {property.city}, {property.state} {property.zip}
                  </p>
                </div>
              </div>
              <div className="flex items-start">
                <Building2 className="h-4 w-4 text-gray-500 dark:text-gray-400 mt-1 mr-3 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-gray-600 dark:text-gray-400 text-xs font-medium uppercase tracking-wide">Management Group</p>
                  <Link
                    to={`/dashboard/property-groups/${property.property_management_group_id}`}
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium"
                  >
                    {property.property_management_group?.company_name || 'No Group Assigned'}
                  </Link>
                </div>
              </div>
              {property.phone && (
                <div className="flex items-start">
                  <Phone className="h-4 w-4 text-gray-500 dark:text-gray-400 mt-1 mr-3 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-gray-600 dark:text-gray-400 text-xs font-medium uppercase tracking-wide">Phone</p>
                    <p className="text-gray-900 dark:text-white text-sm">{property.phone}</p>
                  </div>
                </div>
              )}
              {property.region && (
                <div className="flex items-start">
                  <MapPin className="h-4 w-4 text-gray-500 dark:text-gray-400 mt-1 mr-3 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-gray-600 dark:text-gray-400 text-xs font-medium uppercase tracking-wide">Region</p>
                    <p className="text-gray-900 dark:text-white text-sm">{property.region}</p>
                  </div>
                </div>
              )}
              {property.property_grade && (
                <div className="flex items-start">
                  <ClipboardCheck className="h-4 w-4 text-gray-500 dark:text-gray-400 mt-1 mr-3 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-gray-600 dark:text-gray-400 text-xs font-medium uppercase tracking-wide">Property Grade</p>
                    <p className="text-gray-900 dark:text-white text-sm font-medium">{property.property_grade}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick Stats - 1/4 width */}
          <div className="xl:col-span-1 bg-white dark:bg-[#1E293B] rounded-xl shadow-lg overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-600 to-green-700 dark:from-green-700 dark:to-green-800 px-6 py-4">
              <h3 className="text-lg font-semibold text-white flex items-center">
                <Clipboard className="h-5 w-5 mr-2" />
                Quick Stats
              </h3>
            </div>
            
            {/* Content */}
            <div className="p-6 space-y-3">
              {/* Top row - 2x3 grid */}
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  title="JOB REQUESTS"
                  value={phaseLoading ? '—' : phaseJobRequests.count}
                  accentColor={phaseJobRequests.color}
                  aria-label={`Job Requests: ${phaseJobRequests.count}`}
                />
                <StatCard
                  title="WORK ORDERS"
                  value={phaseLoading ? '—' : workOrders.count}
                  accentColor={workOrders.color}
                  aria-label={`Work Orders: ${workOrders.count}`}
                />
                <StatCard
                  title="PENDING WO"
                  value={phaseLoading ? '—' : pendingWorkOrders.count}
                  accentColor={pendingWorkOrders.color}
                  aria-label={`Pending Work Orders: ${pendingWorkOrders.count}`}
                />
                <StatCard
                  title="COMPLETED"
                  value={phaseLoading ? '—' : completed.count}
                  accentColor={completed.color}
                  aria-label={`Completed Jobs: ${completed.count}`}
                />
                <StatCard
                  title="INVOICING"
                  value={phaseLoading ? '—' : invoicing.count}
                  accentColor={invoicing.color}
                  aria-label={`Invoicing: ${invoicing.count}`}
                />
                <StatCard
                  title="CANCELLED"
                  value={phaseLoading ? '—' : cancelled.count}
                  accentColor={cancelled.color}
                  aria-label={`Cancelled Jobs: ${cancelled.count}`}
                />
              </div>
              
              {/* Bottom row - Full width total */}
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <div className="w-full">
                  <StatCard
                    title="TOTAL JOBS"
                    value={phaseLoading ? '—' : totalJobs.count}
                    accentColor={totalJobs.color}
                    aria-label={`Total Jobs: ${totalJobs.count}`}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Second Row: Contact Information — Full Width */}
        <div id="contacts">
          <PropertyContactsViewer
            systemContacts={{
              community_manager: {
                name: property.community_manager_name || '',
                email: property.community_manager_email || '',
                secondary_email: property.community_manager_secondary_email,
                phone: property.community_manager_phone || '',
                title: property.community_manager_title || 'Community Manager'
              },
              maintenance_supervisor: {
                name: property.maintenance_supervisor_name || '',
                email: property.maintenance_supervisor_email || '',
                secondary_email: property.maintenance_supervisor_secondary_email,
                phone: property.maintenance_supervisor_phone || '',
                title: property.maintenance_supervisor_title || 'Maintenance Supervisor'
              },
              primary_contact: {
                name: property.primary_contact_name || '',
                email: property.primary_contact_email || '',
                secondary_email: property.primary_contact_secondary_email,
                phone: property.primary_contact_phone || '',
                title: property.primary_contact_role || 'Primary Contact'
              },
              ap: {
                name: property.ap_name || '',
                email: property.ap_email || '',
                secondary_email: property.ap_secondary_email,
                phone: property.ap_phone || '',
                title: 'Accounts Payable'
              }
            }}
            systemContactRoles={{
              community_manager: {
                subcontractor: property.community_manager_is_subcontractor || false,
                approvalRecipient: property.community_manager_is_approval_recipient || false,
                notificationRecipient: property.community_manager_is_notification_recipient || false,
                primaryApproval: property.community_manager_is_primary_approval || false,
                primaryNotification: property.community_manager_is_primary_notification || false,
                accountsReceivable: property.community_manager_is_ar || false
              },
              maintenance_supervisor: {
                subcontractor: property.maintenance_supervisor_is_subcontractor || false,
                approvalRecipient: property.maintenance_supervisor_is_approval_recipient || false,
                notificationRecipient: property.maintenance_supervisor_is_notification_recipient || false,
                primaryApproval: property.maintenance_supervisor_is_primary_approval || false,
                primaryNotification: property.maintenance_supervisor_is_primary_notification || false,
                accountsReceivable: property.maintenance_supervisor_is_ar || false
              },
              primary_contact: {
                subcontractor: property.primary_contact_is_subcontractor || false,
                approvalRecipient: property.primary_contact_is_approval_recipient || false,
                notificationRecipient: property.primary_contact_is_notification_recipient || false,
                primaryApproval: property.primary_contact_is_primary_approval || false,
                primaryNotification: property.primary_contact_is_primary_notification || false,
                accountsReceivable: property.primary_contact_is_ar || false
              },
              ap: {
                subcontractor: property.ap_is_subcontractor || false,
                approvalRecipient: property.ap_is_approval_recipient || false,
                notificationRecipient: property.ap_is_notification_recipient || false,
                primaryApproval: property.ap_is_primary_approval || false,
                primaryNotification: property.ap_is_primary_notification || false,
                accountsReceivable: property.ap_is_ar || false
              }
            }}
            customContacts={contacts.map(c => ({
              id: c.id,
              position: (c as any).position || '',
              name: c.name || '',
              email: c.email || '',
              secondary_email: c.secondary_email,
              phone: c.phone || '',
              is_subcontractor_contact: c.is_subcontractor_contact || false,
              is_accounts_receivable_contact: c.is_accounts_receivable_contact || false,
              is_approval_recipient: c.is_approval_recipient || false,
              is_notification_recipient: c.is_notification_recipient || false,
              is_primary_approval_recipient: c.is_primary_approval_recipient || false,
              is_primary_notification_recipient: c.is_primary_notification_recipient || false,
              is_primary_contact: (c as any).is_primary_contact || false,
              receives_approval_emails: (c as any).receives_approval_emails || false,
              receives_notification_emails: (c as any).receives_notification_emails || false,
              custom_title: (c as any).custom_title || null,
            }))}
            onAddContact={() => navigate(`/dashboard/properties/${property.id}/edit`)}
          />
        </div>

        {/* Preferred Subcontractors — Full Width, right after Contacts */}
        <div className="bg-white dark:bg-[#1E293B] rounded-xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 dark:from-indigo-700 dark:to-indigo-800 px-6 py-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white flex items-center">
              <HardHat className="h-5 w-5 mr-2" />
              Preferred Subcontractors
            </h3>
            {!isSubcontractor && (
              <span className="text-indigo-200 text-xs">Select up to 3 preferred subcontractors for this property</span>
            )}
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {(['a', 'b', 'c'] as const).map((slot, idx) => {
                const label = ['A — Primary', 'B — Secondary', 'C — Tertiary'][idx];
                const value = [preferredSubA, preferredSubB, preferredSubC][idx];
                const selectedUser = subcontractorUsers.find(u => u.id === value);
                return (
                  <div key={slot} className="flex flex-col gap-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-bold">
                        {['A', 'B', 'C'][idx]}
                      </span>
                      {label}
                    </p>
                    {isSubcontractor ? (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                        <HardHat className="h-4 w-4 text-indigo-500 flex-shrink-0" />
                        <span className="text-sm text-gray-900 dark:text-white">
                          {selectedUser ? selectedUser.full_name : <span className="text-gray-400 italic">Not assigned</span>}
                        </span>
                      </div>
                    ) : (
                      <div className="relative">
                        <select
                          value={value || ''}
                          onChange={(e) => savePreferredSubcontractor(slot, e.target.value || null)}
                          className="w-full h-11 pl-3 pr-8 bg-white dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
                        >
                          <option value="">— Not assigned —</option>
                          {subcontractorUsers.map(u => (
                            <option key={u.id} value={u.id}>{u.full_name}</option>
                          ))}
                        </select>
                        <HardHat className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      </div>
                    )}
                    {selectedUser && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate pl-1">
                        {selectedUser.email}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Exclusion Note */}
            {!isSubcontractor && (
              <div className="mt-6 pt-5 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-xs">
                      ⚠
                    </span>
                    Exclusion Note
                  </p>
                  {!editingExclusionNote && (
                    <button
                      onClick={() => { setExclusionNoteDraft(exclusionNote); setEditingExclusionNote(true); }}
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 font-medium transition-colors"
                    >
                      {exclusionNote ? 'Edit' : '+ Add note'}
                    </button>
                  )}
                </div>

                {editingExclusionNote ? (
                  <div className="space-y-2">
                    <textarea
                      rows={3}
                      value={exclusionNoteDraft}
                      onChange={(e) => setExclusionNoteDraft(e.target.value)}
                      placeholder="e.g., Do not assign Smith Painting — prior quality issues. Contractor C requires prior approval."
                      className="w-full px-3 py-2 bg-white dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setEditingExclusionNote(false)}
                        className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded-md transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={saveExclusionNote}
                        disabled={savingExclusionNote}
                        className="px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors disabled:opacity-60"
                      >
                        {savingExclusionNote ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : exclusionNote ? (
                  <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40 rounded-lg">
                    <span className="text-amber-500 mt-0.5 flex-shrink-0 text-sm">⚠</span>
                    <p className="text-sm text-amber-900 dark:text-amber-200 leading-relaxed whitespace-pre-wrap">{exclusionNote}</p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 dark:text-gray-600 italic">No exclusion note set.</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Property Unit Map — Full Width (always shown) */}
        <div className="bg-white dark:bg-[#1E293B] rounded-xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-orange-600 to-orange-700 dark:from-orange-700 dark:to-orange-800 px-6 py-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Property Unit Map
              {unitMapImages.length > 1 && (
                <span className="ml-2 text-sm font-normal text-orange-200">
                  ({unitMapImages.length} images)
                </span>
              )}
            </h3>
            {unitMapImages.length > 0 && (
              <button
                onClick={() => { setLightboxIndex(0); setLightboxOpen(true); }}
                className="flex items-center gap-1.5 text-sm text-orange-100 hover:text-white transition-colors"
              >
                <ZoomIn className="h-4 w-4" />
                View Full Size
              </button>
            )}
          </div>
          {/* Content */}
          <div className="p-6">
            {unitMapImages.length > 0 ? (
              <div className="space-y-3">
                {/* Main image */}
                <div
                  className="relative w-full bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden group cursor-pointer"
                  style={{ minHeight: '18rem', maxHeight: '28rem' }}
                  onClick={() => { setLightboxIndex(0); setLightboxOpen(true); }}
                >
                  <img
                    src={unitMapImages[0].url}
                    alt={unitMapImages[0].alt}
                    className="w-full h-full object-contain transition-transform group-hover:scale-[1.02]"
                    style={{ maxHeight: '28rem' }}
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center pointer-events-none">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white dark:bg-gray-800 rounded-full p-3 shadow-lg">
                      <ZoomIn className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                </div>
                {/* Thumbnail strip (only shown when there are multiple images) */}
                {unitMapImages.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {unitMapImages.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => { setLightboxIndex(idx); setLightboxOpen(true); }}
                        className={`flex-shrink-0 w-20 h-14 rounded-md overflow-hidden border-2 transition-all hover:opacity-100 ${
                          idx === 0
                            ? 'border-orange-400 shadow-md opacity-100'
                            : 'border-gray-300 dark:border-gray-600 opacity-70 hover:border-orange-300'
                        }`}
                        title={img.label}
                      >
                        <img
                          src={img.url}
                          alt={img.alt}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Placeholder — always shown when no unit map is uploaded */
              <div className="flex flex-col items-center justify-center h-64 bg-gray-50 dark:bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                <FileText className="h-10 w-10 mb-3 text-gray-300 dark:text-gray-600" />
                <p className="text-sm font-medium text-gray-400 dark:text-gray-500">No unit map uploaded</p>
                {!isSubcontractor && (
                  <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">
                    Upload a unit map from the{' '}
                    <button
                      onClick={() => navigate(`/dashboard/properties/${property.id}/edit`)}
                      className="text-orange-500 hover:text-orange-600 underline underline-offset-2"
                    >
                      Edit Property
                    </button>{' '}
                    page
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Compliance Information - Full Width */}
        <div id="compliance" className="bg-white dark:bg-[#1E293B] rounded-xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 dark:from-emerald-700 dark:to-emerald-800 px-6 py-4">
            <h3 className="text-lg font-semibold text-white flex items-center">
              <ClipboardCheck className="h-5 w-5 mr-2" />
              Compliance Status
            </h3>
          </div>
          
          {/* Content */}
          <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {complianceItems.map(item => (
                <div key={item.label} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">{item.label}</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${getComplianceBadgeClass(item.label, item.value)}`}>
                      {item.value || 'N/A'}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    {item.date ? `Date: ${formatComplianceDate(item.date)}` : 'No date set'}
                  </div>
                </div>                ))}
              </div>
            </div>
          </div>

        {/* Fourth Row: Paint Colors and Billing Information */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Paint Colors */}
          <div id="paint-colors" className="bg-white dark:bg-[#1E293B] rounded-xl shadow-lg overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-teal-600 to-teal-700 dark:from-teal-700 dark:to-teal-800 px-6 py-4">
              <h3 className="text-lg font-semibold text-white flex items-center">
                <Clipboard className="h-5 w-5 mr-2" />
                Paint Colors
              </h3>
            </div>
            
            {/* Content */}
            <div className="p-6">
              {/* Paint Location */}
              {property.paint_location && (
                <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center">
                    <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-400 mr-2 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-blue-800 dark:text-blue-200 uppercase tracking-wide mb-1">Paint Storage Location</p>
                      <p className="text-gray-900 dark:text-white text-sm">{property.paint_location}</p>
                    </div>
                  </div>
                </div>
              )}
              
              <PaintColorsViewer items={paintSchemes} />
            </div>
          </div>

          {/* Billing Information */}
          <div className="bg-white dark:bg-[#1E293B] rounded-xl shadow-lg overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-600 to-amber-700 dark:from-amber-700 dark:to-amber-800 px-6 py-4">
              <h3 className="text-lg font-semibold text-white flex items-center">
                <Clipboard className="h-5 w-5 mr-2" />
                Billing Information
              </h3>
            </div>
            
            {/* Content */}
            <div className="p-6">
                <div className="space-y-6">
                  {/* QuickBooks Number — always shown first */}
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <h4 className="text-sm font-bold text-green-800 dark:text-green-200 mb-2 uppercase tracking-wide">QuickBooks Number</h4>
                    {property.quickbooks_number ? (
                      <p className="text-gray-900 dark:text-white text-sm font-mono">{property.quickbooks_number}</p>
                    ) : (
                      <p className="text-gray-400 dark:text-gray-500 text-sm italic">Not set</p>
                    )}
                  </div>

                  {/* Billing Notes */}
                  {property.billing_notes && (
                    <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                      <h4 className="text-sm font-bold text-yellow-800 dark:text-yellow-200 mb-2 uppercase tracking-wide">Billing Notes</h4>
                      <p className="text-gray-900 dark:text-white text-sm whitespace-pre-wrap">{property.billing_notes}</p>
                    </div>
                  )}

                  {/* Extra Charges Notes */}
                  {property.extra_charges_notes && (
                    <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                      <h4 className="text-sm font-bold text-orange-800 dark:text-orange-200 mb-2 uppercase tracking-wide">Extra Charges Notes</h4>
                      <p className="text-gray-900 dark:text-white text-sm whitespace-pre-wrap">{property.extra_charges_notes}</p>
                    </div>
                  )}

                  {/* Occupied Regular Paint Fees */}
                  {property.occupied_regular_paint_fees && (
                    <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                      <h4 className="text-sm font-bold text-purple-800 dark:text-purple-200 mb-2 uppercase tracking-wide">Occupied Regular Paint Fees</h4>
                      <p className="text-gray-900 dark:text-white text-sm">{property.occupied_regular_paint_fees}</p>
                    </div>
                  )}
                </div>
            </div>
          </div>
        </div>

        {/* Fifth Row: Billing Details (Full Width) */}
        {categories.length > 0 && (
          <div id="billing-details" className="bg-white dark:bg-[#1E293B] rounded-xl shadow-lg overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-600 to-green-700 dark:from-green-700 dark:to-green-800 px-6 py-4">
              <h3 className="text-lg font-semibold text-white flex items-center">
                <Clipboard className="h-5 w-5 mr-2" />
                Billing Details
              </h3>
            </div>
            
            {/* Content */}
            <div className="p-6">
            <div className="overflow-x-auto">
              <div className="space-y-4 min-w-max">
                {categories
                  .filter(category => !category.is_extra_charge)
                  .map(category => (
                  <div key={category.id} className="bg-gray-50 dark:bg-[#0F172A] rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <h5 className="text-gray-900 dark:text-white font-bold mb-3 text-sm uppercase tracking-wide">{category.name}</h5>
                    <div className="space-y-2">
                      {categoryDetails[category.id]?.map(detail => (
                        <div key={detail.unit_size_id} className="flex justify-between items-center text-sm py-2 px-3 bg-white dark:bg-gray-800 rounded-md">
                          <div className="flex-1">
                            <span className="text-gray-600 dark:text-gray-400 font-medium">
                              {unitSizes[detail.unit_size_id]}
                            </span>
                          </div>
                          <div className="flex space-x-6">
                            <span className="text-gray-600 dark:text-gray-400">Bill: <span className="font-bold">${detail.bill_amount}</span></span>
                            <span className="text-gray-600 dark:text-gray-400">Sub Pay: <span className="font-bold">${detail.sub_pay_amount}</span></span>
                            {!detail.is_hourly && (
                              <span className="text-green-600 dark:text-green-400 font-bold">Profit: ${detail.profit_amount}</span>
                            )}
                            {detail.is_hourly && (
                              <span className="text-blue-600 dark:text-blue-400 font-bold">Hourly Rate</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {categories
                  .filter(category => category.is_extra_charge && category.name !== 'Extra Charges')
                  .map(category => (
                  <div key={category.id} className="bg-amber-50/60 dark:bg-amber-900/10 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
                    <h5 className="text-gray-900 dark:text-white font-bold mb-3 text-sm uppercase tracking-wide">
                      Extra Charges - {category.name}
                    </h5>
                    <div className="space-y-2">
                      {categoryDetails[category.id]?.map(detail => (
                        <div key={detail.unit_size_id} className="flex justify-between items-center text-sm py-2 px-3 bg-white dark:bg-gray-800 rounded-md">
                          <div className="flex-1">
                            <span className="text-gray-600 dark:text-gray-400 font-medium">
                              {unitSizes[detail.unit_size_id]}
                            </span>
                          </div>
                          <div className="flex space-x-6">
                            <span className="text-gray-600 dark:text-gray-400">Bill: <span className="font-bold">${detail.bill_amount}</span></span>
                            <span className="text-gray-600 dark:text-gray-400">Sub Pay: <span className="font-bold">${detail.sub_pay_amount}</span></span>
                            {!detail.is_hourly && (
                              <span className="text-green-600 dark:text-green-400 font-bold">Profit: ${detail.profit_amount}</span>
                            )}
                            {detail.is_hourly && (
                              <span className="text-blue-600 dark:text-blue-400 font-bold">Hourly Rate</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            </div>
          </div>
        )}

        {/* Sixth Row: Callbacks (Full Width) */}
        <div id="callbacks" className="bg-white dark:bg-[#1E293B] rounded-xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-red-600 to-red-700 dark:from-red-700 dark:to-red-800 px-6 py-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-white flex items-center">
                <Clipboard className="h-5 w-5 mr-2" />
                Callbacks
              </h3>
              <button
                onClick={() => setShowCallbackForm(true)}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white text-sm font-medium rounded-lg transition-colors flex items-center backdrop-blur-sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Callback
              </button>
            </div>
          </div>
          
          {/* Content */}
          <div className="p-6">

            {callbacks.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <Clipboard className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                <p className="font-medium">No callbacks recorded for this property</p>
                <p className="text-sm">Click "Add Callback" to get started</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-[#0F172A]">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Painter</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Unit</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Reason</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Posted By</th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-[#1E293B] divide-y divide-gray-200 dark:divide-gray-700">
                    {callbacks.map((callback) => (
                      <tr key={callback.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {formatDate(callback.callback_date)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {callback.painter || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {callback.unit_number}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                          {callback.reason}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {callback.poster?.full_name || 'Unknown'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => setShowDeleteCallbackConfirm(callback.id)}
                            className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Add Callback Form */}
          {showCallbackForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 max-w-md w-full">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Add New Callback</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      value={newCallback.callback_date}
                      onChange={(e) => setNewCallback({...newCallback, callback_date: e.target.value})}
                      onClick={(e) => e.currentTarget.showPicker?.()}
                      className="w-full rounded-md bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Painter
                    </label>
                    <input
                      type="text"
                      value={newCallback.painter}
                      onChange={(e) => setNewCallback({...newCallback, painter: e.target.value})}
                      className="w-full rounded-md bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                      placeholder="Enter painter name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Unit #
                    </label>
                    <input
                      type="text"
                      value={newCallback.unit_number}
                      onChange={(e) => setNewCallback({...newCallback, unit_number: e.target.value})}
                      className="w-full rounded-md bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                      placeholder="Enter unit number"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Reason
                    </label>
                    <textarea
                      value={newCallback.reason}
                      onChange={(e) => setNewCallback({...newCallback, reason: e.target.value})}
                      className="w-full rounded-md bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                      placeholder="Enter reason for callback"
                      rows={3}
                      required
                    />
                  </div>
                </div>
                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowCallbackForm(false)}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAddCallback}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Add Callback
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Delete Callback Confirmation */}
          {showDeleteCallbackConfirm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 max-w-md w-full">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Delete Callback</h3>
                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  Are you sure you want to delete this callback? This action cannot be undone.
                </p>
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowDeleteCallbackConfirm(null)}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteCallback(showDeleteCallbackConfirm)}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Property Updates Section */}
        <div id="notes-updates" className="bg-white dark:bg-[#1E293B] rounded-xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-cyan-600 to-cyan-700 dark:from-cyan-700 dark:to-cyan-800 px-6 py-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-white flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                Notes and Important Updates
              </h3>
              <button
                onClick={() => setShowUpdateForm(true)}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white text-sm font-medium rounded-lg transition-colors backdrop-blur-sm"
              >
                <Plus className="h-4 w-4 mr-2 inline-block" />
                Add Update
              </button>
            </div>
          </div>
          
          {/* Content */}
          <div className="p-6">

            {updates.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <FileText className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                <p className="font-medium">No updates recorded for this property</p>
                <p className="text-sm">Click "Add Update" to get started</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-[#0F172A]">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Update Type</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Note / Update</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Posted By</th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-[#1E293B] divide-y divide-gray-200 dark:divide-gray-700">
                    {updates.map((update) => (
                      <tr key={update.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {formatDate(update.update_date)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {update.update_type}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                          {update.note}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {update.poster?.full_name || 'Unknown'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => setShowDeleteUpdateConfirm(update.id)}
                            className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Add Update Form */}
          {showUpdateForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 max-w-md w-full">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Add Property Update</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      value={newUpdate.update_date}
                      onChange={(e) => setNewUpdate({...newUpdate, update_date: e.target.value})}
                      onClick={(e) => e.currentTarget.showPicker?.()}
                      className="w-full rounded-md bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Update Type
                    </label>
                    <select
                      value={newUpdate.update_type}
                      onChange={(e) => setNewUpdate({...newUpdate, update_type: e.target.value})}
                      className="w-full rounded-md bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                      required
                    >
                      <option value="">Select update type</option>
                      <option value="General Note">General Note</option>
                      <option value="Price Change">Price Change</option>
                      <option value="Contact Update">Contact Update</option>
                      <option value="Policy Change">Policy Change</option>
                      <option value="Maintenance Issue">Maintenance Issue</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Note / Update
                    </label>
                    <textarea
                      value={newUpdate.note}
                      onChange={(e) => setNewUpdate({...newUpdate, note: e.target.value})}
                      className="w-full rounded-md bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                      placeholder="Enter update details"
                      rows={3}
                      required
                    />
                  </div>
                </div>
                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowUpdateForm(false)}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAddUpdate}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Add Update
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Delete Update Confirmation */}
          {showDeleteUpdateConfirm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 max-w-md w-full">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Delete Update</h3>
                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  Are you sure you want to delete this update? This action cannot be undone.
                </p>
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowDeleteUpdateConfirm(null)}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteUpdate(showDeleteUpdateConfirm)}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* General Property Notes Section */}
        <div className="bg-white dark:bg-[#1E293B] rounded-xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-slate-700 to-slate-800 dark:from-slate-800 dark:to-slate-900 px-6 py-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-white flex items-center">
                <Clipboard className="h-5 w-5 mr-2" />
                General Property Notes
              </h3>
              {isAdmin && (
                <button
                  onClick={() => setShowGeneralNoteForm(true)}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white text-sm font-medium rounded-lg transition-colors backdrop-blur-sm"
                >
                  <Plus className="h-4 w-4 mr-2 inline-block" />
                  Add Note
                </button>
              )}
            </div>
          </div>

          <div className="p-6">
            {generalNotes.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <Clipboard className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                <p className="font-medium">No general property notes recorded</p>
                <p className="text-sm">
                  {isAdmin ? 'Click "Add Note" to get started' : 'No general notes are currently available for this property'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {generalNotes.map((note) => (
                  <div
                    key={note.id}
                    className="border-l-4 border-slate-300 dark:border-slate-700 bg-gray-50 dark:bg-[#0F172A] rounded-r-xl p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {editingGeneralNoteId === note.id ? (
                          <div className="space-y-3">
                            <input
                              type="text"
                              value={editingGeneralNote.topic}
                              onChange={(e) => setEditingGeneralNote({ ...editingGeneralNote, topic: e.target.value })}
                              className="w-full rounded-md bg-white dark:bg-[#1E293B] border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                              placeholder="Enter note topic"
                            />
                            <textarea
                              value={editingGeneralNote.note_content}
                              onChange={(e) => setEditingGeneralNote({ ...editingGeneralNote, note_content: e.target.value })}
                              className="w-full rounded-md bg-white dark:bg-[#1E293B] border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                              placeholder="Enter general property note"
                              rows={4}
                            />
                          </div>
                        ) : (
                          <>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center rounded-full bg-slate-200 dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                                {note.topic}
                              </span>
                            </div>
                            <p className="text-gray-900 dark:text-white whitespace-pre-wrap mt-3">
                              {note.note_content}
                            </p>
                          </>
                        )}
                        <div className="flex flex-wrap items-center gap-2 mt-3 text-sm text-gray-500 dark:text-gray-400">
                          <span>{formatDate(note.created_at)}</span>
                          <span>•</span>
                          <span>{format(new Date(note.created_at), 'h:mm a')}</span>
                          <span>•</span>
                          <span>{note.creator?.full_name || 'Unknown'}</span>
                        </div>
                      </div>
                      {isAdmin && (
                        <div className="flex items-center gap-2">
                          {editingGeneralNoteId === note.id ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleSaveGeneralNote(note.id)}
                                className="p-2 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg text-green-600 dark:text-green-400 transition-colors"
                                aria-label="Save general property note"
                              >
                                <Save className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelEditGeneralNote}
                                className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300 transition-colors"
                                aria-label="Cancel editing general property note"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => handleStartEditGeneralNote(note)}
                                className="p-2 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400 transition-colors"
                                aria-label="Edit general property note"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm('Delete this general property note?')) {
                                    handleDeleteGeneralNote(note.id);
                                  }
                                }}
                                className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg text-red-600 dark:text-red-400 transition-colors"
                                aria-label="Delete general property note"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {showGeneralNoteForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 max-w-md w-full">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Add General Property Note</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Topic
                    </label>
                    <input
                      type="text"
                      value={newGeneralNote.topic}
                      onChange={(e) => setNewGeneralNote({ ...newGeneralNote, topic: e.target.value })}
                      className="w-full rounded-md bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                      placeholder="Enter note topic"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Note
                    </label>
                    <textarea
                      value={newGeneralNote.note_content}
                      onChange={(e) => setNewGeneralNote({ ...newGeneralNote, note_content: e.target.value })}
                      className="w-full rounded-md bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                      placeholder="Enter general property note"
                      rows={4}
                    />
                  </div>
                </div>
                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowGeneralNoteForm(false)}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAddGeneralNote}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Add Note
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Property Files Section */}
        <div id="property-files" className="bg-white dark:bg-[#1E293B] rounded-xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-purple-700 dark:from-purple-700 dark:to-purple-800 px-6 py-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-white flex items-center">
                <FolderOpen className="h-5 w-5 mr-2" />
                Property Files
              </h3>
              <button
                onClick={() => navigate(`/dashboard/files?property_id=${propertyId}`)}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white text-sm font-medium rounded-lg transition-colors backdrop-blur-sm"
              >
                Open File Manager
              </button>
            </div>
          </div>
          
          {/* Content */}
          <div className="p-6">
            <PropertyFilesPreview propertyId={propertyId} />
          </div>
        </div>

        {/* Property Job History (standalone, directly below Notes) */}
        <div id="job-history" className="bg-white dark:bg-[#1E293B] rounded-xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800 px-6 py-4">
            <h3 className="text-lg font-semibold text-white flex items-center">
              <Clipboard className="h-5 w-5 mr-2" />
              Property Job History
              {!jobsLoading && propertyJobs.length > 0 && (
                <span className="ml-2 text-sm font-normal text-white/80">
                  ({propertyJobs.length} jobs)
                </span>
              )}
            </h3>
          </div>
          
          {/* Content */}
          <div className="p-6">

            {jobsLoading ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
                <p className="font-medium">Loading job history...</p>
              </div>
            ) : propertyJobs.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <Clipboard className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                <p className="font-medium">No job history recorded for this property</p>
                <p className="text-sm">Job requests and work orders will appear here</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-[#0F172A]">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Work Order #
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Job Phase
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Unit #
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Unit Size
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Job Type
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Description
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Scheduled Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-[#1E293B] divide-y divide-gray-200 dark:divide-gray-700">
                    {propertyJobs.map((job) => (
                      <tr key={job.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white font-medium">
                          {job.work_order_num ? (
                            <Link 
                              to={`/dashboard/jobs/${job.id}`}
                              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline"
                            >
                              WO-{String(job.work_order_num).padStart(6, '0')}
                            </Link>
                          ) : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {job.job_phase ? (
                            <span
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                              style={{
                                backgroundColor: job.job_phase.color_dark_mode || '#4B5563',
                                color: 'white'
                              }}
                            >
                              {job.job_phase.job_phase_label}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-500 dark:text-gray-400">Unknown Phase</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white font-medium">
                          {job.unit_number || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {job.unit_size?.unit_size_label || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {job.job_type?.job_type_label || 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                          <div className="max-w-xs truncate" title={job.description}>
                            {job.description || 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {job.scheduled_date ? formatDisplayDate(job.scheduled_date) : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Lightbox for Property Unit Map — supports multiple images */}
      <Lightbox
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        images={unitMapImages.length > 0 ? unitMapImages : undefined}
        imageUrl={unitMapImages.length === 0 ? (unitMapUrl || '') : undefined}
        imageAlt="Property Unit Map"
        initialIndex={lightboxIndex}
      />
    </div>
  );
}
