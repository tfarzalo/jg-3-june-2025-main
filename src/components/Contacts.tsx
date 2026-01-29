import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Plus, 
  Search, 
  Filter, 
  Edit, 
  Trash2, 
  Phone, 
  Mail, 
  MapPin,
  Calendar,
  Tag,
  Eye,
  CheckCircle,
  Check,
  XCircle,
  Clock,
  AlertCircle,
  Building2,
  MessageSquare,
  Save,
  X
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { toast } from 'sonner';
import { useUserRole } from '../hooks/useUserRole';
import { NewContactForm } from './NewContactForm';

interface LeadStatus {
  id: string;
  name: string;
  description: string;
  color: string;
  sort_order: number;
}

interface Contact {
  lead_id: string;
  contact_id: string;
  first_name: string;
  last_name: string;
  email: string;
  secondary_email: string;
  phone: string;
  company: string;
  job_title: string;
  status_name: string;
  status_color: string;
  tags: string[];
  assigned_to: string;
  assigned_to_name: string;
  last_contacted_at: string;
  lead_created_at: string;
  form_name: string;
  lead_notes: string;
  contact_notes: string;
  property_id: string;
  property_name: string;
  property_address: string;
  property_group: string;
  avatar_url: string;
  address: any;
}

interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

interface LeadManagementView {
  lead_id: string;
  form_id: string;
  form_name: string;
  status_id: string;
  status_name: string;
  status_color: string;
  form_data: any;
  source_url: string;
  assigned_to: string;
  assigned_to_name: string;
  lead_notes: string;
  lead_created_at: string;
  lead_updated_at: string;
  contact_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company: string;
  job_title: string;
  address: any;
  tags: string[];
  contact_notes: string;
  last_contacted_at: string;
  contact_created_at: string;
  contact_updated_at: string;
}

