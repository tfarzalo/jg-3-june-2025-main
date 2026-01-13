import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import * as ExcelJS from 'exceljs';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.min.css';
import { 
  Save, 
  Download, 
  X, 
  FileDown, 
  Plus, 
  Trash2, 
  Bold, 
  Italic, 
  Underline,
  Type,
  Palette,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Edit2,
  Check
} from 'lucide-react';
import { saveAs } from 'file-saver';
import Papa from 'papaparse';

// Register Handsontable modules
registerAllModules();
console.log('📦 Handsontable modules registered');

// Add CSS for text formatting
const formattingStyles = `
  .htBold { font-weight: bold !important; }
  .htItalic { font-style: italic !important; }
  .htUnderline { text-decoration: underline !important; }
  .htLeft { text-align: left !important; }
  .htCenter { text-align: center !important; }
  .htRight { text-align: right !important; }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleEl = document.createElement('style');
  styleEl.innerHTML = formattingStyles;
  if (!document.head.querySelector('[data-ht-formatting-styles]')) {
    styleEl.setAttribute('data-ht-formatting-styles', 'true');
    document.head.appendChild(styleEl);
  }
}

interface SpreadsheetEditorProps {
  fileUrl: string;
  fileName: string;
  onSave: (data: ExcelJS.Workbook | XLSX.WorkBook | Blob, newFileName?: string) => Promise<void>;
  onClose: () => void;
  onChangesDetected?: (hasChanges: boolean) => void;
  onRename?: (newName: string) => Promise<void>;
}

export const SpreadsheetEditor: React.FC<SpreadsheetEditorProps> = ({
  fileUrl,
  fileName,
  onSave,
  onClose,
  onChangesDetected,
  onRename
}) => {
  console.log('🟢 SpreadsheetEditor mounted with:', { fileUrl, fileName });
  const [data, setData] = useState<any[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  // Replaced simple 'saving' boolean with explicit status for better UI control
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [hasChanges, setHasChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workbook, setWorkbook] = useState<ExcelJS.Workbook | null>(null);
  const [activeSheet, setActiveSheet] = useState(0);
  const [sheets, setSheets] = useState<string[]>([]);
  const [isExcelFile, setIsExcelFile] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [fontSizeMenuOpen, setFontSizeMenuOpen] = useState(false);
  const [selectedFontSize, setSelectedFontSize] = useState(11);
  const [isRenamingFile, setIsRenamingFile] = useState(false);
  const [editedFileName, setEditedFileName] = useState(fileName);
  const [cellMetadata, setCellMetadata] = useState<Map<string, any>>(new Map());
  const [currentSelection, setCurrentSelection] = useState<number[][] | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState('#ffff00');
  const [fontColorPickerOpen, setFontColorPickerOpen] = useState(false);
  const [selectedFontColor, setSelectedFontColor] = useState('#000000');
  const [editingHeaderIndex, setEditingHeaderIndex] = useState<number | null>(null);
  const [editingHeaderValue, setEditingHeaderValue] = useState<string>('');
  const [editingHeaderType, setEditingHeaderType] = useState<'col' | 'row' | null>(null);

  const hotTableRef = useRef<any>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const fontSizeMenuRef = useRef<HTMLDivElement>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const fontColorPickerRef = useRef<HTMLDivElement>(null);
  const fileNameInputRef = useRef<HTMLInputElement>(null);
  const lastFileUrlRef = useRef<string>('');
  const isMountedRef = useRef(true);
  // Track timestamps for robust save handling
  const lastChangeRef = useRef<number>(0);
  const saveStartRef = useRef<number>(0);

  useEffect(() => {
    // Reload when fileUrl changes or on mount
    if (fileUrl !== lastFileUrlRef.current) {
      console.log('📂 File URL changed, reloading spreadsheet:', fileUrl);
      lastFileUrlRef.current = fileUrl;
      loadSpreadsheet();
    }
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      isMountedRef.current = false;
    };
  }, [fileUrl]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setExportMenuOpen(false);
      }
      if (fontSizeMenuRef.current && !fontSizeMenuRef.current.contains(event.target as Node)) {
        setFontSizeMenuOpen(false);
      }
      if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
        setColorPickerOpen(false);
      }
      if (fontColorPickerRef.current && !fontColorPickerRef.current.contains(event.target as Node)) {
        setFontColorPickerOpen(false);
      }
    };

    if (exportMenuOpen || fontSizeMenuOpen || colorPickerOpen || fontColorPickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [exportMenuOpen, fontSizeMenuOpen, colorPickerOpen, fontColorPickerOpen]);

  useEffect(() => {
    // When hasChanges becomes true, reset saved status to idle
    if (hasChanges && saveStatus === 'saved') {
      setSaveStatus('idle');
    }
  }, [hasChanges, saveStatus]);

  useEffect(() => {
    if (hasChanges && saveStatus !== 'saving') {
      // Auto-save after 30 seconds of inactivity
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      autoSaveTimerRef.current = setTimeout(() => {
        handleSave();
      }, 30000);
    }
    // Cleanup on unmount or when dependencies change
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasChanges, saveStatus]);

  // Keep editable filename in sync with parent updates (e.g., after rename)
  useEffect(() => {
    setEditedFileName(fileName);
  }, [fileName]);

  // Note: Header editing will be handled via a custom approach
  // Handsontable doesn't directly support double-click on headers,
  // so we'll add an overlay UI for header editing

  const loadSpreadsheet = async () => {
    try {
      console.log('📊 Starting to load spreadsheet:', fileName);
      setLoading(true);
      setError(null);

      // Add cache-busting parameter to URL
      const cacheBustUrl = fileUrl.includes('?') 
        ? `${fileUrl}&_t=${Date.now()}` 
        : `${fileUrl}?_t=${Date.now()}`;
      
      console.log('🌐 Fetching file from URL (with cache-bust):', cacheBustUrl);
      const response = await fetch(cacheBustUrl, {
        cache: 'no-store', // Prevent caching
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      console.log('✅ Fetch response status:', response.status, response.statusText);
      
      // Get the file as array buffer first to check magic bytes
      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Check if file is actually an Excel file (PK header = ZIP archive)
      const isPKZip = uint8Array[0] === 0x50 && uint8Array[1] === 0x4B;
      const isExcel = isPKZip || fileName.toLowerCase().match(/\.(xlsx|xls)$/);
      
      // Check if it's a CSV file (and not actually Excel with wrong extension)
      if (fileName.toLowerCase().endsWith('.csv') && !isPKZip) {
        console.log('📝 Detected CSV file, using PapaParse');
        setIsExcelFile(false);
        const text = new TextDecoder().decode(arrayBuffer);
        console.log('📄 CSV text length:', text.length, 'characters');
        
        // Parse CSV using PapaParse with auto-detection
        Papa.parse(text, {
          delimiter: '', // Auto-detect
          skipEmptyLines: true,
          complete: (results) => {
            console.log('✅ CSV Parse complete:', results.data.length, 'rows');
            console.log('🔍 First row detected columns:', Array.isArray(results.data[0]) ? results.data[0].length : 0);
            if (results.data && results.data.length > 0) {
              const allData = results.data as any[][];
              
              // Check if first row looks like headers
              const firstRow = allData[0];
              const hasHeaders = firstRow.every((cell: any) => 
                typeof cell === 'string' && cell.trim().length > 0
              );
              
              let worksheetData: any[][];
              let headerRow: string[];
              let dataRows: any[][];
              
              if (hasHeaders && allData.length > 1) {
                headerRow = firstRow.map(String);
                // Filter out duplicate header rows from data
                dataRows = allData.slice(1).filter(row => {
                  if (!Array.isArray(row)) return true;
                  // Check if row matches header row
                  const isHeaderDuplicate = row.length === headerRow.length && 
                    row.every((cell, index) => String(cell).trim() === headerRow[index].trim());
                  return !isHeaderDuplicate;
                });
                // Workbook should include headers
                worksheetData = [headerRow, ...dataRows];
                console.log('✅ Headers detected:', headerRow.length, 'columns');
                console.log('📊 Data rows (after deduplication):', dataRows.length);
              } else {
                // No headers, create default column headers
                const colCount = Math.max(...allData.map(row => row.length));
                headerRow = Array.from({ length: colCount }, (_, i) => 
                  String.fromCharCode(65 + i)
                );
                dataRows = allData;
                // Workbook uses actual data
                worksheetData = allData;
                console.log('✅ Using default headers:', headerRow.length, 'columns');
                console.log('📊 Data rows:', dataRows.length);
              }
              
              // Set state AFTER we've determined the values
              setHeaders(headerRow);
              setData(dataRows.length > 0 ? dataRows : [Array(headerRow.length).fill('')]);
              
              // Create ExcelJS workbook for CSV (so we can add formatting)
              const wb = new ExcelJS.Workbook();
              const ws = wb.addWorksheet('Sheet1');
              
              // Add headers
              ws.addRow(headerRow);
              // Add data rows
              dataRows.forEach(row => ws.addRow(row));
              
              setWorkbook(wb);
              setSheets(['Sheet1']);
              setActiveSheet(0);
              
              console.log('✅ ExcelJS Workbook created successfully for CSV');
              console.log('📋 Setting state - Headers:', headerRow.length, 'Data rows:', dataRows.length);
              setLoading(false);
            } else {
              // Empty CSV - create default workbook
              console.log('⚠️ Empty CSV detected, creating default grid');
              const defaultHeaders = ['A', 'B', 'C', 'D', 'E'];
              const defaultData = Array(20).fill(null).map(() => Array(5).fill(''));
              setHeaders(defaultHeaders);
              setData(defaultData);
              
              // Create ExcelJS workbook for empty CSV
              const wb = new ExcelJS.Workbook();
              const ws = wb.addWorksheet('Sheet1');
              ws.addRow(defaultHeaders);
              defaultData.forEach(row => ws.addRow(row));
              
              setWorkbook(wb);
              setSheets(['Sheet1']);
              setActiveSheet(0);
              console.log('✅ Default ExcelJS workbook created for empty CSV');
              setLoading(false);
            }
          },
          error: (error) => {
            console.error('CSV parsing error:', error);
            setError('Failed to parse CSV file.');
            setLoading(false);
          }
        });
      } else if (isExcel) {
        // Handle Excel files using ExcelJS to preserve formatting
        console.log('📗 Detected Excel file (isExcel:', isExcel, 'isPKZip:', isPKZip, ')');
        console.log('📄 Excel buffer size:', arrayBuffer.byteLength, 'bytes');
        setIsExcelFile(true);
        
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(arrayBuffer);
        console.log('✅ Excel parsed successfully with ExcelJS');
        console.log('📊 Sheets found:', wb.worksheets.length, wb.worksheets.map(ws => ws.name));
        
        setWorkbook(wb);
        setSheets(wb.worksheets.map(ws => ws.name));
        
        // Load first sheet by default with formatting
        loadExcelJSSheet(wb, 0);
        
        setLoading(false);
        console.log('✅ Spreadsheet loading complete');
      } else {
        // Unknown file type
        console.error('❌ Unknown file type:', fileName);
        setError('Unsupported file type. Please upload a CSV or Excel file.');
        setLoading(false);
      }
    } catch (err) {
      console.error('❌ Error loading spreadsheet:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to load spreadsheet: ${errorMessage}`);
      setLoading(false);
    }
  };

  const loadExcelJSSheet = (wb: ExcelJS.Workbook, sheetIndex: number) => {
    if (!wb || !wb.worksheets || sheetIndex >= wb.worksheets.length) {
      console.error('Invalid ExcelJS workbook or sheet index');
      return;
    }
    
    const worksheet = wb.worksheets[sheetIndex];
    console.log('Loading ExcelJS sheet:', worksheet.name);
    
    // Extract data and formatting
    const dataRows: any[][] = [];
    const metadataMap = new Map<string, any>();
    let headerRow: string[] = [];
    let maxCols = 0;
    
    worksheet.eachRow((row, rowNumber) => {
      const rowData: any[] = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        // Get cell value
        const value = cell.value !== null && cell.value !== undefined ? String(cell.value) : '';
        rowData.push(value);
        
        // Extract formatting
        const metadata = extractExcelJSFormatting(cell);
        if (metadata.className || Object.keys(metadata.style).length > 0) {
          const cellKey = `${rowNumber - 2}-${colNumber - 1}`; // Adjust for 0-based indexing and header row
          metadataMap.set(cellKey, metadata);
        }
        
        maxCols = Math.max(maxCols, colNumber);
      });
      
      if (rowNumber === 1) {
        // First row as headers
        headerRow = rowData;
      } else {
        // Data rows
        dataRows.push(rowData);
      }
    });
    
    // If no data, create empty grid
    if (headerRow.length === 0) {
      headerRow = Array.from({ length: 5 }, (_, i) => String.fromCharCode(65 + i));
    }
    if (dataRows.length === 0) {
      dataRows.push(Array(headerRow.length).fill(''));
    }
    
    console.log('✅ Loaded ExcelJS sheet:', worksheet.name);
    console.log('📋 Headers:', headerRow.length, 'columns');
    console.log('📊 Data rows:', dataRows.length);
    console.log('🎨 Formatting metadata entries:', metadataMap.size);
    
    setHeaders(headerRow);
    setData(dataRows);
    setCellMetadata(metadataMap);
    setActiveSheet(sheetIndex);
    
    // Apply formatting to Handsontable after it renders
    setTimeout(() => {
      const hotInstance = hotTableRef.current?.hotInstance;
      if (hotInstance && metadataMap.size > 0) {
        metadataMap.forEach((metadata, cellKey) => {
          const [row, col] = cellKey.split('-').map(Number);
          if (metadata.className) {
            hotInstance.setCellMeta(row, col, 'className', metadata.className);
          }
          if (metadata.style && Object.keys(metadata.style).length > 0) {
            hotInstance.setCellMeta(row, col, 'style', metadata.style);
          }
        });
        hotInstance.render();
        console.log('✅ Applied formatting to Handsontable cells');
      }
    }, 100);
  };

  const loadSheet = (wb: XLSX.WorkBook, sheetIndex: number) => {
    if (!wb || !wb.SheetNames || sheetIndex >= wb.SheetNames.length) {
      console.error('Invalid workbook or sheet index');
      return;
    }
    
    const sheetName = wb.SheetNames[sheetIndex];
    const worksheet = wb.Sheets[sheetName];
    
    // Convert sheet to 2D array
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    
    console.log('Loading sheet:', sheetName);
    console.log('Raw data rows:', jsonData.length);
    
    if (jsonData.length > 0) {
      // First row as headers
      const firstRow = jsonData[0] as any[];
      const hasValidHeaders = firstRow.some((cell: any) => cell !== null && cell !== '');
      
      if (hasValidHeaders) {
        const headers = firstRow.map((cell: any) => String(cell || ''));
        const rows = jsonData.slice(1) as any[][];
        
        console.log('Headers:', headers);
        console.log('Data rows:', rows.length);
        
        setHeaders(headers);
        setData(rows.length > 0 ? rows : [Array(headers.length).fill('')]);
      } else {
        // No clear headers, use all data and create default headers
        const maxCols = Math.max(...jsonData.map((row: any) => row.length));
        const defaultHeaders = Array.from({ length: maxCols }, (_, i) => 
          String.fromCharCode(65 + i)
        );
        
        console.log('Using default headers:', defaultHeaders);
        console.log('Data rows:', jsonData.length);
        
        setHeaders(defaultHeaders);
        setData(jsonData as any[][]);
      }
    } else {
      // Empty sheet - create default grid
      console.log('Empty sheet, creating default grid');
      setHeaders(['A', 'B', 'C', 'D', 'E']);
      setData(Array(20).fill(null).map(() => Array(5).fill('')));
    }
    
    setActiveSheet(sheetIndex);
  };

  const handleSheetChange = (sheetIndex: number) => {
    if (workbook) {
      if (isExcelFile) {
        loadExcelJSSheet(workbook, sheetIndex);
      } else {
        // For CSV files created as ExcelJS workbooks
        loadExcelJSSheet(workbook, sheetIndex);
      }
      setHasChanges(false);
    }
  };

  const markDirty = () => {
    setHasChanges(true);
    onChangesDetected?.(true);
    lastChangeRef.current = Date.now();
  };

  const handleDataChange = (changes: any, source: string) => {
    console.log('🔔 afterChange fired - changes:', changes, 'source:', source);

    // Ignore changes from initial load or external updates
    if (!changes || source === 'loadData' || source === 'updateData') {
      console.log('⏭️ Ignoring change from source:', source);
      return;
    }

    // Only track user edits
    if (source === 'edit' || source === 'CopyPaste.paste' || source === 'Autofill.fill' || source === 'UndoRedo.undo' || source === 'UndoRedo.redo') {
      console.log('📝 User edit detected:', changes);
      markDirty();

      // Optimization: We DO NOT update the React 'data' state on every edit.
      // This causes massive re-renders. We let Handsontable manage its internal state,
      // and we only read it back when Saving or Switching Sheets.
      console.log('✅ Changes marked dirty (skipping full state update for performance)');
    }
  };

  // Track when user is actively editing a cell
  const handleBeforeChange = (changes: any, source: string) => {
    if (source === 'edit' && changes && changes.length > 0) {
      console.log('✏️ Cell edit in progress, enabling save');
      markDirty();
    }
  };

  // Metadata management for structural changes
  const shiftMetadata = (
    action: 'insert_row' | 'remove_row' | 'insert_col' | 'remove_col',
    index: number,
    amount: number
  ) => {
    setCellMetadata(prev => {
      const newMeta = new Map();
      prev.forEach((value, key) => {
        let [r, c] = key.split('-').map(Number);
        let shouldKeep = true;
        let newR = r;
        let newC = c;

        if (action === 'insert_row') {
          if (r >= index) newR = r + amount;
        } else if (action === 'remove_row') {
          if (r >= index && r < index + amount) shouldKeep = false; // Deleted range
          if (r >= index + amount) newR = r - amount; // Shift up
        } else if (action === 'insert_col') {
          if (c >= index) newC = c + amount;
        } else if (action === 'remove_col') {
          if (c >= index && c < index + amount) shouldKeep = false;
          if (c >= index + amount) newC = c - amount;
        }

        if (shouldKeep) {
          newMeta.set(`${newR}-${newC}`, value);
        }
      });
      return newMeta;
    });
  };

  const handleAfterCreateRow = (index: number, amount: number) => {
    console.log(`➕ Rows inserted at ${index}, amount: ${amount}`);
    shiftMetadata('insert_row', index, amount);
    markDirty();
  };

  const handleAfterRemoveRow = (index: number, amount: number) => {
    console.log(`➖ Rows removed at ${index}, amount: ${amount}`);
    shiftMetadata('remove_row', index, amount);
    markDirty();
  };

  const handleAfterCreateCol = (index: number, amount: number) => {
    console.log(`➕ Columns inserted at ${index}, amount: ${amount}`);
    shiftMetadata('insert_col', index, amount);
    markDirty();
  };

  const handleAfterRemoveCol = (index: number, amount: number) => {
    console.log(`➖ Columns removed at ${index}, amount: ${amount}`);
    shiftMetadata('remove_col', index, amount);
    markDirty();
  };

  // Helper for safe timeout wrapper
  const withTimeout = async <T,>(promise: Promise<T>, ms: number, label = "Save"): Promise<T> => {
    let id: NodeJS.Timeout | undefined;
    
    const timeout = new Promise<never>((_, reject) => {
      id = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    });

    try {
      return await Promise.race([promise, timeout]);
    } finally {
      if (id !== undefined) clearTimeout(id);
    }
  };

  const handleSave = async () => {
    if (saveStatus === 'saving') return;

    if (!workbook) {
      console.error('❌ Cannot save: workbook is null');
      return;
    }
    if (!hasChanges) {
      console.log('⚠️ No changes to save');
      return;
    }

    try {
      console.log('🚀 Starting save process with ExcelJS...');
      setSaveStatus('saving');
      saveStartRef.current = Date.now();
      setError(null);

      // Get current data from Handsontable
      const hotInstance = hotTableRef.current?.hotInstance;
      if (!hotInstance) {
        throw new Error('HotTable instance not available');
      }

      // getData() returns only the data rows (no headers)
      const currentData = hotInstance.getData();
      
      console.log('💾 Saving spreadsheet - Current data rows:', currentData.length);
      console.log('💾 Headers:', headers.length, headers);
      console.log('💾 Sheet name:', sheets[activeSheet]);
      
      const sheetName = sheets[activeSheet];
      
      // Determine if we should save as CSV directly (Blob) or ExcelJS Workbook
      let isCsv = fileName.toLowerCase().endsWith('.csv');
      let currentFileName = fileName;
      
      // Auto-Upgrade: If CSV has formatting, switch to XLSX
      if (isCsv && cellMetadata.size > 0) {
        console.log('✨ Formatting detected in CSV. Upgrading to XLSX to preserve styles.');
        isCsv = false;
        currentFileName = fileName.replace(/\.csv$/i, '.xlsx');
        
        // Notify user via console (could add UI toast later)
        console.log(`📝 File will be saved as: ${currentFileName}`);
      }
      
      let savePromise: Promise<void>;
      
      if (isCsv) {
        console.log('💾 Saving as CSV (Direct Blob Strategy)...');
        
        // Use PapaParse to generate the CSV string directly from the data
        // This ensures 100% fidelity with what the user sees
        
        // Combine headers and data
        const csvData = [headers, ...currentData];
        
        const csvString = Papa.unparse(csvData, {
          quotes: true, // Force quotes to be safe
          quoteChar: '"',
          escapeChar: '"',
          delimiter: ",",
          header: false,
          newline: "\r\n",
        });
        
        console.log('✅ Generated CSV string, length:', csvString.length);
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        
        console.log('⏳ Calling onSave callback with Blob...');
        savePromise = onSave(blob);
      } else {
        // ExcelJS Strategy for .xlsx
        
        // Find and remove existing worksheet
        const existingSheet = workbook.getWorksheet(sheetName);
        if (existingSheet) {
          console.log(`💾 Removing existing worksheet '${sheetName}' to ensure clean save`);
          workbook.removeWorksheet(existingSheet.id);
        }
        
        // Create fresh worksheet
        const worksheet = workbook.addWorksheet(sheetName);
        console.log(`✨ Created fresh worksheet '${sheetName}'`);
        
        // Add headers as the first row
        const headerRow = worksheet.addRow(headers);
        headerRow.font = { bold: true };
        
        // Add data rows and apply formatting
        let cellsWithFormatting = 0;
        currentData.forEach((rowData: any[], rowIndex: number) => {
          const excelRow = worksheet.addRow(rowData);
          
          // Apply cell formatting from metadata
          rowData.forEach((_, colIndex) => {
            const cellKey = `${rowIndex}-${colIndex}`;
            const metadata = cellMetadata.get(cellKey);
            
            if (metadata) {
              const cell = excelRow.getCell(colIndex + 1);
              applyExcelJSFormatting(cell, metadata);
              cellsWithFormatting++;
            }
          });
        });
        
        console.log('💾 ExcelJS worksheet updated with', currentData.length, 'data rows + 1 header row');
        console.log('🎨 Applied formatting to', cellsWithFormatting, 'cells');
        console.log('⏳ Calling onSave callback with Workbook...');
        
        // Pass the potentially new filename (if upgraded from CSV)
        savePromise = onSave(workbook, currentFileName !== fileName ? currentFileName : undefined);
      }

      // Execute save with timeout wrapper
      await withTimeout(savePromise, 30000, "Save operation");
      console.log('✅ onSave callback completed successfully');

      // Unconditionally set success state - we let React handle unmounted component warnings
      // if they happen, because skipping the state update leaves the UI in a broken "Saving..." state.
      console.log('🏁 Success block reached');
      
      // 1. Mark clean
      setHasChanges(false);
      if (onChangesDetected) {
        onChangesDetected(false);
      }
      
      // 2. Reset tracking refs to prevent immediate dirtying
      lastChangeRef.current = Date.now(); // Sync last change to now so previous edits are "old"
      
      // 3. Update saved timestamp
      setLastSavedAt(new Date());
      
      // 4. Explicitly set status to 'saved'
      console.log('✅ Setting saveStatus => saved');
      setSaveStatus('saved');

      // 5. Optional: Schedule return to idle
      setTimeout(() => {
        if (saveStatus === 'saved') {
          setSaveStatus('idle');
        }
      }, 2000);

      console.log('✅ Save completed successfully at', new Date().toLocaleTimeString());
    } catch (err) {
      console.error('❌ Error in handleSave:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('❌ Error details:', errorMessage);
      setError(`Failed to save spreadsheet: ${errorMessage}`);
      setSaveStatus('error');
    } finally {
      // Safety net: If we are STILL in 'saving' state (e.g. error happened but wasn't caught right), force idle
      // But if we are 'saved', leave it be.
      setSaveStatus(prev => {
        if (prev === 'saving') {
            console.log('⚠️ Finally block: Found stuck "saving" state, forcing "idle"');
            return 'idle';
        }
        return prev;
      });
    }
  };

  const handleExportCSV = () => {
    const hotInstance = hotTableRef.current?.hotInstance;
    if (!hotInstance) return;

    const currentData = hotInstance.getData();
    const csvData = [headers, ...currentData];
    const csv = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, fileName.replace(/\.[^/.]+$/, '.csv'));
    setExportMenuOpen(false);
  };

  const handleExportExcel = async () => {
    if (!workbook) return;

    const hotInstance = hotTableRef.current?.hotInstance;
    if (hotInstance) {
      const currentData = hotInstance.getData();
      
      // Get or create the worksheet
      const worksheet = workbook.worksheets[activeSheet] || workbook.addWorksheet(sheets[activeSheet]);
      
      // Clear ALL existing rows to prevent duplication
      if (worksheet.rowCount > 0) {
        worksheet.spliceRows(1, worksheet.rowCount);
      }
      
      // Add headers as the first row
      const headerRow = worksheet.addRow(headers);
      headerRow.font = { bold: true };
      
      // Add data rows and apply formatting
      currentData.forEach((rowData, rowIndex) => {
        const excelRow = worksheet.addRow(rowData);
        
        // Apply cell formatting from metadata
        rowData.forEach((cellValue, colIndex) => {
          const cellKey = `${rowIndex}-${colIndex}`;
          const metadata = cellMetadata.get(cellKey);
          
          if (metadata) {
            const cell = excelRow.getCell(colIndex + 1);
            applyExcelJSFormatting(cell, metadata);
          }
        });
      });
    }

    // Export with ExcelJS
    const excelBuffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([excelBuffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    const exportName = fileName.replace(/\.[^/.]+$/, '.xlsx');
    saveAs(blob, exportName);
    setExportMenuOpen(false);
  };

  const handleExportPDF = async () => {
    const hotInstance = hotTableRef.current?.hotInstance;
    if (!hotInstance) return;

    try {
      console.log('📄 Starting PDF export...');
      
      // Import jsPDF and autotable together
      const { default: jsPDF } = await import('jspdf');
      await import('jspdf-autotable'); // This extends the jsPDF prototype
      
      console.log('✅ Modules loaded');

      const currentData = hotInstance.getData();
      console.log('📊 Data to export:', currentData.length, 'rows');
      
      // Create jsPDF instance - autoTable is now available on the prototype
      const doc = new jsPDF({ 
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });
      
      console.log('📝 jsPDF instance created');
      console.log('autoTable exists?', typeof (doc as any).autoTable);
      
      // Add title
      doc.setFontSize(16);
      doc.text(fileName, 14, 15);
      
      // Use autoTable - it's now available after importing jspdf-autotable
      if (typeof (doc as any).autoTable === 'function') {
        console.log('✅ autoTable function found, generating table...');
        (doc as any).autoTable({
          head: [headers],
          body: currentData,
          startY: 25,
          styles: { 
            fontSize: 7, 
            cellPadding: 1.5 
          },
          headStyles: { 
            fillColor: [37, 99, 235],
            textColor: 255,
            fontStyle: 'bold'
          },
          alternateRowStyles: { 
            fillColor: [245, 245, 245] 
          },
          margin: { left: 10, right: 10 }
        });
        console.log('✅ Table generated successfully');
      } else {
        console.error('❌ autoTable function not found - trying alternative approach');
        // Alternative: Simple text export if autoTable fails
        let yPos = 30;
        doc.setFontSize(10);
        
        // Export headers
        doc.text(headers.join(' | '), 14, yPos);
        yPos += 7;
        
        // Export data (limited rows to avoid overflow)
        currentData.slice(0, 30).forEach(row => {
          const rowText = row.map(cell => String(cell || '')).join(' | ');
          doc.text(rowText.substring(0, 100), 14, yPos); // Limit text length
          yPos += 5;
        });
      }
      
      // Save the PDF
      const pdfFileName = fileName.replace(/\.[^/.]+$/, '.pdf');
      doc.save(pdfFileName);
      console.log('✅ PDF saved:', pdfFileName);
      
      setExportMenuOpen(false);
    } catch (error) {
      console.error('❌ Error exporting to PDF:', error);
      console.error('Error details:', {
        name: (error as any).name,
        message: (error as any).message,
        stack: (error as any).stack
      });
      alert('Failed to export PDF. Please try CSV or Excel export instead.');
    }
  };

  const handleAddRow = () => {
    const hotInstance = hotTableRef.current?.hotInstance;
    if (!hotInstance) {
      console.error('❌ HotTable instance not available');
      return;
    }
    
    const selected = getSelectionOrHighlighted(hotInstance);
    
    if (selected && selected.length > 0) {
      // Insert row below the selected row
      const [row] = selected[0];
      hotInstance.alter('insert_row_below', row);
      console.log('✅ Row added below row:', row);
    } else {
      // No selection, add at end
      const rowCount = hotInstance.countRows();
      hotInstance.alter('insert_row_below', rowCount);
      console.log('✅ Row added at end (no selection)');
    }
    
    markDirty();
  };

  const handleAddColumn = () => {
    const hotInstance = hotTableRef.current?.hotInstance;
    if (!hotInstance) {
      console.error('❌ HotTable instance not available');
      return;
    }
    
    const selected = getSelectionOrHighlighted(hotInstance);
    
    if (selected && selected.length > 0) {
      // Insert column after the selected column
      const [, col] = selected[0];
      hotInstance.alter('insert_col_start', col + 1);
      console.log('✅ Column added after column:', col);
    } else {
      // No selection, add at end
      const colCount = hotInstance.countCols();
      hotInstance.alter('insert_col_end', colCount);
      console.log('✅ Column added at end (no selection)');
    }
    
    markDirty();
  };

  // Helper function to get current selection or fallback to highlighted cell
  const getSelectionOrHighlighted = (hotInstance: any) => {
    console.log('🔍 Getting selection...');
    console.log('currentSelection state:', currentSelection);
    
    // First, check our tracked selection state
    if (currentSelection && currentSelection.length > 0) {
      console.log('✅ Using tracked currentSelection');
      return currentSelection;
    }
    
    // Try getSelected first
    let selected = hotInstance.getSelected();
    console.log('getSelected():', selected);
    if (selected && selected.length > 0) {
      console.log('✅ Using getSelected()');
      return selected;
    }
    
    // Try getSelectedLast
    const selectedLast = hotInstance.getSelectedLast();
    console.log('getSelectedLast():', selectedLast);
    if (selectedLast && Array.isArray(selectedLast) && selectedLast.length === 4) {
      console.log('✅ Using getSelectedLast()');
      return [selectedLast];
    }
    
    // Try getSelectedRange
    try {
      const selectedRange = hotInstance.getSelectedRange();
      console.log('getSelectedRange():', selectedRange);
      if (selectedRange && selectedRange.length > 0) {
        const range = selectedRange[0];
        if (range && range.from && range.to) {
          console.log('✅ Using getSelectedRange()');
          return [[range.from.row, range.from.col, range.to.row, range.to.col]];
        }
      }
    } catch (e) {
      console.warn('getSelectedRange() failed:', e);
    }
    
    // Try getSelectedRangeLast
    try {
      const selectedCell = hotInstance.getSelectedRangeLast();
      console.log('getSelectedRangeLast():', selectedCell);
      if (selectedCell && selectedCell.from && selectedCell.to) {
        console.log('✅ Using getSelectedRangeLast()');
        return [[selectedCell.from.row, selectedCell.from.col, selectedCell.to.row, selectedCell.to.col]];
      }
    } catch (e) {
      console.warn('getSelectedRangeLast() failed:', e);
    }
    
    console.error('❌ No selection found');
    return null;
  };

  // Track selection changes - with deduplication to prevent infinite loops
  const handleAfterSelection = (row: number, col: number, row2: number, col2: number) => {
    console.log('📍 Selection changed:', { row, col, row2, col2 });
    
    // Only update if selection actually changed to prevent infinite re-render loop
    setCurrentSelection(prev => {
      const newSelection = [[row, col, row2, col2]];
      
      // Check if selection is the same as previous
      if (prev && prev.length > 0 && prev[0]) {
        const [prevRow, prevCol, prevRow2, prevCol2] = prev[0];
        if (prevRow === row && prevCol === col && prevRow2 === row2 && prevCol2 === col2) {
          console.log('✅ Selection unchanged, skipping update');
          return prev; // Return previous state to prevent re-render
        }
      }
      
      console.log('✅ Selection updated');
      return newSelection;
    });
  };

  const handleDeleteRow = () => {
    const hotInstance = hotTableRef.current?.hotInstance;
    if (!hotInstance) {
      console.error('❌ HotTable instance not available');
      return;
    }
    
    const selected = getSelectionOrHighlighted(hotInstance);
    
    if (!selected || selected.length === 0) {
      alert('Please click on a cell in the row you want to delete');
      console.warn('⚠️ No cell selected for row deletion');
      return;
    }
    
    const [row] = selected[0];
    console.log('🗑️ Deleting row:', row);
    hotInstance.alter('remove_row', row, 1);
    console.log('✅ Row deleted');
    markDirty();
  };

  const handleDeleteColumn = () => {
    const hotInstance = hotTableRef.current?.hotInstance;
    if (!hotInstance) {
      console.error('❌ HotTable instance not available');
      return;
    }
    
    const selected = getSelectionOrHighlighted(hotInstance);
    
    if (!selected || selected.length === 0) {
      alert('Please click on a cell in the column you want to delete');
      console.warn('⚠️ No cell selected for column deletion');
      return;
    }
    
    const [, col] = selected[0];
    console.log('🗑️ Deleting column:', col);
    hotInstance.alter('remove_col', col, 1);
    console.log('✅ Column deleted');
    markDirty();
  };

  // Text formatting functions
  const applyFormatting = (style: string, value?: any) => {
    const hotInstance = hotTableRef.current?.hotInstance;
    if (!hotInstance) {
      console.error('❌ HotTable instance not available');
      return;
    }

    const selected = getSelectionOrHighlighted(hotInstance);
    
    if (!selected || selected.length === 0) {
      alert('Please click on a cell to format');
      console.warn('⚠️ No cells selected for formatting');
      return;
    }

    const [startRow, startCol, endRow, endCol] = selected[0];
    console.log(`🎨 Applying ${style} to cells: [${startRow},${startCol}] to [${endRow},${endCol}]`);
    
    // Update cell metadata
    const newMetadata = new Map(cellMetadata);
    
    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        const cellKey = `${row}-${col}`;
        const currentMeta = newMetadata.get(cellKey) || { className: '', style: {} };
        let newClassName = currentMeta.className || '';

        switch (style) {
          case 'bold':
            newClassName = currentMeta.className?.includes('htBold') 
              ? currentMeta.className.replace('htBold', '').trim()
              : `${currentMeta.className || ''} htBold`.trim();
            break;
          case 'italic':
            newClassName = currentMeta.className?.includes('htItalic')
              ? currentMeta.className.replace('htItalic', '').trim()
              : `${currentMeta.className || ''} htItalic`.trim();
            break;
          case 'underline':
            newClassName = currentMeta.className?.includes('htUnderline')
              ? currentMeta.className.replace('htUnderline', '').trim()
              : `${currentMeta.className || ''} htUnderline`.trim();
            break;
          case 'align-left':
            newClassName = (currentMeta.className || '').replace(/htLeft|htCenter|htRight/g, '').trim();
            newClassName = `${newClassName} htLeft`.trim();
            break;
          case 'align-center':
            newClassName = (currentMeta.className || '').replace(/htLeft|htCenter|htRight/g, '').trim();
            newClassName = `${newClassName} htCenter`.trim();
            break;
          case 'align-right':
            newClassName = (currentMeta.className || '').replace(/htLeft|htCenter|htRight/g, '').trim();
            newClassName = `${newClassName} htRight`.trim();
            break;
        }

        newMetadata.set(cellKey, { ...currentMeta, className: newClassName });
        hotInstance.setCellMeta(row, col, 'className', newClassName);
      }
    }

    setCellMetadata(newMetadata);
    hotInstance.render();
    console.log(`✅ ${style} applied successfully`);
    markDirty();
  };

  const handleBold = () => applyFormatting('bold');
  const handleItalic = () => applyFormatting('italic');
  const handleUnderline = () => applyFormatting('underline');
  const handleAlignLeft = () => applyFormatting('align-left');
  const handleAlignCenter = () => applyFormatting('align-center');
  const handleAlignRight = () => applyFormatting('align-right');

  const handleFontSize = (size: number) => {
    const hotInstance = hotTableRef.current?.hotInstance;
    if (!hotInstance) return;

    const selected = getSelectionOrHighlighted(hotInstance);
    
    if (!selected || selected.length === 0) {
      alert('Please click on a cell to change font size');
      return;
    }

    const [startRow, startCol, endRow, endCol] = selected[0];
    const newMetadata = new Map(cellMetadata);
    
    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        const cellKey = `${row}-${col}`;
        const currentMeta = newMetadata.get(cellKey) || { className: '', style: {} };
        
        // Update style with precise font size
        const newStyle = { ...currentMeta.style, fontSize: `${size}pt` };
        
        newMetadata.set(cellKey, { ...currentMeta, style: newStyle });
        hotInstance.setCellMeta(row, col, 'style', newStyle);
      }
    }

    setCellMetadata(newMetadata);
    setSelectedFontSize(size);
    setFontSizeMenuOpen(false);
    hotInstance.render();
    markDirty();
  };

  const handleCellColor = (color?: string) => {
    const hotInstance = hotTableRef.current?.hotInstance;
    if (!hotInstance) {
      console.error('❌ HotTable instance not available');
      return;
    }

    const selected = getSelectionOrHighlighted(hotInstance);
    
    if (!selected || selected.length === 0) {
      alert('Please click on a cell to color');
      console.warn('⚠️ No cells selected for coloring');
      return;
    }

    const colorToUse = color || selectedColor;
    const [startRow, startCol, endRow, endCol] = selected[0];
    const newMetadata = new Map(cellMetadata);
    
    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        const cellKey = `${row}-${col}`;
        const currentMeta = newMetadata.get(cellKey) || { className: '', style: {} };
        const newStyle = { ...currentMeta.style, backgroundColor: colorToUse };
        
        newMetadata.set(cellKey, { ...currentMeta, style: newStyle });
        hotInstance.setCellMeta(row, col, 'style', newStyle);
      }
    }

    setCellMetadata(newMetadata);
    hotInstance.render();
    console.log('✅ Cell color applied:', colorToUse);
    markDirty();
    setColorPickerOpen(false);
  };

  const handleFontColor = (color?: string) => {
    const hotInstance = hotTableRef.current?.hotInstance;
    if (!hotInstance) {
      console.error('❌ HotTable instance not available');
      return;
    }

    const selected = getSelectionOrHighlighted(hotInstance);

    if (!selected || selected.length === 0) {
      alert('Please click on a cell to change font color');
      console.warn('⚠️ No cells selected for font coloring');
      return;
    }

    const colorToUse = color || selectedFontColor;
    const [startRow, startCol, endRow, endCol] = selected[0];
    const newMetadata = new Map(cellMetadata);

    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        const cellKey = `${row}-${col}`;
        const currentMeta = newMetadata.get(cellKey) || { className: '', style: {} };
        const newStyle = { ...currentMeta.style, color: colorToUse };

        newMetadata.set(cellKey, { ...currentMeta, style: newStyle });
        hotInstance.setCellMeta(row, col, 'style', newStyle);
      }
    }

    setCellMetadata(newMetadata);
    hotInstance.render();
    console.log('✅ Font color applied:', colorToUse);
    markDirty();
    setFontColorPickerOpen(false);
  };

  // Filename rename handlers
  const handleFileNameClick = () => {
    if (onRename) {
      setIsRenamingFile(true);
      setEditedFileName(fileName);
      // Focus the input after state updates
      setTimeout(() => fileNameInputRef.current?.select(), 0);
    }
  };

  const handleFileNameSave = async () => {
    if (!editedFileName.trim() || editedFileName === fileName) {
      setIsRenamingFile(false);
      setEditedFileName(fileName);
      return;
    }

    const trimmed = editedFileName.trim();
    
    // Validation: No spaces
    if (/\s/.test(trimmed)) {
      alert('File names cannot contain spaces');
      setEditedFileName(fileName); // Revert
      return;
    }

    // Validation: Extension must match
    const oldExt = fileName.split('.').pop()?.toLowerCase();
    const newExt = trimmed.split('.').pop()?.toLowerCase();
    if (oldExt && oldExt !== newExt) {
      alert(`Cannot change file extension from .${oldExt} to .${newExt}`);
      setEditedFileName(fileName); // Revert
      return;
    }

    try {
      if (onRename) {
        await onRename(trimmed);
        console.log('✅ File renamed to:', trimmed);
      }
      setIsRenamingFile(false);
    } catch (error) {
      console.error('❌ Error renaming file:', error);
      alert('Failed to rename file. Please try again.');
      setEditedFileName(fileName);
      setIsRenamingFile(false);
    }
  };

  const handleFileNameCancel = () => {
    setIsRenamingFile(false);
    setEditedFileName(fileName);
  };

  const handleFileNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleFileNameSave();
    } else if (e.key === 'Escape') {
      handleFileNameCancel();
    }
  };

  // Column/Row Header Editing Handlers
  const handleHeaderDoubleClick = (index: number, type: 'col' | 'row') => {
    console.log(`🖱️ Double-clicked ${type} header at index:`, index);
    setEditingHeaderIndex(index);
    setEditingHeaderType(type);
    if (type === 'col') {
      setEditingHeaderValue(headers[index] || '');
    } else {
      // Row headers are just numbers, but we can allow custom labels
      setEditingHeaderValue(String(index + 1));
    }
  };

  const handleHeaderSave = () => {
    if (editingHeaderIndex === null || editingHeaderType === null) return;
    
    if (editingHeaderType === 'col') {
      const newHeaders = [...headers];
      newHeaders[editingHeaderIndex] = editingHeaderValue.trim() || `Column ${editingHeaderIndex + 1}`;
      setHeaders(newHeaders);
      setHasChanges(true);
      console.log('✅ Column header updated:', newHeaders[editingHeaderIndex]);
      
      // Force Handsontable to re-render with new headers
      const hotInstance = hotTableRef.current?.hotInstance;
      if (hotInstance) {
        hotInstance.updateSettings({ colHeaders: newHeaders });
        console.log('✅ Handsontable headers updated');
      }
    } else {
      // For row headers, we could store custom row labels if needed
      // For now, just log and close
      console.log('ℹ️ Row header editing attempted (row headers are typically just numbers)');
    }
    
    setEditingHeaderIndex(null);
    setEditingHeaderType(null);
    setEditingHeaderValue('');
  };

  const handleHeaderCancel = () => {
    setEditingHeaderIndex(null);
    setEditingHeaderType(null);
    setEditingHeaderValue('');
  };

  const handleHeaderKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleHeaderSave();
    } else if (e.key === 'Escape') {
      handleHeaderCancel();
    }
  };

  // Helper: Convert Handsontable cell metadata to ExcelJS format
  const applyExcelJSFormatting = (cell: ExcelJS.Cell, metadata: any) => {
    if (!metadata) return;

    const font: Partial<ExcelJS.Font> = {};
    const alignment: Partial<ExcelJS.Alignment> = {};
    const fill: ExcelJS.Fill = { type: 'pattern', pattern: 'none' };
    
    // Font styles from className
    if (metadata.className) {
      if (metadata.className.includes('htBold')) font.bold = true;
      if (metadata.className.includes('htItalic')) font.italic = true;
      if (metadata.className.includes('htUnderline')) font.underline = true;
      
      // Alignment
      if (metadata.className.includes('htLeft')) alignment.horizontal = 'left';
      if (metadata.className.includes('htCenter')) alignment.horizontal = 'center';
      if (metadata.className.includes('htRight')) alignment.horizontal = 'right';
    }
    
    // Inline styles
    if (metadata.style) {
      // Font color
      if (metadata.style.color) {
        const colorHex = metadata.style.color.replace('#', '');
        font.color = { argb: 'FF' + colorHex.toUpperCase() };
      }
      
      // Font size
      if (metadata.style.fontSize) {
        const size = parseInt(metadata.style.fontSize);
        if (!isNaN(size)) font.size = size;
      }
      
      // Background color
      if (metadata.style.backgroundColor) {
        const bgColor = metadata.style.backgroundColor.replace('#', '');
        fill.type = 'pattern';
        fill.pattern = 'solid';
        (fill as any).fgColor = { argb: 'FF' + bgColor.toUpperCase() };
      }
    }
    
    // Apply to cell
    if (Object.keys(font).length > 0) cell.font = font;
    if (Object.keys(alignment).length > 0) cell.alignment = alignment;
    if (fill.pattern !== 'none') cell.fill = fill;
  };

  // Helper: Extract formatting from ExcelJS cell and convert to Handsontable metadata
  const extractExcelJSFormatting = (cell: ExcelJS.Cell) => {
    const className: string[] = [];
    const style: any = {};
    
    if (cell.font) {
      if (cell.font.bold) className.push('htBold');
      if (cell.font.italic) className.push('htItalic');
      if (cell.font.underline) className.push('htUnderline');
      if (cell.font.color && (cell.font.color as any).argb) {
        const argb = (cell.font.color as any).argb as string;
        style.color = '#' + argb.slice(2); // Remove alpha channel
      }
      if (cell.font.size) {
        style.fontSize = cell.font.size + 'pt';
      }
    }
    
    if (cell.alignment) {
      if (cell.alignment.horizontal === 'left') className.push('htLeft');
      if (cell.alignment.horizontal === 'center') className.push('htCenter');
      if (cell.alignment.horizontal === 'right') className.push('htRight');
    }
    
    if (cell.fill && cell.fill.type === 'pattern' && (cell.fill as any).fgColor) {
      const argb = (cell.fill as any).fgColor.argb as string;
      style.backgroundColor = '#' + argb.slice(2);
    }
    
    return {
      className: className.join(' '),
      style
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading spreadsheet...</p>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-500">{fileName}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <p className="text-red-600 dark:text-red-400 font-semibold mb-2">{error}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            File: {fileName}
          </p>
          <div className="flex justify-center space-x-3">
            <button
              onClick={() => {
                setError(null);
                loadSpreadsheet();
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Try Again
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Debug: Log current state before rendering
  console.log('🎨 Rendering SpreadsheetEditor - Headers:', headers.length, 'Data rows:', data.length, 'Loading:', loading, 'SaveStatus:', saveStatus, 'HasChanges:', hasChanges);
  console.log('🔍 Data check:', data && data.length > 0 ? 'Data exists' : 'No data');
  console.log('🔍 Headers check:', headers.length > 0 ? `${headers.length} headers` : 'No headers');

  return (
    <div className="flex flex-col h-full overflow-hidden rounded-xl shadow-2xl bg-white dark:bg-gray-900">
      {/* File Name Header - Now includes X button */}
      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center justify-between">
        <div className="flex items-center flex-1 min-w-0">
          <span className="text-lg mr-2">📊</span>
          {isRenamingFile ? (
            <div className="flex items-center space-x-2 max-w-md">
              <input
                ref={fileNameInputRef}
                type="text"
                value={editedFileName}
                onChange={(e) => setEditedFileName(e.target.value)}
                onKeyDown={handleFileNameKeyDown}
                onBlur={handleFileNameSave}
                className="w-full px-2 py-1 text-lg font-semibold bg-white dark:bg-gray-700 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 dark:text-gray-200"
                autoFocus
              />
              <button
                onClick={handleFileNameSave}
                className="p-1 text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                title="Save name"
              >
                <Check className="h-5 w-5" />
              </button>
              <button
                onClick={handleFileNameCancel}
                className="p-1 text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                title="Cancel"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleFileNameClick}
              disabled={!onRename}
              className={`flex items-center space-x-2 flex-1 text-left group ${
                onRename ? 'hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer' : 'cursor-default'
              } rounded px-2 py-1 transition-colors min-w-0`}
              title={onRename ? 'Click to rename file' : ''}
            >
              <span className="text-lg font-semibold text-gray-800 dark:text-gray-200 truncate">
                {fileName}
              </span>
              {onRename && (
                <Edit2 className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              )}
            </button>
          )}
        </div>
        
        <button
          onClick={onClose}
          className="p-2 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex-shrink-0 ml-2"
          title="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 flex-shrink-0">
        <div className="flex items-center space-x-3 flex-wrap gap-y-2">{/* Added flex-wrap and gap for better mobile/overflow handling */}
          <button
              onClick={() => {
                console.log('🖱️ Save button clicked! hasChanges:', hasChanges, 'saveStatus:', saveStatus);
                handleSave();
              }}
              disabled={!hasChanges || saveStatus === 'saving'}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                hasChanges && saveStatus !== 'saving'
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              }`}
            >
              {saveStatus === 'saving' ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500 dark:border-gray-400"></div>
              ) : hasChanges ? (
                <Save className="h-4 w-4" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              <span>{saveStatus === 'saving' ? 'Saving...' : (hasChanges ? 'Save' : 'Saved')}</span>
            </button>
          
          <div className="relative" ref={exportMenuRef}>
            <button 
              onClick={() => {
                console.log('🖱️ Export button clicked, current state:', exportMenuOpen);
                setExportMenuOpen(!exportMenuOpen);
              }}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium shadow-md transition-all"
            >
              <Download className="h-4 w-4" />
              <span>Export</span>
            </button>
            {exportMenuOpen && (
              <div className="absolute left-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border-2 border-gray-300 dark:border-gray-600 z-[9999] overflow-hidden">
                <button
                  onClick={handleExportCSV}
                  className="w-full text-left px-4 py-3 hover:bg-green-50 dark:hover:bg-gray-700 text-sm font-medium rounded-t-lg flex items-center space-x-3 border-b border-gray-200 dark:border-gray-700"
                >
                  <FileDown className="h-5 w-5 text-green-600" />
                  <div>
                    <div className="font-semibold">Export as CSV</div>
                    <div className="text-xs text-gray-500">Compatible with Excel</div>
                  </div>
                </button>
                <button
                  onClick={handleExportExcel}
                  className="w-full text-left px-4 py-3 hover:bg-blue-50 dark:hover:bg-gray-700 text-sm font-medium flex items-center space-x-3 border-b border-gray-200 dark:border-gray-700"
                >
                  <FileDown className="h-5 w-5 text-blue-600" />
                  <div>
                    <div className="font-semibold">Export as Excel</div>
                    <div className="text-xs text-gray-500">.xlsx format</div>
                  </div>
                </button>
                <button
                  onClick={handleExportPDF}
                  className="w-full text-left px-4 py-3 hover:bg-red-50 dark:hover:bg-gray-700 text-sm font-medium rounded-b-lg flex items-center space-x-3"
                >
                  <FileDown className="h-5 w-5 text-red-600" />
                  <div>
                    <div className="font-semibold">Export as PDF</div>
                    <div className="text-xs text-gray-500">Printable format</div>
                  </div>
                </button>
              </div>
            )}
          </div>
          
          {/* Formatting/Tools Separator */}
          <div className="h-8 w-px bg-gray-300 dark:bg-gray-600"></div>
          
          {/* Row/Column Tools */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handleAddRow}
              className="flex items-center space-x-1 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm font-medium shadow-sm transition-all"
              title="Add Row"
            >
              <Plus className="h-4 w-4" />
              <span>Row</span>
            </button>
            <button
              onClick={handleAddColumn}
              className="flex items-center space-x-1 px-3 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 text-sm font-medium shadow-sm transition-all"
              title="Add Column"
            >
              <Plus className="h-4 w-4" />
              <span>Col</span>
            </button>
            <button
              onClick={handleDeleteRow}
              className="flex items-center space-x-1 px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm font-medium shadow-sm transition-all"
              title="Delete Selected Row"
            >
              <Trash2 className="h-4 w-4" />
              <span>Row</span>
            </button>
            <button
              onClick={handleDeleteColumn}
              className="flex items-center space-x-1 px-3 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-sm font-medium shadow-sm transition-all"
              title="Delete Selected Column"
            >
              <Trash2 className="h-4 w-4" />
              <span>Col</span>
            </button>
          </div>

          {/* Text Formatting Tools */}
          <div className="h-8 w-px bg-gray-300 dark:bg-gray-600"></div>
          
          <div className="flex items-center space-x-1">
            <button
              onClick={handleBold}
              className="px-2 py-2 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-all"
              title="Bold"
            >
              <Bold className="h-4 w-4" />
            </button>
            <button
              onClick={handleItalic}
              className="px-2 py-2 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-all"
              title="Italic"
            >
              <Italic className="h-4 w-4" />
            </button>
            <button
              onClick={handleUnderline}
              className="px-2 py-2 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-all"
              title="Underline"
            >
              <Underline className="h-4 w-4" />
            </button>
            
            <div className="relative" ref={fontSizeMenuRef}>
              <button
                onClick={() => setFontSizeMenuOpen(!fontSizeMenuOpen)}
                className="px-2 py-2 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-all flex items-center space-x-1"
                title="Font Size"
              >
                <Type className="h-4 w-4" />
                <span className="text-xs">{selectedFontSize}</span>
              </button>
              {fontSizeMenuOpen && (
                <div className="absolute left-0 mt-2 w-24 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-300 dark:border-gray-600 z-[9999] max-h-48 overflow-y-auto">
                  {[8, 9, 10, 11, 12, 14, 16, 18, 20, 24].map(size => (
                    <button
                      key={size}
                      onClick={() => handleFontSize(size)}
                      className={`w-full text-center px-3 py-1.5 text-sm transition-colors ${
                        selectedFontSize === size
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {/* Cell Color Picker */}
            <div className="relative" ref={colorPickerRef}>
              <button
                onClick={() => setColorPickerOpen(!colorPickerOpen)}
                className="px-2 py-2 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-all"
                title="Background Color"
              >
                <Palette className="h-4 w-4" />
              </button>
              {colorPickerOpen && (
                <div className="absolute left-0 mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border-2 border-gray-300 dark:border-gray-600 z-[9999] p-4">
                  <div className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Cell Background Color
                  </div>
                  <div className="grid grid-cols-5 gap-2 mb-3">
                    {['#ffffff', '#ffeb3b', '#ff9800', '#f44336', '#e91e63', 
                      '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4',
                      '#00bcd4', '#009688', '#4caf50', '#8bc34a', '#cddc39',
                      '#ffc107', '#ff5722', '#795548', '#9e9e9e', '#607d8b'].map(color => (
                      <button
                        key={color}
                        onClick={() => {
                          setSelectedColor(color);
                          handleCellColor(color);
                        }}
                        className="w-8 h-8 rounded border-2 border-gray-300 dark:border-gray-600 hover:scale-110 transition-transform"
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                  <div className="flex items-center space-x-2">
                    <label className="text-sm text-gray-600 dark:text-gray-400">Custom:</label>
                    <input
                      type="color"
                      value={selectedColor}
                      onChange={(e) => setSelectedColor(e.target.value)}
                      className="w-12 h-8 border rounded cursor-pointer"
                    />
                    <button
                      onClick={() => handleCellColor(selectedColor)}
                      className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Font Color Picker */}
            <div className="relative" ref={fontColorPickerRef}>
              <button
                onClick={() => setFontColorPickerOpen(!fontColorPickerOpen)}
                className="px-2 py-2 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-all flex items-center"
                title="Font Color"
              >
                <Type className="h-4 w-4" />
                <div className="w-4 h-1 absolute bottom-1 left-1/2 transform -translate-x-1/2" style={{ backgroundColor: selectedFontColor }}></div>
              </button>
              {fontColorPickerOpen && (
                <div className="absolute left-0 mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border-2 border-gray-300 dark:border-gray-600 z-[9999] p-4">
                  <div className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Font Color
                  </div>
                  <div className="grid grid-cols-5 gap-2 mb-3">
                    {['#000000', '#424242', '#757575', '#9e9e9e', '#ffffff',
                      '#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5',
                      '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50',
                      '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800'].map(color => (
                      <button
                        key={color}
                        onClick={() => {
                          setSelectedFontColor(color);
                          handleFontColor(color);
                        }}
                        className="w-8 h-8 rounded border-2 border-gray-300 dark:border-gray-600 hover:scale-110 transition-transform"
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                  <div className="flex items-center space-x-2">
                    <label className="text-sm text-gray-600 dark:text-gray-400">Custom:</label>
                    <input
                      type="color"
                      value={selectedFontColor}
                      onChange={(e) => setSelectedFontColor(e.target.value)}
                      className="w-12 h-8 border rounded cursor-pointer"
                    />
                    <button
                      onClick={() => handleFontColor(selectedFontColor)}
                      className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleAlignLeft}
              className="px-2 py-2 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-all"
              title="Align Left"
            >
              <AlignLeft className="h-4 w-4" />
            </button>
            <button
              onClick={handleAlignCenter}
              className="px-2 py-2 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-all"
              title="Align Center"
            >
              <AlignCenter className="h-4 w-4" />
            </button>
            <button
              onClick={handleAlignRight}
              className="px-2 py-2 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-all"
              title="Align Right"
            >
              <AlignRight className="h-4 w-4" />
            </button>
          </div>

          {/* Status indicators */}
          <div className="flex items-center space-x-3">
            {hasChanges && saveStatus !== 'saving' && (
              <span className="text-sm text-amber-600 dark:text-amber-400 flex items-center">
                <span className="inline-block w-2 h-2 bg-amber-600 rounded-full mr-2 animate-pulse"></span>
                Unsaved changes • Auto-save in 30s
              </span>
            )}
            
            {lastSavedAt && !hasChanges && (
              <span className="text-sm text-green-600 dark:text-green-400 flex items-center">
                <span className="inline-block w-2 h-2 bg-green-600 rounded-full mr-2"></span>
                Last saved: {lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Sheet tabs */}
      {sheets.length > 1 && (
        <div className="flex items-center space-x-1 px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 overflow-x-auto flex-shrink-0">
          {sheets.map((sheet, index) => (
            <button
              key={index}
              onClick={() => handleSheetChange(index)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeSheet === index
                  ? 'bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 border-t-2 border-blue-600'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {sheet}
            </button>
          ))}
        </div>
      )}

      {/* Spreadsheet grid */}
      <div className="flex-1 bg-white dark:bg-gray-900 overflow-auto relative" style={{ minHeight: '400px' }}>
        {/* Header Editing Overlay */}
        {editingHeaderIndex !== null && editingHeaderType && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 min-w-[400px]">
              <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">
                {editingHeaderType === 'col' ? 'Rename Column' : 'Rename Row'}
              </h3>
              <input
                type="text"
                value={editingHeaderValue}
                onChange={(e) => setEditingHeaderValue(e.target.value)}
                onKeyDown={handleHeaderKeyDown}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                placeholder={editingHeaderType === 'col' ? 'Column name' : 'Row label'}
                autoFocus
              />
              <div className="flex justify-end space-x-3 mt-4">
                <button
                  onClick={handleHeaderCancel}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleHeaderSave}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
        
        {(() => {
          if (data && data.length > 0) {
            console.log('✨ Rendering HotTable with', data.length, 'rows and', headers.length, 'columns');
            return (
              <div style={{ width: '100%', height: '100%', minHeight: '400px' }}>
                <HotTable
                  ref={hotTableRef}
                  readOnly={saveStatus === 'saving'}
                  data={data}
                  colHeaders={headers.length > 0 ? headers : true}
                  rowHeaders={true}
                  width="100%"
                  height="auto"
                  licenseKey="non-commercial-and-evaluation"
                  stretchH="all"
                  contextMenu={true}
                  manualColumnResize={true}
                  manualRowResize={true}
                  beforeChange={handleBeforeChange}
                  afterChange={handleDataChange}
                  afterSelection={handleAfterSelection}
                  afterOnCellMouseDown={(event: MouseEvent, coords: any) => {
                    // Handle double-click on column headers
                    if (event.detail === 2) { // double-click
                      const target = event.target as HTMLElement;
                      // Check if it's a column header
                      if (coords.row === -1 && coords.col >= 0) {
                        handleHeaderDoubleClick(coords.col, 'col');
                      }
                      // Check if it's a row header
                      else if (coords.row >= 0 && coords.col === -1) {
                        handleHeaderDoubleClick(coords.row, 'row');
                      }
                    }
                  }}
                  afterSetDataAtCell={() => markDirty()}
    minRows={20}
    minCols={headers.length > 0 ? headers.length : 5}
    className="htDark"
    afterCreateRow={handleAfterCreateRow}
    afterCreateCol={handleAfterCreateCol}
    afterRemoveRow={handleAfterRemoveRow}
    afterRemoveCol={handleAfterRemoveCol}
    cells={(row, col) => {
                    const cellProperties: any = {};
                    const cellKey = `${row}-${col}`;
                    const cellMeta = cellMetadata.get(cellKey);
                    
                    if (cellMeta) {
                      // Custom renderer to apply both className and inline styles
                      cellProperties.renderer = function(instance: any, td: HTMLTableCellElement, row: number, col: number, prop: any, value: any, cellProperties: any) {
                        // Call default text renderer
                        const Handsontable = (window as any).Handsontable;
                        if (Handsontable && Handsontable.renderers && Handsontable.renderers.TextRenderer) {
                          Handsontable.renderers.TextRenderer.apply(this, arguments);
                        } else {
                          td.innerHTML = value || '';
                        }
                        
                        // Apply className if present
                        if (cellMeta.className) {
                          td.className = td.className || '';
                          // Add our custom classes to existing classes
                          const existingClasses = td.className.split(' ').filter(c => c && !c.startsWith('ht'));
                          const newClasses = cellMeta.className.split(' ').filter((c: string) => c);
                          td.className = [...existingClasses, ...newClasses].join(' ');
                        }
                        
                        // Apply inline styles if present
                        if (cellMeta.style) {
                          Object.assign(td.style, cellMeta.style);
                        }
                        
                        return td;
                      };
                    }
                    return cellProperties;
                  }}
                />
              </div>
            );
          } else {
            console.log('⚠️ No data to display - showing placeholder');
            return (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500 dark:text-gray-400">No data to display. Click a cell to start editing.</p>
              </div>
            );
          }
        })()}
      </div>
    </div>
  );
};
