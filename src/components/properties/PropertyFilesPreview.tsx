import React, { useEffect, useState } from 'react';
import { FolderOpen, File as FileIcon, Image as ImageIcon, FileText, ChevronRight, Eye } from 'lucide-react';
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
        // At root level, show only items with folder_id null for this property
        query = query.is('folder_id', null);
      } else {
        query = query.eq('folder_id', currentFolderId);
      }

      const { data, error } = await query
        .order('type', { ascending: false })
        .order('created_at', { ascending: false });

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
                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Name
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Size
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Date
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-[#1E293B] divide-y divide-gray-200 dark:divide-gray-700">
              {items.map((item) => (
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
