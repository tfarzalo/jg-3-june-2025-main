import React from 'react';
import { Link } from 'react-router-dom';

interface DashboardCardProps {
  title: string;
  children: React.ReactNode;
  viewAllLink?: string;
  actionButton?: React.ReactNode;
  titleColor?: string;
  className?: string;
  phaseColor?: string;
}

export function DashboardCard({ 
  title, 
  children, 
  viewAllLink, 
  actionButton,
  titleColor = 'text-gray-900 dark:text-white',
  className = '',
  phaseColor
}: DashboardCardProps) {
  return (
    <div className={`bg-white dark:bg-surface-dark rounded-xl overflow-hidden shadow-lg ${className}`}>
      {phaseColor && (
        <div 
          className="h-1 w-full"
          style={{ backgroundColor: phaseColor }}
        />
      )}
      <div className="px-6 py-4 flex items-center justify-between border-b border-gray-200 dark:border-border-dark">
        <h2 className={`font-medium ${titleColor}`}>{title}</h2>
        <div className="flex items-center space-x-4">
          {actionButton}
          {viewAllLink && (
            <Link to={viewAllLink} className="text-sm text-gray-500 hover:text-gray-700 dark:text-text-muted-dark dark:hover:text-text-base-dark transition-colors">
              View All
            </Link>
          )}
        </div>
      </div>
      <div className="p-6">
        {children}
      </div>
    </div>
  );
}