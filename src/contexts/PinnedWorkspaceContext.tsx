import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useUserRole } from './UserRoleContext';

export type PinnedWorkspaceItemType = 'property' | 'job' | 'list';

export interface PinnedWorkspaceItem {
  id: string;
  type: PinnedWorkspaceItemType;
  title: string;
  subtitle?: string;
  route: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
  minimized: boolean;
  pinnedAt: number;
}

interface PinSummaryInput {
  id: string;
  type: PinnedWorkspaceItemType;
  title: string;
  subtitle?: string;
  route: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
}

interface PinnedWorkspaceContextValue {
  canUsePinnedWorkspace: boolean;
  pinnedItems: PinnedWorkspaceItem[];
  expandedItemId: string | null;
  pinSummary: (item: PinSummaryInput) => void;
  closePinnedItem: (itemId: string) => void;
  minimizePinnedItem: (itemId: string) => void;
  expandPinnedItem: (itemId: string) => void;
  isPinned: (itemId: string) => boolean;
}

const STORAGE_KEY = 'jg:pinned-workspace:v1';

const PinnedWorkspaceContext = createContext<PinnedWorkspaceContextValue | undefined>(undefined);

const getPinnedItemKey = (type: PinnedWorkspaceItemType, id: string) => `${type}:${id}`;

const readStoredItems = (): PinnedWorkspaceItem[] => {
  if (typeof window === 'undefined') return [];

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item): item is PinnedWorkspaceItem => (
      item &&
      typeof item.id === 'string' &&
      ['property', 'job', 'list'].includes(item.type) &&
      typeof item.title === 'string' &&
      typeof item.route === 'string'
    ));
  } catch (error) {
    console.warn('Unable to read pinned workspace items:', error);
    return [];
  }
};

export function PinnedWorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { isAdmin, isJGManagement, loading } = useUserRole();
  const canUsePinnedWorkspace = !loading && (isAdmin || isJGManagement);
  const [pinnedItems, setPinnedItems] = useState<PinnedWorkspaceItem[]>(() => readStoredItems());
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pinnedItems));
    } catch (error) {
      console.warn('Unable to store pinned workspace items:', error);
    }
  }, [pinnedItems]);

  const pinSummary = useCallback((item: PinSummaryInput) => {
    if (!canUsePinnedWorkspace) return;

    const itemKey = getPinnedItemKey(item.type, item.id);
    setPinnedItems(prev => {
      const existing = prev.find(pinnedItem => pinnedItem.id === itemKey);
      if (existing) {
        return prev.map(pinnedItem => pinnedItem.id === itemKey
          ? {
              ...pinnedItem,
              title: item.title,
              subtitle: item.subtitle,
              route: item.route,
              metadata: item.metadata,
              minimized: false,
            }
          : pinnedItem
        );
      }

      return [
        ...prev,
        {
          ...item,
          id: itemKey,
          minimized: false,
          pinnedAt: Date.now(),
        },
      ].slice(-6);
    });
    setExpandedItemId(itemKey);
  }, [canUsePinnedWorkspace]);

  const closePinnedItem = useCallback((itemId: string) => {
    setPinnedItems(prev => prev.filter(item => item.id !== itemId));
    setExpandedItemId(prev => prev === itemId ? null : prev);
  }, []);

  const minimizePinnedItem = useCallback((itemId: string) => {
    setPinnedItems(prev => prev.map(item => item.id === itemId ? { ...item, minimized: true } : item));
    setExpandedItemId(prev => prev === itemId ? null : prev);
  }, []);

  const expandPinnedItem = useCallback((itemId: string) => {
    setPinnedItems(prev => prev.map(item => item.id === itemId ? { ...item, minimized: false } : item));
    setExpandedItemId(itemId);
  }, []);

  const isPinned = useCallback((itemId: string) => {
    return pinnedItems.some(item => item.id === itemId);
  }, [pinnedItems]);

  const value = useMemo(() => ({
    canUsePinnedWorkspace,
    pinnedItems,
    expandedItemId,
    pinSummary,
    closePinnedItem,
    minimizePinnedItem,
    expandPinnedItem,
    isPinned,
  }), [
    canUsePinnedWorkspace,
    closePinnedItem,
    expandPinnedItem,
    expandedItemId,
    isPinned,
    minimizePinnedItem,
    pinSummary,
    pinnedItems,
  ]);

  return (
    <PinnedWorkspaceContext.Provider value={value}>
      {children}
    </PinnedWorkspaceContext.Provider>
  );
}

export function usePinnedWorkspace() {
  const context = useContext(PinnedWorkspaceContext);
  if (!context) {
    throw new Error('usePinnedWorkspace must be used within a PinnedWorkspaceProvider');
  }
  return context;
}
