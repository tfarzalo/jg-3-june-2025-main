import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Edit, 
  Save, 
  X, 
  Phone, 
  Mail, 
  MapPin,
  Building2,
  Calendar,
  Tag,
  Plus,
  Clock,
  User,
  MessageSquare,
  PhoneCall,
  Users,
  AlertCircle,
  Trash2
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { toast } from 'sonner';
import { CreatePropertyFromContactModal } from './CreatePropertyFromContactModal';

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
  avatar_url: string;
  address: any;
}

interface ContactNote {
  id: string;
  note_text: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
}

interface ContactCommunication {
  id: string;
  communication_type: string;
  subject: string;
  notes: string;
  communication_date: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
}

interface ContactHistory {
  id: string;
  interaction_type: string;
  interaction_date: string;
  description: string;
  notes: string;
  created_by: string;
  created_by_name: string;
}

interface Property {
  id: string;
  property_name: string;
  address: string;
}

const INTERACTION_TYPES = [
  { value: 'call', label: 'Phone Call', icon: PhoneCall },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'meeting', label: 'Meeting', icon: Users },
  { value: 'note', label: 'Note', icon: MessageSquare },
  { value: 'status_change', label: 'Status Change', icon: AlertCircle },
  { value: 'other', label: 'Other', icon: Clock },
];

