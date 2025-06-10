import React, { useState, useCallback, useEffect, useId } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface ImageUploadProps {
  jobId: string;
  workOrderId?: string;
  folder: 'before' | 'sprinkler' | 'other';
  onUploadComplete?: (filePath: string) => void;
  onError?: (error: string) => void;
  readOnly?: boolean;
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
  resetTrigger,
  onImageDelete
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [selectedImage, setSelectedImage] = useState<UploadedFile | null>(null);
  const [filesToDelete, setFilesToDelete] = useState<Set<string>>(new Set());
  const { user, loading: authLoading } = useAuth();

  // Add debug logging for auth state
  useEffect(() => {
    console.log('ImageUpload auth state:', { user, authLoading, folder });
  }, [user, authLoading, folder]);

  // Helper function to construct the folder path
  const constructFolderPath = async () => {
    const { data: jobData, error: jobError } = await supabase
      .from('jobs')
      .select(`
        work_order_num,
        property_id,
        properties!property_id (
          property_name
        )
      `)
      .eq('id', jobId)
      .single();

    if (jobError || !jobData) {
      throw new Error('Failed to fetch job data');
    }

    const workOrderNum = `WO-${String(jobData.work_order_num).padStart(6, '0')}`;
    const propertyName = Array.isArray(jobData.properties) 
      ? jobData.properties[0]?.property_name 
      : (jobData.properties as { property_name: string })?.property_name;

    if (!propertyName) {
      throw new Error('Property name not found');
    }

    const folderMap = {
      before: 'Before Images',
      sprinkler: 'Sprinkler Images',
      other: 'Other Files'
    };

    // Create the path segments without encoding
    const pathSegments = [
      'Work Orders',
      propertyName,
      workOrderNum,
      folderMap[folder]
    ];

    // Return both the display path and the storage path
    return {
      displayPath: pathSegments.join('/'),
      storagePath: pathSegments.map(segment => encodeURIComponent(segment)).join('/')
    };
  };

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
          const files = data.map((file: any) => {
            const { data: urlData } = supabase.storage
              .from('files')
              .getPublicUrl(file.path);
            
            return {
              file_path: file.path,
              file_name: file.name,
              public_url: urlData.publicUrl,
              type: file.type
            };
          });
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
    // Check if folder exists
    const { data: existing, error: fetchError } = await supabase
      .from('files')
      .select('id')
      .eq('name', name)
      .eq('type', 'folder/directory')
      .eq('path', path)
      .maybeSingle();
    
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
    if (!files || files.length === 0 || !user) return;
    const newUploadingFiles: UploadingFile[] = files.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      progress: 0
    }));
    setUploadingFiles(newUploadingFiles);
    setIsUploading(true);
    try {
      // Get job data for proper file organization
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select(`work_order_num, property_id, properties!property_id (property_name)`)
        .eq('id', jobId)
        .single();
      if (jobError || !jobData) throw new Error('Failed to fetch job data');
      const workOrderNum = `WO-${String(jobData.work_order_num).padStart(6, '0')}`;
      const propertyName = Array.isArray(jobData.properties)
        ? jobData.properties[0]?.property_name
        : (jobData.properties as { property_name: string })?.property_name;
      if (!propertyName) throw new Error('Property name not found');
      // 1. Ensure property folder
      const propertyPath = `/${propertyName}`;
      const propertyFolderId = await ensureFolder(propertyName, null, propertyPath, null, jobData.property_id);
      // 2. Ensure Work Orders folder
      const workOrdersPath = `/${propertyName}/Work Orders`;
      const workOrdersFolderId = await ensureFolder('Work Orders', propertyFolderId, workOrdersPath, null, jobData.property_id);
      // 3. Ensure WO-XXXXXX folder
      const woPath = `/${propertyName}/Work Orders/${workOrderNum}`;
      const woFolderId = await ensureFolder(workOrderNum, workOrdersFolderId, woPath, jobId, jobData.property_id);
      // 4. Ensure subfolder (Before Images, Sprinkler Images, Other Files)
      const folderMap = { before: 'Before Images', sprinkler: 'Sprinkler Images', other: 'Other Files' };
      const subfolderName = folderMap[folder];
      const subfolderPath = `/${propertyName}/Work Orders/${workOrderNum}/${subfolderName}`;
      const subfolderId = await ensureFolder(subfolderName, woFolderId, subfolderPath, jobId, jobData.property_id);
      // 5. Upload files to storage and DB
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(7);
        const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9-_\.]/g, '_');
        const fileName = `${timestamp}-${randomSuffix}-${sanitizedFileName}`;
        const filePath = `${subfolderPath}/${fileName}`;
        const fileStoragePath = `${subfolderPath.replace(/^\//, '')}/${fileName}`;
        try {
          const mimeType = file.type || 'application/octet-stream';
          if (!mimeType.match(/^[a-zA-Z0-9]+\/[a-zA-Z0-9\-\+\.]+$/)) {
            throw new Error(`Invalid MIME type: ${mimeType}`);
          }
          // Upload file to storage using the files bucket
          const { error: uploadError } = await supabase.storage
            .from('files')
            .upload(fileStoragePath, file, { cacheControl: '3600', upsert: false });
          if (uploadError) {
            console.error('Storage upload error:', {
              error: uploadError,
              filePath: fileStoragePath,
              fileName: fileName,
              fileSize: file.size,
              fileType: mimeType
            });
            throw uploadError;
          }
          // Create file record in database
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
            console.error('Database insert error:', {
              error: dbError,
              message: dbError.message,
              details: dbError.details,
              filePath: filePath,
              fileName: fileName,
              fileSize: file.size,
              fileType: mimeType,
              folderId: subfolderId
            });
            await supabase.storage.from('files').remove([fileStoragePath]);
            throw dbError;
          }
          setUploadingFiles(prev => prev.map((f, index) => index === i ? { ...f, progress: 100 } : f));
          const { data: urlData } = supabase.storage.from('files').getPublicUrl(fileStoragePath);
          if (!urlData?.publicUrl) throw new Error('Failed to generate public URL');
          setUploadedFiles(prev => [...prev, {
            file_path: filePath,
            file_name: fileName,
            public_url: urlData.publicUrl,
            type: mimeType
          }]);
          if (onUploadComplete) onUploadComplete(filePath);
        } catch (error) {
          if (onError) onError(error instanceof Error ? error.message : 'Failed to upload file');
        }
      }
    } catch (error) {
      if (onError) onError(error instanceof Error ? error.message : 'Failed to process files');
    } finally {
      setIsUploading(false);
      setUploadingFiles([]);
    }
  };

  // Add error handling for image loading
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    console.error('Error loading image:', {
      src: e.currentTarget.src,
      error: e
    });
    e.currentTarget.onerror = null;
    e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIgZmlsbD0iI2NjYyIvPjx0ZXh0IHg9Ijc1IiB5PSI3NSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSIjNjY2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+SW1hZ2UgTm90IEZvdW5kPC90ZXh0Pjwvc3ZnPg==';
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
            handleImageError(e);
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
