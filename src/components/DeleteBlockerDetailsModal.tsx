import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

type DeleteBlockerDetailsModalProps = {
  isOpen: boolean;
  title?: string;
  message: string;
  onClose: () => void;
};

const parseMessage = (message: string) => {
  const lines = message.split('\n').map(line => line.trim()).filter(Boolean);
  const heading = lines.find(line => !line.startsWith('-')) || 'Cannot delete this item';
  const sections: Array<{ title: string; items: string[] }> = [];
  let current: { title: string; items: string[] } | null = null;

  lines.slice(1).forEach(line => {
    if (line.startsWith('-')) {
      const item = line.replace(/^-\s*/, '').trim();
      if (!current) {
        current = { title: 'Blocking records', items: [] };
        sections.push(current);
      }
      current.items.push(item);
      return;
    }

    current = { title: line.replace(/:$/, ''), items: [] };
    sections.push(current);
  });

  if (sections.length === 0) {
    const firstItems = lines
      .filter(line => line !== heading)
      .map(line => line.replace(/^-\s*/, '').trim());
    sections.push({ title: 'Blocking records', items: firstItems });
  }

  return { heading, sections: sections.filter(section => section.items.length > 0 || section.title) };
};

export function DeleteBlockerDetailsModal({
  isOpen,
  title = 'Delete Blocked',
  message,
  onClose,
}: DeleteBlockerDetailsModalProps) {
  if (!isOpen) return null;

  const { heading, sections } = parseMessage(message);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-[#1E293B]">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-0.5 flex-shrink-0 rounded-full bg-red-100 p-2 text-red-600 dark:bg-red-900/30 dark:text-red-300">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{heading}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
          <div className="space-y-4">
            {sections.map((section, index) => (
              <div key={`${section.title}-${index}`} className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{section.title}</h4>
                {section.items.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {section.items.map((item, itemIndex) => (
                      <li key={`${item}-${itemIndex}`} className="rounded-md bg-white px-3 py-2 text-sm text-gray-700 shadow-sm dark:bg-[#0F172A] dark:text-gray-200">
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end border-t border-gray-200 bg-gray-50 px-6 py-4 dark:border-gray-700 dark:bg-gray-800/50">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
