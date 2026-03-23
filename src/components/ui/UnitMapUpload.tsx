import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Trash2, Star, ImagePlus } from 'lucide-react';
import {
  uploadPropertyUnitMapMulti,
  deletePropertyUnitMapById,
  setUnitMapPrimary,
  getPropertyUnitMaps,
} from '../../lib/utils/fileUpload';
import { supabase } from '../../utils/supabase';
import { getPreviewUrl } from '../../utils/storagePreviews';

interface UnitMapItem {
  id: string;
  file_path: string;
  file_id: string | null;
  display_name: string | null;
  sort_order: number;
  is_primary: boolean;
  previewUrl?: string | null;
}

interface UnitMapUploadProps {
  propertyId: string;
  propertyName: string;
  /** Legacy single-file path – used as a seed if the new table is empty */
  currentFilePath?: string | null;
  onUploadSuccess: (filePath: string) => void;
  onUploadError: (error: string) => void;
  onDeleteSuccess: () => void;
  onDeleteError: (error: string) => void;
  disabled?: boolean;
}

async function resolvePreviewUrl(filePath: string): Promise<string | null> {
  try {
    const result = await getPreviewUrl(supabase, 'files', filePath);
    return result.url;
  } catch {
    try {
      const { data } = supabase.storage.from('files').getPublicUrl(filePath);
      return data.publicUrl;
    } catch {
      return null;
    }
  }
}

