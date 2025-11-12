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
  Save,
  Trash2,
  ArrowLeft,
  ZoomIn
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { PropertyMap } from './PropertyMap';
import { formatAddress } from '../lib/utils/formatUtils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { PaintColorsViewer } from './properties/PaintColorsViewer';
import { PaintScheme } from '../lib/types';
import { Lightbox } from './Lightbox';
import { usePropertyPhaseCounts } from '../hooks/usePropertyPhaseCounts';
import { StatCard } from './ui/StatCard';
import { getPreviewUrl } from '../utils/storagePreviews';
import { useUserRole } from '../contexts/UserRoleContext';
import { getBackNavigationPath } from '../lib/utils';

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
  unit_map_file_id: string | null;
  unit_map_file_path: string | null;
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
  const { isSubcontractor } = useUserRole();
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<BillingCategory[]>([]);
  const [categoryDetails, setCategoryDetails] = useState<{[key: string]: BillingDetail[]}>({});
  const [unitSizes, setUnitSizes] = useState<{[key: string]: string}>({});
  const [callbacks, setCallbacks] = useState<PropertyCallback[]>([]);
  const [updates, setUpdates] = useState<PropertyUpdate[]>([]);
  const [paintSchemes, setPaintSchemes] = useState<PaintScheme[]>([]);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [unitMapUrl, setUnitMapUrl] = useState<string | null>(null);

  // Generate unit map URL when property data loads
  useEffect(() => {
    const generateUnitMapUrl = async () => {
      if (property?.unit_map_file_path) {
        try {
          // First try to get the file from the database to get the correct path
          const { data: fileData, error: fileError } = await supabase
            .from('files')
            .select('path, name')
            .eq('id', property.unit_map_file_id)
            .single();

          let filePath = property.unit_map_file_path;
          
          // If we found the file in the database, use its path
          if (fileData && !fileError) {
            filePath = fileData.path;
          }

          console.log('Attempting to load unit map with path:', filePath);
          
          const previewResult = await getPreviewUrl(supabase, 'files', filePath);
          setUnitMapUrl(previewResult.url);
        } catch (error) {
          console.error('Error generating unit map URL:', error);
          
          // Try alternative path formats
          const alternativePaths = [
            property.unit_map_file_path,
            property.unit_map_file_path?.replace(/ /g, '_'), // Replace spaces with underscores
            property.unit_map_file_path?.replace(/ /g, '%20'), // URL encode spaces
          ].filter(Boolean);

          for (const altPath of alternativePaths) {
            try {
              console.log('Trying alternative path:', altPath);
              const { data: urlData } = supabase.storage
                .from('files')
                .getPublicUrl(altPath);
              
              // Test if the URL is accessible
              const response = await fetch(urlData.publicUrl, { method: 'HEAD' });
              if (response.ok) {
                setUnitMapUrl(urlData.publicUrl);
                return;
              }
            } catch (altError) {
              console.log('Alternative path failed:', altPath, altError);
            }
          }
          
          // If all alternatives fail, set to null
          setUnitMapUrl(null);
        }
      } else {
        setUnitMapUrl(null);
      }
    };

    generateUnitMapUrl();
  }, [property?.unit_map_file_path, property?.unit_map_file_id]);

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
  
  // State for delete confirmation
  const [showDeleteCallbackConfirm, setShowDeleteCallbackConfirm] = useState<string | null>(null);
  const [showDeleteUpdateConfirm, setShowDeleteUpdateConfirm] = useState<string | null>(null);

  const formattedAddress = property ? [
    property.address,
    property.city,
    property.state,
    property.zip
  ].filter(Boolean).join(', ') : '';



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
            const allowedPhases = ['Job Request', 'Work Order', 'Pending Work Order', 'Invoicing', 'Completed', 'Cancelled'];
            
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
      <div className="grid grid-cols-8 gap-4 mb-8">
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
          <div className="xl:col-span-2 bg-white dark:bg-[#1E293B] rounded-xl p-6 shadow-lg border border-gray-100 dark:border-gray-800">
            <div className="flex items-center mb-4">
              <MapPin className="h-6 w-6 text-blue-600 dark:text-blue-400 mr-3" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Property Location</h2>
            </div>
            
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

          {/* Basic Information - 1/4 width */}
          <div id="basic-info" className="xl:col-span-1 bg-white dark:bg-[#1E293B] rounded-xl p-6 shadow-lg border border-gray-100 dark:border-gray-800">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
              <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
              Basic Info
            </h3>
            <div className="space-y-4">
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
          <div className="xl:col-span-1 bg-white dark:bg-[#1E293B] rounded-xl p-6 shadow-lg border border-gray-100 dark:border-gray-800">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
              <Clipboard className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
              Quick Stats
            </h3>
            <div className="space-y-3">
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

        {/* Second Row: Property Unit Map, Contact Information, and Compliance */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Property Unit Map - 1/3 width */}
          {property.unit_map_file_path && unitMapUrl ? (
            <div className="bg-white dark:bg-[#1E293B] rounded-xl p-6 shadow-lg border border-gray-100 dark:border-gray-800">
              <div className="flex items-center mb-4">
                <FileText className="h-5 w-5 text-indigo-600 dark:text-indigo-400 mr-2" />
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Property Unit Map</h3>
              </div>
              <div className="relative w-full h-64 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden group cursor-pointer" style={{ pointerEvents: 'auto' }}>
                <img 
                  src={unitMapUrl || ''}
                  alt="Property Unit Map" 
                  className="w-full h-full object-contain transition-transform group-hover:scale-105"
                  style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                  onClick={() => setLightboxOpen(true)}
                  onError={(e) => {
                    console.error('Failed to load unit map image:', property.unit_map_file_path);
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                  }}
                />
                <div className="hidden absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 pointer-events-none">
                  <div className="text-center">
                    <FileText className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p className="font-medium text-sm">Unable to load image</p>
                    <p className="text-xs">Please check the file</p>
                  </div>
                </div>
                {/* Hover overlay with click hint */}
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center pointer-events-none">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white dark:bg-gray-800 rounded-full p-3 shadow-lg">
                    <ZoomIn className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#1E293B] rounded-xl p-6 shadow-lg border border-gray-100 dark:border-gray-800">
              <div className="flex items-center mb-4">
                <FileText className="h-5 w-5 text-gray-400 mr-2" />
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Property Unit Map</h3>
              </div>
              <div className="flex items-center justify-center h-64 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                <div className="text-center">
                  <FileText className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-gray-500 dark:text-gray-400 text-sm">No unit map uploaded</p>
                </div>
              </div>
            </div>
          )}

          {/* Contact Information - 1/3 width */}
          <div id="contacts" className="bg-white dark:bg-[#1E293B] rounded-xl p-6 shadow-lg border border-gray-100 dark:border-gray-800">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center">
              <User className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
              Contact Information
            </h3>
            <div className="space-y-6">
              {/* Community Manager */}
              {(property.community_manager_name || property.community_manager_email || property.community_manager_phone) && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <h4 className="text-sm font-bold text-blue-800 dark:text-blue-200 mb-3 uppercase tracking-wide">Community Manager</h4>
                  <div className="space-y-2">
                    {property.community_manager_name && (
                      <div className="flex items-center">
                        <User className="h-4 w-4 text-blue-600 dark:text-blue-400 mr-2 flex-shrink-0" />
                        <span className="text-gray-900 dark:text-white text-sm">{property.community_manager_name}</span>
                      </div>
                    )}
                    {property.community_manager_email && (
                      <div className="flex items-center">
                        <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400 mr-2 flex-shrink-0" />
                        <span className="text-gray-900 dark:text-white text-sm">{property.community_manager_email}</span>
                      </div>
                    )}
                    {property.community_manager_phone && (
                      <div className="flex items-center">
                        <Phone className="h-4 w-4 text-blue-600 dark:text-blue-400 mr-2 flex-shrink-0" />
                        <span className="text-gray-900 dark:text-white text-sm">{property.community_manager_phone}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Maintenance Supervisor */}
              {(property.maintenance_supervisor_name || property.maintenance_supervisor_email || property.maintenance_supervisor_phone) && (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <h4 className="text-sm font-bold text-green-800 dark:text-green-200 mb-3 uppercase tracking-wide">Maintenance Supervisor</h4>
                  <div className="space-y-2">
                    {property.maintenance_supervisor_name && (
                      <div className="flex items-center">
                        <User className="h-4 w-4 text-green-600 dark:text-green-400 mr-2 flex-shrink-0" />
                        <span className="text-gray-900 dark:text-white text-sm">{property.maintenance_supervisor_name}</span>
                      </div>
                    )}
                    {property.maintenance_supervisor_email && (
                      <div className="flex items-center">
                        <Mail className="h-4 w-4 text-green-600 dark:text-green-400 mr-2 flex-shrink-0" />
                        <span className="text-gray-900 dark:text-white text-sm">{property.maintenance_supervisor_email}</span>
                      </div>
                    )}
                    {property.maintenance_supervisor_phone && (
                      <div className="flex items-center">
                        <Phone className="h-4 w-4 text-green-600 dark:text-green-400 mr-2 flex-shrink-0" />
                        <span className="text-gray-900 dark:text-white text-sm">{property.maintenance_supervisor_phone}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Primary Contact */}
              {(property.primary_contact_name || property.primary_contact_phone || property.primary_contact_role) && (
                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <h4 className="text-sm font-bold text-purple-800 dark:text-purple-200 mb-3 uppercase tracking-wide">Primary Contact</h4>
                  <div className="space-y-2">
                    {property.primary_contact_name && (
                      <div className="flex items-center">
                        <User className="h-4 w-4 text-purple-600 dark:text-purple-400 mr-2 flex-shrink-0" />
                        <span className="text-gray-900 dark:text-white text-sm">{property.primary_contact_name}</span>
                      </div>
                    )}
                    {property.primary_contact_phone && (
                      <div className="flex items-center">
                        <Phone className="h-4 w-4 text-purple-600 dark:text-purple-400 mr-2 flex-shrink-0" />
                        <span className="text-gray-900 dark:text-white text-sm">{property.primary_contact_phone}</span>
                      </div>
                    )}
                    {property.primary_contact_role && (
                      <div className="flex items-center">
                        <Clipboard className="h-4 w-4 text-purple-600 dark:text-purple-400 mr-2 flex-shrink-0" />
                        <span className="text-gray-900 dark:text-white text-sm">{property.primary_contact_role}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Subcontractors */}
              {(property.subcontractor_a || property.subcontractor_b) && (
                <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                  <h4 className="text-sm font-bold text-orange-800 dark:text-orange-200 mb-3 uppercase tracking-wide">Subcontractors</h4>
                  <div className="space-y-2">
                    {property.subcontractor_a && (
                      <div className="flex items-center">
                        <Building2 className="h-4 w-4 text-orange-600 dark:text-orange-400 mr-2 flex-shrink-0" />
                        <span className="text-gray-900 dark:text-white text-sm">A: {property.subcontractor_a}</span>
                      </div>
                    )}
                    {property.subcontractor_b && (
                      <div className="flex items-center">
                        <Building2 className="h-4 w-4 text-orange-600 dark:text-orange-400 mr-2 flex-shrink-0" />
                        <span className="text-gray-900 dark:text-white text-sm">B: {property.subcontractor_b}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

                    {/* Compliance Information - 1/3 width */}
          <div id="compliance" className="bg-white dark:bg-[#1E293B] rounded-xl p-6 shadow-lg border border-gray-100 dark:border-gray-800">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center">
              <ClipboardCheck className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
              Compliance Status
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">Compliance Required</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    property.compliance_required === 'Yes' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200' :
                    property.compliance_required === 'No' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200' :
                    'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                  }`}>
                    {property.compliance_required || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">Compliance Approved</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    property.compliance_approved === 'Yes' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200' :
                    property.compliance_approved === 'No' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200' :
                    property.compliance_approved === 'Pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200' :
                    'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                  }`}>
                    {property.compliance_approved || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">Bid Approved</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    property.compliance_bid_approved === 'Yes' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200' :
                    property.compliance_bid_approved === 'No' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200' :
                    property.compliance_bid_approved === 'Pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200' :
                    'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                  }`}>
                    {property.compliance_bid_approved || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">PO Needed</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    property.compliance_po_needed === 'Yes' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200' :
                    property.compliance_po_needed === 'No' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200' :
                    'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                  }`}>
                    {property.compliance_po_needed || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">W9 Created</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    property.compliance_w9_created === 'Yes' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200' :
                    property.compliance_w9_created === 'No' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200' :
                    'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                  }`}>
                    {property.compliance_w9_created || 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Fourth Row: Paint Colors and Billing Information */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Paint Colors */}
          <div id="paint-colors" className="bg-white dark:bg-[#1E293B] rounded-xl p-6 shadow-lg border border-gray-100 dark:border-gray-800">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center">
              <Clipboard className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
              Paint Colors
            </h3>
            
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

          {/* Billing Information */}
          <div className="bg-white dark:bg-[#1E293B] rounded-xl p-6 shadow-lg border border-gray-100 dark:border-gray-800">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center">
              <Clipboard className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
              Billing Information
            </h3>
            <div className="space-y-6">
              {/* AP Contact */}
              {(property.ap_name || property.ap_email || property.ap_phone) && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <h4 className="text-sm font-bold text-blue-800 dark:text-blue-200 mb-3 uppercase tracking-wide">AP Contact</h4>
                  <div className="space-y-2">
                    {property.ap_name && (
                      <div className="flex items-center">
                        <User className="h-4 w-4 text-blue-600 dark:text-blue-400 mr-2 flex-shrink-0" />
                        <span className="text-gray-900 dark:text-white text-sm">{property.ap_name}</span>
                      </div>
                    )}
                    {property.ap_email && (
                      <div className="flex items-center">
                        <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400 mr-2 flex-shrink-0" />
                        <span className="text-gray-900 dark:text-white text-sm">{property.ap_email}</span>
                      </div>
                    )}
                    {property.ap_phone && (
                      <div className="flex items-center">
                        <Phone className="h-4 w-4 text-blue-600 dark:text-blue-400 mr-2 flex-shrink-0" />
                        <span className="text-gray-900 dark:text-white text-sm">{property.ap_phone}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* QuickBooks Number */}
              {property.quickbooks_number && (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <h4 className="text-sm font-bold text-green-800 dark:text-green-200 mb-2 uppercase tracking-wide">QuickBooks Number</h4>
                  <p className="text-gray-900 dark:text-white text-sm font-mono">{property.quickbooks_number}</p>
                </div>
              )}

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

        {/* Fifth Row: Billing Details (Full Width) */}
        {categories.length > 0 && (
          <div id="billing-details" className="bg-white dark:bg-[#1E293B] rounded-xl p-6 shadow-lg border border-gray-100 dark:border-gray-800">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center">
              <Clipboard className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
              Billing Details
            </h3>
            <div className="overflow-x-auto">
              <div className="space-y-4 min-w-max">
                {categories.map(category => (
                  <div key={category.id} className="bg-gray-50 dark:bg-[#0F172A] rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <h5 className="text-gray-900 dark:text-white font-bold mb-3 text-sm uppercase tracking-wide">{category.name}</h5>
                    <div className="space-y-2">
                      {categoryDetails[category.id]?.map(detail => (
                        <div key={detail.unit_size_id} className="flex justify-between items-center text-sm py-2 px-3 bg-white dark:bg-gray-800 rounded-md">
                          <div className="flex-1">
                            {category.name === 'Extra Charges' && detail.is_hourly ? (
                              <div className="px-3 py-1 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-sm text-gray-700 dark:text-gray-300 font-medium w-fit">
                                Hourly
                              </div>
                            ) : (
                              <span className="text-gray-600 dark:text-gray-400 font-medium">
                                {unitSizes[detail.unit_size_id]}
                              </span>
                            )}
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
        )}

        {/* Sixth Row: Callbacks (Full Width) */}
        <div id="callbacks" className="bg-white dark:bg-[#1E293B] rounded-xl p-6 shadow-lg border border-gray-100 dark:border-gray-800">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
              <Clipboard className="h-5 w-5 text-red-600 dark:text-red-400 mr-2" />
              Callbacks
            </h3>
            <button
              onClick={() => setShowCallbackForm(true)}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Callback
            </button>
          </div>

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

        {/* Property Updates Section */}
        <div id="notes-updates" className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow-lg lg:col-span-3">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
              <FileText className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
              Notes and Important Updates
            </h3>
            <button
              onClick={() => setShowUpdateForm(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus className="h-4 w-4 mr-2 inline-block" />
              Add Update
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
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Update Type</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Note / Update</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Posted By</th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-[#1E293B] divide-y divide-gray-200 dark:divide-gray-700">
                  {updates.map((update) => (
                    <tr key={update.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {new Date(update.update_date).toLocaleDateString()}
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

        {/* Property Job History (standalone, directly below Notes) */}
        <div id="job-history" className="bg-white dark:bg-[#1E293B] rounded-xl p-6 shadow-lg border border-gray-100 dark:border-gray-800">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
              <Clipboard className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
              Property Job History
              {!jobsLoading && propertyJobs.length > 0 && (
                <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                  ({propertyJobs.length} jobs)
                </span>
              )}
            </h3>
          </div>

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
                        {job.scheduled_date ? new Date(job.scheduled_date).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric', 
                          year: 'numeric' 
                        }) : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      
      {/* Lightbox for Property Unit Map */}
      <Lightbox
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        imageUrl={unitMapUrl || ''}
        imageAlt="Property Unit Map"
      />
    </div>
  );
}