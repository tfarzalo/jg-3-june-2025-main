import React, { useState } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { Code, Eye } from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  showVariableHelper?: boolean;
  variables?: Array<{ variable: string; description: string }>;
  height?: string;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Enter your content here...',
  showVariableHelper = false,
  variables = [],
  height = '400px'
}: RichTextEditorProps) {
  const [showHtmlEditor, setShowHtmlEditor] = useState(false);
  const [htmlValue, setHtmlValue] = useState(value);

  // Quill editor modules configuration
  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'indent': '-1'}, { 'indent': '+1' }],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'align': [] }],
      ['link'],
      ['clean']
    ],
  };

  const formats = [
    'header',
    'bold', 'italic', 'underline', 'strike',
    'list', 'bullet', 'indent',
    'color', 'background',
    'align',
    'link'
  ];

  const handleHtmlToggle = () => {
    if (showHtmlEditor) {
      // Switching from HTML to visual
      onChange(htmlValue);
    } else {
      // Switching from visual to HTML
      setHtmlValue(value);
    }
    setShowHtmlEditor(!showHtmlEditor);
  };

  const handleHtmlChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setHtmlValue(newValue);
    onChange(newValue);
  };

  const insertVariable = (variable: string) => {
    const newValue = value + ` ${variable}`;
    onChange(newValue);
  };

  return (
    <div className="rich-text-editor">
      {/* Editor Mode Toggle */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleHtmlToggle}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
              showHtmlEditor
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {showHtmlEditor ? <Eye className="h-4 w-4" /> : <Code className="h-4 w-4" />}
            {showHtmlEditor ? 'Visual Editor' : 'HTML Editor'}
          </button>
        </div>

        {/* Variable Helper */}
        {showVariableHelper && variables.length > 0 && (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Click to insert:
            {variables.slice(0, 3).map((v) => (
              <button
                key={v.variable}
                type="button"
                onClick={() => insertVariable(v.variable)}
                className="ml-2 px-2 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-xs font-mono"
                title={v.description}
              >
                {v.variable}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Editor */}
      {showHtmlEditor ? (
        <div className="border border-gray-300 dark:border-gray-600 rounded-md overflow-hidden">
          <textarea
            value={htmlValue}
            onChange={handleHtmlChange}
            className="w-full px-3 py-2 font-mono text-sm dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{ height, resize: 'vertical' }}
            placeholder="Enter HTML code here..."
          />
        </div>
      ) : (
        <div 
          className="rich-text-editor-quill border border-gray-300 dark:border-gray-600 rounded-md overflow-hidden"
          style={{ height }}
        >
          <ReactQuill
            theme="snow"
            value={value}
            onChange={onChange}
            modules={modules}
            formats={formats}
            placeholder={placeholder}
            style={{ height: `calc(${height} - 42px)` }}
          />
        </div>
      )}

      {/* Custom Styles for Quill in Dark Mode */}
      <style>{`
        .dark .ql-toolbar {
          background-color: #374151;
          border-color: #4b5563;
        }
        
        .dark .ql-toolbar button {
          color: #e5e7eb;
        }
        
        .dark .ql-toolbar button:hover {
          color: #ffffff;
        }
        
        .dark .ql-toolbar .ql-stroke {
          stroke: #e5e7eb;
        }
        
        .dark .ql-toolbar .ql-fill {
          fill: #e5e7eb;
        }
        
        .dark .ql-toolbar button:hover .ql-stroke {
          stroke: #ffffff;
        }
        
        .dark .ql-toolbar button:hover .ql-fill {
          fill: #ffffff;
        }
        
        .dark .ql-container {
          background-color: #1f2937;
          border-color: #4b5563;
          color: #e5e7eb;
        }
        
        .dark .ql-editor.ql-blank::before {
          color: #9ca3af;
        }
        
        .dark .ql-editor {
          color: #e5e7eb;
        }
        
        .dark .ql-picker-label {
          color: #e5e7eb;
        }
        
        .dark .ql-picker-options {
          background-color: #374151;
          border-color: #4b5563;
        }
        
        .dark .ql-picker-item {
          color: #e5e7eb;
        }
        
        .dark .ql-picker-item:hover {
          color: #ffffff;
        }
        
        /* Ensure editor takes full height */
        .rich-text-editor-quill .ql-container {
          height: 100%;
        }
      `}</style>
    </div>
  );
}
