import React from 'react';
import { DivideIcon as LucideIcon } from 'lucide-react';

interface CardProps {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
  footer?: React.ReactNode;
  actions?: React.ReactNode;
}

export const Card = React.memo(({
  title,
  description,
  icon: Icon,
  children,
  className = '',
  footer,
  actions
}: CardProps) => {
  return (
    <div className={`bg-white dark:bg-[#1E293B] rounded-lg shadow-sm ${className}`}>
      {(title || description || Icon || actions) && (
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {Icon && <Icon className="h-5 w-5 text-gray-400" />}
              <div>
                {title && (
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {title}
                  </h3>
                )}
                {description && (
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {description}
                  </p>
                )}
              </div>
            </div>
            {actions && <div>{actions}</div>}
          </div>
        </div>
      )}
      <div className="p-6">{children}</div>
      {footer && (
        <div className="px-6 py-4 bg-gray-50 dark:bg-[#0F172A] border-t border-gray-200 dark:border-gray-700 rounded-b-lg">
          {footer}
        </div>
      )}
    </div>
  );
});

Card.displayName = 'Card';