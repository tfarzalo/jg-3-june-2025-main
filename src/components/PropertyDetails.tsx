import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  Building2, 
  Pencil, 
  MapPin, 
  Phone, 
  Mail,
  Trash2,
  ArrowLeft,
  Plus,
  ClipboardCheck,
  User,
  FileText
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { PropertyMap } from './PropertyMap';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useSessionValidation } from '../hooks/useSessionValidation';
import { withErrorHandling } from '../utils/supabaseErrorHandler';
import { JobListingPage } from './shared/JobListingPage';
import { useJobFetch } from './shared/useJobFetch';

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
  maintenance_supervisor_name: string;
  maintenance_supervisor_email: string;
  maintenance_supervisor_phone: string;
  point_of_contact: string;
  primary_contact_name: string;
  primary_contact_phone: string;
  primary_contact_role: string;
  subcontractor_a: string;
  subcontractor_b: string;
  ap_name: string;
  ap_email: string;
  ap_phone: string;
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
  paint_location: string;
}

interface PropertyFile {
  id: string;
  name: string;
  path: string;
  type: string;
  created_at: string;
}

interface Job {
  id: string;
  work_order_num: number;
  unit_number: string;
  job_type: {
    job_type_label: string;
  } | null;
  status: string;
  scheduled_date: string;
  updated_at: string;
}

interface BillingCategory {
  id: string;
  name: string;
  sort_order: number;
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

export function PropertyDetails() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const navigate = useNavigate();
  
  // Add session validation
  useSessionValidation();
  
  // Fetch and filter jobs for this property
  const { jobs: allJobs, loading: jobsLoading, error: jobsError } = useJobFetch({
    phaseLabel: ['Job Request', 'Work Order', 'Pending Work Order', 'Invoicing', 'Completed', 'Cancelled']
  });
  const propertyJobs = allJobs.filter(job => job.property.id === propertyId);

  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<BillingCategory[]>([]);
  const [categoryDetails, setCategoryDetails] = useState<{[key: string]: BillingDetail[]}>({});
  const [unitSizes, setUnitSizes] = useState<{[key: string]: string}>({});
  const [callbacks, setCallbacks] = useState<PropertyCallback[]>([]);
  const [updates, setUpdates] = useState<PropertyUpdate[]>([]);
  const [updateTypes, setUpdateTypes] = useState<string[]>([]);
  const [propertyFiles, setPropertyFiles] = useState<PropertyFile[]>([]);
  
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
  
  // State for delete confirmation
  const [showDeleteCallbackConfirm, setShowDeleteCallbackConfirm] = useState<string | null>(null);
  const [showDeleteUpdateConfirm, setShowDeleteUpdateConfirm] = useState<string | null>(null);

  const formattedAddress = property ? [
    property.address,
    property.city,
    property.state,
    property.zip
  ].filter(Boolean).join(', ') : '';

  console.log('PropertyDetails: Formatted address:', formattedAddress);
  console.log('PropertyDetails: Property data:', property);

  useEffect(() => {
    if (propertyId) {
      fetchPropertyFiles();
    }
  }, [propertyId]);

  const fetchPropertyFiles = async () => {
    try {
      const { data, error } = await supabase
        .from('files')
        .select('*')
        .eq('property_id', propertyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPropertyFiles(data || []);
    } catch (err) {
      console.error('Error fetching property files:', err);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch all update types for dropdown and dedupe
        const { data: typesData, error: typesError } = await supabase
          .from('property_updates')
          .select('update_type');
        if (!typesError && typesData) {
          const uniqueTypes = Array.from(new Set(typesData.map((item: any) => item.update_type)));
          setUpdateTypes(uniqueTypes);
        }

        console.log('PropertyDetails: Starting data fetch with ID:', propertyId);
        
        if (!propertyId) {
          console.error('PropertyDetails: No ID provided in URL params');
          toast.error('Property ID is required');
          setLoading(false);
          navigate('/dashboard/properties');
          return;
        }

        // Fetch property data
        console.log('PropertyDetails: Fetching property data for ID:', propertyId);
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

        if (propertyError) throw propertyError;
        if (!propertyData) {
          console.error('PropertyDetails: No property data found for ID:', propertyId);
          toast.error('Property not found');
          setLoading(false);
          navigate('/dashboard/properties');
          return;
        }
        
        console.log('PropertyDetails: Successfully fetched property data:', propertyData);
        setProperty(propertyData);

        // Fetch billing data
        const { data: categoryData, error: categoryError } = await supabase
          .from('billing_categories')
          .select('*')
          .eq('property_id', propertyId)
          .order('sort_order');

        if (categoryError) throw categoryError;
        setCategories(categoryData || []);

        if (categoryData?.length) {
          const { data: detailsData, error: detailsError } = await supabase
            .from('billing_details')
            .select('*')
            .eq('property_id', propertyId);

          if (detailsError) throw detailsError;

          const detailsByCategory: {[key: string]: BillingDetail[]} = {};
          detailsData?.forEach(detail => {
            if (!detailsByCategory[detail.category_id]) {
              detailsByCategory[detail.category_id] = [];
            }
            detailsByCategory[detail.category_id].push(detail);
          });
          setCategoryDetails(detailsByCategory);

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

        setLoading(false);
      } catch (err) {
        console.error('Error fetching property details:', err);
        setError('Failed to load property details');
        setLoading(false);
      }
    };

    fetchData();
  }, [propertyId, navigate]);

