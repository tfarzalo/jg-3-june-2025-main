import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Save } from 'lucide-react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  content: string;
}

export function ExtraChargesEmailTemplates({ signature, onSignatureChange }: { signature: string; onSignatureChange: (sig: string) => void }) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTemplate, setNewTemplate] = useState({ name: '', subject: '', content: '' });
  const [signatureInput, setSignatureInput] = useState(signature);
  const [showModal, setShowModal] = useState(false);
  const [editTemplate, setEditTemplate] = useState<EmailTemplate | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchTemplates();

    // Restore default templates if missing
    const restoreDefaultTemplates = async () => {
      const defaultTemplates = [
        {
          id: crypto.randomUUID(),
          name: 'Formal',
          subject: 'Approval Request for Job #[Job ID]',
          content: 'Dear [Property Manager],\n\nI am writing to request your approval for additional charges related to Job #[Job ID].\n\n[Job Details]\n\n[Work Order Details]\n\nPlease review these charges and let us know if you approve.\n\nThank you,\nJG Painting Pros Inc.'
        },
        {
          id: crypto.randomUUID(),
          name: 'Professional',
          subject: 'Approval Needed for Job #[Job ID]',
          content: 'Hello [Property Manager],\n\nWe need your approval for some additional charges for Job #[Job ID].\n\n[Job Information]\n\n[Additional Charges]\n\nPlease review and approve these charges at your earliest convenience.\n\nThank you,\nJG Painting Pros Inc.'
        },
        {
          id: crypto.randomUUID(),
          name: 'Casual',
          subject: 'Quick Approval Needed for Job #[Job ID]',
          content: 'Hi [Property Manager],\n\nQuick note about some extra charges for Job #[Job ID] that need your approval.\n\n[Quick Job Info]\n\n[Extra Charges]\n\nLet me know if you\'re good with these charges!\n\nThank you,\nJG Painting Pros Inc.'
        }
      ];

      const { data: existingTemplates } = await supabase.from('email_templates').select('name');
      const missingTemplates = defaultTemplates.filter(
        (template) => !existingTemplates?.some((existing) => existing.name === template.name)
      );

      if (missingTemplates.length > 0) {
        await supabase.from('email_templates').insert(missingTemplates);
        fetchTemplates();
      }
    };

    restoreDefaultTemplates();
  }, []);

  useEffect(() => {
    const fetchUserId = async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user?.id) {
        setUserId(data.session.user.id);
      } else {
        console.error('Failed to fetch user ID');
      }
    };

    fetchUserId();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('email_templates').select('*');
    if (error) toast.error('Failed to load templates');
    setTemplates(data || []);
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!newTemplate.name || !newTemplate.subject || !newTemplate.content) {
      toast.error('All fields are required');
      return;
    }
    const generatedId = crypto.randomUUID();
    const payload = {
      id: generatedId,
      name: newTemplate.name,
      subject: newTemplate.subject,
      content: newTemplate.content
    };
    console.log('Generated UUID:', generatedId);
    console.log('Adding template with payload:', payload);
    const { error } = await supabase.from('email_templates').insert([payload]);
    if (error) {
      console.error('Error adding template:', error);
      toast.error('Failed to add template');
    } else {
      toast.success('Template added');
      setNewTemplate({ name: '', subject: '', content: '' });
      fetchTemplates();
    }
  };

  const handleEdit = (id: string) => {
    const templateToEdit = templates.find(t => t.id === id);
    if (templateToEdit) {
      setEditingId(id);
      setNewTemplate({ 
        name: templateToEdit.name, 
        subject: templateToEdit.subject, 
        content: templateToEdit.content 
      });
    }
  };

  const handleSave = async (id: string, updated: Partial<EmailTemplate>) => {
    if (!updated.name || !updated.subject || !updated.content) {
      toast.error('All fields are required');
      return;
    }
    const payload = {
      name: updated.name,
      subject: updated.subject,
      content: updated.content
    };
    console.log('Updating template with ID:', id, 'Payload:', payload);
    const { error } = await supabase.from('email_templates').update(payload).eq('id', id);
    if (error) {
      console.error('Error updating template:', error);
      toast.error('Failed to update template');
    } else {
      toast.success('Template updated');
      setEditingId(null);
      fetchTemplates();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('email_templates').delete().eq('id', id);
    if (error) toast.error('Failed to delete template');
    else {
      toast.success('Template deleted');
      fetchTemplates();
    }
  };

  const handleSignatureSave = async () => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ extra_charges_email_signature: signatureInput })
        .eq('id', userId); // Replace userId with the actual user ID

      if (error) {
        toast.error('Failed to save signature');
      } else {
        onSignatureChange(signatureInput);
        toast.success('Signature updated');
      }
    } catch (err) {
      console.error('Error saving signature:', err);
      toast.error('An unexpected error occurred');
    }
  };

  // When opening the modal for a new template, reset newTemplate and ensure signature is appended
  const openModal = (template?: EmailTemplate) => {
    if (template) {
      setEditTemplate(template);
    } else {
      setNewTemplate({ name: '', subject: '', content: signature }); // Start with signature in body
      setEditTemplate(null);
    }
    setShowModal(true);
  };

  // When signature changes, update newTemplate body if not editing
  useEffect(() => {
    if (!editTemplate && showModal) {
      setNewTemplate(t => ({ ...t, content: signature }));
    }
  }, [signature]);

  // Modal close function (was missing in previous edit)
  const closeModal = () => {
    setEditTemplate(null);
    setShowModal(false);
  };

  return (
    <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow mt-8">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Extra Charges Email Templates</h2>
      {loading ? (
        <div>Loading...</div>
      ) : (
        <>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Default Email Signature</label>
            <textarea
              className="w-full h-20 rounded border border-gray-300 dark:border-[#2D3B4E] bg-gray-50 dark:bg-[#1E293B] text-gray-900 dark:text-white p-2 mb-2"
              value={signatureInput}
              onChange={e => setSignatureInput(e.target.value)}
            />
            <button onClick={handleSignatureSave} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm flex items-center"><Save className="h-4 w-4 mr-2" />Save Signature</button>
          </div>
          <div className="mb-6 flex justify-between items-center">
            <h3 className="font-medium mb-2">Templates</h3>
            <button onClick={() => openModal()} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm flex items-center"><Plus className="h-4 w-4 mr-2" />Add Template</button>
          </div>
          <div>
            {templates.length === 0 ? (
              <div className="text-red-500">No extra charges email templates found. Please create one in this section to use for extra charges emails.</div>
            ) : (
              <ul className="space-y-4">
                {templates.map(t => (
                  <li key={t.id} className="border rounded p-4 bg-gray-50 dark:bg-[#232f45] flex justify-between items-center">
                    <div>
                      <div className="font-semibold">{t.name}</div>
                      <div className="text-sm text-gray-700 dark:text-gray-300">Subject: {t.subject}</div>
                      <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line" dangerouslySetInnerHTML={{__html: t.content}} />
                    </div>
                    <div className="flex space-x-2">
                      <button onClick={() => openModal(t)} className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 text-xs flex items-center"><Edit className="h-4 w-4 mr-1" />Edit</button>
                      <button onClick={() => handleDelete(t.id)} className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs flex items-center"><Trash2 className="h-4 w-4 mr-1" />Delete</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {/* Modal for create/edit */}
          {showModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white dark:bg-[#1E293B] rounded-lg p-8 w-full max-w-2xl shadow-xl flex flex-col gap-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{editTemplate ? 'Edit Template' : 'Add New Template'}</h3>
                <input className="w-full mb-2 p-2 rounded border border-gray-300 dark:border-[#2D3B4E]" placeholder="Name" value={editTemplate?.name || newTemplate.name} onChange={e => editTemplate ? setEditTemplate(t => t && ({ ...t, name: e.target.value })) : setNewTemplate(t => ({ ...t, name: e.target.value }))} />
                <input className="w-full mb-2 p-2 rounded border border-gray-300 dark:border-[#2D3B4E]" placeholder="Subject" value={editTemplate?.subject || newTemplate.subject} onChange={e => editTemplate ? setEditTemplate(t => t && ({ ...t, subject: e.target.value })) : setNewTemplate(t => ({ ...t, subject: e.target.value }))} />
                <div className="mb-2">
                  <ReactQuill theme="snow" value={editTemplate?.content || newTemplate.content} onChange={val => editTemplate ? setEditTemplate(t => t && ({ ...t, content: val })) : setNewTemplate(t => ({ ...t, content: val }))} style={{height: 200, marginBottom: 20}} />
                </div>
                <div className="flex flex-row justify-end gap-2 mt-2">
                  <button onClick={closeModal} className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 text-sm">Cancel</button>
                  <button
                    onClick={async () => {
                      if (editTemplate) {
                        const { error } = await supabase.from('email_templates').update(editTemplate).eq('id', editTemplate.id);
                        if (!error) {
                          toast.success('Template updated');
                          fetchTemplates();
                          closeModal();
                        } else {
                          toast.error('Failed to update template');
                        }
                      } else {
                        if (!newTemplate.name || !newTemplate.subject || !newTemplate.content) return;
                        const { error } = await supabase.from('email_templates').insert([{ ...newTemplate }]);
                        if (!error) {
                          toast.success('Template added');
                          fetchTemplates();
                          closeModal();
                        } else {
                          toast.error('Failed to add template');
                        }
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm flex items-center"
                  >
                    <Save className="h-4 w-4 mr-2" />Save
                  </button>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">Signature will be appended to all outgoing emails.</div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
