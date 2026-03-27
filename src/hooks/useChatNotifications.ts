import { useEffect, useRef, useCallback } from 'react';

const BLINK_INTERVAL_MS  = 400;   // fast flash — more eye-catching
const SOUND_REPEAT_MS    = 8000;  // re-ring every 8 s while tab is backgrounded and unread > 0

// ── Favicon helpers ──────────────────────────────────────────────────────────

/** Returns the current <link rel="icon"> element, creating one if absent. */
function getFaviconEl(): HTMLLinkElement {
  let el = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!el) {
    el = document.createElement('link');
    el.rel = 'icon';
    document.head.appendChild(el);
  }
  return el;
}

/**
 * Draws a 32×32 canvas favicon and returns its data URI.
 * `type`:
 *   'green-dot'  — solid green circle (alert state)
 *   'badge'      — green circle with white count number
 */
function buildFaviconDataUri(type: 'green-dot' | 'badge', count?: number): string {
  const canvas = document.createElement('canvas');
  canvas.width  = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;

  // Green filled circle
  ctx.beginPath();
  ctx.arc(16, 16, 15, 0, Math.PI * 2);
  ctx.fillStyle = '#16a34a'; // Tailwind green-700
  ctx.fill();

  if (type === 'badge' && count !== undefined && count > 0) {
    const label = count > 99 ? '99+' : String(count);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${label.length > 2 ? 10 : 14}px sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 16, 17);
  }

  return canvas.toDataURL('image/png');
}

/**
 * Manages browser-tab notifications for incoming chat messages:
 *   1. Soft synthesized "ding" sound via Web Audio API (no file dependency)
 *   2. Unread count badge in the tab title  →  "(3) App Name"
 *   3. Favicon flashes green while the tab is backgrounded; shows a green
 *      badge with the unread count when the tab regains focus (until read)
 *
 * Notifications persist until the user actually reads the message
 * (i.e. `unreadCount` reaches 0 via `markAsRead`). Having a chat window
 * open in another tab does NOT clear notifications — only truly reading
 * the message does.
 *
 * `isAnyWindowOpen` is kept for API compatibility but is no longer used to
 * suppress notifications so that switching tabs doesn't silently swallow
 * the unread indicator.
 */
export function useChatNotifications(
  unreadCount: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _isAnyWindowOpen: boolean,
) {
  const originalTitle   = useRef(document.title);
  const originalFavicon = useRef<string>('');
  const blinkInterval   = useRef<ReturnType<typeof setInterval> | null>(null);
  const soundInterval   = useRef<ReturnType<typeof setInterval> | null>(null);
  const blinkState      = useRef(false);
  const prevUnread      = useRef(unreadCount);
  const audioCtx        = useRef<AudioContext | null>(null);
  const isTabFocused    = useRef(!document.hidden);

  // ── Capture the original title + favicon once on mount ─────────────────
  useEffect(() => {
    // Strip any leftover badge from a previous session (e.g. hot-reload)
    originalTitle.current = document.title.replace(/^\(\d+\)\s*/, '');
    originalFavicon.current = getFaviconEl().href;
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
      stopSoundRepeat();
      document.title = originalTitle.current;
      getFaviconEl().href = originalFavicon.current;
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
    // Restore original favicon immediately
    getFaviconEl().href = originalFavicon.current;
  }, []);

  const stopSoundRepeat = useCallback(() => {
    if (soundInterval.current) {
      clearInterval(soundInterval.current);
      soundInterval.current = null;
    }
  }, []);

  /**
   * Two-tone ascending chime: a quick low note followed immediately by a
   * higher note — noticeably louder and more distinct than the old soft ding.
   */
  const playChime = useCallback(() => {
    try {
      const ctx = audioCtx.current;
      if (!ctx) return;
      if (ctx.state === 'suspended') void ctx.resume();

      const now = ctx.currentTime;

      const playNote = (freq: number, startAt: number, duration: number) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sine'; // sine = cleaner, more bell-like than triangle
        osc.frequency.setValueAtTime(freq, startAt);

        gain.gain.setValueAtTime(0,    startAt);
        gain.gain.linearRampToValueAtTime(0.55, startAt + 0.01); // louder attack
        gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration);

        osc.start(startAt);
        osc.stop(startAt + duration);
      };

      // Low note → high note, 120 ms apart
      playNote(660, now,         0.45);  // E5
      playNote(880, now + 0.12,  0.45);  // A5
    } catch {
      // Silently fail — tab blink + title badge still work
    }
  }, []);

  // ── React to unreadCount changes ──────────────────────────────────────────
  useEffect(() => {
    const prev = prevUnread.current;
    prevUnread.current = unreadCount;

    if (unreadCount === 0) {
      // All read — restore title, favicon, and stop blinking + sound repeat
      stopBlink();
      stopSoundRepeat();
      document.title          = originalTitle.current;
      getFaviconEl().href     = originalFavicon.current;
      return;
    }

    // Always keep the count badge up to date
    const baseTitle = originalTitle.current;
    document.title  = `(${unreadCount}) ${baseTitle}`;

    const newMessages = unreadCount > prev;

    if (newMessages) {
      // ① Play chime only when the tab is backgrounded — the user isn't
      //    looking at the screen, so a sound is warranted regardless of
      //    whether a chat window is technically "open". Having a chat window
      //    open in another tab does NOT count as "reading" the message.
      if (!isTabFocused.current) {
        playChime();

        // ② Keep re-ringing every SOUND_REPEAT_MS while the tab stays hidden
        if (!soundInterval.current) {
          soundInterval.current = setInterval(() => {
            if (!isTabFocused.current) {
              playChime();
            } else {
              stopSoundRepeat();
            }
          }, SOUND_REPEAT_MS);
        }
      }

      // ③ Start fast-blinking only when tab is not focused
      if (!isTabFocused.current && !blinkInterval.current) {
        const greenDot   = buildFaviconDataUri('green-dot');
        const faviconEl  = getFaviconEl();

        blinkInterval.current = setInterval(() => {
          blinkState.current = !blinkState.current;
          if (blinkState.current) {
            document.title    = `� NEW MESSAGE`;
            faviconEl.href    = greenDot;
          } else {
            document.title    = `(${unreadCount}) ${baseTitle}`;
            faviconEl.href    = originalFavicon.current;
          }
        }, BLINK_INTERVAL_MS);
      }
    }
  }, [unreadCount, stopBlink, stopSoundRepeat, playChime]);

  // ── Stop blinking + sound repeat when tab regains focus ──────────────────
  useEffect(() => {
    const onFocus = () => {
      stopBlink();
      stopSoundRepeat();
      const faviconEl = getFaviconEl();
      if (unreadCount > 0) {
        // Show green badge with count on the favicon; keep count in title
        document.title   = `(${unreadCount}) ${originalTitle.current}`;
        faviconEl.href   = buildFaviconDataUri('badge', unreadCount);
      } else {
        document.title   = originalTitle.current;
        faviconEl.href   = originalFavicon.current;
      }
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [unreadCount, stopBlink, stopSoundRepeat]);
}