  const handleAddCallback = async () => {
    if (!propertyId) {
      toast.error('You must be logged in to add a callback.');
      return;
    }

    // Validate required fields
    if (!newCallback.callback_date.trim()) {
      toast.error('Callback date is required');
      return;
    }
    
    if (!newCallback.unit_number.trim()) {
      toast.error('Unit number is required');
      return;
    }
    
    if (!newCallback.reason.trim()) {
      toast.error('Reason is required');
      return;
    }

    try {
      console.log('Adding callback with data:', {
        property_id: propertyId,
        callback_date: newCallback.callback_date,
        painter: newCallback.painter,
        unit_number: newCallback.unit_number,
        reason: newCallback.reason,
      });

      // Use error handler for the insert operation
      const { data, error } = await withErrorHandling<PropertyCallback[]>(
        supabase
          .from('property_callbacks')
          .insert({
            property_id: propertyId,
            callback_date: newCallback.callback_date,
            painter: newCallback.painter,
            unit_number: newCallback.unit_number,
            reason: newCallback.reason,
          })
          .select(`
            *,
            poster:profiles(full_name)
          `),
        'add-callback'
      );

      if (error) {
        // Error is already logged by withErrorHandling, just show toast
        toast.error(`Failed to add callback: ${error.message}`);
        return;
      }

      if (data) {
        setCallbacks(prev => [data[0], ...prev]);
        setShowCallbackForm(false);
        setNewCallback({
          callback_date: format(new Date(), 'yyyy-MM-dd'),
          painter: '',
          unit_number: '',
          reason: ''
        });
        toast.success('Callback added successfully');
      }
    } catch (err) {
      // This catch block might be redundant if withErrorHandling handles all errors
      console.error('Unexpected error in handleAddCallback:', err);
      toast.error('An unexpected error occurred.');
    }
  };

  const handleAddUpdate = async () => {
    if (!propertyId) {
      toast.error('Property ID is required to add a note.');
      return;
    }
    // Ensure session for posted_by
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session) {
      toast.error('Authentication error. Please log in again.');
      return;
    }
    const userId = sessionData.session.user.id;

    if (!newUpdate.update_date.trim() || !newUpdate.update_type.trim() || !newUpdate.note.trim()) {
      toast.error('All fields are required for an update.');
      return;
    }

    const { data, error } = await withErrorHandling<PropertyUpdate[]>(
      supabase
        .from('property_updates')
        .insert({
          property_id: propertyId,
          update_date: newUpdate.update_date,
          update_type: newUpdate.update_type,
          note: newUpdate.note,
          posted_by: userId
        })
        .select(`
          *,
          poster:profiles(full_name)
        `),
      'add-update'
    );

    if (error) {
      toast.error(`Failed to add update: ${error.message}`);
      return;
    }

    if (data) {
      setUpdates(prev => [data[0], ...prev]);
      setShowUpdateForm(false);
      setNewUpdate({
        update_date: format(new Date(), 'yyyy-MM-dd'),
        update_type: '',
        note: ''
      });
      toast.success('Update added successfully');
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="p-6 bg-gray-100 dark:bg-[#0F172A]">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => navigate('/dashboard/properties')}
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
              onClick={() => navigate('/dashboard/properties')}
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
    <div className="p-6 bg-gray-100 dark:bg-[#0F172A]">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-3">
          <Building2 className="h-8 w-8 text-gray-600 dark:text-gray-400" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {property.property_name}
          </h2>
        </div>
        <div className="flex space-x-3">
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
            onClick={() => navigate('/dashboard/properties')}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-400 bg-white dark:bg-[#1E293B] border border-gray-300 dark:border-[#2D3B4E] rounded-lg hover:bg-gray-50 dark:hover:bg-[#2D3B4E] transition-colors"
          >
            Back to List
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Property Location Map - 2/3 width */}
        <div className="lg:col-span-2 bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
          <div className="flex items-center mb-4">
            <MapPin className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Location</h2>
          </div>
          
