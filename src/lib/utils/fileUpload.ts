import { supabase } from '../../utils/supabase';
import { optimizeImage } from './imageOptimization';
import { buildStoragePath } from '../../utils/storagePaths';
import { FILE_CATEGORY_PATHS } from '../../utils/fileCategories';

export interface FileUploadResult {
  success: boolean;
  fileId?: string;
  filePath?: string;
  error?: string;
}

/**
 * Upload a property unit map file to Supabase storage
 * @param file - The file to upload
 * @param propertyId - The property ID
 * @param propertyName - The property name for folder organization
 * @returns Promise<FileUploadResult>
 */
export async function uploadPropertyUnitMap(
  file: File,
  propertyId: string,
  propertyName: string
): Promise<FileUploadResult> {
  try {
    console.log('[uploadPropertyUnitMap] Starting upload:', { propertyId, propertyName, fileName: file.name });
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      return {
        success: false,
        error: 'Only image files are allowed for unit maps'
      };
    }

    // Check user role for size limit
    const { data: { user } } = await supabase.auth.getUser();
    let maxSize = 10 * 1024 * 1024; // 10MB default
    let isUnlimited = false;

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile && (profile.role === 'admin' || profile.role === 'jg_management')) {
        isUnlimited = true;
      }
    }

    // Validate file size
    if (!isUnlimited && file.size > maxSize) {
      const sizeLimitMB = Math.round(maxSize / (1024 * 1024));
      return {
        success: false,
        error: `File size must be less than ${sizeLimitMB}MB`
      };
    }

    // CRITICAL: Ensure property folders exist BEFORE uploading
    console.log('[uploadPropertyUnitMap] Ensuring property folders exist...');
    const { data: folderPrep, error: prepError } = await supabase.rpc(
      'prepare_property_for_file_upload',
      { p_property_id: propertyId }
    );

    if (prepError) {
      console.error('[uploadPropertyUnitMap] Failed to prepare folders:', prepError);
      return {
        success: false,
        error: `Failed to prepare property folders: ${prepError.message}`
      };
    }

    console.log('[uploadPropertyUnitMap] Folders ready:', folderPrep);

    // Create the file path in the Property Files folder
    // Sanitize property name to avoid spaces in file paths
    const optimized = await optimizeImage(file);
    const ext = optimized.suggestedExt || (file.name.split('.').pop() || 'jpg');
    const baseName = `unit-map-${Date.now()}`;
    const fileName = `${baseName}.${ext}`;
    const filePath = buildStoragePath({
      propertyId,
      category: FILE_CATEGORY_PATHS.property_files,
      filename: fileName
    });

    console.log('[uploadPropertyUnitMap] Uploading to storage:', filePath);

    // Upload file to Supabase storage
    const uploadFile = new File([optimized.blob], fileName, { type: optimized.mime });
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('files')
      .upload(filePath, uploadFile, {
        cacheControl: '3600',
        upsert: false,
        contentType: optimized.mime
      });

    if (uploadError) {
      console.error('[uploadPropertyUnitMap] Storage upload error:', uploadError);
      return {
        success: false,
        error: `Upload failed: ${uploadError.message}`
      };
    }

    console.log('[uploadPropertyUnitMap] File uploaded to storage successfully');

    // Get the public URL for the uploaded file
    const { data: urlData } = supabase.storage
      .from('files')
      .getPublicUrl(filePath);

    // Get the Property Files folder ID from the prepare result
    const propertyFilesFolderId = folderPrep.property_files_folder_id;

    if (!propertyFilesFolderId) {
      console.error('[uploadPropertyUnitMap] No Property Files folder ID available');
      // Clean up uploaded file
      await supabase.storage.from('files').remove([filePath]);
      return {
        success: false,
        error: 'Property Files folder not available'
      };
    }

    console.log('[uploadPropertyUnitMap] Creating file record in database...');

    // Create file record directly in the database with sanitized path
    const { data: fileRecord, error: dbError } = await supabase
      .from('files')
      .insert({
        name: fileName,
        path: filePath,
        storage_path: filePath,
        display_path: `/Properties/${propertyName}/Property Files/${fileName}`,
        size: optimized.optimizedSize,
        original_size: optimized.originalSize,
        optimized_size: optimized.optimizedSize,
        type: optimized.mime,
        uploaded_by: (await supabase.auth.getUser()).data.user?.id,
        property_id: propertyId,
        folder_id: propertyFilesFolderId,
        category: 'property_files',
        original_filename: file.name,
        bucket: 'files'
      })
      .select()
      .single();

    if (dbError) {
      console.error('[uploadPropertyUnitMap] Database error:', dbError);
      // If database insert fails, delete the uploaded file
      await supabase.storage.from('files').remove([filePath]);
      return {
        success: false,
        error: `Database error: ${dbError.message}`
      };
    }

    console.log('[uploadPropertyUnitMap] File record created:', fileRecord.id);

    console.log('[uploadPropertyUnitMap] File record created:', fileRecord.id);

    // Update the property with the file reference
    const { error: updateError } = await supabase
      .from('properties')
      .update({
        unit_map_file_id: fileRecord.id,
        unit_map_file_path: filePath
      })
      .eq('id', propertyId);

    if (updateError) {
      console.error('[uploadPropertyUnitMap] Property update error:', updateError);
      // If property update fails, delete the uploaded file and file record
      await supabase.storage.from('files').remove([filePath]);
      await supabase.from('files').delete().eq('id', fileRecord.id);
      return {
        success: false,
        error: `Property update failed: ${updateError.message}`
      };
    }

    console.log('[uploadPropertyUnitMap] Upload complete successfully!');

    return {
      success: true,
      fileId: fileRecord.id,
      filePath: filePath
    };

  } catch (error) {
    console.error('[uploadPropertyUnitMap] Unexpected error:', error);
    return {
      success: false,
      error: `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Delete a property unit map file
 * @param propertyId - The property ID
 * @returns Promise<boolean>
 */
export async function deletePropertyUnitMap(propertyId: string): Promise<boolean> {
  try {
    // Get the current unit map file info
    const { data: propertyData, error: propertyError } = await supabase
      .from('properties')
      .select('unit_map_file_id, unit_map_file_path')
      .eq('id', propertyId)
      .single();

    if (propertyError || !propertyData) {
      console.error('Error fetching property data:', propertyError);
      return false;
    }

    if (!propertyData.unit_map_file_id || !propertyData.unit_map_file_path) {
      return true; // No file to delete
    }

    // Delete the file from storage
    const { error: storageError } = await supabase.storage
      .from('files')
      .remove([propertyData.unit_map_file_path]);

    if (storageError) {
      console.error('Storage deletion error:', storageError);
      return false;
    }

    // Delete the file record from the database
    const { error: dbError } = await supabase
      .from('files')
      .delete()
      .eq('id', propertyData.unit_map_file_id);

    if (dbError) {
      console.error('Database deletion error:', dbError);
      return false;
    }

    // Clear the property references
    const { error: updateError } = await supabase
      .from('properties')
      .update({
        unit_map_file_id: null,
        unit_map_file_path: null
      })
      .eq('id', propertyId);

    if (updateError) {
      console.error('Property update error:', updateError);
      return false;
    }

    return true;

  } catch (error) {
    console.error('Delete unit map error:', error);
    return false;
  }
}

/**
 * Get the public URL for a property unit map
 * @param filePath - The file path in storage
 * @returns string - The public URL
 */
export function getUnitMapPublicUrl(filePath: string): string {
  const { data } = supabase.storage
    .from('files')
    .getPublicUrl(filePath);
  
  return data.publicUrl;
}

/**
 * Get unit map file information for a property
 * @param propertyId - The property ID
 * @returns Promise<any> - File information
 */
export async function getPropertyUnitMapInfo(propertyId: string) {
  try {
    const { data, error } = await supabase.rpc(
      'get_property_unit_map_info',
      { p_property_id: propertyId }
    );

    if (error) {
      console.error('Error fetching unit map info:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getPropertyUnitMapInfo:', error);
    return null;
  }
}
