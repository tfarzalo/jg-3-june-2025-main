import { useEffect, useCallback } from 'react';

export function useUnsavedChangesPrompt(
  hasChanges: boolean,
  onSave?: () => Promise<void> | void
) {
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!hasChanges) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasChanges]);

  const attemptNavigate = useCallback(
    async (proceed: () => void) => {
      if (!hasChanges) {
        proceed();
        return;
      }
      const save = window.confirm('You have unsaved changes. Save before leaving?');
      if (save) {
        try {
          if (onSave) await onSave();
          proceed();
        } catch {
        }
        return;
      }
      const discard = window.confirm('Discard unsaved changes?');
      if (discard) {
        proceed();
      }
    },
    [hasChanges, onSave]
  );

  return { attemptNavigate };
}
