import React from 'react';
import { DivideIcon as LucideIcon } from 'lucide-react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: LucideIcon;
  fullWidth?: boolean;
}

export const Input = React.memo(({
  label,
  error,
  icon: Icon,
  fullWidth,
  className = '',
  ...props
}: InputProps) => {
  const inputStyles = [
    'rounded-lg',
    'bg-white dark:bg-[#0F172A]',
    'border border-gray-300 dark:border-gray-600',
    'text-gray-900 dark:text-white',
    'focus:ring-2 focus:ring-blue-500 focus:border-transparent',
    'disabled:bg-gray-100 dark:disabled:bg-gray-800',
    'disabled:cursor-not-allowed',
    Icon && 'pl-10',
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
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
        )}
        <input className={inputStyles} {...props} />
      </div>
      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';