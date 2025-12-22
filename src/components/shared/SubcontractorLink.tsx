import React from 'react';
import { Link } from 'react-router-dom';

interface SubcontractorLinkProps {
  subcontractorId: string;
  subcontractorName: string;
  className?: string;
  children?: React.ReactNode;
}

export function SubcontractorLink({ subcontractorId, subcontractorName, className = '', children }: SubcontractorLinkProps) {
  return (
    <Link
      to={`/dashboard/subcontractors/${subcontractorId}`}
      className={`text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors ${className}`}
    >
      {children || subcontractorName}
    </Link>
  );
}
