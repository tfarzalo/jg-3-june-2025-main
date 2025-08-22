import React from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: Array<{ value: string; label: string }>;
  fullWidth?: boolean;
}

export const Select = React.memo(({
  label,
  error,
  options,
  fullWidth,
  className = '',
  ...props
}: SelectProps) => {
  const selectStyles = [
    'rounded-lg',
    'bg-white dark:bg-[#0F172A]',
    'border border-gray-300 dark:border-gray-600',
    'text-gray-900 dark:text-white',
    'focus:ring-2 focus:ring-blue-500 focus:border-transparent',
    'disabled:bg-gray-100 dark:disabled:bg-gray-800',
    'disabled:cursor-not-allowed',
    fullWidth && 'w-full',
    error && 'border-red-500 focus:ring-red-500',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={fullWidth ? 'w-full' : ''}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label}
        </label>
      )}
      <select className={selectStyles} {...props}>
        {options.map(({ value, label }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
});

Select.displayName = 'Select';