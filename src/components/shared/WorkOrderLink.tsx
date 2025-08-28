import React from 'react';
import { Link } from 'react-router-dom';

interface WorkOrderLinkProps {
  jobId: string;
  workOrderNum: number;
  className?: string;
  children?: React.ReactNode;
}

export function WorkOrderLink({ jobId, workOrderNum, className = '', children }: WorkOrderLinkProps) {
  const formattedNumber = `WO-${String(workOrderNum).padStart(6, '0')}`;
  
  return (
    <Link
      to={`/dashboard/jobs/${jobId}`}
      className={`text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors ${className}`}
    >
      {children || formattedNumber}
    </Link>
  );
}
