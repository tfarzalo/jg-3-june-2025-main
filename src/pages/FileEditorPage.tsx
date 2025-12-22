import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../utils/supabase';
import { SpreadsheetEditor } from '../components/editors/SpreadsheetEditor';
import { DocumentEditor } from '../components/editors/DocumentEditor';
import { PDFViewer } from '../components/editors/PDFViewer';
import { 
  saveSpreadsheetToStorage, 
  saveDocumentToStorage, 
  isSpreadsheet, 
  isDocument, 
  isPDF,
  normalizeStoragePath 
} from '../services/fileSaveService';
import { getPreviewUrl } from '../utils/storagePreviews';

export const FileEditorPage = () => {
  const { fileId } = useParams<{ fileId: string }>();
  const navigate = useNavigate();
  const [fileItem, setFileItem] = useState<any>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editorType, setEditorType] = useState<'spreadsheet' | 'document' | 'pdf' | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Prevent accidental closure
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const fetchFileDetails = useCallback(async () => {
    if (!fileId) return;
    try {
      setLoading(true);
      setError(null);

      // 1. Fetch metadata
      const { data: file, error: dbError } = await supabase
        .from('files')
        .select('*')
        .eq('id', fileId)
        .single();

      if (dbError) throw dbError;
      if (!file) throw new Error('File not found');

      setFileItem(file);

      // 2. Determine editor type
      if (isSpreadsheet(file.name, file.type)) {
        setEditorType('spreadsheet');
      } else if (isDocument(file.name, file.type)) {
        setEditorType('document');
      } else if (isPDF(file.name, file.type)) {
        setEditorType('pdf');
      } else {
        setError('Unsupported file type for editing');
        setLoading(false);
        return;
      }

      // 3. Get Signed URL
      // Try multiple path strategies
      const normalizedPath = normalizeStoragePath(file.path, file.name);
      const candidates = new Set<string>();
      if (file.path) candidates.add(file.path);
      if (normalizedPath) candidates.add(normalizedPath);

      let signedUrl = null;
      let lastError = null;

      for (const path of candidates) {
        const { data, error } = await supabase.storage
          .from('files')
          .createSignedUrl(path, 3600);
        
        if (!error && data?.signedUrl) {
          signedUrl = data.signedUrl;
          break;
        }
        lastError = error;
      }

      if (!signedUrl) {
        throw lastError || new Error('Could not generate signed URL');
      }

      setFileUrl(signedUrl);
    } catch (err) {
      console.error('Error fetching file:', err);
      setError(err instanceof Error ? err.message : 'Failed to load file');
    } finally {
      setLoading(false);
    }
  }, [fileId]);

  useEffect(() => {
    fetchFileDetails();
  }, [fetchFileDetails]);

  const handleSaveSpreadsheet = useCallback(async (content: any, newFileName?: string) => {
    if (!fileItem) return;
    try {
      // Use new filename if provided (e.g., auto-upgraded from CSV to XLSX)
      const nameToUse = newFileName || fileItem.name;
      
      await saveSpreadsheetToStorage(
        content,
        fileItem.id,
        nameToUse,
        fileItem.path
      );
      
      // If name changed, update local state to reflect it
      if (newFileName && newFileName !== fileItem.name) {
         setFileItem((prev: any) => ({ 
             ...prev, 
             name: newFileName,
             type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
         }));
         // Also update URL if needed? Not necessarily if we use ID-based routing
      }
      
      setHasUnsavedChanges(false);
      // Notify parent to refresh
      if (window.opener) {
        window.opener.postMessage({ type: 'FILE_UPDATED', fileId: fileItem.id }, '*');
      }
    } catch (err) {
      console.error('Save failed:', err);
      throw err; // Propagate to editor to show error
    }
  }, [fileItem]);

  const handleSaveDocument = useCallback(async (content: any, mimeType?: string) => {
    if (!fileItem) return;
    try {
      await saveDocumentToStorage(
        content,
        fileItem.id,
        fileItem.name,
        fileItem.path,
        mimeType
      );
      setHasUnsavedChanges(false);
      if (window.opener) {
        window.opener.postMessage({ type: 'FILE_UPDATED', fileId: fileItem.id }, '*');
      }
    } catch (err) {
      console.error('Save failed:', err);
      throw err;
    }
  }, [fileItem]);

  const handleRename = useCallback(async (newName: string) => {
    if (!fileId) return;
    const { error } = await supabase
      .from('files')
      .update({ name: newName, updated_at: new Date().toISOString() })
      .eq('id', fileId);
    
    if (error) throw error;
    setFileItem((prev: any) => ({ ...prev, name: newName }));
  }, [fileId]);

  const handleClose = () => {
    if (window.opener) {
      window.opener.postMessage({ type: 'EDITOR_CLOSED', fileId: fileItem?.id }, '*');
      window.opener.postMessage({ type: 'FILE_UPDATED', fileId: fileItem?.id }, '*'); // Ensure refresh
    }
    window.close();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading editor...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl max-w-md w-full text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Failed to Open File</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => window.close()}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Close Tab
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
      {editorType === 'spreadsheet' && (
        <SpreadsheetEditor
          fileUrl={fileUrl!}
          fileName={fileItem.name}
          onSave={handleSaveSpreadsheet}
          onClose={handleClose}
          onChangesDetected={setHasUnsavedChanges}
          onRename={handleRename}
        />
      )}
      {editorType === 'document' && (
        <DocumentEditor
          fileUrl={fileUrl!}
          fileName={fileItem.name}
          fileType={fileItem.type}
          onSave={handleSaveDocument}
          onClose={handleClose}
          onChangesDetected={setHasUnsavedChanges}
          onRename={handleRename}
        />
      )}
      {editorType === 'pdf' && (
        <PDFViewer
          fileUrl={fileUrl!}
          fileName={fileItem.name}
          onClose={handleClose}
        />
      )}
    </div>
  );
};

export default FileEditorPage;
