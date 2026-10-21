import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  canRunGlobalSearch,
  GLOBAL_SEARCH_MIN_LENGTH,
  normalizeGlobalSearchTerm,
} from '../src/lib/globalSearch';

const overlaySource = readFileSync(
  new URL('../src/components/SearchOverlay.tsx', import.meta.url),
  'utf8',
);
const migrationSource = readFileSync(
  new URL('../supabase/migrations/20261021000000_global_application_search.sql', import.meta.url),
  'utf8',
);

describe('global application search', () => {
  it('starts real-time searches after three normalized characters', () => {
    expect(GLOBAL_SEARCH_MIN_LENGTH).toBe(3);
    expect(canRunGlobalSearch('ab')).toBe(false);
    expect(canRunGlobalSearch('  A b  ')).toBe(true);
    expect(canRunGlobalSearch('WO-')).toBe(true);
    expect(normalizeGlobalSearchTerm('  Cedar   Ridge ')).toBe('Cedar Ridge');
  });

  it('uses a centralized endpoint while retaining a rolling-deployment fallback', () => {
    expect(overlaySource).toContain("supabase.rpc('global_search_v2'");
    expect(overlaySource).toContain('Centralized global search unavailable; using compatibility search.');
    expect(overlaySource).toContain('Enter at least {GLOBAL_SEARCH_MIN_LENGTH} characters');
  });

  it('keeps database row-level security authoritative', () => {
    expect(migrationSource).toContain('SECURITY INVOKER');
    expect(migrationSource).not.toContain('SECURITY DEFINER');
    expect(migrationSource).toContain('TO authenticated');
  });

  it('covers core entities and related contact information', () => {
    for (const entity of ['jobs', 'properties', 'work_orders', 'profiles', 'property_contacts', 'contacts', 'property_management_groups', 'files', 'activity_log']) {
      expect(migrationSource).toContain(`public.${entity}`);
    }
    expect(migrationSource).toContain("'subcontractor'");
    expect(migrationSource).toContain('purchase order');
    expect(migrationSource).toContain('property address');
  });

  it('adds indexes without modifying or deleting application records', () => {
    expect(migrationSource).toContain('CREATE INDEX IF NOT EXISTS');
    expect(migrationSource).not.toMatch(/\b(DELETE FROM|TRUNCATE|DROP TABLE|DROP COLUMN)\b/i);
  });
});
