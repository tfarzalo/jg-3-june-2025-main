import React, { useState, useCallback, useEffect, useId, useRef } from 'react';
import { supabase } from '../utils/supabase';
import { useAuth } from '../contexts/AuthProvider';
import { WorkOrderLink } from './shared/WorkOrderLink';
import { PropertyLink } from './shared/PropertyLink';
import { joinPathSegments } from '../utils/storagePaths';
import { getPreviewUrl, uploadAndPreview, PreviewResult } from '../utils/storagePreviews';

interface ImageUploadProps {
  jobId: string;
  workOrderId?: string;
  folder: 'before' | 'sprinkler' | 'other';
  onUploadComplete?: (filePath: string) => void;
  onError?: (error: string) => void;
  readOnly?: boolean;
  required?: boolean;
  /**
   * Optional. When this value changes, the component will reset its local state and re-fetch from DB.
   * Use this to clear previews after a successful work order submission.
   */
  resetTrigger?: any;
  /**
   * Optional. Callback when an image is marked for deletion.
   * The parent component should handle the actual deletion when saving the work order.
   */
  onImageDelete?: (filePath: string) => void;
}

interface UploadedFile {
  file_path: string;
  file_name: string;
  public_url: string;
  type: string;
  previewResult?: PreviewResult;
}

interface UploadingFile {
  file: File;
  preview: string;
  progress: number;
}

interface JobData {
  work_order_num: number;
  property_id: string;
  properties: {
    property_name: string;
  };
}

