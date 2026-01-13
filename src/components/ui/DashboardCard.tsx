import React from 'react';
import { Link } from 'react-router-dom';

interface DashboardCardProps {
  title: string;
  children: React.ReactNode;
  viewAllLink?: string;
  viewAllState?: any;
  actionButton?: React.ReactNode;
  titleColor?: string;
  titleWeight?: 'normal' | 'medium' | 'semibold' | 'bold';
  className?: string;
  phaseColor?: string;
  notation?: string;
}

export function DashboardCard({ 
  title, 
  children, 
  viewAllLink, 
  viewAllState,
  actionButton,
  titleColor = 'text-gray-900 dark:text-white',
  titleWeight = 'medium',
  className = '',
  phaseColor,
  notation
}: DashboardCardProps) {
  const weightClass = titleWeight === 'bold' ? 'font-bold' : titleWeight === 'semibold' ? 'font-semibold' : titleWeight === 'normal' ? 'font-normal' : 'font-medium';
  return (
    <div className={`h-full flex flex-col bg-white dark:bg-surface-dark rounded-xl overflow-hidden shadow-lg ${className}`}>
      {phaseColor && (
        <div 
          className="h-1 w-full"
          style={{ backgroundColor: phaseColor }}
        />
      )}
      <div className="px-6 py-4 flex items-center justify-between border-b border-gray-200 dark:border-border-dark">
        <div>
          {notation && <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-800 dark:text-gray-200 -mb-0.5">{notation}</div>}
          <h2 className={`${weightClass} ${titleColor}`}>{title}</h2>
        </div>
        <div className="flex items-center space-x-4">
          {actionButton}
          {viewAllLink && (
            <Link to={viewAllLink} state={viewAllState} className="text-sm text-gray-500 hover:text-gray-700 dark:text-text-muted-dark dark:hover:text-text-base-dark transition-colors">
              View All
            </Link>
          )}
        </div>
      </div>
      <div className="p-6 flex-1">
        {children}
      </div>
    </div>
  );
}
