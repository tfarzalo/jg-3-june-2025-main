import React, { useEffect, useState, useMemo } from 'react';
import { FolderOpen, File as FileIcon, Image as ImageIcon, FileText, ChevronRight, Eye, ArrowUp, ArrowDown } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { getPreviewUrl } from '../../utils/storagePreviews';
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';

interface FileItem {
  id: string;
  name: string;
  type: string;
  folder_id: string | null;
  path: string;
  size: number;
  created_at: string;
  previewUrl?: string | null;
}

interface PropertyFilesPreviewProps {
  propertyId: string;
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const getFileIcon = (type: string, isFolder: boolean) => {
  if (isFolder) {
    return <FolderOpen className="h-5 w-5 text-blue-500" />;
  }
  if (type.startsWith('image/')) {
    return <ImageIcon className="h-5 w-5 text-green-500" />;
  }
  return <FileIcon className="h-5 w-5 text-gray-500" />;
};

export const PropertyFilesPreview: React.FC<PropertyFilesPreviewProps> = ({ propertyId }) => {
  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ id: string | null; name: string }>>([
    { id: null, name: 'Property Files' }
  ]);
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [lightboxImages, setLightboxImages] = useState<Array<{ src: string }>>([]);
  const [sortConfig, setSortConfig] = useState<{ key: keyof FileItem; direction: 'asc' | 'desc' } | null>({ 
    key: 'name', 
    direction: 'asc' 
  });

  useEffect(() => {
    fetchItems();
  }, [propertyId, currentFolderId]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('files')
        .select('id, name, type, folder_id, path, size, created_at')
        .eq('property_id', propertyId);

      // Filter by current folder
      if (currentFolderId === null) {
        // Check for "Properties" root folder to handle nested structure
        const { data: propsFolder } = await supabase
          .from('files')
          .select('id')
          .eq('name', 'Properties')
          .is('folder_id', null)
          .single();

        if (propsFolder) {
          // Show items that are either at root (legacy) or under "Properties" folder
          query = query.or(`folder_id.is.null,folder_id.eq.${propsFolder.id}`);
        } else {
          // Fallback for legacy structure
          query = query.is('folder_id', null);
        }
      } else {
        query = query.eq('folder_id', currentFolderId);
      }

      const { data, error } = await query
        .order('type', { ascending: false })
        .order('name', { ascending: true }); // Default sort by name

      if (error) throw error;

      // Process the files to generate preview URLs for images
      const processedData = await Promise.all((data || []).map(async (file) => {
        let previewUrl = null;
        if (file.type.startsWith('image/')) {
          try {
            const previewResult = await getPreviewUrl(supabase, 'files', file.path);
            previewUrl = previewResult.url;
          } catch (error) {
            console.error('Error generating preview URL for file:', file.path, error);
          }
        }

        return {
          ...file,
          previewUrl
        };
      }));

      setItems(processedData);
    } catch (error) {
      console.error('Error fetching property files:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFolderClick = (folderId: string, folderName: string) => {
    setCurrentFolderId(folderId);
    setBreadcrumbs([...breadcrumbs, { id: folderId, name: folderName }]);
  };

  const handleBreadcrumbClick = (index: number) => {
    const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
    setBreadcrumbs(newBreadcrumbs);
    setCurrentFolderId(newBreadcrumbs[newBreadcrumbs.length - 1].id);
  };

  const handleImageClick = (item: FileItem) => {
    if (item.type.startsWith('image/')) {
      const imageItems = items.filter(i => i.type.startsWith('image/') && i.previewUrl);
      const images = imageItems.map(i => ({ src: i.previewUrl! }));
      const index = imageItems.findIndex(i => i.id === item.id);
      setLightboxImages(images);
      setLightboxIndex(index);
    }
  };

  const handleFileClick = async (item: FileItem) => {
    if (item.type === 'folder/directory') {
      handleFolderClick(item.id, item.name);
    } else if (item.type.startsWith('image/')) {
      handleImageClick(item);
    } else {
      // Download the file
      try {
        const { data, error } = await supabase.storage
          .from('files')
          .download(item.path);

        if (error) throw error;

        const url = URL.createObjectURL(data);
        const link = document.createElement('a');
        link.href = url;
        link.download = item.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Error downloading file:', error);
      }
    }
  };

  const handleSort = (key: keyof FileItem) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedItems = useMemo(() => {
    let sortableItems = [...items];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        // Always keep folders on top
        const aIsFolder = a.type === 'folder/directory';
        const bIsFolder = b.type === 'folder/directory';
        
        if (aIsFolder && !bIsFolder) return -1;
        if (!aIsFolder && bIsFolder) return 1;
        
        // If both are folders or both are files, sort by key
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];
        
        // Handle dates
        if (sortConfig.key === 'created_at') {
            aValue = new Date(a.created_at).getTime();
            bValue = new Date(b.created_at).getTime();
        }

        // Handle string comparison for case-insensitivity
        if (typeof aValue === 'string' && typeof bValue === 'string') {
            aValue = aValue.toLowerCase();
            bValue = bValue.toLowerCase();
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [items, sortConfig]);

  if (loading) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-3"></div>
        <p className="font-medium">Loading files...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Breadcrumbs */}
      {breadcrumbs.length > 1 && (
        <div className="flex items-center space-x-2 mb-4 text-sm text-gray-600 dark:text-gray-400">
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={crumb.id || 'root'}>
              {index > 0 && <ChevronRight className="h-4 w-4" />}
              <button
                onClick={() => handleBreadcrumbClick(index)}
                className={`hover:text-purple-600 dark:hover:text-purple-400 transition-colors ${
                  index === breadcrumbs.length - 1 ? 'font-semibold text-gray-900 dark:text-white' : ''
                }`}
              >
                {crumb.name}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}

      {items.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <FolderOpen className="h-12 w-12 mx-auto mb-3 text-gray-400" />
          <p className="font-medium">No files found</p>
          <p className="text-sm">Upload files using the File Manager</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-[#0F172A]">
              <tr>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Name</span>
                    {sortConfig?.key === 'name' && (
                      sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    )}
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
                  onClick={() => handleSort('size')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Size</span>
                    {sortConfig?.key === 'size' && (
                      sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    )}
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
                  onClick={() => handleSort('created_at')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Date</span>
                    {sortConfig?.key === 'created_at' && (
                      sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    )}
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-[#1E293B] divide-y divide-gray-200 dark:divide-gray-700">
              {sortedItems.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-[#0F172A] transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getFileIcon(item.type, item.type === 'folder/directory')}
                      <button
                        onClick={() => handleFileClick(item)}
                        className="ml-3 text-sm font-medium text-gray-900 dark:text-white hover:text-purple-600 dark:hover:text-purple-400 transition-colors text-left"
                      >
                        {item.name}
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {item.type === 'folder/directory' ? '-' : formatFileSize(item.size)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(item.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {item.type.startsWith('image/') && (
                      <button
                        onClick={() => handleImageClick(item)}
                        className="text-purple-600 dark:text-purple-400 hover:text-purple-900 dark:hover:text-purple-300"
                        title="Preview image"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Lightbox for image preview */}
      <Lightbox
        open={lightboxIndex >= 0}
        index={lightboxIndex}
        close={() => setLightboxIndex(-1)}
        slides={lightboxImages}
      />
    </div>
  );
};
