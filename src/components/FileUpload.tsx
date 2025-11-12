import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, X } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { WorkOrderLink } from './shared/WorkOrderLink';
import { PropertyLink } from './shared/PropertyLink';

interface Property {
  id: string;
  property_name: string;
}

interface Job {
  id: string;
  work_order_num: number;
  unit_number: string;
  property: {
    property_name: string;
  };
}

interface Folder {
  id: string;
  name: string;
  path: string;
}

export function FileUpload() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [formData, setFormData] = useState({
    property_id: '',
    job_id: '',
    folder_id: ''
  });

  useEffect(() => {
    Promise.all([
      fetchProperties(),
      fetchJobs(),
      fetchFolders()
    ]);
  }, []);

  useEffect(() => {
    if (formData.property_id) {
      fetchJobs();
    }
  }, [formData.property_id]);

  const fetchProperties = async () => {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('id, property_name')
        .order('property_name');

      if (error) throw error;
      setProperties(data || []);
    } catch (err) {
      console.error('Error fetching properties:', err);
    }
  };

  const fetchJobs = async () => {
    if (!formData.property_id) {
      setJobs([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          id,
          work_order_num,
          unit_number,
          property:properties (
            property_name
          )
        `)
        .eq('property_id', formData.property_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setJobs(data || []);
    } catch (err) {
      console.error('Error fetching jobs:', err);
    }
  };

  const fetchFolders = async () => {
    try {
      const { data, error } = await supabase
        .from('files')
        .select('id, name, path')
        .eq('type', 'folder/directory')
        .order('name');

      if (error) throw error;
      setFolders(data || []);
    } catch (err) {
      console.error('Error fetching folders:', err);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      setSelectedFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const sanitizeFilename = (filename: string) => {
    const timestamp = Date.now();
    const name = filename.replace(/[^a-zA-Z0-9.-]/g, '_').toLowerCase();
    return `${timestamp}_${name}`;
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setError('Please select files to upload');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      // Get or create General folder if no specific location is selected
      let generalFolderId: string | null = null;
      if (!formData.property_id && !formData.folder_id) {
        const { data: folderData, error: folderError } = await supabase
          .from('files')
          .select('id')
          .eq('name', 'General')
          .eq('type', 'folder/directory')
          .eq('path', '/')
          .single();

        if (folderError && folderError.code !== 'PGRST116') { // Not found error
          throw folderError;
        }

        if (!folderData) {
          const { data: newFolder, error: createError } = await supabase
            .from('files')
            .insert({
              name: 'General',
              path: '/',
              size: 0,
              type: 'folder/directory',
              uploaded_by: userData.user.id
            })
            .select()
            .single();

          if (createError) throw createError;
          generalFolderId = newFolder.id;
        } else {
          generalFolderId = folderData.id;
        }
      }

      for (const file of selectedFiles) {
        const sanitizedFilename = sanitizeFilename(file.name);
        let filePath: string;
        let storagePath: string;

        if (formData.property_id) {
          if (formData.job_id) {
            filePath = `/properties/${formData.property_id}/jobs/${formData.job_id}`;
            storagePath = `properties/${formData.property_id}/jobs/${formData.job_id}/${sanitizedFilename}`;
          } else {
            filePath = `/properties/${formData.property_id}`;
            storagePath = `properties/${formData.property_id}/${sanitizedFilename}`;
          }
        } else if (formData.folder_id) {
          const folder = folders.find(f => f.id === formData.folder_id);
          filePath = folder?.path || '/';
          storagePath = `${folder?.path || ''}/${sanitizedFilename}`.replace(/^\/+/, '');
        } else {
          filePath = '/general';
          storagePath = `general/${sanitizedFilename}`;
        }

        // Upload file to storage
        const { data: storageData, error: storageError } = await supabase.storage
          .from('files')
          .upload(storagePath, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (storageError) throw storageError;

        // Create file record in database
        const { error: dbError } = await supabase
          .from('files')
          .insert({
            name: sanitizedFilename,
            path: filePath,
            size: file.size,
            type: file.type,
            uploaded_by: userData.user.id,
            property_id: formData.property_id || null,
            job_id: formData.job_id || null,
            folder_id: formData.folder_id || generalFolderId
          });

        if (dbError) throw dbError;
      }

      navigate('/dashboard/files');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload files');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-gray-100 dark:bg-[#0F172A] min-h-screen">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-3">
          <Upload className="h-8 w-8 text-gray-500 dark:text-gray-400" />
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Upload Files</h1>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-500/50 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="max-w-3xl">
        <div className="mb-6 space-y-6">
          <div>
            <label htmlFor="property_id" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              Select Property (Optional)
            </label>
            <select
              id="property_id"
              name="property_id"
              value={formData.property_id}
              onChange={(e) => {
                setFormData(prev => ({
                  ...prev,
                  property_id: e.target.value,
                  job_id: ''
                }));
              }}
              className="w-full rounded-lg bg-white dark:bg-[#1E293B] border-gray-300 dark:border-[#2D3B4E] text-gray-900 dark:text-white"
            >
              <option value="">Select a property...</option>
              {properties.map(property => (
                <option key={property.id} value={property.id}>
                  {property.property_name}
                </option>
              ))}
            </select>
          </div>

          {formData.property_id && (
            <div>
              <label htmlFor="job_id" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Select Job (Optional)
              </label>
              <select
                id="job_id"
                name="job_id"
                value={formData.job_id}
                onChange={(e) => setFormData(prev => ({ ...prev, job_id: e.target.value }))}
                className="w-full rounded-lg bg-white dark:bg-[#1E293B] border-gray-300 dark:border-[#2D3B4E] text-gray-900 dark:text-white"
              >
                <option value="">Select a job...</option>
                {jobs.map(job => (
                  <option key={job.id} value={job.id}>
                    {`WO-${String(job.work_order_num).padStart(6, '0')} - Unit ${job.unit_number}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {!formData.property_id && (
            <div>
              <label htmlFor="folder_id" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Select Folder (Optional)
              </label>
              <select
                id="folder_id"
                name="folder_id"
                value={formData.folder_id}
                onChange={(e) => setFormData(prev => ({ ...prev, folder_id: e.target.value }))}
                className="w-full rounded-lg bg-white dark:bg-[#1E293B] border-gray-300 dark:border-[#2D3B4E] text-gray-900 dark:text-white"
              >
                <option value="">Select a folder...</option>
                {folders.map(folder => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div
          className="mb-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 dark:hover:border-blue-500 transition-colors"
          onClick={() => document.getElementById('file-input')?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <input
            id="file-input"
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          <Upload className="mx-auto h-12 w-12 text-gray-500 dark:text-gray-400 mb-4" />
          <p className="text-gray-700 dark:text-gray-400 mb-2">
            Drag and drop files here, or click to select files
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            Maximum file size: 50MB
          </p>
        </div>

        {selectedFiles.length > 0 && (
          <div className="mb-6 bg-white dark:bg-[#1E293B] rounded-lg overflow-hidden shadow">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-[#2D3B4E]">
              <h3 className="text-gray-900 dark:text-white font-medium">Selected Files</h3>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-[#2D3B4E]">
              {selectedFiles.map((file, index) => (
                <div key={index} className="px-6 py-4 flex items-center justify-between">
                  <div>
                    <p className="text-gray-900 dark:text-white font-medium">{file.name}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{formatFileSize(file.size)}</p>
                  </div>
                  <button
                    onClick={() => {
                      const newFiles = [...selectedFiles];
                      newFiles.splice(index, 1);
                      setSelectedFiles(newFiles);
                    }}
                    className="text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-500 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => navigate('/dashboard/files')}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-400 bg-white dark:bg-[#1E293B] border border-gray-300 dark:border-[#2D3B4E] rounded-lg hover:bg-gray-50 dark:hover:bg-[#2D3B4E] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={loading || selectedFiles.length === 0}
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Uploading...' : 'Upload Files'}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatFileSize(bytes: number) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}