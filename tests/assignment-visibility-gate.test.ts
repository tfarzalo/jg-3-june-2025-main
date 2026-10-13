import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('../supabase/migrations/20261012000000_gate_subcontractor_jobs_until_assignment_email.sql', import.meta.url),
  'utf8',
);
const sender = readFileSync(
  new URL('../supabase/functions/send-assignment-notifications/index.ts', import.meta.url),
  'utf8',
);
const dashboard = readFileSync(
  new URL('../src/components/SubcontractorDashboard.tsx', import.meta.url),
  'utf8',
);
const compatibilityMigration = readFileSync(
  new URL('../supabase/migrations/20261012100000_finalize_assignment_from_sent_notification.sql', import.meta.url),
  'utf8',
);

describe('subcontractor assignment visibility gate', () => {
  it('resets finalized visibility whenever the assignment revision changes', () => {
    expect(migration).toContain('NEW.assigned_to IS DISTINCT FROM OLD.assigned_to');
    expect(migration).toContain('NEW.assigned_at IS DISTINCT FROM OLD.assigned_at');
    expect(migration).toContain('NEW.assignment_notification_sent_at := NULL');
  });

  it('releases only an exact current pending assignment revision', () => {
    expect(migration).toContain('j.assigned_to = n.subcontractor_id');
    expect(migration).toContain('j.assigned_at = n.assignment_assigned_at');
    expect(migration).toContain("j.assignment_status = 'pending'");
    expect(migration).toContain('RAISE EXCEPTION');
  });

  it('starts the response deadline when the notification is sent', () => {
    expect(migration).toContain('assignment_deadline = public.calculate_assignment_deadline(p_sent_at)');
  });

  it('enforces finalized visibility in jobs RLS for subcontractors', () => {
    expect(migration).toContain('public.is_internal_admin_user()');
    expect(migration).toContain('assigned_to = auth.uid()');
    expect(migration).toContain('assignment_notification_sent_at IS NOT NULL');
    expect(migration).toContain("AND cmd = 'UPDATE'");
    expect(migration).toContain('CREATE POLICY "jobs_update_finalized_assignment"');
    expect(migration).toContain('CREATE POLICY "jobs_insert_internal_only"');
  });

  it('finalizes only after the email provider reports success', () => {
    const providerSuccess = sender.indexOf('if (!response.ok || !emailResult.success)');
    const finalizeCall = sender.indexOf("'finalize_job_assignment_notifications'");
    expect(providerSuccess).toBeGreaterThan(-1);
    expect(finalizeCall).toBeGreaterThan(providerSuccess);
  });

  it('also filters administrator dashboard previews to finalized assignments', () => {
    expect(dashboard).toContain(".not('assignment_notification_sent_at', 'is', null)");
  });

  it('supports deployed senders that mark the notification row sent directly', () => {
    expect(compatibilityMigration).toContain("NEW.status = 'sent'");
    expect(compatibilityMigration).toContain('j.assigned_to = NEW.subcontractor_id');
    expect(compatibilityMigration).toContain('j.assigned_at = NEW.assignment_assigned_at');
    expect(compatibilityMigration).toContain("j.assignment_status = 'pending'");
  });
});
