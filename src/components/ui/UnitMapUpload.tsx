import React, { useState, useRef } from 'react';
import { Upload, X, FileImage, Trash2, CheckCircle, AlertCircle } from 'lucide-react';
import { uploadPropertyUnitMap, deletePropertyUnitMap, FileUploadResult } from '../../lib/utils/fileUpload';

interface UnitMapUploadProps {
  propertyId: string;
  propertyName: string;
  currentFilePath?: string | null;
  onUploadSuccess: (filePath: string) => void;
  onUploadError: (error: string) => void;
  onDeleteSuccess: () => void;
  onDeleteError: (error: string) => void;
  disabled?: boolean;
}

export function UnitMapUpload({
  propertyId,
  propertyName,
  currentFilePath,
  onUploadSuccess,
  onUploadError,
  onDeleteSuccess,
  onDeleteError,
  disabled = false
}: UnitMapUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentFilePath ? URL.createObjectURL(new Blob()) : null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (disabled || isUploading) return;

    setIsUploading(true);
    
    try {
      const result: FileUploadResult = await uploadPropertyUnitMap(file, propertyId, propertyName);
      
      if (result.success && result.filePath) {
        onUploadSuccess(result.filePath);
        // Create a preview URL for the uploaded file
        const previewUrl = URL.createObjectURL(file);
        setPreviewUrl(previewUrl);
      } else {
        onUploadError(result.error || 'Upload failed');
      }
    } catch (error) {
      onUploadError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    if (disabled || isDeleting) return;

    setIsDeleting(true);
    
    try {
      const success = await deletePropertyUnitMap(propertyId);
      
      if (success) {
        onDeleteSuccess();
        setPreviewUrl(null);
      } else {
        onDeleteError('Failed to delete unit map');
      }
    } catch (error) {
      onDeleteError(error instanceof Error ? error.message : 'Delete failed');
    } finally {
      setIsDeleting(false);
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-4">
      {/* File Input (hidden) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled}
      />

      {/* Upload Area */}
      {!currentFilePath && !previewUrl && (
        <div
          className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            dragActive
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={!disabled ? openFileDialog : undefined}
        >
          <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {dragActive ? 'Drop the file here' : 'Click to upload or drag and drop'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              PNG, JPG, GIF up to 10MB
            </p>
          </div>
          
          {isUploading && (
            <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-sm text-gray-600 dark:text-gray-300">Uploading...</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Preview Area */}
      {(currentFilePath || previewUrl) && (
        <div className="relative border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <FileImage className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                Unit Map Image
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {currentFilePath || 'Uploaded file'}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              {isDeleting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
              ) : (
                <>
                  <button
                    onClick={openFileDialog}
                    disabled={disabled}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50"
                    title="Replace file"
                  >
                    <Upload className="h-4 w-4" />
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={disabled}
                    className="p-1 text-red-400 hover:text-red-600 dark:hover:text-red-300 disabled:opacity-50"
                    title="Delete file"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Help Text */}
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Upload a clear image of the property unit map. This will be displayed on the property details page.
      </p>
    </div>
  );
}
