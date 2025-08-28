import { supabase } from '../../utils/supabase';

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
    // Validate file type
    if (!file.type.startsWith('image/')) {
      return {
        success: false,
        error: 'Only image files are allowed for unit maps'
      };
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return {
        success: false,
        error: 'File size must be less than 10MB'
      };
    }

    // Create the file path in the property assets folder
    const fileName = `unit-map-${Date.now()}-${file.name}`;
    const filePath = `Property Assets/${propertyName}/${fileName}`;

    // Upload file to Supabase storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('files')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return {
        success: false,
        error: `Upload failed: ${uploadError.message}`
      };
    }

    // Get the public URL for the uploaded file
    const { data: urlData } = supabase.storage
      .from('files')
      .getPublicUrl(filePath);

    // Create file record in the database using the custom function
    const { data: fileRecord, error: dbError } = await supabase.rpc(
      'handle_unit_map_upload',
      {
        p_property_id: propertyId,
        p_file_name: file.name,
        p_file_path: filePath,
        p_file_size: file.size,
        p_file_type: file.type,
        p_uploaded_by: (await supabase.auth.getUser()).data.user?.id
      }
    );

    if (dbError) {
      console.error('Database error:', dbError);
      // If database insert fails, delete the uploaded file
      await supabase.storage.from('files').remove([filePath]);
      return {
        success: false,
        error: `Database error: ${dbError.message}`
      };
    }

    return {
      success: true,
      fileId: fileRecord,
      filePath: filePath
    };

  } catch (error) {
    console.error('File upload error:', error);
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
