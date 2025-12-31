import React, { useEffect, useState, useCallback, useRef } from 'react';
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
  Download,
  Edit,
  AlertTriangle
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { config } from '../config/environment';
import { useNavigate, useLocation } from 'react-router-dom';
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';
import { getPreviewUrl } from '../utils/storagePreviews';
import { 
  normalizeStoragePath,
  isSpreadsheet,
  isDocument,
  isPDF
} from '../services/fileSaveService';
import { optimizeImage } from '../lib/utils/imageOptimization';

// Translations
const translations = {
  en: {
    fileManager: 'File Manager',
    allFiles: 'All Files',
    searchFiles: 'Search files...',
    name: 'Name',
    date: 'Date',
    size: 'Size',
    type: 'Type',
    newFolder: 'New Folder',
    uploadFiles: 'Upload Files',
    enterFolderName: 'Enter folder name',
    create: 'Create',
    cancel: 'Cancel',
    noItemsFound: 'No items found.',
    uploadModalTitle: 'Upload Files',
    dragAndDrop: 'Drag and drop files here, or click to select files',
    upload: 'Upload',
    rename: 'Rename',
    renameModalTitle: 'Rename',
    enterNewName: 'Enter new name',
    download: 'Download',
    delete: 'Delete',
    itemsSelected: 'items selected',
    deleteSelected: 'Delete Selected',
    confirmDelete: 'Are you sure you want to delete',
    confirmBulkDelete: 'Are you sure you want to delete',
    items: 'items',
    loading: 'Loading...',
    errorPrefix: 'Error:',
    failedToLoad: 'Failed to load file items.',
    failedToCreate: 'Failed to create folder.',
    failedToDelete: 'Failed to delete item.',
    failedToDeleteItems: 'Failed to delete items.',
    failedToUpload: 'Failed to upload files.',
    failedToRename: 'Failed to rename item.',
    failedToHandle: 'Failed to handle file.',
    failedToPreview: 'Failed to open image preview.',
    confirmClose: 'Close without saving?',
    unsavedChangesWarning: 'You have unsaved changes. If you close now, your changes will be lost.',
    closeAnyway: 'Close Anyway'
  },
  es: {
    fileManager: 'Gestor de Archivos',
    allFiles: 'Todos los Archivos',
    searchFiles: 'Buscar archivos...',
    name: 'Nombre',
    date: 'Fecha',
    size: 'Tamaño',
    type: 'Tipo',
    newFolder: 'Nueva Carpeta',
    uploadFiles: 'Subir Archivos',
    enterFolderName: 'Ingrese el nombre de la carpeta',
    create: 'Crear',
    cancel: 'Cancelar',
    noItemsFound: 'No se encontraron elementos.',
    uploadModalTitle: 'Subir Archivos',
    dragAndDrop: 'Arrastra y suelta archivos aquí, o haz clic para seleccionar archivos',
    upload: 'Subir',
    rename: 'Renombrar',
    renameModalTitle: 'Renombrar',
    enterNewName: 'Ingrese el nuevo nombre',
    download: 'Descargar',
    delete: 'Eliminar',
    itemsSelected: 'elementos seleccionados',
    deleteSelected: 'Eliminar Seleccionados',
    confirmDelete: '¿Está seguro de que desea eliminar',
    confirmBulkDelete: '¿Está seguro de que desea eliminar',
    items: 'elementos',
    loading: 'Cargando...',
    errorPrefix: 'Error:',
    failedToLoad: 'Error al cargar los elementos.',
    failedToCreate: 'Error al crear la carpeta.',
    failedToDelete: 'Error al eliminar el elemento.',
    failedToDeleteItems: 'Error al eliminar los elementos.',
    failedToUpload: 'Error al subir los archivos.',
    failedToRename: 'Error al renombrar el elemento.',
    failedToHandle: 'Error al manejar el archivo.',
    failedToPreview: 'Error al abrir la vista previa de la imagen.',
    confirmClose: '¿Cerrar sin guardar?',
    unsavedChangesWarning: 'Tiene cambios sin guardar. Si cierra ahora, sus cambios se perderán.',
    closeAnyway: 'Cerrar de Todos Modos'
  }
};

