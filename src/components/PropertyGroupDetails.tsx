import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Building2, Pencil, MapPin, Phone, Mail, User, Building, ArrowLeft } from 'lucide-react';
import { supabase, type PropertyManagementGroup } from '../utils/supabase';
import { WorkOrderLink } from './shared/WorkOrderLink';
import { PropertyLink } from './shared/PropertyLink';
import { PropertyMap } from './PropertyMap';

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
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const [group, setGroup] = useState<PropertyGroupWithProperties | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Format address for map display
  const formattedAddress = group ? [
    group.address,
    group.city,
    group.state,
    group.zip
  ].filter(Boolean).join(', ') : '';

  useEffect(() => {
    if (!groupId || groupId === 'null') {
      navigate('/dashboard/property-groups');
      return;
    }
    fetchPropertyGroup();
  }, [groupId, navigate]);

  const fetchPropertyGroup = async () => {
    if (!groupId || groupId === 'null') return;

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
        .eq('id', groupId)
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

  if (!groupId || groupId === 'null') {
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
      <div className="p-6 bg-gray-100 dark:bg-[#0F172A] min-h-screen">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => navigate('/dashboard/property-groups')}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <ArrowLeft className="h-6 w-6" />
              </button>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Property Group Details</h1>
            </div>
          </div>
          <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-500/50 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg">
            {error || 'Property group not found'}
          </div>
          <div className="mt-4">
            <button
              onClick={() => navigate('/dashboard/property-groups')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Back to Property Groups
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-100 dark:bg-[#0F172A] min-h-screen">
      {/* Header Section */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate('/dashboard/property-groups')}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
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

      {/* Navigation Links */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <button 
          onClick={() => document.getElementById('group-info')?.scrollIntoView({ behavior: 'smooth' })}
          className="flex flex-col items-center space-y-1 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          <Building2 className="h-4 w-4" />
          <span className="text-xs">Group Info</span>
        </button>
        <button 
          onClick={() => document.getElementById('contacts')?.scrollIntoView({ behavior: 'smooth' })}
          className="flex flex-col items-center space-y-1 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          <User className="h-4 w-4" />
          <span className="text-xs">Contacts</span>
        </button>
        <button 
          onClick={() => document.getElementById('properties')?.scrollIntoView({ behavior: 'smooth' })}
          className="flex flex-col items-center space-y-1 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          <Building className="h-4 w-4" />
          <span className="text-xs">Properties</span>
        </button>
        <button 
          onClick={() => document.getElementById('location')?.scrollIntoView({ behavior: 'smooth' })}
          className="flex flex-col items-center space-y-1 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          <MapPin className="h-4 w-4" />
          <span className="text-xs">Location</span>
        </button>
      </div>

      <div className="space-y-8">
        {/* Top Row: Group Information and Location */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Group Information */}
          <div id="group-info" className="bg-white dark:bg-[#1E293B] rounded-xl shadow-lg overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800 px-6 py-4">
              <h2 className="text-xl font-semibold text-white flex items-center">
                <Building2 className="h-5 w-5 mr-2" />
                Group Information
              </h2>
            </div>
            
            {/* Content */}
            <div className="p-6">
              <div className="space-y-4">
              <div className="flex items-start">
                <MapPin className="h-5 w-5 text-gray-500 dark:text-gray-400 mt-1 mr-3 flex-shrink-0" />
                <div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">Address</p>
                  <p className="text-gray-900 dark:text-white">
                    {group.address}
                    {group.address_2 && <span><br />{group.address_2}</span>}
                    <br />
                    {group.city}, {group.state} {group.zip}
                  </p>
                </div>
              </div>
            </div>
          </div>
          </div>

          {/* Location Map */}
          <div id="location" className="bg-white dark:bg-[#1E293B] rounded-xl shadow-lg overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-600 to-green-700 dark:from-green-700 dark:to-green-800 px-6 py-4">
              <h2 className="text-xl font-semibold text-white flex items-center">
                <MapPin className="h-5 w-5 mr-2" />
                Group Location
              </h2>
            </div>
            
            {/* Content */}
            <div className="p-6">
              {group && group.address ? (
              <PropertyMap 
                address={formattedAddress}
                className="w-full h-72 xl:h-80 rounded-lg overflow-hidden"
              />
            ) : (
              <div className="flex items-center justify-center h-72 xl:h-80 bg-gray-50 dark:bg-[#0F172A] rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                <div className="text-center">
                  <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500 dark:text-gray-400 font-medium">No address available</p>
                  <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
                    Add an address to see the location on the map
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Second Row: Contacts and Properties */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Contact Information */}
          <div id="contacts" className="bg-white dark:bg-[#1E293B] rounded-xl shadow-lg overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-purple-700 dark:from-purple-700 dark:to-purple-800 px-6 py-4">
              <h2 className="text-xl font-semibold text-white flex items-center">
                <User className="h-5 w-5 mr-2" />
                Contact Information
              </h2>
            </div>
            
            {/* Content */}
            <div className="p-6">
              <div className="space-y-4">
              <div className="flex items-start">
                <User className="h-5 w-5 text-gray-500 dark:text-gray-400 mt-1 mr-3 flex-shrink-0" />
                <div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">Contact Name</p>
                  <p className="text-gray-900 dark:text-white">{group.contact_name || 'Not specified'}</p>
                </div>
              </div>
              <div className="flex items-start">
                <Phone className="h-5 w-5 text-gray-500 dark:text-gray-400 mt-1 mr-3 flex-shrink-0" />
                <div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">Contact Phone</p>
                  <p className="text-gray-900 dark:text-white">{group.contact_phone || 'Not specified'}</p>
                </div>
              </div>
              <div className="flex items-start">
                <Mail className="h-5 w-5 text-gray-500 dark:text-gray-400 mt-1 mr-3 flex-shrink-0" />
                <div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">Contact Email</p>
                  <p className="text-gray-900 dark:text-white">{group.contact_email || 'Not specified'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Properties */}
          <div id="properties" className="bg-white dark:bg-[#1E293B] rounded-xl shadow-lg overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-600 to-orange-700 dark:from-orange-700 dark:to-orange-800 px-6 py-4">
              <h2 className="text-xl font-semibold text-white flex items-center">
                <Building className="h-5 w-5 mr-2" />
                Properties ({group.properties?.length || 0})
              </h2>
            </div>
            
            {/* Content */}
            <div className="p-6">
            <div className="space-y-4 max-h-80 overflow-y-auto">
              {group.properties && group.properties.length > 0 ? (
                group.properties.map(property => (
                  <div key={property.id} className="flex items-start p-3 bg-gray-50 dark:bg-[#0F172A] rounded-lg">
                    <Building className="h-5 w-5 text-gray-500 dark:text-gray-400 mt-1 mr-3 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <PropertyLink 
                        propertyId={property.id}
                        propertyName={property.property_name}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium block truncate"
                      />
                      <p className="text-gray-600 dark:text-gray-400 text-sm truncate">
                        {property.address}, {property.city}, {property.state}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <Building className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500 dark:text-gray-400 font-medium">No properties assigned</p>
                  <p className="text-gray-400 dark:text-gray-500 text-sm">This group doesn't have any properties yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      </div>
      </div>
      </div>
    </div>
  );
}