export function ContactDetail() {
  const { contactId } = useParams<{ contactId: string }>();
  const navigate = useNavigate();
  const [contact, setContact] = useState<Contact | null>(null);
  const [contactHistory, setContactHistory] = useState<ContactHistory[]>([]);
  const [contactNotes, setContactNotes] = useState<ContactNote[]>([]);
  const [contactCommunications, setContactCommunications] = useState<ContactCommunication[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [leadStatuses, setLeadStatuses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'notes' | 'communications' | 'history'>('overview');
  const [showCreatePropertyModal, setShowCreatePropertyModal] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    company: '',
    job_title: '',
    property_name: '',
    property_address: '',
    notes: '',
    tags: [] as string[],
    assigned_to: '',
    status_id: '',
    address: {
      street: '',
      city: '',
      state: '',
      zip: '',
      country: 'USA'
    }
  });

  // New history entry
  const [newHistory, setNewHistory] = useState({
    interaction_type: 'note',
    description: '',
    notes: ''
  });

  // New note entry
  const [newNote, setNewNote] = useState({
    note_text: ''
  });

  // New communication entry
  const [newCommunication, setNewCommunication] = useState({
    communication_type: 'call',
    subject: '',
    notes: '',
    communication_date: new Date().toISOString().slice(0, 16)
  });

  useEffect(() => {
    if (contactId) {
      fetchContactDetails();
    }
  }, [contactId]);

  const fetchContactDetails = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('all_contacts_view')
        .select('*')
        .eq('contact_id', contactId)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Contact not found');

      const contactData: Contact = {
        lead_id: data.lead_id || '',
        contact_id: data.contact_id,
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        email: data.email || '',
        secondary_email: data.secondary_email || '',
        phone: data.phone || '',
        company: data.company || '',
        job_title: data.job_title || '',
        status_name: data.status_name || 'Manual Contact',
        status_color: data.status_color || '#6B7280',
        tags: data.tags || [],
        assigned_to: data.assigned_to || '',
        assigned_to_name: data.assigned_to_name || 'Unassigned',
        last_contacted_at: data.last_contacted_at || '',
        lead_created_at: data.lead_created_at || data.contact_created_at,
        form_name: data.form_name || data.contact_type || 'Manual Contact',
        lead_notes: data.lead_notes || '',
        contact_notes: data.contact_notes || '',
        property_id: data.property_id || '',
        property_name: data.property_name || '',
        property_address: data.property_address || '',
        avatar_url: data.avatar_url || '',
        address: data.address || {}
      };

      setContact(contactData);
      setFormData({
        first_name: contactData.first_name,
        last_name: contactData.last_name,
        email: contactData.email,
        phone: contactData.phone,
        company: contactData.company,
        job_title: contactData.job_title,
        property_name: contactData.property_name,
        property_address: contactData.property_address,
        notes: contactData.contact_notes,
        tags: contactData.tags,
        assigned_to: contactData.assigned_to,
        status_id: data.status_id || '',
        address: contactData.address || {
          street: '',
          city: '',
          state: '',
          zip: '',
          country: 'USA'
        }
      });

      // Fetch contact history (non-blocking)
      const { data: historyData, error: historyError } = await supabase
        .from('contact_history')
        .select(`
          *,
          created_by_profile:profiles!contact_history_created_by_fkey(full_name)
        `)
        .eq('contact_id', contactId)
        .order('interaction_date', { ascending: false });

      if (historyError) {
        console.warn('Error fetching contact history:', historyError);
      } else if (historyData) {
        const formattedHistory: ContactHistory[] = historyData.map((item: any) => ({
          id: item.id,
          interaction_type: item.interaction_type,
          interaction_date: item.interaction_date,
          description: item.description,
          notes: item.notes,
          created_by: item.created_by,
          created_by_name: item.created_by_profile?.full_name || 'Unknown'
        }));
        setContactHistory(formattedHistory);
      }

      // Fetch contact notes (non-blocking)
      const { data: notesData, error: notesError } = await supabase
        .from('contact_notes')
        .select(`
          *,
          created_by_profile:profiles!contact_notes_created_by_fkey(full_name)
        `)
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false });

      if (notesError) {
        console.warn('Error fetching contact notes:', notesError);
      } else if (notesData) {
        const formattedNotes = notesData.map((item: any) => ({
          id: item.id,
          note_text: item.note_text,
          created_by: item.created_by,
          created_by_name: item.created_by_profile?.full_name || 'Unknown',
          created_at: item.created_at
        }));
        setContactNotes(formattedNotes);
      }

      // Fetch contact communications (non-blocking)
      const { data: commData, error: commError } = await supabase
        .from('contact_communications')
        .select(`
          *,
          created_by_profile:profiles!contact_communications_created_by_fkey(full_name)
        `)
        .eq('contact_id', contactId)
        .order('communication_date', { ascending: false });

      if (commError) {
        console.warn('Error fetching contact communications:', commError);
      } else if (commData) {
        const formattedCommunications = commData.map((item: any) => ({
          id: item.id,
          communication_type: item.communication_type,
          subject: item.subject,
          notes: item.notes,
          communication_date: item.communication_date,
          created_by: item.created_by,
          created_by_name: item.created_by_profile?.full_name || 'Unknown',
          created_at: item.created_at
        }));
        setContactCommunications(formattedCommunications);
      }

      // Fetch users for assignment (non-blocking)
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .in('role', ['admin', 'jg_management'])
        .order('full_name');

      if (usersError) {
        console.warn('Error fetching users:', usersError);
      } else if (usersData) {
        setUsers(usersData);
      }

      // Fetch lead statuses (non-blocking)
      const { data: statusesData, error: statusesError } = await supabase
        .from('lead_statuses')
        .select('*')
        .order('sort_order');

      if (statusesError) {
        console.warn('Error fetching lead statuses:', statusesError);
      } else if (statusesData) {
        setLeadStatuses(statusesData);
      }

    } catch (error) {
      console.error('Error fetching contact details:', error);
      toast.error('Failed to fetch contact details');
    } finally {
      setLoading(false);
    }
  };

  // No longer need to fetch properties since we're using text fields

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Update contact
      const { error: contactError } = await supabase
        .from('contacts')
        .update({
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email,
          phone: formData.phone,
          company: formData.company,
          job_title: formData.job_title,
          property_name: formData.property_name,
          property_address: formData.property_address,
          notes: formData.notes,
          tags: formData.tags,
          address: formData.address,
          assigned_to: formData.assigned_to || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', contactId);

      if (contactError) throw contactError;

      // Update lead status if there's a lead_id
      if (contact?.lead_id && formData.status_id) {
        const { error: leadError } = await supabase
          .from('leads')
          .update({ status_id: formData.status_id })
          .eq('id', contact.lead_id);

        if (leadError) console.warn('Error updating lead status:', leadError);
      }

      toast.success('Contact updated successfully');
      setEditing(false);
      fetchContactDetails();
    } catch (error) {
      console.error('Error updating contact:', error);
      toast.error('Failed to update contact');
    } finally {
      setSaving(false);
    }
  };

  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, newTag.trim()]
      });
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter(tag => tag !== tagToRemove)
    });
  };

  const handleCreateProperty = async () => {
    // Open the modal instead of the old inline creation
    setShowCreatePropertyModal(true);
  };

  const handlePropertyCreated = async (propertyId: string) => {
    // Refresh contact data to show the new property link and updated status
    await fetchContactDetails();
  };

  const handleAddNote = async () => {
    if (!newNote.note_text.trim()) {
      toast.error('Note text is required');
      return;
    }

    try {
      setSaving(true);
      
      const { data, error } = await supabase
        .from('contact_notes')
        .insert({
          contact_id: contactId,
          note_text: newNote.note_text,
          created_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Note added successfully');
      setNewNote({ note_text: '' });
      await fetchContactDetails();
      
    } catch (error) {
      console.error('Error adding note:', error);
      toast.error('Failed to add note');
    } finally {
      setSaving(false);
    }
  };

  const handleAddCommunication = async () => {
    if (!newCommunication.subject.trim() || !newCommunication.notes.trim()) {
      toast.error('Subject and notes are required');
      return;
    }

    try {
      setSaving(true);
      
      const { data, error } = await supabase
        .from('contact_communications')
        .insert({
          contact_id: contactId,
          communication_type: newCommunication.communication_type,
          subject: newCommunication.subject,
          notes: newCommunication.notes,
          communication_date: newCommunication.communication_date,
          created_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Communication logged successfully');
      setNewCommunication({
        communication_type: 'call',
        subject: '',
        notes: '',
        communication_date: new Date().toISOString().slice(0, 16)
      });
      await fetchContactDetails();
      
    } catch (error) {
      console.error('Error adding communication:', error);
      toast.error('Failed to add communication');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      const { error } = await supabase
        .from('contact_notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;

      toast.success('Note deleted successfully');
      await fetchContactDetails();
      
    } catch (error) {
      console.error('Error deleting note:', error);
      toast.error('Failed to delete note');
    }
  };

  const handleDeleteCommunication = async (commId: string) => {
    try {
      const { error } = await supabase
        .from('contact_communications')
        .delete()
        .eq('id', commId);

      if (error) throw error;

      toast.success('Communication deleted successfully');
      await fetchContactDetails();
      
    } catch (error) {
      console.error('Error deleting communication:', error);
      toast.error('Failed to delete communication');
    }
  };

  const handleDeleteContact = async () => {
    if (!contactId) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete ${contact.first_name} ${contact.last_name}? This action cannot be undone and will also delete all associated notes and communications.`
    );

    if (!confirmed) return;

    try {
      setSaving(true);
      
      // Delete the contact (this will cascade delete notes and communications due to foreign key constraints)
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', contactId);

      if (error) throw error;

      toast.success('Contact deleted successfully');
      navigate('/dashboard/contacts'); // Redirect to contacts list
    } catch (error) {
      console.error('Error deleting contact:', error);
      toast.error('Failed to delete contact');
    } finally {
      setSaving(false);
    }
  };

  const handleAddHistory = async () => {
    try {
      setSaving(true);
      
      const { error } = await supabase
        .from('contact_history')
        .insert({
          contact_id: contactId!,
          interaction_type: newHistory.interaction_type,
          description: newHistory.description,
          notes: newHistory.notes
        });

      if (error) throw error;

      toast.success('Contact history added successfully');
      setNewHistory({
        interaction_type: 'note',
        description: '',
        notes: ''
      });
      fetchContactDetails();
    } catch (error) {
      console.error('Error adding contact history:', error);
      toast.error('Failed to add contact history');
    } finally {
      setSaving(false);
    }
  };

  const getInteractionIcon = (type: string) => {
    const interaction = INTERACTION_TYPES.find(t => t.value === type);
    return interaction ? React.createElement(interaction.icon, { className: "h-4 w-4" }) : <Clock className="h-4 w-4" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Contact not found
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          The contact you're looking for doesn't exist.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/dashboard/contacts')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center overflow-hidden">
                {contact.avatar_url ? (
                  <img 
                    src={contact.avatar_url} 
                    alt={`${contact.first_name} ${contact.last_name}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-purple-600 dark:text-purple-400 font-semibold text-2xl">
                    {contact.first_name.charAt(0)}{contact.last_name.charAt(0)}
                  </span>
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {contact.first_name} {contact.last_name}
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  {contact.company || 'No Company'} • {contact.job_title || 'No Title'}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {editing ? (
              <>
                <button
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg flex items-center"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Contact
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="flex space-x-8">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'notes', label: 'Notes' },
            { id: 'communications', label: 'Communications' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Information */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Basic Information
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    First Name
                  </label>
                  {editing ? (
                    <input
                      type="text"
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  ) : (
                    <p className="text-gray-900 dark:text-white">{contact.first_name}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Last Name
                  </label>
                  {editing ? (
                    <input
                      type="text"
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  ) : (
                    <p className="text-gray-900 dark:text-white">{contact.last_name}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email
                  </label>
                  {editing ? (
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  ) : (
                    <p className="text-gray-900 dark:text-white">{contact.email}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Phone
                  </label>
                  {editing ? (
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  ) : (
                    <p className="text-gray-900 dark:text-white">{contact.phone}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Company
                  </label>
                  {editing ? (
                    <input
                      type="text"
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  ) : (
                    <p className="text-gray-900 dark:text-white">{contact.company}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Job Title
                  </label>
                  {editing ? (
                    <input
                      type="text"
                      value={formData.job_title}
                      onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  ) : (
                    <p className="text-gray-900 dark:text-white">{contact.job_title}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Property and Address */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Property & Address
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Property Name
                </label>
                {editing ? (
                  <input
                    type="text"
                    value={formData.property_name}
                    onChange={(e) => setFormData({ ...formData, property_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Enter property name"
                  />
                ) : (
                  <p className="text-gray-900 dark:text-white">{contact.property_name || 'No property name'}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Address
                </label>
                {editing ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Street Address"
                      value={formData.address.street}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        address: { ...formData.address, street: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="City"
                        value={formData.address.city}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          address: { ...formData.address, city: e.target.value }
                        })}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                      <input
                        type="text"
                        placeholder="State"
                        value={formData.address.state}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          address: { ...formData.address, state: e.target.value }
                        })}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="ZIP Code"
                        value={formData.address.zip}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          address: { ...formData.address, zip: e.target.value }
                        })}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                      <input
                        type="text"
                        placeholder="Country"
                        value={formData.address.country}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          address: { ...formData.address, country: e.target.value }
                        })}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-900 dark:text-white">
                    {contact.address ? 
                      `${contact.address.street || ''} ${contact.address.city || ''} ${contact.address.state || ''} ${contact.address.zip || ''}`.trim() || 'No address provided'
                      : 'No address provided'
                    }
                  </p>
                )}
              </div>
              
              {/* Show property link if already linked */}
              {!editing && contact.property_id && (
                <div className="pt-2">
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                    <p className="text-sm text-green-800 dark:text-green-200 flex items-center">
                      <Building2 className="h-4 w-4 mr-2" />
                      <strong>Linked to Property:</strong>&nbsp;{contact.property_name}
                    </p>
                  </div>
                </div>
              )}
              
              {/* Create Property Button - At bottom, visible when not linked and has address info */}
              {!editing && !contact.property_id && 
                contact.property_name && 
                contact.address?.street && 
                contact.address?.city && 
                contact.address?.state && (
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={handleCreateProperty}
                    className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center"
                  >
                    <Building2 className="h-5 w-5 mr-2" />
                    Create Property from Contact
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Status, Assignment, Tags, and Notes */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Contact Management
            </h3>
            <div className="space-y-4">
              {/* Lead Status */}
              {contact.lead_id && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Lead Status
                  </label>
                  {editing ? (
                    <select
                      value={formData.status_id}
                      onChange={(e) => setFormData({ ...formData, status_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      {leadStatuses.map((status) => (
                        <option key={status.id} value={status.id}>
                          {status.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="flex items-center">
                      <span
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium"
                        style={{ backgroundColor: `${contact.status_color}20`, color: contact.status_color }}
                      >
                        {contact.status_name}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Assignment */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Assigned To
                </label>
                {editing ? (
                  <select
                    value={formData.assigned_to || ''}
                    onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Unassigned</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.full_name} ({user.role})
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-gray-900 dark:text-white">{contact.assigned_to_name || 'Unassigned'}</p>
                )}
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tags
                </label>
                {editing ? (
                  <div className="space-y-3">
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="Add a tag"
                      />
                      <button
                        onClick={handleAddTag}
                        type="button"
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {formData.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                        >
                          {tag}
                          <button
                            onClick={() => handleRemoveTag(tag)}
                            type="button"
                            className="ml-2 text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-200"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {contact.tags?.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                      >
                        {tag}
                      </span>
                    ))}
                    {(!contact.tags || contact.tags.length === 0) && (
                      <p className="text-gray-500 dark:text-gray-400">No tags</p>
                    )}
                  </div>
                )}
              </div>

              {/* Description / About */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description / About
                </label>
                {editing ? (
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Add a description or bio for this contact..."
                  />
                ) : (
                  <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{contact.contact_notes || 'No description provided'}</p>
                )}
              </div>

              {/* Lead Information - Read Only */}
              {contact.lead_id && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Lead Information
                  </label>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-1 text-sm text-gray-600 dark:text-gray-400">
                    <p><strong>Source Form:</strong> {contact.form_name}</p>
                    <p><strong>Created:</strong> {new Date(contact.lead_created_at).toLocaleString()}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Delete Button - Bottom Right, only visible when editing */}
            {editing && (
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                <button
                  onClick={handleDeleteContact}
                  disabled={saving}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg flex items-center"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {saving ? 'Deleting...' : 'Delete Contact'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-6">
          {/* Add New History Entry */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Add Contact History
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Interaction Type
                </label>
                <select
                  value={newHistory.interaction_type}
                  onChange={(e) => setNewHistory({ ...newHistory, interaction_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {INTERACTION_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={newHistory.description}
                  onChange={(e) => setNewHistory({ ...newHistory, description: e.target.value })}
                  placeholder="Brief description"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleAddHistory}
                  disabled={saving || !newHistory.description}
                  className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg flex items-center justify-center"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Entry
                </button>
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Notes
              </label>
              <textarea
                value={newHistory.notes}
                onChange={(e) => setNewHistory({ ...newHistory, notes: e.target.value })}
                placeholder="Additional notes..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          {/* History List */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Contact History
              </h3>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {contactHistory.map((entry) => (
                <div key={entry.id} className="p-6">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      {getInteractionIcon(entry.interaction_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {entry.description}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {new Date(entry.interaction_date).toLocaleDateString()}
                        </p>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {entry.notes}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        Added by {entry.created_by_name}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {contactHistory.length === 0 && (
                <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                  No contact history yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'notes' && (
        <div className="space-y-6">
          {/* Add New Note */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Add New Note
            </h3>
            <div className="space-y-4">
              <textarea
                value={newNote.note_text}
                onChange={(e) => setNewNote({ ...newNote, note_text: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Add a note about this contact..."
              />
              <button
                onClick={handleAddNote}
                disabled={saving || !newNote.note_text.trim()}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg flex items-center"
              >
                <Plus className="h-4 w-4 mr-2" />
                {saving ? 'Adding...' : 'Add Note'}
              </button>
            </div>
          </div>

          {/* Notes List */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Notes History
            </h3>
            <div className="space-y-4">
              {contactNotes.map((note) => (
                <div key={note.id} className="border-l-4 border-purple-200 dark:border-purple-800 pl-4 py-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-gray-900 dark:text-white">{note.note_text}</p>
                      <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                        <span>Added by {note.created_by_name}</span>
                        <span>•</span>
                        <span>{new Date(note.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      className="ml-4 p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded text-red-600 dark:text-red-400"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
              {contactNotes.length === 0 && (
                <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                  No notes yet. Add your first note above.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'communications' && (
        <div className="space-y-6">
          {/* Add New Communication */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Log Communication
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Type
                  </label>
                  <select
                    value={newCommunication.communication_type}
                    onChange={(e) => setNewCommunication({ ...newCommunication, communication_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="call">Phone Call</option>
                    <option value="email">Email</option>
                    <option value="meeting">Meeting</option>
                    <option value="text">Text Message</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={newCommunication.communication_date}
                    onChange={(e) => setNewCommunication({ ...newCommunication, communication_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  value={newCommunication.subject}
                  onChange={(e) => setNewCommunication({ ...newCommunication, subject: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Brief subject or topic..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes
                </label>
                <textarea
                  value={newCommunication.notes}
                  onChange={(e) => setNewCommunication({ ...newCommunication, notes: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Details about the communication..."
                />
              </div>
              <button
                onClick={handleAddCommunication}
                disabled={saving || !newCommunication.subject.trim() || !newCommunication.notes.trim()}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg flex items-center"
              >
                <Plus className="h-4 w-4 mr-2" />
                {saving ? 'Logging...' : 'Log Communication'}
              </button>
            </div>
          </div>

          {/* Communications List */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Communication History
            </h3>
            <div className="space-y-4">
              {contactCommunications.map((comm) => (
                <div key={comm.id} className="border-l-4 border-blue-200 dark:border-blue-800 pl-4 py-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs font-medium rounded">
                          {comm.communication_type.toUpperCase()}
                        </span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {comm.subject}
                        </span>
                      </div>
                      <p className="text-gray-900 dark:text-white mb-2">{comm.notes}</p>
                      <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                        <span>Logged by {comm.created_by_name}</span>
                        <span>•</span>
                        <span>{new Date(comm.communication_date).toLocaleString()}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteCommunication(comm.id)}
                      className="ml-4 p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded text-red-600 dark:text-red-400"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
              {contactCommunications.length === 0 && (
                <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                  No communications logged yet. Add your first communication above.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Property Modal */}
      <CreatePropertyFromContactModal
        isOpen={showCreatePropertyModal}
        onClose={() => setShowCreatePropertyModal(false)}
        contactId={contactId!}
        contactData={{
          first_name: contact.first_name,
          last_name: contact.last_name,
          email: contact.email,
          phone: contact.phone,
          address: contact.address
        }}
        onSuccess={handlePropertyCreated}
      />
    </div>
  );
}
