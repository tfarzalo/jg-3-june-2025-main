import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Building2, Pencil, MapPin, Phone, Mail, User, Building } from 'lucide-react';
import { supabase, type PropertyManagementGroup } from '../utils/supabase';

interface PropertyGroupWithProperties extends PropertyManagementGroup {
  properties: {
    id: string;
    property_name: string;
    address: string;
    city: string;
    state: string;
  }[];
}

export function PropertyGroupDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [group, setGroup] = useState<PropertyGroupWithProperties | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || id === 'null') {
      navigate('/dashboard/property-groups');
      return;
    }
    fetchPropertyGroup();
  }, [id, navigate]);

  const fetchPropertyGroup = async () => {
    if (!id || id === 'null') return;

    try {
      const { data, error } = await supabase
        .from('property_management_groups')
        .select(`
          *,
          properties:properties(
            id,
            property_name,
            address,
            city,
            state
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      if (!data) {
        throw new Error('Property group not found');
      }
      setGroup(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch property group');
      setTimeout(() => navigate('/dashboard/property-groups'), 2000);
    } finally {
      setLoading(false);
    }
  };

  if (!id || id === 'null') {
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="p-6 bg-gray-100 dark:bg-[#0F172A]">
        <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-500/50 text-red-700 dark:text-red-200 px-4 py-3 rounded">
          {error || 'Property group not found'}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-100 dark:bg-[#0F172A] min-h-screen">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-3">
          <Building2 className="h-8 w-8 text-gray-600 dark:text-gray-400" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {group.company_name}
          </h2>
        </div>
        <div className="flex space-x-3">
          <button
            type="button"
            onClick={() => navigate(`/dashboard/property-groups/${group.id}/edit`)}
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Pencil className="h-4 w-4 mr-2" />
            Edit Group
          </button>
          <button
            type="button"
            onClick={() => navigate('/dashboard/property-groups')}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-400 bg-white dark:bg-[#1E293B] border border-gray-300 dark:border-[#2D3B4E] rounded-lg hover:bg-gray-50 dark:hover:bg-[#2D3B4E] transition-colors"
          >
            Back to List
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Group Information</h3>
          <div className="space-y-4">
            <div className="flex items-start">
              <MapPin className="h-5 w-5 text-gray-500 dark:text-gray-400 mt-1 mr-3" />
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Address</p>
                <p className="text-gray-900 dark:text-white">
                  {group.address}
                  {group.address_2 && <span><br />{group.address_2}</span>}
                  <br />
                  {group.city}, {group.state} {group.zip}
                </p>
              </div>
            </div>
            <div className="flex items-start">
              <User className="h-5 w-5 text-gray-500 dark:text-gray-400 mt-1 mr-3" />
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Contact Name</p>
                <p className="text-gray-900 dark:text-white">{group.contact_name || 'Not specified'}</p>
              </div>
            </div>
            <div className="flex items-start">
              <Phone className="h-5 w-5 text-gray-500 dark:text-gray-400 mt-1 mr-3" />
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Contact Phone</p>
                <p className="text-gray-900 dark:text-white">{group.contact_phone || 'Not specified'}</p>
              </div>
            </div>
            <div className="flex items-start">
              <Mail className="h-5 w-5 text-gray-500 dark:text-gray-400 mt-1 mr-3" />
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Contact Email</p>
                <p className="text-gray-900 dark:text-white">{group.contact_email || 'Not specified'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Properties</h3>
          <div className="space-y-4">
            {group.properties && group.properties.length > 0 ? (
              group.properties.map(property => (
                <div key={property.id} className="flex items-start">
                  <Building className="h-5 w-5 text-gray-500 dark:text-gray-400 mt-1 mr-3" />
                  <div>
                    <Link
                      to={`/dashboard/properties/${property.id}`}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 block"
                    >
                      {property.property_name}
                    </Link>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                      {property.address}, {property.city}, {property.state}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-600 dark:text-gray-400 italic">No properties assigned to this group</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}