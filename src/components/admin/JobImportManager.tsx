import React, { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';
import { parse, isValid, format } from 'date-fns';
import { Upload, FileText, Download, AlertCircle, CheckCircle, X, Loader2 } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthProvider';

interface CSVRow {
  'Property Name': string;
  'Unit Number': string;
  'Unit Size': string;
  'Job Type': string;
  'Scheduled Date': string;
  'Description'?: string;
  'Job Category'?: string;
}

interface ValidationResult {
  row: number;
  data: CSVRow;
  isValid: boolean;
  errors: string[];
  parsedData?: {
    property_id: string;
    unit_size_id: string;
    job_type_id: string;
    job_category_id: string | null;
    scheduled_date: string;
  };
}

interface ReferenceData {
  properties: Record<string, string>; // name -> id
  unitSizes: Record<string, string>; // label -> id
  jobTypes: Record<string, string>; // label -> id
  jobCategories: Record<string, string>; // name -> id
}

export function JobImportManager() {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [step, setStep] = useState<'upload' | 'review' | 'processing'>('upload');
  const [loadingRefs, setLoadingRefs] = useState(true);
  const [referenceData, setReferenceData] = useState<ReferenceData>({
    properties: {},
    unitSizes: {},
    jobTypes: {},
    jobCategories: {}
  });

  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch reference data on mount
  useEffect(() => {
    const fetchRefs = async () => {
      try {
        const [props, units, types, cats] = await Promise.all([
          supabase.from('properties').select('id, property_name').eq('is_archived', false),
          supabase.from('unit_sizes').select('id, unit_size_label'),
          supabase.from('job_types').select('id, job_type_label'),
          supabase.from('job_categories').select('id, name')
        ]);

        const refs: ReferenceData = {
          properties: {},
          unitSizes: {},
          jobTypes: {},
          jobCategories: {}
        };

        props.data?.forEach(p => refs.properties[p.property_name.toLowerCase()] = p.id);
        units.data?.forEach(u => refs.unitSizes[u.unit_size_label.toLowerCase()] = u.id);
        types.data?.forEach(t => refs.jobTypes[t.job_type_label.toLowerCase()] = t.id);
        cats.data?.forEach(c => refs.jobCategories[c.name.toLowerCase()] = c.id);

        setReferenceData(refs);
      } catch (error) {
        console.error('Error fetching reference data:', error);
        toast.error('Failed to load reference data');
      } finally {
        setLoadingRefs(false);
      }
    };

    fetchRefs();
  }, []);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0];
    if (selectedFile) {
      if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
        toast.error('Please upload a valid CSV file');
        return;
      }
      setFile(selectedFile);
      parseFile(selectedFile);
    }
  }, [referenceData]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv']
    },
    maxFiles: 1
  });

  const parseFile = (file: File) => {
    Papa.parse<CSVRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        validateRows(results.data);
      },
      error: (error) => {
        toast.error(`Error parsing CSV: ${error.message}`);
      }
    });
  };

  const validateRows = (rows: CSVRow[]) => {
    const results: ValidationResult[] = rows.map((row, index) => {
      const errors: string[] = [];
      const data = { ...row };
      
      // Trim all string values
      Object.keys(data).forEach(key => {
        if (typeof data[key as keyof CSVRow] === 'string') {
          (data as any)[key] = (data[key as keyof CSVRow] as string).trim();
        }
      });

      // Validate Property
      const propertyId = referenceData.properties[data['Property Name']?.toLowerCase()];
      if (!propertyId) errors.push(`Property "${data['Property Name']}" not found`);

      // Validate Unit Number
      if (!data['Unit Number']) errors.push('Unit Number is required');

      // Validate Unit Size
      const unitSizeId = referenceData.unitSizes[data['Unit Size']?.toLowerCase()];
      if (!unitSizeId) errors.push(`Unit Size "${data['Unit Size']}" not found`);

      // Validate Job Type
      const jobTypeId = referenceData.jobTypes[data['Job Type']?.toLowerCase()];
      if (!jobTypeId) errors.push(`Job Type "${data['Job Type']}" not found`);

      // Validate Job Category (Optional)
      let jobCategoryId: string | null = null;
      if (data['Job Category']) {
        jobCategoryId = referenceData.jobCategories[data['Job Category']?.toLowerCase()] || null;
        if (!jobCategoryId) errors.push(`Job Category "${data['Job Category']}" not found`);
      }

      // Validate Date (Support multiple formats)
      let scheduledDate = '';
      let displayDate = '';
      
      if (!data['Scheduled Date']) {
        errors.push('Scheduled Date is required');
      } else {
        const dateStr = data['Scheduled Date'].trim();
        const formatsToTry = [
          'MM-dd-yyyy',
          'MM/dd/yyyy',
          'M/d/yyyy',
          'M-d-yyyy',
          'yyyy-MM-dd',
          'MM.dd.yyyy',
          'M.d.yyyy',
          'MM/dd/yy',
          'MM-dd-yy',
          'M/d/yy',
          'M-d-yy'
        ];
        
        let parsedDate: Date | null = null;
        
        for (const fmt of formatsToTry) {
          const d = parse(dateStr, fmt, new Date());
          if (isValid(d)) {
            // Sanity check for year (ensure it parsed into a reasonable 4-digit year)
            const year = d.getFullYear();
            if (year > 2000 && year < 2100) {
               parsedDate = d;
               break;
            }
          }
        }

        if (parsedDate && isValid(parsedDate)) {
          scheduledDate = format(parsedDate, 'yyyy-MM-dd');
          displayDate = format(parsedDate, 'MMM d, yyyy');
        } else {
          errors.push(`Invalid date format "${data['Scheduled Date']}". Please use MM/DD/YYYY (e.g. 12/25/2025)`);
        }
      }

      return {
        row: index + 1,
        data,
        isValid: errors.length === 0,
        errors,
        parsedData: errors.length === 0 ? {
          property_id: propertyId,
          unit_size_id: unitSizeId,
          job_type_id: jobTypeId,
          job_category_id: jobCategoryId,
          scheduled_date: scheduledDate,
          display_date: displayDate
        } : undefined
      };
    });

    setValidationResults(results);
  };

  const downloadTemplate = () => {
    const headers = ['Property Name', 'Unit Number', 'Job Category', 'Job Type', 'Unit Size', 'Scheduled Date', 'Description'];
    const example = ['511 Queens', '101', 'Regular Paint', 'Paint', '1 Bedroom', '12-25-2025', 'optional'];
    const csvContent = [headers.join(','), example.join(',')].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'job_import_template.csv';
    link.click();
  };

  const ensureBulkImportsFolder = async () => {
    // Check if folder exists
    const { data: folders, error: searchError } = await supabase
      .from('files')
      .select('id')
      .eq('name', 'Bulk Imports')
      .eq('type', 'folder/directory')
      .is('folder_id', null) // Root folder
      .single();

    if (folders) return folders.id;

    if (searchError && searchError.code !== 'PGRST116') {
      console.error('Error searching for folder:', searchError);
      throw new Error('Failed to check for Bulk Imports folder');
    }

    // Create folder if not found
    const { data: newFolder, error: createError } = await supabase
      .from('files')
      .insert({
        name: 'Bulk Imports',
        type: 'folder/directory',
        path: 'Bulk_Imports',
        size: 0,
        uploaded_by: user?.id
      })
      .select()
      .single();

    if (createError) throw createError;
    return newFolder.id;
  };

  const saveFileToStorage = async (folderId: string) => {
    if (!file || !user) return;

    const timestamp = Date.now();
    const storagePath = `Bulk_Imports/${timestamp}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    // Upload to Storage
    const { error: uploadError } = await supabase.storage
      .from('files')
      .upload(storagePath, file);

    if (uploadError) throw uploadError;

    // Create File Record
    const { error: dbError } = await supabase
      .from('files')
      .insert({
        name: file.name,
        type: file.type || 'text/csv',
        size: file.size,
        path: storagePath,
        folder_id: folderId,
        uploaded_by: user.id
      });

    if (dbError) throw dbError;
  };

  const handleReview = () => {
    setStep('review');
  };

  const handleImport = async () => {
    const validRows = validationResults.filter(r => r.isValid);
    if (validRows.length === 0) {
      toast.error('No valid rows to import');
      return;
    }

    setIsProcessing(true);
    let successCount = 0;
    let failureCount = 0;

    try {
      // 1. Save File
      const folderId = await ensureBulkImportsFolder();
      await saveFileToStorage(folderId);

      // 2. Process Jobs
      // We process sequentially to avoid overwhelming the DB connection
      for (const result of validRows) {
        if (!result.parsedData) continue;

        const { data: jobId, error } = await supabase.rpc('create_job', {
          p_property_id: result.parsedData.property_id,
          p_unit_number: result.data['Unit Number'],
          p_unit_size_id: result.parsedData.unit_size_id,
          p_job_type_id: result.parsedData.job_type_id,
          p_description: result.data['Description'] || '',
          p_scheduled_date: result.parsedData.scheduled_date,
          p_job_category_id: result.parsedData.job_category_id,
          p_purchase_order: (result.data['Purchase Order'] as string | undefined)?.trim() || null
        });

        if (error) {
          console.error(`Error importing row ${result.row}:`, error);
          failureCount++;
        } else {
          successCount++;
        }
      }

      toast.success(`Import complete: ${successCount} created, ${failureCount} failed`);
      
      // Reset
      setFile(null);
      setValidationResults([]);

    } catch (error) {
      console.error('Import process failed:', error);
      toast.error('Import process failed. Check console for details.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (loadingRefs) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">Bulk Job Schedule</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Upload a CSV file to create multiple job requests at once.
          </p>
        </div>
        <button
          onClick={downloadTemplate}
          className="flex items-center px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30 transition-colors"
        >
          <Download className="w-4 h-4 mr-2" />
          Download Template
        </button>
      </div>

      {step === 'upload' && (
        <>
          {!file ? (
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors
                ${isDragActive 
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                  : 'border-gray-300 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500'
                }`}
            >
              <input {...getInputProps()} />
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-lg font-medium text-gray-900 dark:text-white mb-1">
                Drop your CSV file here
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                or click to select a file
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                All imported jobs will be set as new Job Request jobs
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#1E293B] rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded">
                    <FileText className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{file.name}</p>
                    <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setFile(null);
                    setValidationResults([]);
                  }}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full text-gray-500"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="max-h-96 overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Row</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Property</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-[#1E293B] divide-y divide-gray-200 dark:divide-gray-700">
                    {validationResults.map((result) => (
                      <tr key={result.row} className={!result.isValid ? 'bg-red-50 dark:bg-red-900/10' : ''}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{result.row}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{result.data['Property Name']}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{result.data['Unit Number']}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{result.data['Job Type']}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{result.data['Scheduled Date']}</td>
                        <td className="px-6 py-4 text-sm">
                          {result.isValid ? (
                            <span className="flex items-center text-green-600 dark:text-green-400">
                              <CheckCircle className="w-4 h-4 mr-1.5" />
                              Valid
                            </span>
                          ) : (
                            <div className="text-red-600 dark:text-red-400">
                              <div className="flex items-center font-medium mb-1">
                                <AlertCircle className="w-4 h-4 mr-1.5" />
                                Invalid
                              </div>
                              <ul className="list-disc list-inside text-xs space-y-1 pl-1">
                                {result.errors.map((err, i) => (
                                  <li key={i}>{err}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <div className="text-sm text-gray-500">
                  {validationResults.filter(r => r.isValid).length} valid rows ready to import
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      setFile(null);
                      setValidationResults([]);
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReview}
                    disabled={validationResults.filter(r => r.isValid).length === 0}
                    className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Review {validationResults.filter(r => r.isValid).length} Jobs
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {(step === 'review' || step === 'processing') && (
        <div className="bg-white dark:bg-[#1E293B] rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Review Jobs to Import</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Please review the list below. These jobs will be created in the system.
            </p>
          </div>

          <div className="max-h-[600px] overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Property</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Size</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-[#1E293B] divide-y divide-gray-200 dark:divide-gray-700">
                {validationResults.filter(r => r.isValid).map((result, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white font-medium">
                      {result.data['Property Name']}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {result.data['Unit Number']}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {result.data['Unit Size']}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {result.data['Job Type']}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {(result.parsedData as any)?.display_date}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
                      {result.data['Description'] || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <div className="text-sm text-gray-500">
              Total: {validationResults.filter(r => r.isValid).length} new jobs
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => setStep('upload')}
                disabled={step === 'processing'}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                Back
              </button>
              <button
                onClick={handleImport}
                disabled={step === 'processing'}
                className="flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {step === 'processing' ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Confirm & Import
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
