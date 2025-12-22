import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { supabase } from '../utils/supabase';
import { saveAs } from 'file-saver';

/**
 * Normalize a storage path so it is safe for Supabase:
 * - strips any leading slash
 * - collapses duplicate slashes
 * - ensures the filename is present at the end when provided
 */
export const normalizeStoragePath = (storagePath: string, fileName?: string): string => {
  const cleaned = (storagePath || '').replace(/^\/+/, '').replace(/\/+/g, '/').replace(/\/$/, '');
  if (!fileName) return cleaned;

  const normalizedFileName = fileName.trim();
  if (!cleaned) return normalizedFileName;

  // If the path already ends with a file-looking segment, treat it as a complete key
  const segments = cleaned.split('/');
  const lastSegment = segments[segments.length - 1];
  if (lastSegment.includes('.')) {
    return cleaned;
  }

  // If the path already contains the filename anywhere (common when the path has a timestamped prefix),
  // avoid appending it again to prevent ".../foo.docx/foo.docx".
  if (cleaned.toLowerCase().includes(normalizedFileName.toLowerCase())) {
    return cleaned;
  }

  const lastSegmentNormalized = cleaned.split('/').slice(-1)[0];
  if (lastSegmentNormalized === normalizedFileName) {
    return cleaned;
  }

  return `${cleaned}/${normalizedFileName}`;
};

/**
 * Save a spreadsheet workbook back to Supabase storage
 * Supports both ExcelJS and XLSX workbooks, and handles CSV files correctly
 */
