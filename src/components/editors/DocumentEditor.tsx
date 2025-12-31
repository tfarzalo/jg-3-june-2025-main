import React, { useState, useEffect, useRef } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import mammoth from 'mammoth';
import { Buffer } from 'buffer';
import { Save, Download, Type, X, Edit2, Check, FileDown } from 'lucide-react';
import { saveAs } from 'file-saver';

// Polyfill Buffer for html-to-docx in browser environment
if (typeof window !== 'undefined') {
  window.Buffer = window.Buffer || Buffer;
}

interface DocumentEditorProps {
  fileUrl: string;
  fileName: string;
  fileType: string;
  onSave: (content: string | Blob | Buffer, mimeType?: string) => Promise<void>;
  onClose: () => void;
  onChangesDetected?: (hasChanges: boolean) => void;
  onRename?: (newName: string) => Promise<void>;
}

export const DocumentEditor: React.FC<DocumentEditorProps> = ({
  fileUrl,
  fileName,
  fileType,
  onSave,
  onClose,
  onChangesDetected,
  onRename
}) => {
  console.log('📄 DocumentEditor mounted with:', { fileUrl, fileName, fileType });
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [hasChanges, setHasChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wordCount, setWordCount] = useState(0);
  const [isEditingFileName, setIsEditingFileName] = useState(false);
  const [editedFileName, setEditedFileName] = useState(fileName);
  const [isRenamingFile, setIsRenamingFile] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const quillRef = useRef<ReactQuill>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const fileNameInputRef = useRef<HTMLInputElement>(null);
  const isMountedRef = useRef(true);
  const lastChangeRef = useRef<number>(0);
  const saveStartRef = useRef<number>(0);

  useEffect(() => {
    isMountedRef.current = true;
    loadDocument();
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      isMountedRef.current = false;
    };
  }, [fileUrl]);

  // Close export dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setExportMenuOpen(false);
      }
    };

    if (exportMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [exportMenuOpen]);

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
    // Cleanup timer on unmount or dependency change
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasChanges, saveStatus]);

  useEffect(() => {
    // Update word count
    const text = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const words = text ? text.split(' ').length : 0;
    setWordCount(words);
  }, [content]);

  // Keep local filename state in sync when parent updates it (e.g., after rename)
  useEffect(() => {
    setEditedFileName(fileName);
  }, [fileName]);

  const loadDocument = async () => {
    try {
      setLoading(true);
      setError(null);
      setHasChanges(false);
      setLastSavedAt(null);
      onChangesDetected?.(false);

      console.log('📄 Loading document:', { fileName, fileType, fileUrl });

      const cacheBustUrl = fileUrl.includes('?') ? `${fileUrl}&_t=${Date.now()}` : `${fileUrl}?_t=${Date.now()}`;
      const response = await fetch(cacheBustUrl, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch document: ${response.status} ${response.statusText}`);
      }

      const normalizedFileType = (fileType || '').toLowerCase();
      const contentTypeHeader = response.headers.get('content-type')?.toLowerCase() || normalizedFileType;
      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const textDecoder = new TextDecoder();
      const decodedSnippet = textDecoder.decode(uint8Array.slice(0, 800)).trim();
      let decodedText: string | null = null;
      const getDecodedText = () => {
        if (decodedText === null) {
          decodedText = textDecoder.decode(arrayBuffer);
        }
        return decodedText;
      };

      const isPKZip = uint8Array[0] === 0x50 && uint8Array[1] === 0x4B;
      const looksLikeHtml =
        contentTypeHeader.includes('html') ||
        fileName.toLowerCase().endsWith('.html') ||
        /^<!doctype html/i.test(decodedSnippet) ||
        /^<html/i.test(decodedSnippet) ||
        decodedSnippet.toLowerCase().startsWith('<p') ||
        decodedSnippet.toLowerCase().startsWith('<div') ||
        decodedSnippet.toLowerCase().includes('<body');
      
      // Handle various document formats
      if (
        isPKZip &&
        (normalizedFileType.includes('docx') || normalizedFileType.includes('word') || normalizedFileType.includes('officedocument') || fileName.toLowerCase().endsWith('.docx'))
      ) {
        // Modern Word documents (.docx)
        console.log('📗 Loading DOCX file with mammoth');
        const result = await mammoth.convertToHtml({ arrayBuffer });
        setContent(result.value || '<p></p>');

        if (result.messages.length > 0) {
          console.warn('DOCX conversion warnings:', result.messages);
        }
        console.log('✅ DOCX loaded successfully');
      } else if (normalizedFileType.includes('msword') || fileName.toLowerCase().endsWith('.doc')) {
        // Legacy Word documents (.doc)
        console.log('📘 Loading legacy DOC file');
        console.warn('⚠️ Legacy .doc format has limited support. For best results, convert to .docx');

        if (isPKZip) {
          // It's actually a DOCX file, use mammoth
          try {
            const result = await mammoth.convertToHtml({ arrayBuffer });
            setContent(result.value || '<p></p>');
            console.log('✅ DOC loaded as DOCX via mammoth');
          } catch (error) {
            console.error('❌ Error loading DOCX:', error);
            throw new Error('Failed to load document. Please ensure the file is not corrupted.');
          }
        } else {
          // True legacy .doc file - show helpful message
          console.warn('⚠️ True legacy .doc format detected');
          setContent(`
            <div style="background: #fff3cd; border: 2px solid #ffc107; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #856404; margin-top: 0;">⚠️ Legacy Word Format (.doc)</h3>
              <p style="color: #856404;">
                This file is in the legacy Microsoft Word format (.doc) which cannot be edited in web browsers.
              </p>
              <p style="color: #856404;">
                <strong>To edit this document:</strong>
              </p>
              <ol style="color: #856404;">
                <li>Download the file using the download button above</li>
                <li>Open it in Microsoft Word</li>
                <li>Save As → Select "Word Document (.docx)"</li>
                <li>Upload the new .docx file here</li>
              </ol>
              <p style="color: #856404;">
                <strong>Alternative:</strong> You can also save as .txt for plain text editing.
              </p>
            </div>
          `);
        }
      } else if (
        normalizedFileType.includes('docx') ||
        normalizedFileType.includes('word') ||
        normalizedFileType.includes('officedocument') ||
        fileName.toLowerCase().endsWith('.docx')
      ) {
        console.warn('⚠️ DOCX extension without ZIP signature - treating as HTML/plain content');
        const fullHtml = getDecodedText();
        const bodyMatch = fullHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        const htmlBody = bodyMatch ? bodyMatch[1] : fullHtml;
        setContent((htmlBody || '<p></p>').trim());
      } else if (looksLikeHtml) {
        console.log('🧩 Loading HTML content directly');
        const fullHtml = getDecodedText();
        const bodyMatch = fullHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        const htmlBody = bodyMatch ? bodyMatch[1] : fullHtml;
        setContent((htmlBody || '<p></p>').trim());
      } else if (normalizedFileType.includes('text') || normalizedFileType.includes('plain') || fileName.toLowerCase().endsWith('.txt')) {
        // Plain text files (.txt)
        console.log('📝 Loading TXT file');
        const text = getDecodedText();
        setContent(`<p>${text.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`);
        console.log('✅ TXT loaded successfully');
      } else if (fileName.toLowerCase().endsWith('.rtf')) {
        // Rich Text Format - basic support
        console.log('📋 Loading RTF file');
        const text = getDecodedText();
        // Strip RTF formatting codes and extract text
        const plainText = text
          .replace(/\\[a-z]{1,32}(-?\d{1,10})?[ ]?|\\'[0-9a-f]{2}|\\([^a-z])|([{}])|[\r\n]+/gi, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        setContent(`<p>${plainText.replace(/\n/g, '</p><p>')}</p>`);
        console.log('✅ RTF loaded successfully');
      } else if (fileName.toLowerCase().endsWith('.md') || fileName.toLowerCase().endsWith('.markdown')) {
        // Markdown - convert to HTML-like structure
        console.log('📝 Loading Markdown file');
        const text = getDecodedText();
        // Basic markdown to HTML conversion
        let html = text
          .replace(/^### (.+)$/gm, '<h3>$1</h3>')
          .replace(/^## (.+)$/gm, '<h2>$1</h2>')
          .replace(/^# (.+)$/gm, '<h1>$1</h1>')
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.+?)\*/g, '<em>$1</em>')
          .replace(/\n\n/g, '</p><p>')
          .replace(/\n/g, '<br>');
        setContent(`<p>${html}</p>`);
        console.log('✅ Markdown loaded successfully');
      } else if (fileName.toLowerCase().endsWith('.pages')) {
        // Apple Pages - typically a package, show notice
        console.warn('⚠️ Apple Pages format detected');
        setContent(`
          <div style="background: #d1ecf1; border: 2px solid #0c5460; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #0c5460; margin-top: 0;">🍎 Apple Pages Format</h3>
            <p style="color: #0c5460;">
              This file is in Apple Pages format, which is a proprietary package format that cannot be directly edited in a web browser.
            </p>
            <p style="color: #0c5460;">
              <strong>To edit this document:</strong>
            </p>
            <ol style="color: #0c5460;">
              <li>Download the file using the download button above</li>
              <li>Open it in Apple Pages (on Mac or iOS)</li>
              <li>Go to File → Export To → Word (.docx)</li>
              <li>Upload the exported .docx file here</li>
            </ol>
            <p style="color: #0c5460;">
              <strong>Alternative:</strong> You can also export as PDF for viewing, or TXT for plain text editing.
            </p>
          </div>
        `);
      } else if (fileName.toLowerCase().endsWith('.odt')) {
        // OpenDocument Text - try to load it
        console.log('📄 Loading ODT file');
        try {
          // ODT files are ZIP archives, similar to DOCX
          // For now, show a helpful message
          setContent(`
            <div style="background: #e8f5e9; border: 2px solid #4caf50; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #2e7d32; margin-top: 0;">📄 OpenDocument Format (.odt)</h3>
              <p style="color: #2e7d32;">
                This file is in OpenDocument Text format (.odt), which has limited support in web browsers.
              </p>
              <p style="color: #2e7d32;">
                <strong>Recommended approach:</strong>
              </p>
              <ol style="color: #2e7d32;">
                <li>Download the file using the download button above</li>
                <li>Open it in LibreOffice, Google Docs, or Microsoft Word</li>
                <li>Save As → Word Document (.docx)</li>
                <li>Upload the .docx file here for full editing support</li>
              </ol>
              <p style="color: #2e7d32;">
                <strong>Note:</strong> ODT files can be opened in most modern word processors including LibreOffice (free) and Microsoft Word.
              </p>
            </div>
          `);
        } catch (error) {
          console.error('❌ Error loading ODT:', error);
          throw new Error('Failed to load ODT file. Please convert to DOCX format.');
        }
      } else {
        // Unknown format - provide basic editing
        const text = getDecodedText();
        setContent(`<p>${text.substring(0, 1000)}${text.length > 1000 ? '...' : ''}</p><p><em>Document format not fully supported. Basic text editing available.</em></p>`);
      }
      
      if (isMountedRef.current) {
        setLoading(false);
      }
    } catch (err) {
      console.error('❌ Error loading document:', err);
      console.error('Error details:', {
        message: err instanceof Error ? err.message : 'Unknown error',
        fileName,
        fileType,
        fileUrl: fileUrl.substring(0, 100) + '...'
      });
      if (isMountedRef.current) {
        setError(`Failed to load document: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setLoading(false);
      }
    }
  };

  const handleContentChange = (value: string) => {
    setContent(value);
    setHasChanges(true);
    if (onChangesDetected) {
      onChangesDetected(true);
    }
  };

  const handleSave = async () => {
    if (saveStatus === 'saving') return;
    if (!hasChanges) return;

    try {
      setSaveStatus('saving');
      saveStartRef.current = Date.now();
      setError(null);
      
      let contentToSave: string | Blob | Buffer = content;
      let mimeType = 'text/html';
      
      const buildFullHtml = (inner: string) => `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${fileName}</title><style>body{font-family:Arial,sans-serif;line-height:1.6;color:#000}table{width:100%;border-collapse:collapse}img{max-width:100%;height:auto}h1,h2,h3{margin:.5em 0}p{margin:.5em 0}</style></head><body>${inner}</body></html>`;
      
      const sanitizeHtml = (html: string) => {
        return html
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/\son\w+="[^"]*"/gi, '')
          .replace(/\son\w+='[^']*'/gi, '');
      };
      
      const normalizedFileType = (fileType || '').toLowerCase();
      const isDocx = normalizedFileType.includes('docx') || 
                     normalizedFileType.includes('word') || 
                     normalizedFileType.includes('officedocument') || 
                     fileName.toLowerCase().endsWith('.docx');
      
      // Prepare the save promise
      const performSave = async () => {
        if (isDocx) {
           const fullHtml = buildFullHtml(content);
           try {
             // @ts-ignore
             const { default: HTMLtoDOCX } = await import('html-to-docx');
             const fileBuffer = await HTMLtoDOCX(fullHtml, null, {
               table: { row: { cantSplit: true } },
               footer: true,
               pageNumber: true,
             });
             contentToSave = new Blob([fileBuffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
             mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
           } catch {
             const sanitized = buildFullHtml(sanitizeHtml(content));
             try {
               // @ts-ignore
               const { default: HTMLtoDOCX } = await import('html-to-docx');
               const fileBuffer = await HTMLtoDOCX(sanitized, null, {
                 table: { row: { cantSplit: true } },
                 footer: true,
                 pageNumber: true,
               });
               contentToSave = new Blob([fileBuffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
               mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
             } catch {
               const plain = sanitizeHtml(content)
                 .replace(/<[^>]*>/g, '\n')
                 .replace(/\n{3,}/g, '\n\n')
                 .trim();
               const { Document, Packer, Paragraph } = await import('docx');
               const paragraphs = plain.split(/\n{2,}/).map((p) => new (Paragraph as any)(p));
               const doc = new (Document as any)({ sections: [{ properties: {}, children: paragraphs }] });
               const blob = await (Packer as any).toBlob(doc);
               contentToSave = blob;
               mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
             }
           }
        } else if (fileName.toLowerCase().endsWith('.txt')) {
           mimeType = 'text/plain';
           contentToSave = content.replace(/<[^>]*>/g, '\n').replace(/\n+/g, '\n').trim();
        }

        await onSave(contentToSave, mimeType);
      };

      // Execute save with timeout wrapper
      await withTimeout(performSave(), 30000, "Save operation");
      
      if (!isMountedRef.current) return;
      
      // Success handling
      setHasChanges(false);
      lastChangeRef.current = Date.now();
      setLastSavedAt(new Date());
      if (onChangesDetected) {
        onChangesDetected(false);
      }
      setSaveStatus('saved');
      
      // Optional: Schedule return to idle
      setTimeout(() => {
        if (isMountedRef.current && saveStatus === 'saved') {
          setSaveStatus('idle');
        }
      }, 2000);
      
    } catch (err) {
      console.error('Error saving document:', err);
      if (isMountedRef.current) {
        setError('Failed to save document. Please try again.');
        setSaveStatus('error');
      }
    } finally {
       // Safety net
       if (isMountedRef.current) {
         setSaveStatus(prev => {
            if (prev === 'saving') return 'idle';
            return prev;
         });
       }
    }
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

  // Filename editing handlers
  const handleFileNameClick = () => {
    if (onRename) {
      setIsEditingFileName(true);
      setEditedFileName(fileName);
      setTimeout(() => fileNameInputRef.current?.select(), 0);
    }
  };

  const handleFileNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditedFileName(e.target.value);
  };

  const handleFileNameSave = async () => {
    if (!editedFileName.trim() || editedFileName === fileName) {
      setIsEditingFileName(false);
      setEditedFileName(fileName);
      return;
    }

    const trimmed = editedFileName.trim();

    // Validation: No spaces
    if (/\s/.test(trimmed)) {
      alert('File names cannot contain spaces');
      setEditedFileName(fileName);
      return;
    }

    // Validation: Extension must match
    const oldExt = fileName.split('.').pop()?.toLowerCase();
    const newExt = trimmed.split('.').pop()?.toLowerCase();
    if (oldExt && oldExt !== newExt) {
      alert(`Cannot change file extension from .${oldExt} to .${newExt}`);
      setEditedFileName(fileName);
      return;
    }

    try {
      setIsRenamingFile(true);
      if (onRename) {
        await onRename(trimmed);
        console.log('✅ File renamed to:', trimmed);
      }
      setIsEditingFileName(false);
    } catch (error) {
      console.error('❌ Error renaming file:', error);
      setError('Failed to rename file. Please try again.');
      setEditedFileName(fileName);
      setIsEditingFileName(false);
    } finally {
      setIsRenamingFile(false);
    }
  };

  const handleFileNameCancel = () => {
    setIsEditingFileName(false);
    setEditedFileName(fileName);
  };

  const handleFileNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleFileNameSave();
    } else if (e.key === 'Escape') {
      handleFileNameCancel();
    }
  };

  const handleExportDocx = async () => {
    try {
      console.log('🔄 Exporting to DOCX using html-to-docx...');
      // @ts-ignore
      const { default: HTMLtoDOCX } = await import('html-to-docx');
      const fileBuffer = await HTMLtoDOCX(content, null, {
        table: { row: { cantSplit: true } },
        footer: true,
        pageNumber: true,
      });
      const blob = new Blob([fileBuffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      saveAs(blob, fileName.replace(/\.[^/.]+$/, '.docx'));
    } catch (err) {
      console.error('Error exporting to DOCX:', err);
      setError('Failed to export document.');
    }
  };

  const handleExportTxt = () => {
    const text = content.replace(/<[^>]*>/g, '\n').replace(/\n+/g, '\n').trim();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, fileName.replace(/\.[^/.]+$/, '.txt'));
  };

  const handleExportPdf = () => {
    // Basic browser print as PDF for now, can be enhanced with jspdf if needed
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('Please allow popups to export as PDF');
        return;
    }
    
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${fileName}</title>
  <style>
    @page {
      size: 8.5in 11in;
      margin: 0.5in;
    }
    html, body {
      width: 100%;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: black;
      /* Add padding to body to simulate margin if @page is ignored by some browsers */
      padding: 0.5in;
      box-sizing: border-box;
    }
    @media print {
      body { 
        -webkit-print-color-adjust: exact;
        width: 100%; 
        /* Reset padding for print if @page works, but keep as fallback */
        padding: 0;
        margin: 0;
      }
      /* Ensure content container respects the print margins */
      .content-wrapper {
         width: 100%;
      }
    }
    /* Ensure images and content fit within the page */
    img { max-width: 100%; height: auto; }
    table { width: 100%; border-collapse: collapse; }
  </style>
</head>
<body>
  <div class="content-wrapper">
    ${content}
  </div>
  <script>
    window.onload = function() {
      // Small delay to ensure resources load
      setTimeout(function() {
        window.print();
        window.close();
      }, 500);
    }
  </script>
</body>
</html>`;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handleExportHtml = () => {
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${fileName}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 800px;
      margin: 40px auto;
      padding: 20px;
      line-height: 1.6;
    }
  </style>
</head>
<body>
  ${content}
</body>
</html>`;
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    saveAs(blob, fileName.replace(/\.[^/.]+$/, '.html'));
  };

  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
      [{ 'font': [] }],
      [{ 'size': ['small', false, 'large', 'huge'] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'script': 'sub'}, { 'script': 'super' }],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'indent': '-1'}, { 'indent': '+1' }],
      [{ 'align': [] }],
      ['blockquote', 'code-block'],
      ['link', 'image'],
      ['clean']
    ]
  };

  const formats = [
    'header', 'font', 'size',
    'bold', 'italic', 'underline', 'strike',
    'color', 'background',
    'script',
    'list', 'bullet', 'indent',
    'align',
    'blockquote', 'code-block',
    'link', 'image'
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading document...</p>
        </div>
      </div>
    );
  }

  if (error) {
    // Check if it's the specific compatibility warning
    const isWarning = error.includes('compatibility mode');
    
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className={isWarning ? "text-amber-600 dark:text-amber-400 font-medium" : "text-red-600 dark:text-red-400"}>
            {error}
          </p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            {isWarning ? "Continue" : "Close"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden rounded-xl shadow-2xl bg-white dark:bg-gray-900 relative">
      {/* Error/Warning Banner - Non-blocking */}
      {error && (
        <div className="absolute top-14 left-0 right-0 z-50 px-4 transition-all duration-300 ease-in-out">
          <div className={`border px-4 py-3 rounded relative shadow-md flex items-center justify-between ${
            error.includes('compatibility mode') 
              ? 'bg-amber-50 border-amber-200 text-amber-800' 
              : 'bg-red-100 border-red-400 text-red-700'
          }`}>
            <div className="flex items-center">
              <strong className="font-bold mr-2">{error.includes('compatibility mode') ? 'Note:' : 'Error:'}</strong>
              <span className="block sm:inline">{error}</span>
            </div>
            <button 
              onClick={() => setError(null)}
              className={`ml-4 p-1 rounded transition-colors ${
                error.includes('compatibility mode')
                  ? 'hover:bg-amber-100 text-amber-600'
                  : 'hover:bg-red-200 text-red-600'
              }`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* File Name Header - Now includes X button */}
      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center justify-between">
        <div className="flex items-center flex-1 min-w-0">
          <span className="text-lg mr-2">📄</span>
          {isEditingFileName ? (
            <div className="flex items-center flex-1 space-x-2">
              <input
                ref={fileNameInputRef}
                type="text"
                value={editedFileName}
                onChange={handleFileNameChange}
                onKeyDown={handleFileNameKeyDown}
                onBlur={handleFileNameSave}
                className="flex-1 px-2 py-1 text-lg font-semibold bg-white dark:bg-gray-700 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 dark:text-gray-200"
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
        <div className="flex items-center space-x-3 flex-wrap gap-y-2">
          <button
            onClick={handleSave}
            disabled={!hasChanges || saveStatus === 'saving'}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors shadow-md ${
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
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium shadow-md transition-all"
            >
              <Download className="h-4 w-4" />
              <span>Export</span>
            </button>
            {exportMenuOpen && (
              <div className="absolute left-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border-2 border-gray-300 dark:border-gray-600 z-[9999] overflow-hidden">
                <button
                  onClick={() => {
                    handleExportDocx();
                    setExportMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-blue-50 dark:hover:bg-gray-700 text-sm font-medium rounded-t-lg flex items-center space-x-3 border-b border-gray-200 dark:border-gray-700 transition-colors"
                >
                  <FileDown className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-gray-100">Export as DOCX</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Word document format</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    handleExportPdf();
                    setExportMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-red-50 dark:hover:bg-gray-700 text-sm font-medium flex items-center space-x-3 border-b border-gray-200 dark:border-gray-700 transition-colors"
                >
                  <FileDown className="h-5 w-5 text-red-600 dark:text-red-400" />
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-gray-100">Export as PDF</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Portable Document Format</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    handleExportHtml();
                    setExportMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-green-50 dark:hover:bg-gray-700 text-sm font-medium flex items-center space-x-3 border-b border-gray-200 dark:border-gray-700 transition-colors"
                >
                  <FileDown className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-gray-100">Export as HTML</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Web format with styling</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    handleExportTxt();
                    setExportMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium rounded-b-lg flex items-center space-x-3 transition-colors"
                >
                  <FileDown className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-gray-100">Export as TXT</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Plain text only</div>
                  </div>
                </button>
              </div>
            )}
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

        <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-center space-x-2">
            <Type className="h-4 w-4" />
            <span>{wordCount} words</span>
          </div>
        </div>
      </div>

      {/* Editor - Force Light Mode for the "Paper" feel */}
      <div className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-900">
        <div className="max-w-[816px] mx-auto py-8 px-4 w-full"> {/* A4 width approx */}
          <div className="rounded-none md:rounded-lg border border-gray-200 shadow-xl bg-white text-black min-h-[1056px]">
            <style>{`
              .ql-container.ql-snow { border: none !important; }
              .ql-toolbar.ql-snow { 
                background: #f3f4f6; 
                border: none !important; 
                border-bottom: 1px solid #e5e7eb !important;
                position: sticky;
                top: 0;
                z-index: 10;
              }
              .dark .ql-toolbar.ql-snow {
                background: #1f2937;
                border-bottom: 1px solid #374151 !important;
              }
              .dark .ql-toolbar.ql-snow .ql-stroke { stroke: #e5e7eb; }
              .dark .ql-toolbar.ql-snow .ql-fill { fill: #e5e7eb; }
              .dark .ql-toolbar.ql-snow .ql-picker { color: #e5e7eb; }
              
              /* Force editor content to be light mode text on white background */
              .ql-editor {
                color: black !important;
                background-color: white !important;
                min-height: 1000px;
                padding: 40px 60px; /* Word-like padding */
                font-size: 11pt;
                line-height: 1.5;
              }
              .ql-editor p { margin-bottom: 1em; }
            `}</style>
            <ReactQuill
              ref={quillRef}
              value={content}
              onChange={handleContentChange}
              modules={modules}
              formats={formats}
              theme="snow"
              className="h-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
