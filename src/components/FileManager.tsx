import React, { useEffect, useState, useCallback, useRef } from 'react';
// We'll add icon imports and other necessary imports later as we build out features
import { 
  FolderOpen, 
  File as FileIcon, 
  Grid, 
  List, 
  Plus, 
  Trash2, 
  Upload, 
  Search,
  Share2,
  MoreVertical,
  ChevronLeft,
  X,
  Image as ImageIcon,
  FileText,
  FileVideo,
  FileAudio,
  FileArchive,
  Download
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';

interface FileItem {
  id: string;
  name: string;
  type: string;
  folder_id: string | null;
  uploaded_by: string;
  created_at: string;
  size: number;
  job_id: string | null;
  property_id: string | null;
  file_path: string;
  path?: string;
}

type ViewMode = 'list' | 'grid';
type SortOption = 'name' | 'date' | 'size' | 'type';

interface FolderPath {
  id: string | null;
  name: string;
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export function FileManager() {
  const [items, setItems] = useState<FileItem[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<FolderPath[]>([{ id: null, name: 'All Files' }]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showPreview, setShowPreview] = useState<FileItem | null>(null);
  const [showRenameInput, setShowRenameInput] = useState<FileItem | null>(null);
  const [newName, setNewName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const [previewUrls, setPreviewUrls] = useState<{ [key: string]: string }>({});
  const [isDragging, setIsDragging] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxImages, setLightboxImages] = useState<{ src: string; alt: string }[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const fetchItems = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('files')
        .select('id, name, type, folder_id, uploaded_by, created_at, size, job_id, property_id, path');

      // Handle root folder and nested folders correctly
      if (currentFolderId === null) {
        // At root level, show only property folders (folder_id IS NULL)
        query = query.is('folder_id', null);
      } else {
        query = query.eq('folder_id', currentFolderId);
      }

      // Add job_id filter if we're in a job context
      const urlParams = new URLSearchParams(window.location.search);
      const jobId = urlParams.get('job_id');
      if (jobId) {
        query = query.eq('job_id', jobId);
      }

      const { data, error: fetchError } = await query.order('name');

      if (fetchError) {
        console.error('[FileManager] fetchItems error:', JSON.stringify(fetchError, null, 2));
        console.error('[FileManager] Query params:', { currentFolderId, jobId });
        throw fetchError;
      }

      // Process the files to ensure correct paths
      const processedData = (data || []).map(file => ({
        ...file,
        file_path: file.path || (file.job_id ? `jobs/${file.job_id}/${file.name}` : `root/${file.name}`)
      }));

      setItems(processedData);

    } catch (error) {
      console.error('Error fetching file items:', error);
      setError('Failed to load file items.');
    } finally {
      setLoading(false);
    }
  }, [currentFolderId]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      // Get job_id and property_id if we're in a job context
      const urlParams = new URLSearchParams(window.location.search);
      const jobId = urlParams.get('job_id');
      let propertyId = null;

      if (jobId) {
        const { data: jobData } = await supabase
          .from('jobs')
          .select('property_id')
          .eq('id', jobId)
          .single();
        propertyId = jobData?.property_id;
      }

      // Create folder path
      let folderPath;
      if (jobId && propertyId) {
        folderPath = `properties/${propertyId}/jobs/${jobId}/${currentFolderId || ''}/${newFolderName.trim()}`;
      } else if (currentFolderId) {
        folderPath = `${currentFolderId}/${newFolderName.trim()}`;
      } else {
        folderPath = `root/${newFolderName.trim()}`;
      }
      folderPath = folderPath.replace(/\/+/g, '/');

      const { error } = await supabase
        .from('files')
        .insert({
          name: newFolderName.trim(),
          type: 'folder/directory',
          path: folderPath,
          folder_id: currentFolderId,
          uploaded_by: userData.user.id,
          job_id: jobId || null,
          property_id: propertyId,
          size: 0
        });

      if (error) throw error;

      setNewFolderName('');
      setShowNewFolderInput(false);
      fetchItems();
    } catch (err) {
      console.error('Error creating folder:', err);
      setError('Failed to create folder.');
    }
  };

  const handleDeleteItem = async (item: FileItem) => {
    if (!confirm(`Are you sure you want to delete ${item.name}?`)) return;

    try {
      const { error } = await supabase
        .from('files')
        .delete()
        .eq('id', item.id);

      if (error) throw error;

      fetchItems();
    } catch (err) {
      console.error('Error deleting item:', err);
      setError('Failed to delete item.');
    }
  };

  const handleFolderClick = (folder: FileItem) => {
    setCurrentFolderId(folder.id);
    setFolderPath([...folderPath, { id: folder.id, name: folder.name }]);
  };

  const handleNavigateUp = (index: number) => {
    setCurrentFolderId(folderPath[index].id);
    setFolderPath(folderPath.slice(0, index + 1));
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    setSelectedFiles(files);
    setShowUploadModal(true);
  };

  const generatePreviewUrl = (file: File) => {
    if (file.type.startsWith('image/')) {
      return URL.createObjectURL(file);
    }
    return null;
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <ImageIcon className="h-5 w-5 text-blue-500" />;
    if (type.startsWith('video/')) return <FileVideo className="h-5 w-5 text-purple-500" />;
    if (type.startsWith('audio/')) return <FileAudio className="h-5 w-5 text-green-500" />;
    if (type.includes('zip') || type.includes('rar')) return <FileArchive className="h-5 w-5 text-orange-500" />;
    return <FileText className="h-5 w-5 text-gray-500" />;
  };

  const getFileThumbnail = async (item: FileItem) => {
    if (item.type.startsWith('image/')) {
      try {
        const { data } = await supabase.storage
          .from('files')
          .createSignedUrl(item.file_path, 3600);
        return data?.signedUrl;
      } catch (error) {
        console.error('Error getting thumbnail:', error);
        return null;
      }
    }
    return null;
  };

  useEffect(() => {
    const fetchThumbnails = async () => {
      const newPreviewUrls: { [key: string]: string } = {};
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const url = await getFileThumbnail(item);
          if (url) {
            newPreviewUrls[item.id] = url;
          }
        }
      }
      setPreviewUrls(newPreviewUrls);
    };

    fetchThumbnails();
  }, [items]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setSelectedFiles(files);
      
      const newPreviewUrls: { [key: string]: string } = {};
      files.forEach(file => {
        const previewUrl = generatePreviewUrl(file);
        if (previewUrl) {
          newPreviewUrls[file.name] = previewUrl;
        }
      });
      setPreviewUrls(newPreviewUrls);
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      // Get job_id from URL if available
      const urlParams = new URLSearchParams(window.location.search);
      const jobId = urlParams.get('job_id');

      // Get property_id if we're in a job context
      let propertyId = null;
      if (jobId) {
        const { data: jobData } = await supabase
          .from('jobs')
          .select('property_id')
          .eq('id', jobId)
          .single();
        propertyId = jobData?.property_id;
      }

      for (const file of selectedFiles) {
        // Create a proper file path based on context
        let filePath;
        if (jobId && propertyId) {
          filePath = `properties/${propertyId}/jobs/${jobId}/${currentFolderId || ''}/${Date.now()}_${file.name}`;
        } else if (currentFolderId) {
          filePath = `${currentFolderId}/${Date.now()}_${file.name}`;
        } else {
          filePath = `root/${Date.now()}_${file.name}`;
        }
        filePath = filePath.replace(/\/+/g, '/');

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('files')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Create file record
        const { error: dbError } = await supabase
          .from('files')
          .insert({
            name: file.name,
            type: file.type,
            size: file.size,
            path: filePath,
            folder_id: currentFolderId,
            uploaded_by: userData.user.id,
            job_id: jobId || null,
            property_id: propertyId
          });

        if (dbError) throw dbError;

        // Update progress after successful upload
        setUploadProgress(prev => ({
          ...prev,
          [file.name]: 100
        }));
      }

      setSelectedFiles([]);
      setShowUploadModal(false);
      setUploadProgress({});
      fetchItems();
    } catch (err) {
      console.error('Error uploading files:', err);
      setError('Failed to upload files.');
    }
  };

  const handleRename = async (item: FileItem) => {
    if (!newName.trim()) return;

    try {
      const { error } = await supabase
        .from('files')
        .update({ name: newName.trim() })
        .eq('id', item.id);

      if (error) throw error;

      setShowRenameInput(null);
      setNewName('');
      fetchItems();
    } catch (err) {
      console.error('Error renaming item:', err);
      setError('Failed to rename item.');
    }
  };

  const sortedItems = [...items].sort((a, b) => {
    const order = sortOrder === 'asc' ? 1 : -1;
    switch (sortBy) {
      case 'name':
        return order * a.name.localeCompare(b.name);
      case 'date':
        return order * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      case 'size':
        return order * (a.size - b.size);
      case 'type':
        return order * a.type.localeCompare(b.type);
      default:
        return 0;
    }
  });

  const filteredItems = sortedItems.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Function to handle file download
  const handleDownload = async (item: FileItem) => {
    try {
      const { data, error } = await supabase.storage
        .from('files')
        .createSignedUrl(item.file_path, 3600);

      if (error) throw error;
      if (!data?.signedUrl) throw new Error('No signed URL available');

      // For PDFs and documents, open in new tab
      if (item.type === 'application/pdf' || item.type.startsWith('text/') || item.type.includes('document')) {
        window.open(data.signedUrl, '_blank');
      } else {
        // For other files, trigger download
        const link = document.createElement('a');
        link.href = data.signedUrl;
        link.download = item.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      console.error('Error handling file:', err);
      setError('Failed to handle file.');
    }
  };

  // Function to handle image preview
  const handleImagePreview = async (item: FileItem) => {
    if (!item.type.startsWith('image/')) return;

    try {
      // Get all image items
      const imageItems = items.filter(i => i.type.startsWith('image/'));
      const currentIndex = imageItems.findIndex(i => i.id === item.id);

      // Get signed URLs for all images
      const imageUrls = await Promise.all(
        imageItems.map(async (img) => {
          const { data: urlData } = await supabase.storage
            .from('files')
            .createSignedUrl(img.file_path, 3600);
          return {
            src: urlData?.signedUrl || '',
            alt: img.name
          };
        })
      );

      setLightboxImages(imageUrls);
      setLightboxIndex(currentIndex);
      setLightboxOpen(true);
    } catch (err) {
      console.error('Error opening image preview:', err);
      setError('Failed to open image preview.');
    }
  };

  const handleItemSelect = (itemId: string, event: React.MouseEvent) => {
    if (event.ctrlKey || event.metaKey) {
      setSelectedItems(prev => 
        prev.includes(itemId) 
          ? prev.filter(id => id !== itemId)
          : [...prev, itemId]
      );
    } else {
      setSelectedItems([itemId]);
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedItems.length) return;
    if (!confirm(`Are you sure you want to delete ${selectedItems.length} items?`)) return;

    try {
      // Get the items to be deleted
      const itemsToDelete = items.filter(item => selectedItems.includes(item.id));
      
      // Delete from storage
      for (const item of itemsToDelete) {
        if (item.type !== 'folder/directory') {
          await supabase.storage
            .from('files')
            .remove([item.file_path]);
        }
      }

      // Delete from database
      const { error } = await supabase
        .from('files')
        .delete()
        .in('id', selectedItems);

      if (error) throw error;

      setSelectedItems([]);
      fetchItems();
    } catch (err) {
      console.error('Error deleting items:', err);
      setError('Failed to delete items.');
    }
  };

  const handleFileClick = (item: FileItem) => {
    if (item.type.startsWith('image/')) {
      handleImagePreview(item);
    } else if (item.type === 'application/pdf' || item.type.startsWith('text/') || item.type.includes('document')) {
      handleDownload(item);
    }
  };

  if (loading) {
    return <div className="p-4 text-gray-900 dark:text-gray-100">Loading...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500 dark:text-red-400">Error: {error}</div>;
  }

  return (
    <div className="p-4">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center space-x-2 mb-4">
        {folderPath.map((folder, index) => (
          <React.Fragment key={folder.id || 'root'}>
            {index > 0 && <span className="text-gray-500">/</span>}
            <button
              onClick={() => handleNavigateUp(index)}
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              {folder.name}
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">File Manager</h1>
        <div className="flex items-center space-x-4">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files..."
              className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            <option value="name">Name</option>
            <option value="date">Date</option>
            <option value="size">Size</option>
            <option value="type">Type</option>
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
          <button
            onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
            className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            {viewMode === 'list' ? <Grid className="h-5 w-5" /> : <List className="h-5 w-5" />}
          </button>
          <button
            onClick={() => setShowNewFolderInput(true)}
            className="flex items-center px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Folder
          </button>
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload Files
          </button>
        </div>
      </div>

      {/* New Folder Input */}
      {showNewFolderInput && (
        <div className="mb-4 flex items-center space-x-2">
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Enter folder name"
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            onKeyPress={(e) => e.key === 'Enter' && handleCreateFolder()}
          />
          <button
            onClick={handleCreateFolder}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Create
          </button>
          <button
            onClick={() => {
              setShowNewFolderInput(false);
              setNewFolderName('');
            }}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 text-sm font-medium rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* File List/Grid */}
      {filteredItems.length === 0 ? (
        <p className="text-gray-600 dark:text-gray-400">No items found.</p>
      ) : viewMode === 'list' ? (
        <ul className="space-y-2">
          {filteredItems.map(item => (
            <li
              key={item.id}
              className={`p-3 border border-gray-200 dark:border-gray-700 rounded-lg flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                selectedItems.includes(item.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
              }`}
              onClick={(e) => handleItemSelect(item.id, e)}
            >
              <div className="flex items-center space-x-4 flex-1">
                {item.type === 'folder/directory' ? (
                  <button
                    onClick={() => handleFolderClick(item)}
                    className="flex items-center text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 w-full"
                  >
                    <FolderOpen className="h-5 w-5 mr-3 text-yellow-500" />
                    <span>{item.name}</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleFileClick(item)}
                    className="flex items-center w-full hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    {item.type.startsWith('image/') && previewUrls[item.id] ? (
                      <img
                        src={previewUrls[item.id]}
                        alt={item.name}
                        className="h-8 w-8 object-cover rounded mr-3"
                      />
                    ) : (
                      <div className="mr-3">
                        {getFileIcon(item.type)}
                      </div>
                    )}
                    <span className="text-gray-900 dark:text-gray-100">{item.name}</span>
                  </button>
                )}
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {formatDate(item.created_at)}
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleDownload(item)}
                    className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteItem(item)}
                    className="p-1 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredItems.map(item => (
            <div
              key={item.id}
              className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <div className="flex flex-col items-center">
                {item.type === 'folder/directory' ? (
                  <button
                    onClick={() => handleFolderClick(item)}
                    className="flex flex-col items-center text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 w-full"
                  >
                    <FolderOpen className="h-8 w-8 mb-2 text-yellow-500" />
                    <span className="text-center mb-2">{item.name}</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleFileClick(item)}
                    className="flex flex-col items-center w-full hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    {item.type.startsWith('image/') && previewUrls[item.id] ? (
                      <img
                        src={previewUrls[item.id]}
                        alt={item.name}
                        className="h-24 w-24 object-cover rounded mb-2"
                      />
                    ) : (
                      <div className="h-24 w-24 flex items-center justify-center mb-2">
                        {getFileIcon(item.type)}
                      </div>
                    )}
                    <span className="mt-2 text-center mb-2 text-gray-900 dark:text-gray-100">{item.name}</span>
                  </button>
                )}
                <div className="flex items-center space-x-2 mt-2">
                  <button
                    onClick={() => handleDownload(item)}
                    className="p-2 text-gray-500 hover:text-blue-500 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
                    title="Download"
                  >
                    <Download className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => handleDeleteItem(item)}
                    className="p-2 text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Upload Files</h2>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setSelectedFiles([]);
                  setUploadProgress({});
                  setPreviewUrls({});
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div
              ref={dropRef}
              className={`mb-4 border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragging
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-500'
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
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
              <div className="space-y-4 mb-4">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {file.type.startsWith('image/') && previewUrls[file.name] ? (
                        <img
                          src={previewUrls[file.name]}
                          alt={file.name}
                          className="h-10 w-10 object-cover rounded"
                        />
                      ) : (
                        <div className="h-10 w-10 flex items-center justify-center">
                          {getFileIcon(file.type)}
                        </div>
                      )}
                      <span className="text-gray-900 dark:text-gray-100">{file.name}</span>
                    </div>
                    {uploadProgress[file.name] && (
                      <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 transition-all duration-300"
                          style={{ width: `${uploadProgress[file.name]}%` }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setSelectedFiles([]);
                  setUploadProgress({});
                  setPreviewUrls({});
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-400 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={selectedFiles.length === 0}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                Upload
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {showRenameInput && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Rename</h2>
              <button
                onClick={() => {
                  setShowRenameInput(null);
                  setNewName('');
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Enter new name"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 mb-4"
            />
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowRenameInput(null);
                  setNewName('');
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-400 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRename(showRenameInput)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        index={lightboxIndex}
        slides={lightboxImages}
        carousel={{
          padding: '16px',
          spacing: '16px',
        }}
        controller={{
          closeOnBackdropClick: true,
        }}
        animation={{ fade: 300 }}
      />

      {/* Add bulk actions toolbar */}
      {selectedItems.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-300">
              {selectedItems.length} items selected
            </span>
            <div className="flex items-center space-x-4">
              <button
                onClick={handleBulkDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Delete Selected
              </button>
              <button
                onClick={() => setSelectedItems([])}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 