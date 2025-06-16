import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Search, 
  ArrowUpDown, 
  Building2, 
  MapPin, 
  Archive, 
  RefreshCw,
  X
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { formatAddress } from '../lib/utils/formatUtils';
import { toast } from 'sonner';
import { useAuth } from '/src/contexts/AuthContext';

interface PropertyGroup {
  id: string;
  company_name: string;
  address: string;
  address_2: string | null;
  city: string;
  state: string;
  zip: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  is_archived: boolean;
  properties: {
    id: string;
    property_name: string;
  }[];
}

export function PropertyGroupArchives() {
  const [groups, setGroups] = useState<PropertyGroup[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [showUnarchiveConfirm, setShowUnarchiveConfirm] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchPropertyGroups();
  }, []);

  const fetchPropertyGroups = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('property_management_groups')
        .select(`
          *,
          properties (
            id,
            property_name
          )
        `)
        .eq('is_archived', true)
        .order('company_name', { ascending: true });

      if (error) throw error;
      setGroups(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch property groups');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedGroups(filteredGroups.map(group => group.id));
    } else {
      setSelectedGroups([]);
    }
  };

  const handleSelectGroup = (groupId: string) => {
    setSelectedGroups(prev => {
      if (prev.includes(groupId)) {
        return prev.filter(id => id !== groupId);
      } else {
        return [...prev, groupId];
      }
    });
  };

  const handleUnarchiveSelected = async () => {
    if (selectedGroups.length === 0) return;
    
    setProcessing(true);
    try {
      // Update property groups to set is_archived to false
      const { error: updateError } = await supabase
        .from('property_management_groups')
        .update({ is_archived: false })
        .in('id', selectedGroups);

      if (updateError) throw updateError;

      // Clear selection and close confirmation
      setSelectedGroups([]);
      setShowUnarchiveConfirm(false);
      
      toast.success(`Successfully unarchived ${selectedGroups.length} ${selectedGroups.length !== 1 ? 'property groups' : 'property group'}`);
      
      // Refresh the property group list
      fetchPropertyGroups();
    } catch (err) {
      console.error('Error unarchiving property groups:', err);
      toast.error('Failed to unarchive property groups. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchPropertyGroups();
      toast.success('Property group list refreshed');
    } catch (err) {
      console.error('Error refreshing property groups:', err);
      toast.error('Failed to refresh property groups. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  const filteredGroups = groups
    .filter(group => 
      group.company_name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const comparison = a.company_name.localeCompare(b.company_name);
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
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Archived Property Management Groups</h1>
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
          {selectedGroups.length > 0 && (
            <button
              onClick={() => setShowUnarchiveConfirm(true)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Archive className="h-4 w-4 mr-2" />
              Unarchive Selected ({selectedGroups.length})
            </button>
          )}
          <button
            onClick={() => navigate('/dashboard/property-groups')}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-400 bg-white dark:bg-[#1E293B] border border-gray-300 dark:border-[#2D3B4E] rounded-lg hover:bg-gray-50 dark:hover:bg-[#2D3B4E] transition-colors"
          >
            Back to Property Groups
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search archived property groups..."
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
                      checked={selectedGroups.length > 0 && selectedGroups.length === filteredGroups.length}
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
                    Company Name
                    <ArrowUpDown className="ml-2 h-4 w-4 text-gray-400 group-hover:text-gray-700 dark:group-hover:text-white" />
                  </button>
                </th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Address
                </th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Properties
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-[#2D3B4E]">
              {filteredGroups.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-gray-600 dark:text-gray-400">
                    No archived property groups found
                  </td>
                </tr>
              ) : (
                filteredGroups.map((group) => (
                  <tr key={group.id} className="hover:bg-gray-50 dark:hover:bg-[#2D3B4E] transition-colors">
                    <td className="px-3 py-4">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedGroups.includes(group.id)}
                          onChange={() => handleSelectGroup(group.id)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        to={`/dashboard/property-groups/${group.id}`}
                        className="text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 font-medium"
                      >
                        {group.company_name}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-start">
                        <MapPin className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2 mt-0.5" />
                        <div className="text-gray-600 dark:text-gray-400 text-sm">
                          {formatAddress(group)}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {group.properties && group.properties.length > 0 ? (
                          group.properties.map(property => (
                            <Link
                              key={property.id}
                              to={`/dashboard/properties/${property.id}`}
                              className="block text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm"
                            >
                              {property.property_name}
                            </Link>
                          ))
                        ) : (
                          <span className="text-gray-500 italic text-sm">No properties</span>
                        )}
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
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Unarchive Selected Property Groups</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Are you sure you want to unarchive {selectedGroups.length} selected {selectedGroups.length !== 1 ? 'property groups' : 'property group'}?
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
                {processing ? 'Unarchiving...' : 'Unarchive Groups'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PropertyGroupArchives;