export const saveSpreadsheetToStorage = async (
  content: ExcelJS.Workbook | XLSX.WorkBook | Blob,
  fileId: string,
  fileName: string,
  storagePath: string
): Promise<void> => {
  try {
    // Validate inputs
    if (!content) {
      throw new Error('Content is required');
    }
    if (!fileId || !fileName || !storagePath) {
      throw new Error('File ID, name, and storage path are required');
    }

    const normalizedPath = normalizeStoragePath(storagePath, fileName);
    const isCsv = fileName.toLowerCase().endsWith('.csv');

    console.log('📤 Saving spreadsheet:', { fileId, fileName, storagePath: normalizedPath, isCsv });

    let blob: Blob;
    let contentType: string;

    if (content instanceof Blob) {
      // Direct Blob handling (Used for CSVs from PapaParse)
      console.log('💾 Using provided Blob for save');
      blob = content;
      contentType = content.type || (isCsv ? 'text/csv' : 'application/octet-stream');
    } else {
      // Legacy/ExcelJS Workbook handling
      const workbook = content as ExcelJS.Workbook | XLSX.WorkBook;
      
      if (isCsv) {
        // ... (This path should be less used now for CSVs, but kept as fallback)
        console.log('💾 Saving as CSV format (Workbook fallback)');
        contentType = 'text/csv';
        
        if ('xlsx' in workbook && typeof (workbook as ExcelJS.Workbook).csv.writeBuffer === 'function') {
          const buffer = await (workbook as ExcelJS.Workbook).csv.writeBuffer();
          blob = new Blob([buffer], { type: contentType });
        } else {
          const csvContent = XLSX.utils.sheet_to_csv((workbook as XLSX.WorkBook).Sheets[(workbook as XLSX.WorkBook).SheetNames[0]]);
          blob = new Blob([csvContent], { type: contentType });
        }
      } else {
        // Save as Excel (XLSX)
        console.log('💾 Saving as XLSX format');
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        
        let excelBuffer: ArrayBuffer;
        if ('xlsx' in workbook && typeof (workbook as ExcelJS.Workbook).xlsx.writeBuffer === 'function') {
          console.log('💾 Using ExcelJS to save with formatting');
          excelBuffer = await (workbook as ExcelJS.Workbook).xlsx.writeBuffer();
        } else {
          console.log('💾 Using XLSX library to save (no formatting)');
          excelBuffer = XLSX.write(workbook as XLSX.WorkBook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
        }
        
        blob = new Blob([excelBuffer], { type: contentType });
      }
    }

    console.log('💾 Upload size:', blob.size, 'bytes');
    console.log('💾 Storage path:', normalizedPath);

    // Upload to Supabase Storage - use upload with upsert to replace existing file
    console.log('⏳ Initiating Supabase upload...');
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('files')
      .upload(normalizedPath, blob, {
        cacheControl: 'no-cache',
        upsert: true,
        contentType: contentType
      });
    
    console.log('✅ Supabase upload returned:', { uploadData, uploadError });

    if (uploadError) {
      console.error('❌ Upload error:', uploadError);
      console.error('❌ Upload error details:', JSON.stringify(uploadError, null, 2));
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    console.log('✅ File uploaded to storage:', uploadData);

    // Only attempt to update the database if we have a valid fileId (UUID)
    // If it's a new file (might not have ID yet depending on flow), we might need to handle differently
    // But typically this service is called with an existing ID.
    
    // Check if the file record exists before trying to update
    console.log('⏳ Checking file record in DB...');
    const { data: existingFile, error: checkError } = await supabase
      .from('files')
      .select('id')
      .eq('id', fileId)
      .single();
    console.log('✅ File check returned:', { existingFile, checkError });
      
    if (checkError || !existingFile) {
       console.warn('⚠️ File record not found in database, creating new record...');
       // If the file doesn't exist in the DB, insert it instead of updating
       const { error: insertError } = await supabase
        .from('files')
        .insert({
          id: fileId, // Use the provided ID if possible, or let DB generate if it's not a UUID
          name: fileName,
          path: normalizedPath,
          type: contentType,
          size: blob.size,
          updated_at: new Date().toISOString()
        });
        
       if (insertError) {
         console.error('❌ Database insert error:', insertError);
         throw new Error(`Database insert failed: ${insertError.message}`);
       }
    } else {
        // Update file metadata with new updated_at timestamp
        console.log('⏳ Updating file metadata in DB...');
        const { error: updateError } = await supabase
          .from('files')
          .update({
            path: normalizedPath,
            type: contentType,
            updated_at: new Date().toISOString(),
            size: blob.size
          })
          .eq('id', fileId);
        console.log('✅ Database update returned:', { updateError });

        if (updateError) {
          console.error('❌ Database update error (non-fatal):', updateError);
          console.warn('⚠️ Spreadsheet content saved but metadata update failed. Continuing...');
          // Do not throw here, as the content is safe.
        }
    }

    console.log('✅ Spreadsheet saved successfully at:', new Date().toISOString());
  } catch (error) {
    console.error('❌ Error saving spreadsheet:', error);
    throw error instanceof Error ? error : new Error('Failed to save spreadsheet to storage');
  }
};

/**
 * Save document content back to Supabase storage
 * Supports HTML, TXT, and DOCX formats
 */
export const saveDocumentToStorage = async (
  content: string | Blob | Buffer,
  fileId: string,
  fileName: string,
  storagePath: string,
  mimeType: string = 'text/html'
): Promise<void> => {
  try {
    // Validate inputs
    if (content === null || content === undefined) {
      throw new Error('Content is required');
    }
    if (!fileId || !fileName || !storagePath) {
      throw new Error('File ID, name, and storage path are required');
    }

    const normalizedPath = normalizeStoragePath(storagePath, fileName);

    console.log('📤 Saving document:', { fileId, fileName, storagePath: normalizedPath, mimeType });

    let blob: Blob;
    
    if (content instanceof Blob) {
      blob = content;
    } else if (Buffer.isBuffer(content)) {
      blob = new Blob([content as unknown as BlobPart], { type: mimeType });
    } else {
      // String content (HTML or TXT)
      if (mimeType === 'text/html' && typeof content === 'string' && !content.trim().toLowerCase().startsWith('<!doctype')) {
         // Wrap HTML fragment if it's not a full document
         const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${fileName}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.6; }
  </style>
</head>
<body>
  ${content}
</body>
</html>`;
         blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
      } else {
         blob = new Blob([content as string], { type: mimeType });
      }
    }

    console.log('💾 Upload size:', blob.size, 'bytes');
    console.log('💾 Storage path:', normalizedPath);

    // Upload to Supabase Storage - use upload with upsert to replace existing file
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('files')
      .upload(normalizedPath, blob, {
        cacheControl: 'no-cache',
        upsert: true,
        contentType: mimeType
      });

    if (uploadError) {
      console.error('❌ Upload error:', uploadError);
      console.error('❌ Upload error details:', JSON.stringify(uploadError, null, 2));
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    console.log('✅ File uploaded to storage:', uploadData);

    // Check if the file record exists before trying to update
    const { data: existingFile, error: checkError } = await supabase
      .from('files')
      .select('id')
      .eq('id', fileId)
      .single();
      
    if (checkError || !existingFile) {
       console.warn('⚠️ File record not found in database (Document), creating new record...');
       const { error: insertError } = await supabase
        .from('files')
        .insert({
          id: fileId,
          name: fileName,
          path: normalizedPath,
          type: mimeType,
          size: blob.size,
          updated_at: new Date().toISOString()
        });
        
       if (insertError) {
         console.error('❌ Database insert error:', insertError);
         throw new Error(`Database insert failed: ${insertError.message}`);
       }
    } else {
        // Update file metadata
        const { error: updateError } = await supabase
          .from('files')
          .update({
            path: normalizedPath,
            type: mimeType,
            updated_at: new Date().toISOString(),
            size: blob.size
          })
          .eq('id', fileId);

        if (updateError) {
          console.error('❌ Database update error (non-fatal):', updateError);
          console.warn('⚠️ File content saved but metadata update failed. Continuing...');
          // Do not throw here, as the content is safe.
        }
    }

    console.log('✅ Document saved successfully at:', new Date().toISOString());
  } catch (error) {
    console.error('❌ Error saving document:', error);
    throw error instanceof Error ? error : new Error('Failed to save document to storage');
  }
};

/**
 * Export spreadsheet data to CSV format
 */
export const exportSpreadsheetToCSV = (
  data: any[][],
  headers: string[],
  fileName: string
): void => {
  const csvData = [headers, ...data];
  const csv = csvData.map(row => 
    row.map(cell => {
      // Handle cells with commas or quotes
      const cellStr = String(cell || '');
      if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
        return `"${cellStr.replace(/"/g, '""')}"`;
      }
      return cellStr;
    }).join(',')
  ).join('\n');
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, fileName.replace(/\.[^/.]+$/, '.csv'));
};

