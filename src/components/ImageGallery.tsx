import React, { useState, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';
import { supabase } from '../utils/supabase';
import { getPreviewUrl, PreviewResult } from '../utils/storagePreviews';

interface WorkOrderFile {
  id: string;
  file_path: string;
  file_name: string;
  file_type: string;
  file_size: number;
  created_at: string;
  previewResult?: PreviewResult;
}

interface ImageGalleryProps {
  workOrderId: string;
  folder: 'before' | 'sprinkler' | 'other' | 'job_files';
  allowDelete?: boolean;
}

export function ImageGallery({ workOrderId, folder, allowDelete = false }: ImageGalleryProps) {
  const [files, setFiles] = useState<WorkOrderFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLightbox, setShowLightbox] = useState(false);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [imageUrls, setImageUrls] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    fetchFiles();
  }, [workOrderId, folder]);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      files.forEach(file => {
        if (file.previewResult?.kind === 'blob') {
          file.previewResult.revoke();
        }
      });
    };
  }, [files]);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      setError(null);

      // Map folder prop to display name
      const folderDisplayMap = {
        before: 'Before Images',
        sprinkler: 'Sprinkler Images',
        other: 'Other Files',
        job_files: 'Job Files',
      };
      const subfolderName = folderDisplayMap[folder];

      console.log('[ImageGallery] Starting file fetch', { workOrderId, folder, subfolderName });

      // 1. Find the subfolder under the work order folder
      const { data: subfolder, error: subfolderError } = await supabase
        .from('files')
        .select('id, name, path')
        .eq('name', subfolderName)
        .eq('folder_id', workOrderId)
        .maybeSingle();
        
      console.log('[ImageGallery] Subfolder lookup', { 
        subfolderName, 
        workOrderId, 
        subfolder, 
        subfolderError 
      });
      
      if (subfolderError) {
        console.error('[ImageGallery] ❌ Subfolder lookup error:', subfolderError);
        throw subfolderError;
      }
      
      let subfolderRecord = subfolder;
      if (!subfolderRecord || !subfolderRecord.id) {
        if (folder === 'job_files') {
          const { data: legacySubfolder } = await supabase
            .from('files')
            .select('id, name, path')
            .eq('name', 'Other Files')
            .eq('folder_id', workOrderId)
            .maybeSingle();
          if (!legacySubfolder?.id) {
            setFiles([]);
            setLoading(false);
            return;
          }
          subfolderRecord = legacySubfolder as any;
        } else {
          setFiles([]);
          setLoading(false);
          return;
        }
      }

      console.log('[ImageGallery] ✅ Found subfolder:', subfolderRecord);

      // 2. Fetch files from the subfolder with the correct category
      const query = supabase
        .from('files')
        .select('*')
        .eq('folder_id', subfolderRecord.id)
        .order('created_at', { ascending: false });

      // Job Files uploads often have no category; only filter by category for the image-specific buckets
      if (folder !== 'job_files') {
        query.eq('category', folder);
      }

      const { data, error } = await query;
        
      console.log('[ImageGallery] File fetch query params:', { 
        subfolderId: subfolderRecord.id, 
        category: folder
      });
      console.log('[ImageGallery] File fetch results:', { 
        fileCount: data?.length || 0,
        files: data?.map(f => ({ id: f.id, name: f.name, path: f.path, category: f.category })),
        error 
      });

      if (error) {
        console.error('[ImageGallery] ❌ File fetch error:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        console.log('[ImageGallery] ⚠️ No files found in DB; attempting storage fallback');
        const storagePath = (subfolderRecord.path || '').replace(/^\/+/, '');
        try {
          const { data: objects, error: listError } = await supabase
            .storage
            .from('files')
            .list(storagePath, { limit: 100 });
          if (listError) {
            console.error('[ImageGallery] ❌ Storage list error:', listError);
            setFiles([]);
            setLoading(false);
            return;
          }
          if (!objects || objects.length === 0) {
            console.log('[ImageGallery] ⚠️ No objects found in storage for path:', storagePath);
            setFiles([]);
            setLoading(false);
            return;
          }
          const filesWithPreviews = await Promise.all(objects.map(async (obj) => {
            try {
              const fullPath = `${storagePath}/${obj.name}`.replace(/\/+/g, '/');
              const previewResult = await getPreviewUrl(supabase, 'files', fullPath);
              return {
                id: `${subfolderRecord.id}:${obj.name}`,
                file_path: fullPath,
                file_name: obj.name,
                file_type: 'file',
                file_size: 0,
                created_at: new Date().toISOString(),
                previewResult
              } as WorkOrderFile;
            } catch (error) {
              console.error('[ImageGallery] ❌ Error generating preview for storage object:', obj.name, error);
              const { data: urlData } = supabase.storage
                .from('files')
                .getPublicUrl(`${storagePath}/${obj.name}`);
              return {
                id: `${subfolderRecord.id}:${obj.name}`,
                file_path: `${storagePath}/${obj.name}`,
                file_name: obj.name,
                file_type: 'file',
                file_size: 0,
                created_at: new Date().toISOString(),
                previewResult: { kind: 'signed' as const, url: urlData.publicUrl }
              } as WorkOrderFile;
            }
          }));
          setFiles(filesWithPreviews);
          setLoading(false);
          return;
        } catch (fallbackErr) {
          console.error('[ImageGallery] ❌ Storage fallback failed:', fallbackErr);
          setFiles([]);
          setLoading(false);
          return;
        }
      }

      console.log('[ImageGallery] 📸 Processing', data.length, 'files for preview URLs');

      // Generate preview URLs for all files
      const filesWithPreviews = await Promise.all((data || []).map(async (file) => {
        try {
          console.log('[ImageGallery] Getting preview for:', file.path);
          const previewResult = await getPreviewUrl(supabase, 'files', file.path);
          console.log('[ImageGallery] ✅ Preview URL generated for:', file.name);
          return {
            id: file.id,
            file_path: file.path,
            file_name: file.name,
            file_type: file.type,
            file_size: file.size,
            created_at: file.created_at,
            previewResult
          };
        } catch (error) {
          console.error('[ImageGallery] ❌ Error getting preview URL for file:', file.path, error);
          // Fallback to public URL if preview fails
          const { data: urlData } = supabase.storage
            .from('files')
            .getPublicUrl(file.path);
          return {
            id: file.id,
            file_path: file.path,
            file_name: file.name,
            file_type: file.type,
            file_size: file.size,
            created_at: file.created_at,
            previewResult: { kind: 'signed' as const, url: urlData.publicUrl }
          };
        }
      }));

      console.log('[ImageGallery] ✅ All files processed, setting state');
      setFiles(filesWithPreviews);
    } catch (err) {
      console.error('[ImageGallery] ❌ Error fetching files:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch files');
    } finally {
      setLoading(false);
    }
  };

  const getImageUrl = (file: WorkOrderFile) => {
    return file.previewResult?.url || '';
  };

  const refreshImageUrl = async (file: WorkOrderFile) => {
    try {
      const previewResult = await getPreviewUrl(supabase, 'files', file.file_path);
      setFiles(prev => prev.map(f => 
        f.id === file.id 
          ? { ...f, previewResult }
          : f
      ));
    } catch (error) {
      console.error('Error refreshing image URL:', error);
    }
  };

  const handleImageError = (file: WorkOrderFile) => {
    console.error('Image load error for file:', file.file_name);
    // Try to refresh the signed URL once
    if (file.previewResult?.kind === 'signed') {
      refreshImageUrl(file);
    }
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

  const handleImageClick = (index: number) => {
    setCurrentIndex(index);
    setShowLightbox(true);
  };

  // Lightbox library handles keyboard navigation and arrows internally

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
        {files.map((file, index) => (
          <div key={file.id} className="relative group">
            <button
              onClick={() => handleImageClick(index)}
              className="w-full aspect-square rounded-lg overflow-hidden hover:opacity-90 transition-opacity"
            >
              <img
                src={getImageUrl(file)}
                alt={file.file_name}
                className="w-full h-full object-cover"
                onError={() => handleImageError(file)}
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

      <Lightbox
        open={showLightbox}
        close={() => setShowLightbox(false)}
        index={currentIndex}
        slides={files.map(f => ({ src: getImageUrl(f) }))}
        render={{
          buttonClose: () => (
            <button
              onClick={() => setShowLightbox(false)}
              className="absolute top-4 right-4 text-white hover:text-gray-300"
              aria-label="Close"
            >
              <X className="h-6 w-6" />
            </button>
          ),
        }}
      />
    </div>
  );
}
