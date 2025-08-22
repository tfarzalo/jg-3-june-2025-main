import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface SubcontractorPreviewContextType {
  previewUserId: string | null;
}

const SubcontractorPreviewContext = createContext<SubcontractorPreviewContextType>({
  previewUserId: null
});

export function SubcontractorPreviewProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const previewUserId = queryParams.get('userId');

  return (
    <SubcontractorPreviewContext.Provider value={{ previewUserId }}>
      {children}
    </SubcontractorPreviewContext.Provider>
  );
}

export function useSubcontractorPreview() {
  const context = useContext(SubcontractorPreviewContext);
  if (context === undefined) {
    throw new Error('useSubcontractorPreview must be used within a SubcontractorPreviewProvider');
  }
  return context;
} 