const ImageUpload: React.FC<ImageUploadProps> = ({
  jobId,
  workOrderId,
  folder,
  onUploadComplete,
  onError,
  readOnly = false,
  required = false,
  resetTrigger,
  onImageDelete
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [selectedImage, setSelectedImage] = useState<UploadedFile | null>(null);
  const [filesToDelete, setFilesToDelete] = useState<Set<string>>(new Set());
  const { user, initializing: authLoading } = useAuth();
  const fileInputId = useId();
  const revokeRef = useRef<(() => void) | null>(null);
  const [lastUploadedPath, setLastUploadedPath] = useState<string | null>(null);
 
  // Component mount logging
  useEffect(() => {
    console.log('🎨 ImageUpload component mounted:', { 
      jobId, 
      workOrderId, 
      folder, 
      readOnly, 
      required 
    });
  }, []);

  // Add debug logging for auth state
  useEffect(() => {
    console.log('🔐 ImageUpload auth state:', { 
      hasUser: !!user, 
      userId: user?.id,
      authLoading, 
      folder 
    });
  }, [user, authLoading, folder]);

  // Fetch images on mount or when resetTrigger changes
  useEffect(() => {
    const fetchImages = async () => {
      try {
        const { data, error } = await supabase
          .from('files')
          .select('*')
          .eq('job_id', jobId)
          .eq('category', folder)
          .order('created_at', { ascending: false });

        if (error) throw error;

        if (data && data.length > 0) {
          const files = await Promise.all(data.map(async (file: any) => {
            try {
              const previewResult = await getPreviewUrl(supabase, 'files', file.path);
              return {
                file_path: file.path,
                file_name: file.name,
                public_url: previewResult.url,
                type: file.type,
                previewResult
              };
            } catch (error) {
              console.error('Error getting preview URL for file:', file.path, error);
              // Fallback to public URL if preview fails
              const { data: urlData } = supabase.storage
                .from('files')
                .getPublicUrl(file.path);
              return {
                file_path: file.path,
                file_name: file.name,
                public_url: urlData.publicUrl,
                type: file.type
              };
            }
          }));
          setUploadedFiles(files);
        } else {
          setUploadedFiles([]);
        }
      } catch (error) {
        console.error('Error fetching files:', error);
        setUploadedFiles([]);
      }
    };

    fetchImages();
    setUploadingFiles([]);
  }, [jobId, workOrderId, folder, resetTrigger]);

  // Cleanup preview URLs
  useEffect(() => {
    return () => {
      uploadingFiles.forEach(file => {
        URL.revokeObjectURL(file.preview);
      });
      if (revokeRef.current) {
        revokeRef.current();
        revokeRef.current = null;
      }
    };
  }, [uploadingFiles]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      handleFiles(files);
    }
  }, []);

  // Add types for ensureFolder
  const ensureFolder = async (
    name: string,
    parentId: string | null,
    path: string,
    jobId: string | null,
    propertyId: string | null
  ): Promise<string> => {
    // Only the property folder should have folder_id = null
    const folderIdToUse = parentId || null;
   // Check if folder exists using folder_id and name which is the unique constraint
    let query = supabase
      .from('files')
      .select('id')
      .eq('name', name)
      .eq('type', 'folder/directory');

    if (folderIdToUse === null) {
      query = query.is('folder_id', null);
    } else {
      query = query.eq('folder_id', folderIdToUse);
    }

    const { data: existing, error: fetchError } = await query.maybeSingle();
    
    if (fetchError) {
      console.error('Error checking for existing folder:', {
        error: fetchError,
        name,
        path
      });
      throw fetchError;
    }
    
    if (existing && existing.id) {
      console.log('Found existing folder:', { id: existing.id, name, path });
      return existing.id;
    }
    
    // Create folder
    console.log('Creating new folder:', { name, path, folderIdToUse });
    const { data: created, error: createError } = await supabase
      .from('files')
      .insert({
        name,
        path,
        type: 'folder/directory',
        size: 0,
        uploaded_by: user!.id,
        property_id: propertyId,
        job_id: jobId,
        folder_id: folderIdToUse
      })
      .select('id')
      .single();
    
    if (createError) {
      // If error is 409 (conflict), fetch the existing folder and return its id
      if (createError.code === '23505' || createError.message?.includes('duplicate key') || createError.message?.includes('conflict')) {
        console.warn('Folder already exists, fetching existing folder:', { name, path, folderIdToUse });
        let retryQuery = supabase
          .from('files')
          .select('id')
          .eq('name', name)
          .eq('type', 'folder/directory');
        if (folderIdToUse === null) {
          retryQuery = retryQuery.is('folder_id', null);
        } else {
          retryQuery = retryQuery.eq('folder_id', folderIdToUse);
        }
        const { data: retryExisting, error: retryError } = await retryQuery.maybeSingle();
        if (retryError || !retryExisting) {
          console.error('Failed to fetch existing folder after conflict:', {
            retryError,
            retryExisting,
            name,
            path,
            folderIdToUse
          });
          throw createError;
        }
        return retryExisting.id;
      }
      console.error('Error creating folder:', {
        error: createError,
        name,
        path,
        parentId,
        jobId,
        propertyId
      });
      throw createError;
    }
    
    console.log('Successfully created folder:', { id: created.id, name, path });
    return created.id;
  };

  const handleFiles = async (files: File[]) => {
    if (!files || files.length === 0) {
      if (onError) onError('No files selected');
      return;
    }
    if (!user) {
      console.error('No user found in ImageUpload handleFiles', { user });
      if (onError) onError('User not authenticated');
      return;
    }
    
    // Create optimistic previews immediately
    const newUploadingFiles: UploadingFile[] = files.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      progress: 0
    }));
    setUploadingFiles(newUploadingFiles);
    setIsUploading(true);
    
    try {
      console.log('📤 Starting upload process:', { jobId, folder, fileCount: files.length });

      // Get job and property details
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select(`work_order_num, property_id, properties!property_id (property_name)`)
        .eq('id', jobId)
        .single();

      if (jobError || !jobData) {
        console.error('❌ Failed to load job:', jobError);
        const errorMsg = `Failed to load job details: ${jobError?.message || 'Unknown error'}`;
        if (onError) onError(errorMsg);
        throw new Error(errorMsg);
      }

      console.log('✅ Job loaded:', jobData);

      const workOrderNum = `WO-${String(jobData.work_order_num).padStart(6, '0')}`;
      const propertyName = Array.isArray(jobData.properties)
        ? jobData.properties[0]?.property_name
        : (jobData.properties as { property_name: string })?.property_name;

      if (!propertyName) {
        const errorMsg = 'Property name not found';
        if (onError) onError(errorMsg);
        throw new Error(errorMsg);
      }

      // Get folder path using RPC function (returns path directly, not ID)
      console.log('📁 Getting upload folder...');
      const { data: folderPathData, error: folderError } = await supabase.rpc(
        'get_upload_folder',
        {
          p_property_id: jobData.property_id,
          p_job_id: jobId,
          p_folder_type: folder
        }
      );

      if (folderError) {
        console.error('❌ get_upload_folder error:', folderError);
        
        // Provide specific error messages based on error type
        let errorMsg: string;
        if (folderError.message?.includes('permission denied')) {
          errorMsg = '⛔ Permission denied: You do not have access to upload files to this location';
        } else if (folderError.message?.includes('function') || folderError.message?.includes('does not exist')) {
          errorMsg = '⚠️ Upload system configuration error. Please contact system administrator.';
          console.error('Function error - get_upload_folder may not exist or lack permissions');
        } else {
          errorMsg = `Failed to prepare upload location: ${folderError.message}`;
        }
        
        if (onError) onError(errorMsg);
        throw new Error(errorMsg);
      }

      if (!folderPathData) {
        console.error('❌ No folder path returned');
        const errorMsg = 'Failed to determine upload folder path';
        if (onError) onError(errorMsg);
        throw new Error(errorMsg);
      }

      console.log('✅ Upload folder path:', folderPathData);

      // Remove leading slash from folder path if present
      const folderPath = folderPathData.startsWith('/') ? folderPathData.substring(1) : folderPathData;
      console.log('📁 Using folder path:', folderPath);

      // Now get the folder ID for database entry
      const { data: folderInfo, error: folderInfoError } = await supabase
        .from('files')
        .select('id')
        .eq('path', folderPathData)
        .eq('type', 'folder/directory')
        .single();

      if (folderInfoError || !folderInfo) {
        console.error('❌ Failed to get folder ID:', folderInfoError);
        const errorMsg = 'Failed to get folder information';
        if (onError) onError(errorMsg);
        throw new Error(errorMsg);
      }

      const subfolderId = folderInfo.id;
      console.log('✅ Upload folder ID:', subfolderId);

      // Upload each file
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        console.log(`📤 Uploading file ${i + 1}/${files.length}:`, file.name);

        try {
          const timestamp = Date.now();
          const randomSuffix = Math.random().toString(36).substring(7);
          const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9-_\.]/g, '_');
          const fileName = `${timestamp}-${randomSuffix}-${sanitizedFileName}`;

          // Build the storage path using the actual folder path from database
          const fileStoragePath = `${folderPath}/${fileName}`;
          const filePath = fileStoragePath;

          console.log('  📍 Storage path:', fileStoragePath);
          console.log('  📦 Bucket: files');
          console.log('  📏 Size:', file.size, 'bytes');
          console.log('  📄 Type:', file.type);

          const mimeType = file.type || 'application/octet-stream';
          if (!mimeType.match(/^[a-zA-Z0-9]+\/[a-zA-Z0-9\-\+\.]+$/)) {
            throw new Error(`Invalid MIME type: ${mimeType}`);
          }

          // Upload file to storage
          const previewResult = await uploadAndPreview(supabase, 'files', fileStoragePath, file, {
            upsert: false,
            contentType: mimeType
          });

          console.log('  ✅ Storage upload successful');

          // Create database record
          console.log('  💾 Creating database record...');
          const { error: dbError } = await supabase
            .from('files')
            .insert({
              name: fileName,
              path: filePath,
              size: file.size,
              type: mimeType,
              uploaded_by: user.id,
              property_id: jobData.property_id,
              job_id: jobId,
              folder_id: subfolderId,
              category: folder
            })
            .select()
            .single();

          if (dbError) {
            console.error('  ❌ Database error:', dbError);

            // Attempt cleanup of storage file
            console.log('  🧹 Attempting to cleanup storage file...');
            await supabase.storage.from('files').remove([fileStoragePath]);

            // Provide specific error messages
            let errorMsg: string;
            if (dbError.message?.includes('policy') || 
                dbError.message?.includes('permission') || 
                dbError.message?.includes('row-level security')) {
              errorMsg = 'Permission denied: Unable to save file record. You may not have access to upload files for this job.';
            } else if (dbError.message?.includes('foreign key') || dbError.message?.includes('violates')) {
              errorMsg = 'Invalid reference: Check property or parent folder exists.';
            } else {
              errorMsg = `Failed to save file record: ${dbError.message}`;
            }

            throw new Error(errorMsg);
          }

          console.log('  ✅ File record created');

          // Update UI
          setUploadingFiles(prev => prev.map((f, index) => index === i ? { ...f, progress: 100 } : f));
          setUploadedFiles(prev => [...prev, {
            file_path: filePath,
            file_name: fileName,
            public_url: previewResult.url,
            type: mimeType,
            previewResult
          }]);
          setLastUploadedPath(fileStoragePath);
          if (onUploadComplete) onUploadComplete(filePath);

        } catch (fileError) {
          const errorMsg = fileError instanceof Error ? fileError.message : 'Unknown error';
          console.error(`  ❌ Failed to upload ${file.name}:`, fileError);
          if (onError) onError(`${file.name}: ${errorMsg}`);
        }
      }
    } catch (error) {
      console.error('❌ Upload process error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Upload failed';
      if (onError) onError(errorMsg);
    } finally {
      setIsUploading(false);
      setUploadingFiles([]);
      console.log('📤 Upload process finished');
    }
  };

  // Refresh signed URL for a specific file
  const refreshSignedUrl = async (file: UploadedFile) => {
    try {
      const previewResult = await getPreviewUrl(supabase, 'files', file.file_path);
      setUploadedFiles(prev => prev.map(f => 
        f.file_path === file.file_path 
          ? { ...f, public_url: previewResult.url, previewResult }
          : f
      ));
    } catch (error) {
      console.error('Error refreshing signed URL:', error);
    }
  };

  // Add error handling for image loading
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>, file: UploadedFile) => {
    console.error('Error loading image:', {
      src: e.currentTarget.src,
      file: file,
      error: e
    });
    
    // Try to refresh the signed URL once
    if (file.previewResult?.kind === 'signed') {
      refreshSignedUrl(file);
    } else {
      // If it's not a signed URL or refresh failed, show error placeholder
      e.currentTarget.onerror = null;
      e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIgZmlsbD0iI2NjYyIvPjx0ZXh0IHg9Ijc1IiB5PSI3NSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSIjNjY2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+SW1hZ2UgTm90IEZvdW5kPC90ZXh0Pjwvc3ZnPg==';
    }
  };

  // Add success handling for image loading
  const handleImageLoad = (file: UploadedFile) => {
    console.log('Image loaded successfully:', {
      url: file.public_url,
      file_path: file.file_path
    });
  };

  // Add error boundary for image loading
  const ImageWithErrorBoundary = ({ file }: { file: UploadedFile }) => {
    const [hasError, setHasError] = useState(false);
    const [imageUrl, setImageUrl] = useState(file.public_url);

    useEffect(() => {
      // Set the URL immediately for preview
      setImageUrl(file.public_url);
    }, [file.public_url]);

    if (hasError) {
      return (
        <div className="w-full h-32 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
          <p className="text-gray-500 dark:text-gray-400 text-sm">Failed to load image</p>
        </div>
      );
    }

    return (
      <div className="w-full h-32 rounded-lg overflow-hidden">
        <img
          src={imageUrl}
          alt={file.file_name}
          className="w-full h-full object-cover"
          onError={(e) => {
            console.error('Image load error:', {
              src: e.currentTarget.src,
              file: file,
              originalUrl: file.public_url
            });
            handleImageError(e, file);
            setHasError(true);
          }}
          onLoad={() => handleImageLoad(file)}
        />
      </div>
    );
  };

  const handleDeleteImage = (filePath: string) => {
    if (onImageDelete) {
      onImageDelete(filePath);
    }
    setFilesToDelete(prev => new Set([...prev, filePath]));
    setUploadedFiles(prev => prev.filter(file => file.file_path !== filePath));
  };

  return (
    <div className="w-full">
      {required && (
        <div className="mb-2">
          <span className="text-red-500 text-sm">* Required</span>
        </div>
      )}
      {!readOnly && (
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center ${
            isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
          }`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <input
            type="file"
            multiple
            accept={folder === 'other' ? '*/*' : 'image/*'}
            onChange={handleFileInput}
            className="hidden"
            id={fileInputId}
          />
          <label
            htmlFor={fileInputId}
            className="cursor-pointer text-blue-500 hover:text-blue-600"
          >
            <div className="space-y-2">
              <div className="text-gray-600">
                Drag and drop files here, or click to select files
              </div>
              <div className="text-sm text-gray-500">
                {folder === 'other' 
                  ? 'All file types are supported'
                  : 'Supported formats: JPG, PNG, GIF'}
              </div>
            </div>
          </label>
        </div>
      )}

      {/* Uploading files preview */}
      {uploadingFiles.length > 0 && (
        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {uploadingFiles.map((file, index) => (
            <div key={index} className="relative">
              <img
                src={file.preview}
                alt="Uploading"
                className="w-full h-32 object-cover rounded-lg"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1">
                Uploading: {Math.round(file.progress)}%
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Uploaded files grid */}
      {uploadedFiles.length > 0 && (
        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {uploadedFiles.map((file, index) => (
            <div key={index} className="relative group">
              <ImageWithErrorBoundary file={file} />
              {!readOnly && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDeleteImage(file.file_path);
                  }}
                  className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ImageUpload;