          {property && property.address ? (
            <PropertyMap 
              address={formattedAddress}
              className="w-full h-[300px]"
            />
          ) : (
            <div className="flex items-center justify-center h-[300px] bg-gray-100 dark:bg-[#0F172A] rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
              <p className="text-gray-500 dark:text-gray-400">
                No address available
              </p>
            </div>
          )}
        </div>

        {/* Basic Information - 1/3 width */}
        <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Basic Information</h3>
          <div className="space-y-4">
            <div className="flex items-start">
              <MapPin className="h-5 w-5 text-gray-500 dark:text-gray-400 mt-1 mr-3" />
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Address</p>
                <p className="text-gray-900 dark:text-white">
                  {property.address}
                  {property.address_2 && <span><br />{property.address_2}</span>}
                  <br />
                  {property.city}, {property.state} {property.zip}
                </p>
              </div>
            </div>
            <div className="flex items-start">
              <Building2 className="h-5 w-5 text-gray-500 dark:text-gray-400 mt-1 mr-3" />
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Property Management Group</p>
                <Link
                  to={`/dashboard/property-groups/${property.property_management_group_id}`}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                >
                  {property.property_management_group?.company_name || 'No Group Assigned'}
                </Link>
              </div>
            </div>
            {property.phone && (
              <div className="flex items-start">
                <Phone className="h-5 w-5 text-gray-500 dark:text-gray-400 mt-1 mr-3" />
                <div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">Phone</p>
                  <p className="text-gray-900 dark:text-white">{property.phone}</p>
                </div>
              </div>
            )}
            {property.region && (
              <div className="flex items-start">
                <MapPin className="h-5 w-5 text-gray-500 dark:text-gray-400 mt-1 mr-3" />
                <div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">Region</p>
                  <p className="text-gray-900 dark:text-white">{property.region}</p>
                </div>
              </div>
            )}
            {property.property_grade && (
              <div className="flex items-start">
                <ClipboardCheck className="h-5 w-5 text-gray-500 dark:text-gray-400 mt-1 mr-3" />
                <div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">Property Grade</p>
                  <p className="text-gray-900 dark:text-white">{property.property_grade}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contact Information */}
        <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Contact Information</h3>
          <div className="space-y-6">
            {/* Community Manager */}
            {(property.community_manager_name || property.community_manager_email || property.community_manager_phone) && (
              <div>
                <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Community Manager</h4>
                <div className="space-y-2">
                  {property.community_manager_name && (
                    <div className="flex items-center">
                      <User className="h-4 w-4 text-gray-500 dark:text-gray-400 mr-2" />
                      <span className="text-gray-900 dark:text-white">{property.community_manager_name}</span>
                    </div>
                  )}
                  {property.community_manager_email && (
                    <div className="flex items-center">
                      <Mail className="h-4 w-4 text-gray-500 dark:text-gray-400 mr-2" />
                      <span className="text-gray-900 dark:text-white">{property.community_manager_email}</span>
                    </div>
                  )}
                  {property.community_manager_phone && (
                    <div className="flex items-center">
                      <Phone className="h-4 w-4 text-gray-500 dark:text-gray-400 mr-2" />
                      <span className="text-gray-900 dark:text-white">{property.community_manager_phone}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Maintenance Supervisor */}
            {(property.maintenance_supervisor_name || property.maintenance_supervisor_email || property.maintenance_supervisor_phone) && (
              <div>
                <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Maintenance Supervisor</h4>
                <div className="space-y-2">
                  {property.maintenance_supervisor_name && (
                    <div className="flex items-center">
                      <User className="h-4 w-4 text-gray-500 dark:text-gray-400 mr-2" />
                      <span className="text-gray-900 dark:text-white">{property.maintenance_supervisor_name}</span>
                    </div>
                  )}
                  {property.maintenance_supervisor_email && (
                    <div className="flex items-center">
                      <Mail className="h-4 w-4 text-gray-500 dark:text-gray-400 mr-2" />
                      <span className="text-gray-900 dark:text-white">{property.maintenance_supervisor_email}</span>
                    </div>
                  )}
                  {property.maintenance_supervisor_phone && (
                    <div className="flex items-center">
                      <Phone className="h-4 w-4 text-gray-500 dark:text-gray-400 mr-2" />
                      <span className="text-gray-900 dark:text-white">{property.maintenance_supervisor_phone}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Paint Colors */}
        <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Paint Colors</h3>
          <div className="grid grid-cols-2 gap-4">
            {property.color_walls && (
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Walls</p>
                <p className="text-gray-900 dark:text-white">{property.color_walls}</p>
              </div>
            )}
            {property.color_trim && (
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Trim</p>
                <p className="text-gray-900 dark:text-white">{property.color_trim}</p>
              </div>
            )}
            {property.color_regular_unit && (
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Regular Unit</p>
                <p className="text-gray-900 dark:text-white">{property.color_regular_unit}</p>
              </div>
            )}
            {property.color_kitchen_bathroom && (
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Kitchen/Bathroom</p>
                <p className="text-gray-900 dark:text-white">{property.color_kitchen_bathroom}</p>
              </div>
            )}
            {property.color_ceilings && (
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Ceilings</p>
                <p className="text-gray-900 dark:text-white">{property.color_ceilings}</p>
              </div>
            )}
            {property.paint_location && (
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Paint Location</p>
                <p className="text-gray-900 dark:text-white">{property.paint_location}</p>
              </div>
            )}
          </div>
        </div>

        {/* Compliance Information */}
        <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Compliance Information</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Compliance Required</p>
                <p className="text-gray-900 dark:text-white">{property.compliance_required || 'N/A'}</p>
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Compliance Approved</p>
                <p className="text-gray-900 dark:text-white">{property.compliance_approved || 'N/A'}</p>
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Bid Approved</p>
                <p className="text-gray-900 dark:text-white">{property.compliance_bid_approved || 'N/A'}</p>
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">PO Needed</p>
                <p className="text-gray-900 dark:text-white">{property.compliance_po_needed || 'N/A'}</p>
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">W9 Created</p>
                <p className="text-gray-900 dark:text-white">{property.compliance_w9_created || 'N/A'}</p>
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">COI Address</p>
                <p className="text-gray-900 dark:text-white">{property.compliance_coi_address || 'N/A'}</p>
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Create Sub Prop Portal</p>
                <p className="text-gray-900 dark:text-white">{property.compliance_create_sub_prop_portal || 'N/A'}</p>
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Notify Team</p>
                <p className="text-gray-900 dark:text-white">{property.compliance_notify_team || 'N/A'}</p>
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Upload Documents</p>
                <p className="text-gray-900 dark:text-white">{property.compliance_upload_documents || 'N/A'}</p>
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Invoice Delivery</p>
                <p className="text-gray-900 dark:text-white">{property.compliance_invoice_delivery || 'N/A'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Billing Information */}
        <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow-lg lg:col-span-2">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Billing Information</h3>
            <button
              onClick={() => navigate(`/dashboard/properties/${property.id}/billing`)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus className="h-4 w-4 mr-2 inline-block" />
              Manage Billing Details
            </button>
          </div>
          
          <div className="space-y-6">
            {/* AP Contact */}
            {(property.ap_name || property.ap_email || property.ap_phone) && (
              <div>
                <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">AP Contact</h4>
                <div className="space-y-2">
                  {property.ap_name && (
                    <div className="flex items-center">
                      <User className="h-4 w-4 text-gray-500 dark:text-gray-400 mr-2" />
                      <span className="text-gray-900 dark:text-white">{property.ap_name}</span>
                    </div>
                  )}
                  {property.ap_email && (
                    <div className="flex items-center">
                      <Mail className="h-4 w-4 text-gray-500 dark:text-gray-400 mr-2" />
                      <span className="text-gray-900 dark:text-white">{property.ap_email}</span>
                    </div>
                  )}
                  {property.ap_phone && (
                    <div className="flex items-center">
                      <Phone className="h-4 w-4 text-gray-500 dark:text-gray-400 mr-2" />
                      <span className="text-gray-900 dark:text-white">{property.ap_phone}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* QuickBooks Number */}
            {property.quickbooks_number && (
              <div>
                <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">QuickBooks Number</h4>
                <p className="text-gray-900 dark:text-white">{property.quickbooks_number}</p>
              </div>
            )}

            {/* Billing Notes */}
            {property.billing_notes && (
              <div>
                <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Billing Notes</h4>
                <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{property.billing_notes}</p>
              </div>
            )}

            {/* Billing Details */}
            {categories.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Billing Details</h4>
                <div className="space-y-4">
                  {categories.map(category => (
                    <div key={category.id} className="bg-gray-50 dark:bg-[#0F172A] rounded-lg p-4">
                      <h5 className="text-gray-900 dark:text-white font-medium mb-2">{category.name}</h5>
                      <div className="space-y-2">
                        {categoryDetails[category.id]?.map(detail => (
                          <div key={detail.unit_size_id} className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">{unitSizes[detail.unit_size_id]}</span>
                            <div className="space-x-4">
                              <span className="text-gray-600 dark:text-gray-400">Bill: ${detail.bill_amount}</span>
                              <span className="text-gray-600 dark:text-gray-400">Sub Pay: ${detail.sub_pay_amount}</span>
                              {!detail.is_hourly && (
                                <span className="text-green-600 dark:text-green-400">Profit: ${detail.profit_amount}</span>
                              )}
                              {detail.is_hourly && (
                                <span className="text-blue-600 dark:text-blue-400">Hourly Rate</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Callbacks Section */}
        <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow-lg lg:col-span-3">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Callbacks</h3>
            <button
              onClick={() => setShowCallbackForm(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus className="h-4 w-4 mr-2 inline-block" />
              Add Callback
            </button>
          </div>

          {callbacks.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No callbacks recorded for this property
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-[#0F172A]">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Painter</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Unit</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Reason</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Posted By</th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-[#1E293B] divide-y divide-gray-200 dark:divide-gray-700">
                  {callbacks.map((callback) => (
                    <tr key={callback.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {new Date(callback.callback_date).toLocaleDateString()}
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
                          className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
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

        {/* Property Updates / Notes Section */}
        <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow-lg lg:col-span-3 mt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Property Updates / Notes</h3>
            <button
              onClick={() => setShowUpdateForm(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus className="h-4 w-4 mr-2 inline-block" />
              Add Note
            </button>
          </div>
          {updates.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No updates recorded for this property
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-[#0F172A]">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Note</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Posted By</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-[#1E293B] divide-y divide-gray-200 dark:divide-gray-700">
                  {updates.map(update => (
                    <tr key={update.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{format(new Date(update.update_date), 'MM/dd/yyyy')}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{update.update_type}</td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{update.note}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{update.poster.full_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button onClick={() => setShowDeleteUpdateConfirm(update.id)} className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Add Update Form Overlay */}
          {showUpdateForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 max-w-md w-full">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Add New Update/Note</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
                    <input
                      type="date"
                      value={newUpdate.update_date}
                      onChange={e => setNewUpdate({...newUpdate, update_date: e.target.value})}
                      className="w-full rounded-md bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                    <select
                      value={newUpdate.update_type}
                      onChange={e => setNewUpdate({...newUpdate, update_type: e.target.value})}
                      className="w-full rounded-md bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                    >
                      <option value="">Select a type...</option>
                      {updateTypes.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Note</label>
                    <textarea
                      value={newUpdate.note}
                      onChange={e => setNewUpdate({...newUpdate, note: e.target.value})}
                      className="w-full rounded-md bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white h-24"
                      placeholder="Enter note details"
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-3">
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

        {/* Job History Section */}
        <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow-lg lg:col-span-3 mt-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Job History</h3>
          <JobListingPage
            title="Job History"
            jobs={propertyJobs}
            loading={jobsLoading}
            error={jobsError ?? null}
            showAddButton={false}
          />
        </div>

        {/* Property Documents Section */}
        <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow-lg lg:col-span-3 mt-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Property Documents</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {propertyFiles.map(file => (
              <div key={file.id} className="relative flex items-center space-x-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1E293B] px-6 py-5 shadow-sm hover:border-gray-400 dark:hover:border-gray-600">
                <div className="flex-shrink-0">
                  <FileText className="h-6 w-6 text-gray-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <a href={file.path} target="_blank" rel="noopener noreferrer" className="focus:outline-none">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{file.name}</p>
                    <p className="truncate text-sm text-gray-500 dark:text-gray-400">
                      {new Date(file.created_at).toLocaleDateString()}
                    </p>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}