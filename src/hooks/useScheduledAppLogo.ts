import { useEffect, useState } from 'react';

export const ORIGINAL_APP_LOGO_URL =
  'https://tbwtfimnbmvbgesidbxh.supabase.co/storage/v1/object/public/files/fb38963b-c67e-4924-860b-312045d19d2f/1750132407578_jg-logo-icon.png';

export const TEMPORARY_APP_LOGO_URL = `${import.meta.env.BASE_URL}jg-halloween-logo-2026.png`;

// Pacific time is explicit so the changeover is consistent for every user.
// Daylight saving time ends on November 1, 2026.
export const TEMPORARY_LOGO_START_AT = new Date('2026-10-29T00:00:00-07:00');
export const TEMPORARY_LOGO_END_AT = new Date('2026-11-02T00:00:00-08:00');

export function isTemporaryAppLogoActive(at: Date | number = Date.now()): boolean {
  const timestamp = typeof at === 'number' ? at : at.getTime();

  return (
    timestamp >= TEMPORARY_LOGO_START_AT.getTime() &&
    timestamp < TEMPORARY_LOGO_END_AT.getTime()
  );
}

export function getScheduledAppLogo(at: Date | number = Date.now()): string {
  return isTemporaryAppLogoActive(at) ? TEMPORARY_APP_LOGO_URL : ORIGINAL_APP_LOGO_URL;
}

export function useScheduledAppLogo(): string {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const boundaries = [
      TEMPORARY_LOGO_START_AT.getTime(),
      TEMPORARY_LOGO_END_AT.getTime(),
    ];
    const nextBoundary = boundaries.find((boundary) => boundary > now);

    if (!nextBoundary) return;

    const timer = window.setTimeout(
      () => setNow(Date.now()),
      Math.min(nextBoundary - now + 50, 2_147_483_647),
    );

    return () => window.clearTimeout(timer);
  }, [now]);

  return getScheduledAppLogo(now);
}