interface FileItem {
  id: string;
  name: string;
  type: string;
  folder_id: string | null;
  uploaded_by: string;
  created_at: string;
  updated_at?: string;
  size: number;
  job_id: string | null;
  property_id: string | null;
  file_path: string;
  path?: string;
  previewUrl?: string | null;
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

// Ensure file paths are storage-safe and include the file name
const buildStoragePath = (path: string | null | undefined, name: string, jobId?: string | null) => {
  const normalized = normalizeStoragePath(path || '', name);
  
  if (normalized) return normalized;
  
  // Fallbacks for legacy rows that were missing path
  return jobId ? `jobs/${jobId}/${name}` : `root/${name}`;
};

// Helper to upload with progress
const uploadFileWithProgress = async (
  bucket: string,
  path: string,
  file: File,
  onProgress: (progress: number) => void
) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No session');

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = `${config.supabase.url}/storage/v1/object/${bucket}/${path}`;

    xhr.open('POST', url);
    xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
    xhr.setRequestHeader('apikey', config.supabase.anonKey!);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = (event.loaded / event.total) * 100;
        onProgress(percent);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.response);
      } else {
        reject(new Error(`Upload failed: ${xhr.statusText}`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error'));

    xhr.send(file);
  });
};

export function FileManager() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  
  // Detect language from URL or query params
  const getLanguage = (): 'en' | 'es' => {
    const urlLang = queryParams.get('lang');
    if (urlLang === 'en' || urlLang === 'es') return urlLang;
    
    const navigatorLang = navigator.language.split('-')[0];
    return navigatorLang === 'es' ? 'es' : 'en';
  };

  const [language, setLanguage] = useState<'en' | 'es'>(getLanguage());
  const t = translations[language];
  
  const [items, setItems] = useState<FileItem[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<FolderPath[]>([{ id: null, name: t.allFiles }]);
  const [currentFolderPath, setCurrentFolderPath] = useState<string | null>(null);
  const [isWorkOrdersContext, setIsWorkOrdersContext] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showPreview, setShowPreview] = useState<FileItem | null>(null);
  const [showRenameInput, setShowRenameInput] = useState<FileItem | null>(null);
  const [newName, setNewName] = useState('');
  const [previewUrls, setPreviewUrls] = useState<{ [key: string]: string }>({});
  const [isDragging, setIsDragging] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxImages, setLightboxImages] = useState<{ src: string; alt: string }[]>([]);
  const [moveConfirmation, setMoveConfirmation] = useState<{ item: FileItem; targetFolderId: string } | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  const isFolder = (type: string) => type === 'folder/directory' || type === 'folder/job' || type === 'folder/property';
  const imageExts = new Set(['jpg','jpeg','png','gif','webp','bmp','tiff','svg']);
  const isImageByExt = (name?: string) => {
    if (!name) return false;
    const ext = name.split('.').pop()?.toLowerCase() || '';
    return imageExts.has(ext);
  };
  const isImageItem = (item: FileItem) => item.type.startsWith('image/') || isImageByExt(item.name) || !!item.previewUrl;

  const fetchItems = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('files')
        .select('id, name, type, folder_id, uploaded_by, created_at, size, original_size, optimized_size, job_id, property_id, path, updated_at');

      // Handle root folder and nested folders correctly
      if (currentFolderId === null) {
        // At root level, show only property folders (folder_id IS NULL)
        query = query.is('folder_id', null);
      } else {
        query = query.eq('folder_id', currentFolderId);
        const { data: curFolder } = await supabase
          .from('files')
          .select('path, name')
          .eq('id', currentFolderId)
          .maybeSingle();
        const pathStr = curFolder?.path || null;
        setCurrentFolderPath(pathStr);
        setIsWorkOrdersContext(!!pathStr && /\/Work Orders\/?$/i.test(pathStr));
      }

      // Add job_id filter if we're in a job context
      const urlParams = new URLSearchParams(window.location.search);
      const jobId = urlParams.get('job_id');
      if (jobId) {
        query = query.eq('job_id', jobId);
      }

      const { data, error: fetchError } = await (isWorkOrdersContext
        ? query.order('updated_at', { ascending: false }).order('created_at', { ascending: false })
        : query.order('name'));

      if (fetchError) {
        console.error('[FileManager] fetchItems error:', JSON.stringify(fetchError, null, 2));
        console.error('[FileManager] Query params:', { currentFolderId, jobId });
        throw fetchError;
      }

      // Process the files to ensure correct paths and generate preview URLs
      const processedData = await Promise.all((data || []).map(async (file) => {
        const filePath = buildStoragePath(file.path, file.name, file.job_id);
        
        // Generate preview URL for image files
        let previewUrl = null;
        if (file.type.startsWith('image/') || isImageByExt(file.name)) {
          try {
            const previewResult = await getPreviewUrl(supabase, 'files', filePath);
            previewUrl = previewResult.url;
          } catch (error) {
            console.error('Error generating preview URL for file:', filePath, error);
            // Fallback to public URL if preview fails
            const { data: urlData } = supabase.storage
              .from('files')
              .getPublicUrl(filePath);
            previewUrl = urlData.publicUrl;
          }
        }

        return {
          ...file,
          file_path: filePath,
          previewUrl
        };
      }));

      setItems(processedData);

    } catch (error) {
      console.error('Error fetching file items:', error);
      setError(t.failedToLoad);
    } finally {
      setLoading(false);
    }
  }, [currentFolderId, language]);

  useEffect(() => {
    fetchItems();

    // Listen for refresh messages from editor tabs
    const handleMessage = (event: MessageEvent) => {
      if (event.data && (event.data.type === 'FILE_UPDATED' || event.data.type === 'REFRESH_FILES')) {
        console.log('🔄 Received refresh message, reloading files...');
        fetchItems();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [fetchItems]);

  // Helper to validate filename
  const validateFileName = (newName: string, originalName: string): { valid: boolean; error?: string; formattedName?: string } => {
    const trimmed = newName.trim();
    if (!trimmed) return { valid: false, error: 'Name cannot be empty' };
    
    // Check for spaces - DISABLED to allow spaces in folder names
    // if (/\s/.test(trimmed)) {
    //   return { valid: false, error: 'File names cannot contain spaces' };
    // }
    
    // Check extension for files
    if (!originalName.endsWith('/')) { // Not a folder
      const oldExt = originalName.split('.').pop()?.toLowerCase();
      const newExt = trimmed.split('.').pop()?.toLowerCase();
      
      if (oldExt && oldExt !== newExt) {
        return { valid: false, error: `Cannot change file extension from .${oldExt} to .${newExt}` };
      }
    }
    
    return { valid: true, formattedName: trimmed };
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    
    // Check for spaces - DISABLED to allow spaces in folder names
    /* if (/\s/.test(newFolderName.trim())) {
      setError('Folder names cannot contain spaces');
      return;
    } */

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      // Use the new create_user_folder function
      const { data: folderId, error } = await supabase.rpc('create_user_folder', {
        p_name: newFolderName.trim(),
        p_parent_folder_id: currentFolderId
      });

      if (error) throw error;

      setNewFolderName('');
      setShowNewFolderInput(false);
      fetchItems();
    } catch (err: any) {
      console.error('Error creating folder:', err);
      // Try to extract a more specific error message if available
      const errorMessage = err?.message || err?.error_description || err?.details || t.failedToCreate;
      setError(`${t.failedToCreate} ${errorMessage !== t.failedToCreate ? `(${errorMessage})` : ''}`);
    }
  };

  const handleDeleteItem = async (item: FileItem) => {
    if (!confirm(`${t.confirmDelete} ${item.name}?`)) return;

    try {
      const { error } = await supabase
        .from('files')
        .delete()
        .eq('id', item.id);

      if (error) throw error;

      fetchItems();
    } catch (err) {
      console.error('Error deleting item:', err);
      setError(t.failedToDelete);
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

      // Resolve target folder path
      let targetFolderId: string | null = currentFolderId;
      let basePath: string | null = null;
      if (targetFolderId) {
        const { data: folderInfo } = await supabase
          .from('files')
          .select('path')
          .eq('id', targetFolderId)
          .maybeSingle();
        basePath = folderInfo?.path || null;
      } else if (jobId && propertyId) {
        const { data: uploadFolderId } = await supabase.rpc('get_upload_folder', {
          p_property_id: propertyId,
          p_job_id: jobId,
          p_folder_type: 'other'
        });
        if (uploadFolderId) {
          targetFolderId = uploadFolderId;
          const { data: folderInfo } = await supabase
            .from('files')
            .select('path')
            .eq('id', uploadFolderId)
            .maybeSingle();
          basePath = folderInfo?.path || null;
        }
      }

      // Determine auto naming context
      let autoCategory: 'before' | 'sprinkler' | 'other' | null = null
      let woSegment: string | null = null
      if (basePath) {
        const lowerPath = basePath.toLowerCase()
        if (lowerPath.includes('/work orders/')) {
          if (lowerPath.includes('/before images')) autoCategory = 'before'
          else if (lowerPath.includes('/sprinkler images')) autoCategory = 'sprinkler'
          else autoCategory = 'other'
          const m = basePath.match(/WO-\d+/)
          if (m) woSegment = m[0]
        }
      }

      // Precompute index if auto naming applies
      let nextIndex = 1
      if (autoCategory && targetFolderId) {
        const { data: existing } = await supabase
          .from('files')
          .select('name')
          .eq('folder_id', targetFolderId)
        let maxIdx = 0
        const rx = new RegExp(`^wo-\\d+_${autoCategory}_(\\d+)\\.`)
        if (existing && Array.isArray(existing)) {
          for (const row of existing as any[]) {
            const n = typeof row.name === 'string' ? row.name.toLowerCase().match(rx) : null
            if (n && n[1]) {
              const v = parseInt(n[1], 10)
              if (!isNaN(v)) maxIdx = Math.max(maxIdx, v)
            }
          }
        }
        nextIndex = maxIdx + 1
      }

      for (const file of selectedFiles) {
        const isImage = (file.type || '').toLowerCase().startsWith('image/')
        const optimized = isImage ? await optimizeImage(file) : { blob: file, mime: file.type || 'application/octet-stream', suggestedExt: '', width: 0, height: 0, originalSize: file.size, optimizedSize: file.size }
        let finalName = file.name
        let finalCategory = null as string | null
        if (autoCategory && woSegment) {
          const woLabel = `wo-${woSegment.replace('WO-', '')}`
          const ext = optimized.suggestedExt || (file.name.split('.').pop() || 'bin')
          finalName = `${woLabel}_${autoCategory}_${nextIndex}.${ext}`
          nextIndex += 1
          finalCategory = autoCategory
        }

        const storageBase = (basePath || 'root').replace(/^\/+/, '')
        const filePath = `${storageBase}/${finalName}`.replace(/\/+/g, '/')
        const uploadFile = new File([optimized.blob], finalName, { type: optimized.mime })
        await uploadFileWithProgress('files', filePath, uploadFile, (progress) => {
          setUploadProgress(prev => ({
            ...prev,
            [finalName]: progress
          }));
        });

        // Create file record
        const { error: dbError } = await supabase
          .from('files')
          .insert({
            name: finalName,
            type: uploadFile.type,
            size: optimized.optimizedSize,
            original_size: optimized.originalSize,
            optimized_size: optimized.optimizedSize,
            path: filePath,
            folder_id: targetFolderId,
            uploaded_by: userData.user.id,
            job_id: jobId || null,
            property_id: propertyId,
            category: finalCategory
          });

        if (dbError) throw dbError;
      }

      setSelectedFiles([]);
      setShowUploadModal(false);
      setUploadProgress({});
      fetchItems();
    } catch (err) {
      console.error('Error uploading files:', err);
      setError(t.failedToUpload);
    }
  };

  const handleRename = async (item: FileItem) => {
    if (!newName.trim()) return;

    const validation = validateFileName(newName, item.name);
    if (!validation.valid) {
      setError(validation.error || 'Invalid filename');
      return;
    }
    const validatedName = validation.formattedName!;

    try {
      // Check if this is a folder
      if (item.type === 'folder/directory') {
        // Use the rename_folder function for folders
        const { data, error } = await supabase.rpc('rename_folder', {
          p_folder_id: item.id,
          p_new_name: validatedName
        });

        if (error) throw error;

        console.log('[FileManager] Folder renamed:', data);
      } else {
        // For files, just update the name
        const { error } = await supabase
          .from('files')
          .update({ name: validatedName })
          .eq('id', item.id);

        if (error) throw error;
      }

      setShowRenameInput(null);
      setNewName('');
      fetchItems();
    } catch (err) {
      console.error('Error renaming item:', err);
      setError(t.failedToRename);
    }
  };

  // Rename handler for use within editor modals
  // Returns a function that takes only the new name (the fileId is captured from openDocument)
  /* const createRenameHandler = () => {
    return async (newName: string) => {
      if (!openDocument) {
        throw new Error('No document is currently open');
      }
      
      if (!newName.trim()) {
        throw new Error('File name cannot be empty');
      }

      try {
        const fileId = openDocument.item.id;
        console.log('[FileManager] Renaming file:', { fileId, newName });
        
        const { error } = await supabase
          .from('files')
          .update({ 
            name: newName.trim(),
            updated_at: new Date().toISOString()
          })
          .eq('id', fileId);

        if (error) {
          console.error('[FileManager] Rename error:', error);
          throw error;
        }

        console.log('[FileManager] File renamed successfully');
        
        // Update the openDocument state with the new name
        setOpenDocument({
          ...openDocument,
          item: { ...openDocument.item, name: newName.trim() }
        });
        
        // Refresh the file list to reflect the new name
        await fetchItems();
      } catch (err) {
        console.error('[FileManager] Error renaming file:', err);
        throw new Error(t.failedToRename);
      }
    };
  }; */

  const sortedItems = [...items].sort((a, b) => {
    const order = sortOrder === 'asc' ? 1 : -1;
    if (isWorkOrdersContext) {
      const aDate = new Date(a.updated_at || a.created_at).getTime();
      const bDate = new Date(b.updated_at || b.created_at).getTime();
      return (bDate - aDate) * 1; // always show latest first in Work Orders
    }
    switch (sortBy) {
      case 'name':
        return order * a.name.localeCompare(b.name);
      case 'date':
        return order * (new Date(a.updated_at || a.created_at).getTime() - new Date(b.updated_at || b.created_at).getTime());
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


  const getExtension = (name: string) => {
    const parts = name?.split('.') || [];
    return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';
  };

  const shouldOpenInEditor = (type: string, name: string) => {
    const lowerType = (type || '').toLowerCase();
    const ext = getExtension(name);
    const docExts = new Set([
      'pdf', 'txt', 'md', 'rtf',
      'doc', 'docx', 'odt', 'pages', 'html', 'htm',
      'xls', 'xlsx', 'ods', 'csv', 'tsv',
      'ppt', 'pptx', 'odp'
    ]);
    return lowerType === 'application/pdf' ||
      lowerType.startsWith('text/') ||
      lowerType.includes('document') ||
      lowerType.includes('msword') ||
      lowerType.includes('ms-excel') ||
      lowerType.includes('spreadsheet') ||
      lowerType.includes('presentation') ||
      lowerType.includes('ms-powerpoint') ||
      docExts.has(ext);
  };

  const isOfficeDocument = (type: string, name: string) => {
    const lowerType = (type || '').toLowerCase();
    const ext = getExtension(name);
    const officeExts = new Set(['doc', 'docx', 'xls', 'xlsx', 'csv', 'tsv', 'ppt', 'pptx', 'odp', 'ods']);
    return lowerType.includes('officedocument') ||
      lowerType.includes('msword') ||
      lowerType.includes('ms-excel') ||
      lowerType.includes('spreadsheet') ||
      lowerType.includes('presentation') ||
      lowerType.includes('ms-powerpoint') ||
      officeExts.has(ext);
  };

  const getSignedFileUrl = async (item: FileItem) => {
    const normalizedPath = normalizeStoragePath(item.file_path, item.name);
    // Prefer the raw DB path first (most objects stored there), then normalized as a fallback
    const candidates = new Set<string>();
    if (item.file_path) candidates.add(item.file_path);
    if (normalizedPath) candidates.add(normalizedPath);

    // Fallback: if the path ends with "/<fileName>" and the parent segment already contains the name (e.g., ".../foo.csv/foo.csv"), try the parent path.
    if (item.file_path) {
      const segments = item.file_path.split('/').filter(Boolean);
      if (segments.length > 1) {
        const last = segments[segments.length - 1];
        const parent = segments.slice(0, -1).join('/');
        if (last === item.name || parent.toLowerCase().includes(item.name.toLowerCase())) {
          candidates.add(parent);
        }
      }
    }

    let lastError: any = null;
    for (const path of candidates) {
      const { data, error } = await supabase.storage
        .from('files')
        .createSignedUrl(path, 3600);

      if (!error && data?.signedUrl) {
        return { signedUrl: data.signedUrl, storagePath: path };
      }
      lastError = error || new Error('No signed URL returned');
      console.warn('[FileManager] createSignedUrl failed for path', path, lastError);
    }

    throw lastError || new Error('No signed URL available');
  };

  const formatBytes = (bytes?: number | null) => {
    if (!bytes || bytes <= 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
  }

  const percentSaved = (orig?: number | null, opt?: number | null) => {
    if (!orig || !opt || orig <= 0) return null
    const saved = 1 - opt / orig
    return Math.max(0, Math.round(saved * 100))
  }

  // Function to handle file download (always downloads)
  const handleDownload = async (item: FileItem) => {
    try {
      const { signedUrl } = await getSignedFileUrl(item);
      const link = document.createElement('a');
      link.href = signedUrl;
      link.download = item.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error handling file:', err);
      setError(t.failedToHandle);
    }
  };

  // Open documents/spreadsheets/PDFs in a new tab (dedicated editor page)
  const handleOpenDocument = (item: FileItem) => {
    // Navigate to the dedicated editor route
    // Using window.open for "New Tab" experience as requested
    window.open(`/file-editor/${item.id}`, '_blank');
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
      setError(t.failedToPreview);
    }
  };

  const handleItemDragStart = (e: React.DragEvent, item: FileItem) => {
    e.stopPropagation();
    e.dataTransfer.setData('itemId', item.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleItemDragOver = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragOverFolderId !== folderId) {
      setDragOverFolderId(folderId);
    }
  };

  const handleItemDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);
  };

  const handleItemDrop = async (e: React.DragEvent, targetFolder: FileItem) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);

    const itemId = e.dataTransfer.getData('itemId');
    if (!itemId) return;

    if (itemId === targetFolder.id) return;

    const itemToMove = items.find(i => i.id === itemId);
    if (!itemToMove) return;

    // Check if moving to same folder
    if (itemToMove.folder_id === targetFolder.id) return;

    // Check for warnings
    if (itemToMove.job_id || itemToMove.property_id) {
      setMoveConfirmation({ item: itemToMove, targetFolderId: targetFolder.id });
      return;
    }

    await executeMove(itemToMove, targetFolder.id);
  };

  const executeMove = async (item: FileItem, targetFolderId: string) => {
    try {
      const { error } = await supabase
        .from('files')
        .update({ folder_id: targetFolderId })
        .eq('id', item.id);

      if (error) throw error;

      fetchItems();
      setMoveConfirmation(null);
    } catch (err) {
      console.error('Error moving item:', err);
      setError('Failed to move item');
    }
  };

  const handleFileClick = async (item: FileItem) => {
    if (isImageItem(item)) {
      return handleImagePreview(item);
    }

    if (shouldOpenInEditor(item.type, item.name)) {
      return handleOpenDocument(item);
    }

    return handleDownload(item);
  };

  // Handle closing the editor with unsaved changes check
  // Removed as logic is now in FileEditorPage
  // const handleCloseEditor = () => {
  //   if (hasUnsavedChanges) {
  //     setShowCloseConfirmation(true);
  //   } else {
  //     setOpenDocument(null);
  //     setEditorMode(null);
  //     setHasUnsavedChanges(false);
  //   }
  // };

  // const confirmCloseEditor = () => {
  //   setOpenDocument(null);
  //   setEditorMode(null);
  //   setHasUnsavedChanges(false);
  //   setShowCloseConfirmation(false);
  // };

  if (loading) {
    return <div className="p-4 text-gray-900 dark:text-gray-100">{t.loading}</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500 dark:text-red-400">{t.errorPrefix} {error}</div>;
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center space-x-2 mb-4 overflow-x-auto">
        {folderPath.map((folder, index) => (
          <React.Fragment key={folder.id || 'root'}>
            {index > 0 && <span className="text-gray-500">/</span>}
            <button
              onClick={() => handleNavigateUp(index)}
              className="text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
            >
              {folder.name}
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 space-y-4 sm:space-y-0">
        <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-100">{t.fileManager}</h1>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
          <div className="relative flex-1 sm:flex-none">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.searchFiles}
              className="w-full pl-8 sm:pl-10 pr-4 py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
            <Search className="absolute left-2 sm:left-3 top-2.5 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
          </div>
          <div className="flex space-x-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="px-2 sm:px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value="name">{t.name}</option>
              <option value="date">{t.date}</option>
              <option value="size">{t.size}</option>
              <option value="type">{t.type}</option>
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
              {viewMode === 'list' ? <Grid className="h-4 w-4 sm:h-5 sm:w-5" /> : <List className="h-4 w-4 sm:h-5 sm:w-5" />}
            </button>
          </div>
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
            <button
              onClick={() => setShowNewFolderInput(true)}
              className="flex items-center justify-center px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">{t.newFolder}</span>
              <span className="sm:hidden">Folder</span>
            </button>
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center justify-center px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Upload className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">{t.uploadFiles}</span>
              <span className="sm:hidden">Upload</span>
            </button>
          </div>
        </div>
      </div>

      {/* New Folder Input */}
      {showNewFolderInput && (
        <div className="mb-4 flex items-center space-x-2">
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder={t.enterFolderName}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            onKeyPress={(e) => e.key === 'Enter' && handleCreateFolder()}
          />
          <button
            onClick={handleCreateFolder}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {t.create}
          </button>
          <button
            onClick={() => {
              setShowNewFolderInput(false);
              setNewFolderName('');
            }}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 text-sm font-medium rounded-lg transition-colors"
          >
            {t.cancel}
          </button>
        </div>
      )}

      {/* File List/Grid */}
      {filteredItems.length === 0 ? (
        <p className="text-gray-600 dark:text-gray-400">{t.noItemsFound}</p>
      ) : viewMode === 'list' ? (
        <ul className="space-y-2">
          {filteredItems.map(item => (
            <li
              key={item.id}
              draggable
              onDragStart={(e) => handleItemDragStart(e, item)}
              onDragOver={(e) => item.type === 'folder/directory' ? handleItemDragOver(e, item.id) : undefined}
              onDragLeave={handleItemDragLeave}
              onDrop={(e) => item.type === 'folder/directory' ? handleItemDrop(e, item) : undefined}
              className={`p-3 border rounded-lg flex items-center justify-between transition-colors ${
                dragOverFolderId === item.id 
                  ? 'bg-blue-100 dark:bg-blue-900 border-blue-500' 
                  : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
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
                    {isImageItem(item) && item.previewUrl ? (
                      <img
                        src={item.previewUrl}
                        alt={item.name}
                        className="h-8 w-8 object-cover rounded mr-3"
                        onError={(e) => {
                          console.error('Failed to load unit map image:', item.previewUrl);
                          e.currentTarget.style.display = 'none';
                        }}
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
                {isImageItem(item) && (
                  <div className="text-xs text-gray-600 dark:text-gray-300">
                    <span className="mr-3">Org: {formatBytes((item as any).original_size ?? item.size)}</span>
                    <span className="mr-3">Opt: {formatBytes((item as any).optimized_size ?? item.size)}</span>
                    {(() => {
                      const p = percentSaved((item as any).original_size ?? item.size, (item as any).optimized_size ?? item.size)
                      return p !== null ? <span>Saved: {p}%</span> : null
                    })()}
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isFolder(item.type) && shouldOpenInEditor(item.type, item.name)) {
                        handleFileClick(item);
                        return;
                      }
                      setNewName(item.name);
                      setShowRenameInput(item);
                    }}
                    className="p-1 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
                    title={t.rename}
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(item);
                    }}
                    className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    title={t.download}
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteItem(item);
                    }}
                    className="p-1 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                    title={t.delete}
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
              draggable
              onDragStart={(e) => handleItemDragStart(e, item)}
              onDragOver={(e) => isFolder(item.type) ? handleItemDragOver(e, item.id) : undefined}
              onDragLeave={handleItemDragLeave}
              onDrop={(e) => isFolder(item.type) ? handleItemDrop(e, item) : undefined}
              className={`p-4 border rounded-lg transition-colors ${
                dragOverFolderId === item.id 
                  ? 'bg-blue-100 dark:bg-blue-900 border-blue-500' 
                  : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <div className="flex flex-col items-center">
                {isFolder(item.type) ? (
                  <button
                    onClick={() => handleFolderClick(item)}
                    className="flex flex-col items-center text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 w-full"
                  >
                    <FolderOpen className={`h-8 w-8 mb-2 ${item.type === 'folder/property' ? 'text-blue-500' : item.type === 'folder/job' ? 'text-green-500' : 'text-yellow-500'}`} />
                    <span className="text-center mb-2">{item.name}</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleFileClick(item)}
                    className="flex flex-col items-center w-full hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    {isImageItem(item) && item.previewUrl ? (
                      <img
                        src={item.previewUrl}
                        alt={item.name}
                        className="h-24 w-24 object-cover rounded mb-2"
                        onError={(e) => {
                          console.error('Failed to load unit map image:', item.previewUrl);
                          e.currentTarget.style.display = 'none';
                        }}
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
                    onClick={(e) => {
                      e.stopPropagation();
                      if (item.type !== 'folder/directory' && shouldOpenInEditor(item.type, item.name)) {
                        handleFileClick(item);
                        return;
                      }
                      setNewName(item.name);
                      setShowRenameInput(item);
                    }}
                    className="p-2 text-gray-500 hover:text-blue-500 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
                    title={t.rename}
                  >
                    <Edit className="h-5 w-5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(item);
                    }}
                    className="p-2 text-gray-500 hover:text-blue-500 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
                    title={t.download}
                  >
                    <Download className="h-5 w-5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteItem(item);
                    }}
                    className="p-2 text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
                    title={t.delete}
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
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t.uploadModalTitle}</h2>
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
                {t.dragAndDrop}
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
                {t.cancel}
              </button>
              <button
                onClick={handleUpload}
                disabled={selectedFiles.length === 0}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {t.upload}
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
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t.renameModalTitle}</h2>
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
              placeholder={t.enterNewName}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 mb-4"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">File extensions cannot be changed.</p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowRenameInput(null);
                  setNewName('');
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-400 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                {t.cancel}
              </button>
              <button
                onClick={() => handleRename(showRenameInput)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {t.rename}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move Confirmation Modal */}
      {moveConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center space-x-3 mb-4 text-amber-500">
              <AlertTriangle className="h-8 w-8" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Warning</h2>
            </div>
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              This item is associated with a Job or Property. Moving it may break file references in other parts of the system.
              <br /><br />
              Are you sure you want to move <strong>{moveConfirmation.item.name}</strong>?
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setMoveConfirmation(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-400 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => executeMove(moveConfirmation.item, moveConfirmation.targetFolderId)}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Move Anyway
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
    </div>
  );
}
