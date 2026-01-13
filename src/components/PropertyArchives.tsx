import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Search, 
  Plus, 
  ArrowUpDown, 
  Building2, 
  Archive, 
  RefreshCw,
  ChevronDown,
  X,
  Trash2
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { createClient } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { WorkOrderLink } from './shared/WorkOrderLink';
import { PropertyLink } from './shared/PropertyLink';

type Property = {
  id: string;
  property_name: string;
  address: string;
  address_2: string | null;
  city: string;
  state: string;
  zip: string;
  property_management_group_id: string;
  property_management_group: {
    company_name: string;
  };
  is_archived: boolean;
};

export function PropertyArchives() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProperties, setSelectedProperties] = useState<string[]>([]);
  const [showUnarchiveConfirm, setShowUnarchiveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchProperties();
  }, []);

  const fetchProperties = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('properties')
        .select(`
          *,
          property_management_group:property_management_groups!fk_property_management_group(company_name)
        `)
        .eq('is_archived', true)
        .order('property_name', { ascending: true });

      if (error) throw error;
      setProperties(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch properties');
    } finally {
      setLoading(false);
    }
  };

  const formatAddress = (property: Property) => {
    const parts = [
      property.address,
      property.city,
      property.state,
      property.zip
    ].filter(Boolean);
    return parts.join(', ');
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedProperties(filteredProperties.map(property => property.id));
    } else {
      setSelectedProperties([]);
    }
  };

  const handleSelectProperty = (propertyId: string) => {
    setSelectedProperties(prev => {
      if (prev.includes(propertyId)) {
        return prev.filter(id => id !== propertyId);
      } else {
        return [...prev, propertyId];
      }
    });
  };

  const handleUnarchiveSelected = async () => {
    if (selectedProperties.length === 0) return;
    
    setProcessing(true);
    try {
      // Update properties to set is_archived to false
      const { error: updateError } = await supabase
        .from('properties')
        .update({ is_archived: false })
        .in('id', selectedProperties);

      if (updateError) throw updateError;

      // Clear selection and close confirmation
      setSelectedProperties([]);
      setShowUnarchiveConfirm(false);
      
      toast.success(`Successfully unarchived ${selectedProperties.length} ${selectedProperties.length !== 1 ? 'properties' : 'property'}`);
      
      // Refresh the property list
      fetchProperties();
    } catch (err) {
      console.error('Error unarchiving properties:', err);
      toast.error('Failed to unarchive properties. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedProperties.length === 0) return;
    
    setProcessing(true);
    try {
      // For deletion operations, we need admin privileges to bypass RLS
      const adminClient = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      );

      // First, check for any remaining dependencies that might prevent deletion
      console.log('Checking for dependencies before deletion...');
      
      // Check for jobs that reference these properties
      const { data: jobsData, error: jobsError } = await adminClient
        .from('jobs')
        .select('id, work_order_num, property_id')
        .in('property_id', selectedProperties);

      if (jobsError) {
        console.error('Error checking jobs:', jobsError);
      } else if (jobsData && jobsData.length > 0) {
        console.log(`Found ${jobsData.length} jobs that reference these properties:`, jobsData);
        // Jobs should be deleted automatically due to CASCADE, but let's be explicit
        const { error: deleteJobsError } = await adminClient
          .from('jobs')
          .delete()
          .in('property_id', selectedProperties);
        
        if (deleteJobsError) {
          console.error('Error deleting related jobs:', deleteJobsError);
          throw new Error(`Failed to delete related jobs: ${deleteJobsError.message}`);
        }
        console.log('Successfully deleted related jobs');
      }

      // Check for billing categories that reference these properties
      const { data: billingData, error: billingError } = await adminClient
        .from('billing_categories')
        .select('id, name, property_id')
        .in('property_id', selectedProperties);

      if (billingError) {
        console.error('Error checking billing categories:', billingError);
      } else if (billingData && billingData.length > 0) {
        console.log(`Found ${billingData.length} billing categories that reference these properties:`, billingData);
        // Billing categories should be deleted automatically due to CASCADE, but let's be explicit
        const { error: deleteBillingError } = await adminClient
          .from('billing_categories')
          .delete()
          .in('property_id', selectedProperties);
        
        if (deleteBillingError) {
          console.error('Error deleting related billing categories:', deleteBillingError);
          throw new Error(`Failed to delete related billing categories: ${deleteBillingError.message}`);
        }
        console.log('Successfully deleted related billing categories');
      }

      // Check for files that reference these properties
      const { data: filesData, error: filesError } = await adminClient
        .from('files')
        .select('id, name, property_id')
        .in('property_id', selectedProperties);

      if (filesError) {
        console.error('Error checking files:', filesError);
      } else if (filesData && filesData.length > 0) {
        console.log(`Found ${filesData.length} files that reference these properties:`, filesData);
        
        // First, clear any unit_map_file_id references in properties table to break circular dependency
        console.log('Clearing unit_map_file_id references to break circular dependency...');
        const { error: clearUnitMapError } = await adminClient
          .from('properties')
          .update({ unit_map_file_id: null })
          .in('id', selectedProperties);
        
        if (clearUnitMapError) {
          console.error('Error clearing unit_map_file_id references:', clearUnitMapError);
          throw new Error(`Failed to clear unit_map_file_id references: ${clearUnitMapError.message}`);
        }
        console.log('Successfully cleared unit_map_file_id references');
        
        // Now delete the files
        const { error: deleteFilesError } = await adminClient
          .from('files')
          .delete()
          .in('property_id', selectedProperties);
        
        if (deleteFilesError) {
          console.error('Error deleting related files:', deleteFilesError);
          throw new Error(`Failed to delete related files: ${deleteFilesError.message}`);
        }
        console.log('Successfully deleted related files');
      }

      // Check for units that reference these properties
      const { data: unitsData, error: unitsError } = await adminClient
        .from('units')
        .select('id, unit_number, property_id')
        .in('property_id', selectedProperties);

      if (unitsError) {
        console.error('Error checking units:', unitsError);
      } else if (unitsData && unitsData.length > 0) {
        console.log(`Found ${unitsData.length} units that reference these properties:`, unitsData);
        const { error: deleteUnitsError } = await adminClient
          .from('units')
          .delete()
          .in('property_id', selectedProperties);
        
        if (deleteUnitsError) {
          console.error('Error deleting related units:', deleteUnitsError);
          throw new Error(`Failed to delete related units: ${deleteUnitsError.message}`);
        }
        console.log('Successfully deleted related units');
      }

      // Check for property paint schemes that reference these properties
      const { data: paintSchemesData, error: paintSchemesError } = await adminClient
        .from('property_paint_schemes')
        .select('id, floorplan, property_id')
        .in('property_id', selectedProperties);

      if (paintSchemesError) {
        console.error('Error checking property paint schemes:', paintSchemesError);
      } else if (paintSchemesData && paintSchemesData.length > 0) {
        console.log(`Found ${paintSchemesData.length} paint schemes that reference these properties:`, paintSchemesData);
        const { error: deletePaintSchemesError } = await adminClient
          .from('property_paint_schemes')
          .delete()
          .in('property_id', selectedProperties);
        
        if (deletePaintSchemesError) {
          console.error('Error deleting related paint schemes:', deletePaintSchemesError);
          throw new Error(`Failed to delete related paint schemes: ${deletePaintSchemesError.message}`);
        }
        console.log('Successfully deleted related paint schemes');
      }

      // Now delete the properties themselves
      console.log('Deleting properties...');
      const { error: deleteError } = await adminClient
        .from('properties')
        .delete()
        .in('id', selectedProperties);

      if (deleteError) {
        console.error('Error deleting properties:', deleteError);
        throw deleteError;
      }

      console.log('Successfully deleted properties');

      // Clear selection and close confirmation
      setSelectedProperties([]);
      setShowDeleteConfirm(false);
      
      toast.success(`Successfully deleted ${selectedProperties.length} ${selectedProperties.length !== 1 ? 'properties' : 'property'}`);
      
      // Refresh the property list
      fetchProperties();
    } catch (err) {
      console.error('Error deleting properties:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete properties. Please try again.';
      toast.error(errorMessage);
    } finally {
      setProcessing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchProperties();
      toast.success('Property list refreshed');
    } catch (err) {
      console.error('Error refreshing properties:', err);
      toast.error('Failed to refresh properties. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  const filteredProperties = properties
    .filter(property => 
      property.property_name?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const comparison = a.property_name?.localeCompare(b.property_name);
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-100 dark:bg-[#0F172A] min-h-screen">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-3">
          <Building2 className="h-8 w-8 text-gray-600 dark:text-gray-400" />
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Archived Properties</h1>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {selectedProperties.length > 0 && (
            <>
              <button
                onClick={() => setShowUnarchiveConfirm(true)}
                className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Archive className="h-4 w-4 mr-2" />
                Unarchive Selected ({selectedProperties.length})
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="inline-flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Selected ({selectedProperties.length})
              </button>
            </>
          )}
          <button
            onClick={() => navigate('/dashboard/properties')}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-400 bg-white dark:bg-[#1E293B] border border-gray-300 dark:border-[#2D3B4E] rounded-lg hover:bg-gray-50 dark:hover:bg-[#2D3B4E] transition-colors"
          >
            Back to Properties
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search archived properties..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-[#1E293B] border border-gray-300 dark:border-[#1E293B] rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-500/50 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <div className="bg-white dark:bg-[#1E293B] rounded-lg overflow-hidden shadow">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-[#2D3B4E]">
            <thead>
              <tr>
                <th scope="col" className="px-3 py-4 text-left">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedProperties.length > 0 && selectedProperties.length === filteredProperties.length}
                      onChange={handleSelectAll}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </div>
                </th>
                <th scope="col" className="px-6 py-4 text-left">
                  <button
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="group inline-flex items-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-white"
                  >
                    Property Name
                    <ArrowUpDown className="ml-2 h-4 w-4 text-gray-400 group-hover:text-gray-700 dark:group-hover:text-white" />
                  </button>
                </th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Address
                </th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Property Management Group
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-[#2D3B4E]">
              {filteredProperties.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-gray-600 dark:text-gray-400">
                    No archived properties found
                  </td>
                </tr>
              ) : (
                filteredProperties.map((property) => (
                  <tr key={property.id} className="hover:bg-gray-50 dark:hover:bg-[#2D3B4E] transition-colors">
                    <td className="px-3 py-4">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedProperties.includes(property.id)}
                          onChange={() => handleSelectProperty(property.id)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <PropertyLink 
                        propertyId={property.id}
                        propertyName={property.property_name}
                        className="text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 font-medium"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-start">
                        <div className="text-gray-600 dark:text-gray-400 text-sm">
                          {formatAddress(property)}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <Building2 className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2" />
                        <div className="flex flex-col">
                          <Link
                            to={`/dashboard/property-groups/${property.property_management_group_id}`}
                            className="text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                          >
                            {property.property_management_group?.company_name || 'No Group Assigned'}
                          </Link>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Unarchive Confirmation Modal */}
      {showUnarchiveConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Unarchive Selected Properties</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Are you sure you want to unarchive {selectedProperties.length} selected {selectedProperties.length !== 1 ? 'properties' : 'property'}?
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowUnarchiveConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-400 bg-gray-100 dark:bg-[#2D3B4E] rounded-lg hover:bg-gray-200 dark:hover:bg-[#374151] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUnarchiveSelected}
                disabled={processing}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {processing ? 'Unarchiving...' : 'Unarchive Properties'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Delete Selected Properties</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Are you sure you want to delete {selectedProperties.length} selected {selectedProperties.length !== 1 ? 'properties' : 'property'}? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-400 bg-gray-100 dark:bg-[#2D3B4E] rounded-lg hover:bg-gray-200 dark:hover:bg-[#374151] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSelected}
                disabled={processing}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {processing ? 'Deleting...' : 'Delete Properties'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PropertyArchives;