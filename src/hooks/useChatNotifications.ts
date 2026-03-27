import { useEffect, useRef, useCallback } from 'react';

const BLINK_INTERVAL_MS = 1000;

/**
 * Manages browser-tab notifications for incoming chat messages:
 *   1. Soft synthesized "ding" sound via Web Audio API (no file dependency)
 *   2. Unread count badge in the tab title  →  "(3) App Name"
 *   3. Alternating tab title blink when the tab is backgrounded
 *
 * Pass `unreadCount` from UnreadMessagesContext and `isAnyWindowOpen` to
 * tell the hook whether the user is actively looking at chat right now.
 */
export function useChatNotifications(
  unreadCount: number,
  isAnyWindowOpen: boolean,
) {
  const originalTitle   = useRef(document.title);
  const blinkInterval   = useRef<ReturnType<typeof setInterval> | null>(null);
  const blinkState      = useRef(false);
  const prevUnread      = useRef(unreadCount);
  const audioCtx        = useRef<AudioContext | null>(null);
  const isTabFocused    = useRef(!document.hidden);

  // ── Capture the original title once on mount ────────────────────────────
  useEffect(() => {
    // Strip any leftover badge from a previous session (e.g. hot-reload)
    originalTitle.current = document.title.replace(/^\(\d+\)\s*/, '');
  }, []);

  // ── Track tab focus / visibility ─────────────────────────────────────────
  useEffect(() => {
    const onFocus      = () => { isTabFocused.current = true; };
    const onBlur       = () => { isTabFocused.current = false; };
    const onVisibility = () => { isTabFocused.current = !document.hidden; };

    window.addEventListener('focus', onFocus);
    window.addEventListener('blur',  onBlur);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur',  onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // ── Init AudioContext on first user gesture (browser autoplay policy) ────
  useEffect(() => {
    const init = () => {
      if (!audioCtx.current) {
        try {
          audioCtx.current = new (
            window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
          )();
        } catch {
          // Web Audio not available — sound silently disabled
        }
      }
    };
    window.addEventListener('click',   init, { once: true });
    window.addEventListener('keydown', init, { once: true });
    return () => {
      window.removeEventListener('click',   init);
      window.removeEventListener('keydown', init);
    };
  }, []);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopBlink();
      document.title = originalTitle.current;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const stopBlink = useCallback(() => {
    if (blinkInterval.current) {
      clearInterval(blinkInterval.current);
      blinkInterval.current = null;
    }
    blinkState.current = false;
  }, []);

  const playDing = useCallback(() => {
    try {
      const ctx = audioCtx.current;
      if (!ctx) return;
      if (ctx.state === 'suspended') void ctx.resume();

      // Soft 880 → 440 Hz triangle wave "ding", 350 ms
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.2);

      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    } catch {
      // Silently fail — tab blink + title badge still work
    }
  }, []);

  // ── React to unreadCount changes ──────────────────────────────────────────
  useEffect(() => {
    const prev = prevUnread.current;
    prevUnread.current = unreadCount;

    if (unreadCount === 0) {
      // All read — restore title and stop blinking
      stopBlink();
      document.title = originalTitle.current;
      return;
    }

    // Always keep the count badge up to date
    const baseTitle = originalTitle.current;
    document.title  = `(${unreadCount}) ${baseTitle}`;

    const newMessages = unreadCount > prev;

    if (newMessages) {
      // ① Play sound if tab is blurred OR window is not open
      if (!isTabFocused.current || !isAnyWindowOpen) {
        playDing();
      }

      // ② Start blinking only when tab is not focused
      if (!isTabFocused.current && !blinkInterval.current) {
        blinkInterval.current = setInterval(() => {
          blinkState.current = !blinkState.current;
          document.title = blinkState.current
            ? `💬 New Message`
            : `(${unreadCount}) ${baseTitle}`;
        }, BLINK_INTERVAL_MS);
      }
    }
  }, [unreadCount, isAnyWindowOpen, stopBlink, playDing]);

  // ── Stop blinking when tab regains focus ─────────────────────────────────
  useEffect(() => {
    const onFocus = () => {
      stopBlink();
      // Restore count badge (non-zero) or clean title (zero)
      document.title = unreadCount > 0
        ? `(${unreadCount}) ${originalTitle.current}`
        : originalTitle.current;
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [unreadCount, stopBlink]);
}
