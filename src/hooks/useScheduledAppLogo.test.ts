import { describe, expect, it } from 'vitest';
import {
  ORIGINAL_APP_LOGO_URL,
  TEMPORARY_APP_LOGO_URL,
  getScheduledAppLogo,
  isTemporaryAppLogoActive,
} from './useScheduledAppLogo';

describe('scheduled app logo', () => {
  it('uses the original logo before the campaign starts', () => {
    const date = new Date('2026-10-28T23:59:59.999-07:00');

    expect(isTemporaryAppLogoActive(date)).toBe(false);
    expect(getScheduledAppLogo(date)).toBe(ORIGINAL_APP_LOGO_URL);
  });

  it('uses the temporary logo throughout November 1 in Pacific time', () => {
    const date = new Date('2026-11-01T23:59:59.999-08:00');

    expect(isTemporaryAppLogoActive(date)).toBe(true);
    expect(getScheduledAppLogo(date)).toBe(TEMPORARY_APP_LOGO_URL);
  });

  it('reverts at midnight Pacific time on November 2', () => {
    const date = new Date('2026-11-02T00:00:00-08:00');

    expect(isTemporaryAppLogoActive(date)).toBe(false);
    expect(getScheduledAppLogo(date)).toBe(ORIGINAL_APP_LOGO_URL);
  });
});
