import React from 'react';
import { Link } from 'react-router-dom';

interface PropertyLinkProps {
  propertyId: string;
  propertyName: string;
  className?: string;
  children?: React.ReactNode;
}

export function PropertyLink({ propertyId, propertyName, className = '', children }: PropertyLinkProps) {
  return (
    <Link
      to={`/dashboard/properties/${propertyId}`}
      className={`text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors ${className}`}
    >
      {children || propertyName}
    </Link>
  );
}
