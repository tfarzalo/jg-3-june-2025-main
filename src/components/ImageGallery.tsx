import React, { useState, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface WorkOrderFile {
  id: string;
  file_path: string;
  file_name: string;
  file_type: string;
  file_size: number;
  created_at: string;
}

interface ImageGalleryProps {
  workOrderId: string;
  folder: 'before' | 'sprinkler' | 'other';
  allowDelete?: boolean;
}

export function ImageGallery({ workOrderId, folder, allowDelete = false }: ImageGalleryProps) {
  const [files, setFiles] = useState<WorkOrderFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLightbox, setShowLightbox] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ src: string; alt: string } | null>(null);

  useEffect(() => {
    fetchFiles();
  }, [workOrderId, folder]);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      setError(null);

      // Map folder prop to display name
      const folderDisplayMap = {
        before: 'Before Images',
        sprinkler: 'Sprinkler Images',
        other: 'Other Files',
      };
      const subfolderName = folderDisplayMap[folder];

      // 1. Find the subfolder under the work order folder
      const { data: subfolder, error: subfolderError } = await supabase
        .from('files')
        .select('id')
        .eq('name', subfolderName)
        .eq('folder_id', workOrderId)
        .eq('type', 'folder/directory')
        .maybeSingle();
      console.log('[ImageGallery] Subfolder lookup', { subfolderName, workOrderId, subfolder, subfolderError });
      if (subfolderError) throw subfolderError;
      if (!subfolder || !subfolder.id) {
        setFiles([]);
        setLoading(false);
        return;
      }

      // 2. Fetch files from the subfolder with the correct category
      const { data, error } = await supabase
        .from('files')
        .select('*')
        .eq('folder_id', subfolder.id)
        .eq('category', folder)
        .order('created_at', { ascending: false });
      console.log('[ImageGallery] File fetch', { subfolderId: subfolder.id, category: folder, data, error });

      if (error) throw error;

      setFiles((data || []).map(file => ({
        id: file.id,
        file_path: file.path,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        created_at: file.created_at,
      })));
    } catch (err) {
      console.error('Error fetching files:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch files');
    } finally {
      setLoading(false);
    }
  };

  const getImageUrl = (filePath: string) => {
    const { data } = supabase.storage
      .from('files')
      .getPublicUrl(filePath);
    console.log('[ImageGallery] getImageUrl', { filePath, publicUrl: data.publicUrl });
    return data.publicUrl;
  };

  const handleDelete = async (fileId: string, filePath: string) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('files')
        .remove([filePath]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('files')
        .delete()
        .eq('id', fileId);

      if (dbError) throw dbError;

      // Refresh the file list
      fetchFiles();
    } catch (err) {
      console.error('Error deleting file:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete file');
    }
  };

  const handleFiles = async (
    files: File[],
    jobId: string,
    workOrderId: string,
    folder: string,
    user: string | undefined
  ) => {
    if (!files || files.length === 0 || !user) return;
    // ...rest of the code
  };

  const handleImageClick = (image: { src: string; alt: string }) => {
    setSelectedImage(image);
    setShowLightbox(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-600 dark:text-red-400 text-sm">
        {error}
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="text-gray-500 dark:text-gray-400 text-sm">
        No images uploaded yet
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {files.map((file) => (
          <div key={file.id} className="relative group">
            <button
              onClick={() => handleImageClick({ src: getImageUrl(file.file_path), alt: file.file_name })}
              className="w-full aspect-square rounded-lg overflow-hidden hover:opacity-90 transition-opacity"
            >
              <img
                src={getImageUrl(file.file_path)}
                alt={file.file_name}
                className="w-full h-full object-cover"
              />
            </button>
            {allowDelete && (
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity flex items-center justify-center">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(file.id, file.file_path);
                  }}
                  className="p-2 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {showLightbox && selectedImage && (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center">
          <button
            onClick={() => setShowLightbox(false)}
            className="absolute top-4 right-4 text-white hover:text-gray-300"
          >
            <X className="h-6 w-6" />
          </button>
          <div className="max-w-7xl max-h-[90vh] p-4">
            <img
              src={selectedImage.src}
              alt={selectedImage.alt}
              className="max-w-full max-h-[90vh] object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
} 