export function Contacts() {
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [leadStatuses, setLeadStatuses] = useState<LeadStatus[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showNewContactForm, setShowNewContactForm] = useState(false);
  const [secondaryEmailEditorContactId, setSecondaryEmailEditorContactId] = useState<string | null>(null);
  const [secondaryEmailDraft, setSecondaryEmailDraft] = useState('');
  const [secondaryEmailSavingContactId, setSecondaryEmailSavingContactId] = useState<string | null>(null);

  useEffect(() => {
    fetchContacts();
    fetchLeadStatuses();
    fetchUsers();
  }, []);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('all_contacts_view')
        .select('*')
        .order('contact_created_at', { ascending: false });

      if (error) throw error;

        const formattedContacts: Contact[] = data.map((item: any) => ({
          lead_id: item.lead_id || '',
          contact_id: item.contact_id,
          first_name: item.first_name || '',
          last_name: item.last_name || '',
          email: item.email || '',
          secondary_email: item.secondary_email || '',
          phone: item.phone || '',
        company: item.company || '',
        job_title: item.job_title || '',
        status_name: item.status_name || 'Manual Contact',
        status_color: item.status_color || '#6B7280',
        tags: item.tags || [],
        assigned_to: item.assigned_to || '',
        assigned_to_name: item.assigned_to_name || 'Unassigned',
        last_contacted_at: item.last_contacted_at || '',
        lead_created_at: item.lead_created_at || item.contact_created_at,
        form_name: item.form_name || item.contact_type || 'Manual Contact',
        lead_notes: item.lead_notes || '',
        contact_notes: item.contact_notes || '',
        property_id: item.property_id || '',
        property_name: item.property_name || '',
        property_address: item.property_address || '',
        property_group: item.property_group || '',
        avatar_url: item.avatar_url || '',
        address: item.address || {}
      }));

      setContacts(formattedContacts);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      toast.error('Failed to fetch contacts');
    } finally {
      setLoading(false);
    }
  };

  const fetchLeadStatuses = async () => {
    try {
      const { data, error } = await supabase
        .from('contact_statuses')
        .select('*')
        .order('sort_order');

      if (error) throw error;
      setLeadStatuses(data);
    } catch (error) {
      console.error('Error fetching lead statuses:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .in('role', ['admin', 'jg_management'])
        .order('full_name');

      if (error) throw error;
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const updateLeadStatus = async (contactId: string, statusName: string) => {
    try {
      const { error } = await supabase
        .from('contacts')
        .update({ status: statusName })
        .eq('id', contactId);

      if (error) throw error;

      toast.success('Contact status updated successfully');
      fetchContacts();
    } catch (error) {
      console.error('Error updating contact status:', error);
      toast.error('Failed to update contact status');
    }
  };

  const updateContactNotes = async (contactId: string, notes: string) => {
    try {
      const { error } = await supabase
        .from('contacts')
        .update({ notes, updated_at: new Date().toISOString() })
        .eq('id', contactId);

      if (error) throw error;

      toast.success('Contact notes updated successfully');
      fetchContacts();
    } catch (error) {
      console.error('Error updating contact notes:', error);
      toast.error('Failed to update contact notes');
    }
  };

  const updateContactAssignment = async (contactId: string, assignedTo: string) => {
    try {
      const { error } = await supabase
        .from('contacts')
        .update({ assigned_to: assignedTo || null, updated_at: new Date().toISOString() })
        .eq('id', contactId);

      if (error) throw error;

      toast.success('Contact assignment updated successfully');
      fetchContacts();
    } catch (error) {
      console.error('Error updating contact assignment:', error);
      toast.error('Failed to update contact assignment');
    }
  };

  const startSecondaryEmailEditor = (contact: Contact) => {
    setSecondaryEmailEditorContactId(contact.contact_id);
    setSecondaryEmailDraft(contact.secondary_email || '');
  };

  const cancelSecondaryEmailEdit = () => {
    setSecondaryEmailEditorContactId(null);
    setSecondaryEmailDraft('');
  };

  const saveSecondaryEmail = async (contactId: string) => {
    setSecondaryEmailSavingContactId(contactId);
    const trimmedEmail = secondaryEmailDraft.trim();

    try {
      const { error } = await supabase
        .from('contacts')
        .update({ secondary_email: trimmedEmail || null })
        .eq('id', contactId);

      if (error) throw error;

      setContacts(prev =>
        prev.map(contact =>
          contact.contact_id === contactId ? { ...contact, secondary_email: trimmedEmail } : contact
        )
      );
      toast.success('Secondary email saved');
      cancelSecondaryEmailEdit();
    } catch (err) {
      console.error('Error saving secondary email:', err);
      toast.error('Failed to save secondary email');
    } finally {
      setSecondaryEmailSavingContactId(null);
    }
  };

  const filteredContacts = contacts.filter(contact => {
    const matchesSearch = 
      contact.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.phone.includes(searchTerm);

    const matchesStatus = statusFilter === 'all' || contact.status_name === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusIcon = (statusName: string) => {
    switch (statusName) {
      case 'Lead':
        return <AlertCircle className="h-4 w-4" />;
      case 'General Contact':
        return <Users className="h-4 w-4" />;
      case 'Client':
        return <Building2 className="h-4 w-4" />;
      case 'Customer':
        return <CheckCircle className="h-4 w-4" />;
      case 'Proposal Sent':
        return <Mail className="h-4 w-4" />;
      case 'Dead':
        return <XCircle className="h-4 w-4" />;
      case 'Other':
        return <Tag className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
              <Users className="h-8 w-8 mr-3 text-purple-600" />
              Contacts & Lead Management
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Manage your leads and contacts in one place
            </p>
          </div>
          <button
            onClick={() => setShowNewContactForm(true)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Contact
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Search contacts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="pl-10 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="all">All Statuses</option>
            {leadStatuses.map((status) => (
              <option key={status.id} value={status.name}>
                {status.name}
              </option>
            ))}
            <option value="Manual Contact">Manual Contact</option>
          </select>
        </div>
      </div>

      {/* Contacts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredContacts.map((contact) => (
          <div
            key={contact.contact_id}
            onClick={() => navigate(`/dashboard/contacts/${contact.contact_id}`)}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 border-l-4 p-6 hover:shadow-lg transition-shadow cursor-pointer relative"
            style={{ borderLeftColor: contact.status_color }}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mr-3 overflow-hidden">
                  {contact.avatar_url ? (
                    <img 
                      src={contact.avatar_url} 
                      alt={`${contact.first_name} ${contact.last_name}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-purple-600 dark:text-purple-400 font-semibold text-lg">
                      {contact.first_name.charAt(0)}{contact.last_name.charAt(0)}
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {contact.first_name} {contact.last_name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {contact.company || 'No Company'}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2 flex-shrink-0">
                <div
                  className="flex items-center px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap"
                  style={{ 
                    backgroundColor: `${contact.status_color}20`,
                    color: contact.status_color
                  }}
                >
                  {getStatusIcon(contact.status_name)}
                  <span className="ml-1">{contact.status_name}</span>
                </div>
              </div>
            </div>

            {/* Contact Info */}
            <div className="space-y-2 mb-4">
            {contact.email && (
              <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                <div className="flex items-center">
                  <Mail className="h-4 w-4 mr-2" />
                  <a href={`mailto:${contact.email}`} className="hover:text-purple-600" onClick={(e) => e.stopPropagation()}>
                    {contact.email}
                  </a>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    startSecondaryEmailEditor(contact);
                  }}
                  className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  title="Add or edit secondary email"
                >
                  {contact.secondary_email ? (
                    <Edit className="h-4 w-4 text-green-600" />
                  ) : (
                    <Plus className="h-4 w-4 text-gray-500" />
                  )}
                </button>
              </div>
            )}
            {contact.secondary_email && (
              <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                <Mail className="h-4 w-4 mr-2" />
                <span className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Secondary:</span>
                <span className="ml-1">{contact.secondary_email}</span>
              </div>
            )}
            {secondaryEmailEditorContactId === contact.contact_id && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  saveSecondaryEmail(contact.contact_id);
                }}
                className="flex items-center space-x-2"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="email"
                  value={secondaryEmailDraft}
                  onChange={(e) => setSecondaryEmailDraft(e.target.value)}
                  className="flex-1 h-10 px-3 bg-white dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Secondary Email"
                />
                <button
                  type="submit"
                  disabled={secondaryEmailSavingContactId === contact.contact_id}
                  className="inline-flex items-center px-2 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-white"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    cancelSecondaryEmailEdit();
                  }}
                  className="inline-flex items-center px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500"
                >
                  <X className="h-4 w-4" />
                </button>
              </form>
            )}
            {contact.phone && (
              <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                <Phone className="h-4 w-4 mr-2" />
                <a href={`tel:${contact.phone}`} className="hover:text-purple-600" onClick={(e) => e.stopPropagation()}>
                    {contact.phone}
                  </a>
                </div>
              )}
              {contact.job_title && (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {contact.job_title}
                </div>
              )}
              {contact.property_name && (
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                  <Building2 className="h-4 w-4 mr-2" />
                  {contact.property_name}
                </div>
              )}
              {contact.address && (contact.address.street || contact.address.city) && (
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                  <MapPin className="h-4 w-4 mr-2" />
                  {contact.address.street && contact.address.city 
                    ? `${contact.address.street}, ${contact.address.city}`
                    : contact.address.street || contact.address.city
                  }
                </div>
              )}
            </div>

            {/* Tags */}
            {contact.tags && contact.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-4">
                {contact.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Footer */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <div className="flex items-center">
                  <Calendar className="h-3 w-3 mr-1" />
                  {new Date(contact.lead_created_at).toLocaleDateString()}
                </div>
                <div>
                  Assigned to: {contact.assigned_to_name}
                </div>
              </div>
              {(contact.contact_notes || contact.last_contacted_at) && (
                <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                  {contact.contact_notes && (
                    <div className="flex items-center">
                      <MessageSquare className="h-3 w-3 mr-1" />
                      Has notes
                    </div>
                  )}
                  {contact.last_contacted_at && (
                    <div className="flex items-center">
                      <Clock className="h-3 w-3 mr-1" />
                      Last contact: {new Date(contact.last_contacted_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredContacts.length === 0 && (
        <div className="text-center py-12">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No contacts found
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {searchTerm || statusFilter !== 'all' 
              ? 'Try adjusting your search or filter criteria'
              : 'Create a lead form to start collecting contacts'
            }
          </p>
        </div>
      )}

      {/* New Contact Form Modal */}
      {showNewContactForm && (
        <NewContactForm
          isOpen={showNewContactForm}
          onClose={() => setShowNewContactForm(false)}
          onSuccess={() => {
            setShowNewContactForm(false);
            fetchContacts();
          }}
          leadStatuses={leadStatuses}
          users={users}
        />
      )}
    </div>
  );
}
