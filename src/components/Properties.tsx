import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Plus, ArrowUpDown, Building2, Archive } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { SupabaseErrorHandler } from '../utils/supabaseErrorHandler';
import { useSessionValidation } from '../hooks/useSessionValidation';
import { toast } from 'sonner';

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

export function Properties() {
  // Validate session when component mounts (handles expired sessions)
  useSessionValidation();
  
  const [properties, setProperties] = useState<Property[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProperties, setSelectedProperties] = useState<string[]>([]);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [processing, setProcessing] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchProperties();
  }, []);

  const fetchProperties = async () => {
    try {
      setLoading(true);
      
      const result = await SupabaseErrorHandler.executeWithRetry(
        async () => {
          return await supabase
            .from('properties')
            .select(`
              *,
              property_management_group:property_management_groups!fk_property_management_group(company_name)
            `)
            .eq('is_archived', false)
            .order('property_name', { ascending: true });
        },
        'fetchProperties'
      );

      if (result.error) throw result.error;
      setProperties(result.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch properties');
    } finally {
      setLoading(false);
    }
  };

  const handlePropertyClick = (propertyId: string) => {
    console.log('Navigating to property details with ID:', propertyId);
    const url = `/dashboard/properties/${propertyId}`;
    console.log('Navigation URL:', url);
    navigate(url);
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

  const handleArchiveSelected = async () => {
    if (selectedProperties.length === 0) return;
    
    setProcessing(true);
    try {
      const { error: updateError } = await supabase
        .from('properties')
        .update({ is_archived: true })
        .in('id', selectedProperties);

      if (updateError) throw updateError;

      setSelectedProperties([]);
      setShowArchiveConfirm(false);
      
      toast.success(`Successfully archived ${selectedProperties.length} ${selectedProperties.length !== 1 ? 'properties' : 'property'}`);
      
      fetchProperties();
    } catch (err) {
      console.error('Error archiving properties:', err);
      toast.error('Failed to archive properties. Please try again.');
    } finally {
      setProcessing(false);
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
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Properties</h1>
        </div>
        <div className="flex space-x-3">
          {selectedProperties.length > 0 && (
            <button
              onClick={() => setShowArchiveConfirm(true)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Archive className="h-4 w-4 mr-2" />
              Archive Selected ({selectedProperties.length})
            </button>
          )}
          <button
            onClick={() => navigate('/dashboard/properties/archives')}
            className="inline-flex items-center px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            <Archive className="h-4 w-4 mr-2" />
            View Archives
          </button>
          <button
            onClick={() => navigate('/dashboard/properties/new')}
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Property
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search properties..."
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
                    className="group inline-flex items-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider"
                  >
                    Property Name
                    <ArrowUpDown className="ml-2 h-4 w-4 text-gray-400 group-hover:text-gray-700 dark:group-hover:text-white" />
                  </button>
                </th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Address
                </th>
                <th scope="col" className="px-6 py-4 text-left">
                  <button
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="group inline-flex items-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider"
                  >
                    Property Management Group
                    <ArrowUpDown className="ml-2 h-4 w-4 text-gray-400 group-hover:text-gray-700 dark:group-hover:text-white" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-[#2D3B4E]">
              {filteredProperties.map((property) => (
                <tr 
                  key={property.id} 
                  className="hover:bg-gray-50 dark:hover:bg-[#2D3B4E] transition-colors cursor-pointer"
                  onClick={() => handlePropertyClick(property.id)}
                >
                  <td className="px-3 py-4" onClick={(e) => e.stopPropagation()}>
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
                    <div className="text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 font-medium">
                      {property.property_name}
                    </div>
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
                          onClick={(e) => e.stopPropagation()}
                        >
                          {property.property_management_group?.company_name || 'No Group Assigned'}
                        </Link>
                        <span className="text-xs text-gray-500">Contact: N/A</span>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Archive Confirmation Modal */}
      {showArchiveConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Archive Properties</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              Are you sure you want to archive {selectedProperties.length} {selectedProperties.length !== 1 ? 'properties' : 'property'}? This action can be undone later.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowArchiveConfirm(false)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleArchiveSelected}
                disabled={processing}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing ? 'Archiving...' : 'Archive'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}