export function UnitMapUpload({
  propertyId,
  propertyName,
  currentFilePath,
  onUploadSuccess,
  onUploadError,
  onDeleteSuccess,
  onDeleteError,
  disabled = false,
}: UnitMapUploadProps) {
  const [images, setImages] = useState<UnitMapItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadImages = useCallback(async () => {
    const records = await getPropertyUnitMaps(propertyId);
    const withPreviews = await Promise.all(
      records.map(async (r) => ({
        ...r,
        previewUrl: await resolvePreviewUrl(r.file_path),
      }))
    );
    setImages(withPreviews);
  }, [propertyId]);

  useEffect(() => {
    if (propertyId) loadImages();
  }, [propertyId, loadImages]);

  // Seed from legacy path if the new table is empty
  useEffect(() => {
    if (images.length === 0 && currentFilePath) {
      resolvePreviewUrl(currentFilePath).then((url) => {
        if (url) {
          setImages([{
            id: 'legacy',
            file_path: currentFilePath,
            file_id: null,
            display_name: null,
            sort_order: 0,
            is_primary: true,
            previewUrl: url,
          }]);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFilePath, images.length]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
    if (files.length) handleFilesUpload(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith('image/'));
    if (files.length) handleFilesUpload(files);
    e.target.value = '';
  };

  const handleFilesUpload = async (files: File[]) => {
    if (disabled || isUploading) return;
    setIsUploading(true);
    let lastSuccessPath: string | null = null;

    for (let i = 0; i < files.length; i++) {
      const result = await uploadPropertyUnitMapMulti(
        files[i],
        propertyId,
        propertyName,
        images.length + i
      );
      if (result.success && result.filePath) {
        lastSuccessPath = result.filePath;
      } else {
        onUploadError(result.error || 'Upload failed');
      }
    }

    setIsUploading(false);
    await loadImages();
    if (lastSuccessPath) onUploadSuccess(lastSuccessPath);
  };

  const handleDelete = async (item: UnitMapItem) => {
    if (disabled) return;
    if (item.id === 'legacy') {
      setImages((prev) => prev.filter((i) => i.id !== 'legacy'));
      onDeleteSuccess();
      return;
    }
    setLoadingIds((prev) => new Set(prev).add(item.id));
    const ok = await deletePropertyUnitMapById(item.id, propertyId);
    setLoadingIds((prev) => { const s = new Set(prev); s.delete(item.id); return s; });
    if (ok) {
      await loadImages();
      onDeleteSuccess();
    } else {
      onDeleteError('Failed to delete image');
    }
  };

  const handleSetPrimary = async (item: UnitMapItem) => {
    if (disabled || item.is_primary || item.id === 'legacy') return;
    setLoadingIds((prev) => new Set(prev).add(item.id));
    const ok = await setUnitMapPrimary(item.id, propertyId);
    setLoadingIds((prev) => { const s = new Set(prev); s.delete(item.id); return s; });
    if (ok) await loadImages();
  };

  const openFileDialog = () => fileInputRef.current?.click();

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled}
      />

      {/* Drop / Upload Zone */}
      <div
        className={`relative border-2 border-dashed rounded-xl p-5 text-center transition-all duration-150 ${
          dragActive
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-gray-50 dark:hover:bg-gray-800/40'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={!disabled ? handleDrop : undefined}
        onClick={!disabled ? openFileDialog : undefined}
      >
        {isUploading ? (
          <div className="flex flex-col items-center py-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2" />
            <p className="text-sm text-gray-600 dark:text-gray-300">Uploading…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center py-1">
            <ImagePlus className="h-8 w-8 text-blue-500 dark:text-blue-400 mb-2" />
            <p className="text-sm font-medium text-gray-800 dark:text-white">
              {dragActive ? 'Drop images here' : 'Click or drag & drop to add images'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              PNG, JPG, GIF – up to 10 MB each. Multiple files supported.
            </p>
          </div>
        )}
      </div>

      {/* Image Grid */}
      {images.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
              Unit Map Images ({images.length})
            </p>
            {images.length > 1 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <Star className="h-3 w-3 text-yellow-500" />
                = primary (shown first on property page)
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {images.map((item) => {
              const isLoading = loadingIds.has(item.id);
              return (
                <div
                  key={item.id}
                  className={`relative group rounded-lg overflow-hidden border-2 transition-all ${
                    item.is_primary
                      ? 'border-yellow-400 dark:border-yellow-500 shadow-md'
                      : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="aspect-video bg-gray-100 dark:bg-gray-800">
                    {item.previewUrl ? (
                      <img
                        src={item.previewUrl}
                        alt={item.display_name || 'Unit map'}
                        className="w-full h-full object-cover"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Upload className="h-6 w-6 text-gray-400" />
                      </div>
                    )}
                  </div>

                  {item.is_primary && (
                    <div className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-yellow-400 dark:bg-yellow-500 text-yellow-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow">
                      <Star className="h-2.5 w-2.5 fill-yellow-900" />
                      Primary
                    </div>
                  )}

                  <div className={`absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-150 flex items-center justify-center gap-2 ${isLoading ? 'bg-black/50' : ''}`}>
                    {isLoading ? (
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white" />
                    ) : (
                      <>
                        {!item.is_primary && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleSetPrimary(item); }}
                            disabled={disabled}
                            title="Set as primary"
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 bg-yellow-400 hover:bg-yellow-300 rounded-full text-yellow-900 shadow-lg"
                          >
                            <Star className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleDelete(item); }}
                          disabled={disabled}
                          title="Remove image"
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 bg-red-500 hover:bg-red-400 rounded-full text-white shadow-lg"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Add More tile */}
            <div
              className={`aspect-video rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-colors ${
                disabled
                  ? 'border-gray-200 dark:border-gray-700 opacity-40 cursor-not-allowed'
                  : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 cursor-pointer hover:bg-blue-50/50 dark:hover:bg-blue-900/10'
              }`}
              onClick={!disabled ? openFileDialog : undefined}
            >
              <Upload className="h-5 w-5 text-gray-400" />
              <span className="text-xs text-gray-500 dark:text-gray-400">Add more</span>
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Upload images of the property unit map. Multiple images are supported — the{' '}
        <Star className="inline h-3 w-3 text-yellow-500" />{' '}
        <strong>Primary</strong> image is shown first. Hover an image to set primary or remove it.
      </p>
    </div>
  );
}
