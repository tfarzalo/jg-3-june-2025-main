-- Allow internal users to edit phase-change reasons, including cancellation text.
-- Subcontractors are explicitly excluded.

DROP POLICY IF EXISTS "job_phase_changes_update_internal_users" ON public.job_phase_changes;

CREATE POLICY "job_phase_changes_update_internal_users"
ON public.job_phase_changes
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND COALESCE(p.role, '') <> 'subcontractor'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND COALESCE(p.role, '') <> 'subcontractor'
  )
);
