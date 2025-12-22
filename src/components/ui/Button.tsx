import React from 'react';
import { DivideIcon as LucideIcon } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: LucideIcon;
  loading?: boolean;
  fullWidth?: boolean;
}

export const Button = React.memo(({
  children,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  loading,
  fullWidth,
  className = '',
  disabled,
  ...props
}: ButtonProps) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors';
  
  const variantStyles = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-blue-400 dark:bg-blue-600 dark:hover:bg-blue-700 dark:text-white dark:disabled:bg-blue-800',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-800 disabled:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200 dark:disabled:bg-gray-800',
    danger: 'bg-red-600 hover:bg-red-700 text-white disabled:bg-red-400 dark:bg-red-600 dark:hover:bg-red-700 dark:text-white dark:disabled:bg-red-800',
    ghost: 'hover:bg-gray-100 text-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg'
  };

  const styles = [
    baseStyles,
    variantStyles[variant],
    sizeStyles[size],
    fullWidth && 'w-full',
    disabled && 'opacity-50 cursor-not-allowed',
    className
  ].filter(Boolean).join(' ');

  return (
    <button
      className={styles}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
      ) : (
        <>
          {Icon && <Icon className={`h-4 w-4 ${children ? 'mr-2' : ''}`} />}
          {children}
        </>
      )}
    </button>
  );
});

Button.displayName = 'Button';