/**
 * Get file extension from filename
 */
export const getFileExtension = (filename: string): string => {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
};

/**
 * Check if file is a spreadsheet
 */
export const isSpreadsheet = (filename: string, mimeType?: string): boolean => {
  const ext = getFileExtension(filename);
  const spreadsheetExtensions = ['xlsx', 'xls', 'csv', 'tsv', 'ods'];
  const spreadsheetMimeTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'text/tab-separated-values',
    'application/vnd.oasis.opendocument.spreadsheet'
  ];
  
  return spreadsheetExtensions.includes(ext) || 
         (mimeType ? spreadsheetMimeTypes.includes(mimeType) : false);
};

/**
 * Check if file is a document
 */
export const isDocument = (filename: string, mimeType?: string): boolean => {
  const ext = getFileExtension(filename);
  const documentExtensions = ['docx', 'doc', 'txt', 'rtf', 'odt', 'md', 'pages', 'html', 'htm'];
  const documentMimeTypes = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain',
    'application/rtf',
    'application/vnd.oasis.opendocument.text',
    'text/markdown',
    'application/x-iwork-pages-sffpages', // Pages format
    'application/vnd.apple.pages',
    'text/html'
  ];
  
  return documentExtensions.includes(ext) || 
         (mimeType ? documentMimeTypes.includes(mimeType) : false);
};

/**
 * Check if file is a PDF
 */
export const isPDF = (filename: string, mimeType?: string): boolean => {
  const ext = getFileExtension(filename);
  return ext === 'pdf' || mimeType === 'application/pdf';
};
